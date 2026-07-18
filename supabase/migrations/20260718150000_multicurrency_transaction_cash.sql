begin;

create or replace function public.ensure_transaction_cash_asset(
  p_user_id uuid,
  p_currency text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'EUR'));
  desired_ticker text;
  cash_asset_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;
  if normalized_currency !~ '^[A-Z]{3}$' then
    raise exception 'Unsupported cash currency';
  end if;

  desired_ticker := case
    when normalized_currency = 'EUR' then 'CASH'
    else 'CASH-' || normalized_currency
  end;

  -- Serialize creation per user and currency without broadening the asset table's
  -- uniqueness rules for existing non-cash tickers.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || desired_ticker, 0)
  );

  select id into cash_asset_id
  from public.activos
  where user_id = p_user_id and ticker = desired_ticker
  order by created_at, id
  limit 1;

  if cash_asset_id is null then
    insert into public.activos (
      user_id, ticker, nombre, tipo, estrategia, moneda
    ) values (
      p_user_id,
      desired_ticker,
      case when normalized_currency = 'EUR' then 'Efectivo' else 'Efectivo ' || normalized_currency end,
      'Fondo Monetario',
      'Core',
      normalized_currency
    ) returning id into cash_asset_id;
  end if;

  return cash_asset_id;
end;
$$;

create or replace function public.create_transaction_with_cash(
  p_transaction jsonb,
  p_cash_operation text default null,
  p_cash_amount numeric default null
)
returns public.transacciones
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_asset public.activos;
  source_transaction public.transacciones;
  cash_asset_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select * into source_asset
  from public.activos
  where id = (p_transaction->>'activo_id')::uuid
    and user_id = current_user_id;

  if source_asset.id is null then
    raise exception 'Asset not found or not authorized';
  end if;

  if p_transaction->>'tipo_operacion' not in (
    'Compra', 'Venta', 'Dividendo', 'Traspaso Salida',
    'Traspaso Entrada', 'Retirada'
  ) then raise exception 'Unsupported transaction operation'; end if;

  if coalesce(p_transaction->>'estado', 'Completada') not in ('Completada', 'Pendiente') then
    raise exception 'Unsupported transaction state';
  end if;

  if coalesce((p_transaction->>'cantidad')::numeric, 0) < 0
    or coalesce((p_transaction->>'precio_unitario')::numeric, 0) < 0
    or coalesce((p_transaction->>'comision')::numeric, 0) < 0
    or coalesce((p_transaction->>'retencion_origen')::numeric, 0) < 0
    or coalesce((p_transaction->>'retencion_destino')::numeric, 0) < 0
  then raise exception 'Transaction amounts cannot be negative'; end if;

  insert into public.transacciones (
    user_id, activo_id, tipo_operacion, cantidad, precio_unitario,
    comision, retencion_origen, retencion_destino, estado, fecha, notas
  ) values (
    current_user_id,
    source_asset.id,
    p_transaction->>'tipo_operacion',
    coalesce((p_transaction->>'cantidad')::numeric, 0),
    coalesce((p_transaction->>'precio_unitario')::numeric, 0),
    coalesce((p_transaction->>'comision')::numeric, 0),
    coalesce((p_transaction->>'retencion_origen')::numeric, 0),
    coalesce((p_transaction->>'retencion_destino')::numeric, 0),
    coalesce(p_transaction->>'estado', 'Completada'),
    (p_transaction->>'fecha')::date,
    nullif(p_transaction->>'notas', '')
  ) returning * into source_transaction;

  if p_cash_operation in ('Compra', 'Venta')
    and p_cash_amount > 0
    and source_asset.ticker not like 'CASH%'
  then
    cash_asset_id := public.ensure_transaction_cash_asset(current_user_id, source_asset.moneda);

    insert into public.transacciones (
      user_id, activo_id, tipo_operacion, cantidad, precio_unitario,
      comision, retencion_origen, retencion_destino, estado, fecha,
      notas, linked_transaction_id
    ) values (
      current_user_id, cash_asset_id, p_cash_operation, p_cash_amount, 1,
      0, 0, 0, source_transaction.estado, source_transaction.fecha,
      format(
        '[Auto-Cash:%s] Auto-liquidez de %s %s',
        source_transaction.id, source_transaction.tipo_operacion, source_asset.ticker
      ),
      source_transaction.id
    );
  end if;

  return source_transaction;
end;
$$;

