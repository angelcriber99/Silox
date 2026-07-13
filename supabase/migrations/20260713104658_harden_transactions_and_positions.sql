begin;

-- A transaction created to mirror the cash impact points to its source.
alter table public.transacciones
  add column if not exists linked_transaction_id uuid,
  add column if not exists retencion_origen numeric default 0,
  add column if not exists retencion_destino numeric default 0;

alter table public.transacciones
  drop constraint if exists transacciones_linked_transaction_id_fkey;

alter table public.transacciones
  add constraint transacciones_linked_transaction_id_fkey
  foreign key (linked_transaction_id)
  references public.transacciones(id)
  on delete cascade;

create unique index if not exists idx_transacciones_linked_transaction
  on public.transacciones(linked_transaction_id)
  where linked_transaction_id is not null;

create index if not exists idx_transacciones_user_estado_created
  on public.transacciones(user_id, estado, created_at desc);

-- Normalize the only supported state spelling before enforcing it.
update public.transacciones
set estado = 'Pendiente'
where lower(coalesce(estado, '')) = 'pendiente';

update public.transacciones
set estado = 'Completada'
where estado is null or lower(estado) = 'completada';

alter table public.transacciones
  alter column estado set default 'Completada',
  alter column estado set not null;

alter table public.transacciones
  drop constraint if exists transacciones_estado_check;

alter table public.transacciones
  add constraint transacciones_estado_check
  check (estado in ('Completada', 'Pendiente'));

-- Backfill links written by the legacy [Auto-Cash:<uuid>] note convention.
with raw_tagged_cash as (
  select
    cash.id as cash_id,
    cash.user_id,
    cash.created_at,
    (regexp_match(
      cash.notas,
      '\[Auto-Cash:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]'
    ))[1]::uuid as source_id
  from public.transacciones cash
  where cash.linked_transaction_id is null
    and cash.notas ~ '\[Auto-Cash:[0-9a-fA-F-]{36}\]'
), tagged_cash as (
  select *, row_number() over (
    partition by user_id, source_id
    order by created_at, cash_id
  ) as link_rank
  from raw_tagged_cash
)
update public.transacciones cash
set linked_transaction_id = tagged.source_id
from tagged_cash tagged
join public.transacciones source
  on source.id = tagged.source_id
 and source.user_id = tagged.user_id
where cash.id = tagged.cash_id
  and tagged.link_rank = 1;

-- Collapse any legacy duplicate CASH assets before enforcing uniqueness.
with ranked_cash as (
  select
    id,
    first_value(id) over (
      partition by user_id
      order by created_at, id
    ) as canonical_id,
    row_number() over (
      partition by user_id
      order by created_at, id
    ) as row_number
  from public.activos
  where ticker = 'CASH'
), duplicate_cash as (
  select id, canonical_id
  from ranked_cash
  where row_number > 1
)
update public.transacciones tx
set activo_id = duplicate.canonical_id
from duplicate_cash duplicate
where tx.activo_id = duplicate.id;

with ranked_cash as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at, id
    ) as row_number
  from public.activos
  where ticker = 'CASH'
)
delete from public.activos asset
using ranked_cash duplicate
where asset.id = duplicate.id
  and duplicate.row_number > 1;

-- One canonical cash asset per user. Existing rows retain their history.
update public.activos
set tipo = 'Liquidez', estrategia = 'Liquidez', moneda = 'EUR'
where ticker = 'CASH';

create unique index if not exists idx_activos_one_cash_per_user
  on public.activos(user_id)
  where ticker = 'CASH';

-- Confirmed positions are the accounting source of truth. Pending orders are
-- queried separately and may be presented as a projection by the UI.
drop view if exists public.posiciones;

create view public.posiciones
with (security_invoker = true)
as
select
  a.user_id,
  a.id as activo_id,
  a.ticker,
  a.isin,
  a.nombre,
  a.tipo,
  a.estrategia,
  a.moneda,
  a.sector,
  a.geografia,
  a.notas,
  coalesce(sum(
    case
      when t.tipo_operacion in ('Compra', 'Traspaso Entrada') then t.cantidad
      when t.tipo_operacion in ('Venta', 'Traspaso Salida', 'Retirada') then -t.cantidad
      else 0
    end
  ), 0) as unidades,
  coalesce(sum(
    case
      when t.tipo_operacion in ('Compra', 'Traspaso Entrada')
        then t.cantidad * t.precio_unitario
      when t.tipo_operacion in ('Venta', 'Traspaso Salida', 'Retirada')
        then -(t.cantidad * t.precio_unitario)
      else 0
    end
  ), 0) as coste_total,
  coalesce(sum(t.comision), 0) as comisiones_total,
  count(t.id) as num_operaciones,
  max(t.fecha) as ultima_operacion
from public.activos a
left join public.transacciones t
  on t.activo_id = a.id
 and t.estado = 'Completada'
group by
  a.user_id,
  a.id,
  a.ticker,
  a.isin,
  a.nombre,
  a.tipo,
  a.estrategia,
  a.moneda,
  a.sector,
  a.geografia,
  a.notas;