create or replace function public.update_transaction_with_cash(
  p_transaction_id uuid,
  p_transaction jsonb,
  p_cash_operation text default null,
  p_cash_amount numeric default null
)
returns public.transacciones
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_transaction public.transacciones;
  source_asset public.activos;
  cash_transaction_id uuid;
  cash_asset_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  if p_transaction->>'tipo_operacion' not in (
    'Compra', 'Venta', 'Dividendo', 'Traspaso Salida',
    'Traspaso Entrada', 'Retirada'
  ) then raise exception 'Unsupported transaction operation'; end if;

  if coalesce(p_transaction->>'estado', 'Completada') not in ('Completada', 'Pendiente') then
    raise exception 'Unsupported transaction state';
  end if;

  if coalesce((p_transaction->>'cantidad')::numeric, 0) < 0
    or coalesce((p_transaction->>'precio_unitario')::numeric, 0) < 0
    or coalesce((p_transaction->>'comision')::numeric, 0) < 0
    or coalesce((p_transaction->>'retencion_origen')::numeric, 0) < 0
    or coalesce((p_transaction->>'retencion_destino')::numeric, 0) < 0
  then raise exception 'Transaction amounts cannot be negative'; end if;

  select * into source_asset
  from public.activos
  where id = (p_transaction->>'activo_id')::uuid
    and user_id = current_user_id;
  if source_asset.id is null then
    raise exception 'Asset not found or not authorized';
  end if;

  update public.transacciones
  set
    activo_id = source_asset.id,
    tipo_operacion = p_transaction->>'tipo_operacion',
    cantidad = coalesce((p_transaction->>'cantidad')::numeric, 0),
    precio_unitario = coalesce((p_transaction->>'precio_unitario')::numeric, 0),
    comision = coalesce((p_transaction->>'comision')::numeric, 0),
    retencion_origen = coalesce((p_transaction->>'retencion_origen')::numeric, 0),
    retencion_destino = coalesce((p_transaction->>'retencion_destino')::numeric, 0),
    estado = coalesce(p_transaction->>'estado', 'Completada'),
    fecha = (p_transaction->>'fecha')::date,
    notas = nullif(p_transaction->>'notas', '')
  where id = p_transaction_id
    and user_id = current_user_id
    and linked_transaction_id is null
  returning * into updated_transaction;

  if updated_transaction.id is null then
    raise exception 'Transaction not found or not authorized';
  end if;

  select id into cash_transaction_id
  from public.transacciones
  where linked_transaction_id = updated_transaction.id
    and user_id = current_user_id;

  if p_cash_operation in ('Compra', 'Venta')
    and p_cash_amount > 0
    and source_asset.ticker not like 'CASH%'
  then
    cash_asset_id := public.ensure_transaction_cash_asset(current_user_id, source_asset.moneda);
    if cash_transaction_id is null then
      insert into public.transacciones (
        user_id, activo_id, tipo_operacion, cantidad, precio_unitario,
        comision, retencion_origen, retencion_destino, estado, fecha,
        notas, linked_transaction_id
      ) values (
        current_user_id, cash_asset_id, p_cash_operation, p_cash_amount, 1,
        0, 0, 0, updated_transaction.estado, updated_transaction.fecha,
        format(
          '[Auto-Cash:%s] Auto-liquidez de %s %s',
          updated_transaction.id, updated_transaction.tipo_operacion, source_asset.ticker
        ),
        updated_transaction.id
      );
    else
      update public.transacciones
      set activo_id = cash_asset_id,
          tipo_operacion = p_cash_operation,
          cantidad = p_cash_amount,
          estado = updated_transaction.estado,
          fecha = updated_transaction.fecha
      where id = cash_transaction_id;
    end if;
  elsif cash_transaction_id is not null then
    delete from public.transacciones where id = cash_transaction_id;
  end if;

  return updated_transaction;
end;
$$;

revoke all on function public.ensure_transaction_cash_asset(uuid, text) from public, anon;
revoke all on function public.create_transaction_with_cash(jsonb, text, numeric) from public, anon;
revoke all on function public.update_transaction_with_cash(uuid, jsonb, text, numeric) from public, anon;
grant execute on function public.ensure_transaction_cash_asset(uuid, text) to authenticated;
grant execute on function public.create_transaction_with_cash(jsonb, text, numeric) to authenticated;
grant execute on function public.update_transaction_with_cash(uuid, jsonb, text, numeric) to authenticated;

commit;