grant select on public.posiciones to authenticated;

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
    and source_asset.ticker <> 'CASH'
  then
    select id into cash_asset_id
    from public.activos
    where user_id = current_user_id and ticker = 'CASH'
    limit 1;

    if cash_asset_id is null then
      insert into public.activos (
        user_id, ticker, nombre, tipo, estrategia, moneda
      ) values (
        current_user_id, 'CASH', 'Efectivo', 'Liquidez', 'Liquidez', 'EUR'
      )
      on conflict (user_id) where ticker = 'CASH' do nothing
      returning id into cash_asset_id;

      if cash_asset_id is null then
        select id into cash_asset_id
        from public.activos
        where user_id = current_user_id and ticker = 'CASH'
        limit 1;
      end if;
    end if;

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
  cash_transaction_id uuid;
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

  update public.transacciones
  set
    activo_id = (p_transaction->>'activo_id')::uuid,
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
    and exists (
      select 1 from public.activos asset
      where asset.id = (p_transaction->>'activo_id')::uuid
        and asset.user_id = current_user_id
    )
  returning * into updated_transaction;

  if updated_transaction.id is null then
    raise exception 'Transaction not found or not authorized';
  end if;

  select id into cash_transaction_id
  from public.transacciones
  where linked_transaction_id = updated_transaction.id
    and user_id = current_user_id;

  if cash_transaction_id is not null then
    if p_cash_operation in ('Compra', 'Venta') and p_cash_amount > 0 then
      update public.transacciones
      set tipo_operacion = p_cash_operation,
          cantidad = p_cash_amount,
          estado = updated_transaction.estado,
          fecha = updated_transaction.fecha
      where id = cash_transaction_id;
    else
      delete from public.transacciones where id = cash_transaction_id;
    end if;
  end if;

  return updated_transaction;
end;
$$;

create or replace function public.create_fund_transfer(
  p_source_transaction jsonb,
  p_destination_transaction jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_transaction public.transacciones;
  destination_transaction public.transacciones;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  if p_source_transaction->>'tipo_operacion' <> 'Traspaso Salida'
    or p_destination_transaction->>'tipo_operacion' <> 'Traspaso Entrada'
  then raise exception 'Invalid transfer operations'; end if;

  if not exists (
    select 1 from public.activos
    where id = (p_source_transaction->>'activo_id')::uuid
      and user_id = current_user_id
  ) or not exists (
    select 1 from public.activos
    where id = (p_destination_transaction->>'activo_id')::uuid
      and user_id = current_user_id
  ) then raise exception 'Transfer asset not found or not authorized'; end if;

  if (p_source_transaction->>'cantidad')::numeric <= 0
    or (p_source_transaction->>'precio_unitario')::numeric <= 0
    or (p_destination_transaction->>'cantidad')::numeric <= 0
    or (p_destination_transaction->>'precio_unitario')::numeric <= 0
  then raise exception 'Transfer quantities and prices must be positive'; end if;

  if abs(
    (p_source_transaction->>'cantidad')::numeric
      * (p_source_transaction->>'precio_unitario')::numeric
    - (p_destination_transaction->>'cantidad')::numeric
      * (p_destination_transaction->>'precio_unitario')::numeric
  ) > 0.01 then raise exception 'Transfer legs must have the same value'; end if;

  insert into public.transacciones (
    user_id, activo_id, tipo_operacion, cantidad, precio_unitario,
    comision, retencion_origen, retencion_destino, estado, fecha, notas
  ) values (
    current_user_id,
    (p_source_transaction->>'activo_id')::uuid,
    'Traspaso Salida',
    (p_source_transaction->>'cantidad')::numeric,
    (p_source_transaction->>'precio_unitario')::numeric,
    coalesce((p_source_transaction->>'comision')::numeric, 0),
    0, 0, 'Completada',
    (p_source_transaction->>'fecha')::date,
    nullif(p_source_transaction->>'notas', '')
  ) returning * into source_transaction;

  insert into public.transacciones (
    user_id, activo_id, tipo_operacion, cantidad, precio_unitario,
    comision, retencion_origen, retencion_destino, estado, fecha, notas
  ) values (
    current_user_id,
    (p_destination_transaction->>'activo_id')::uuid,
    'Traspaso Entrada',
    (p_destination_transaction->>'cantidad')::numeric,
    (p_destination_transaction->>'precio_unitario')::numeric,
    coalesce((p_destination_transaction->>'comision')::numeric, 0),
    0, 0, 'Completada',
    (p_destination_transaction->>'fecha')::date,
    nullif(p_destination_transaction->>'notas', '')
  ) returning * into destination_transaction;

  return jsonb_build_object(
    'source', to_jsonb(source_transaction),
    'destination', to_jsonb(destination_transaction)
  );
end;
$$;

revoke all on function public.create_transaction_with_cash(jsonb, text, numeric) from public, anon;
revoke all on function public.update_transaction_with_cash(uuid, jsonb, text, numeric) from public, anon;
revoke all on function public.create_fund_transfer(jsonb, jsonb) from public, anon;
grant execute on function public.create_transaction_with_cash(jsonb, text, numeric) to authenticated;
grant execute on function public.update_transaction_with_cash(uuid, jsonb, text, numeric) to authenticated;
grant execute on function public.create_fund_transfer(jsonb, jsonb) to authenticated;

commit;
