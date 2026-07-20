begin;

alter table public.transacciones
  add column if not exists tipo_cambio_eur numeric;

comment on column public.transacciones.tipo_cambio_eur is
  'Tipo histÃ³rico expresado como unidades de la moneda del activo por 1 EUR; queda fijado para valorar el flujo en su fecha.';

-- EUR transactions need no external lookup and can be frozen immediately.
update public.transacciones transaction
set tipo_cambio_eur = 1
from public.activos asset
where asset.id = transaction.activo_id
  and asset.moneda = 'EUR'
  and transaction.tipo_cambio_eur is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transacciones_tipo_cambio_eur_check'
      and conrelid = 'public.transacciones'::regclass
  ) then
    alter table public.transacciones
      add constraint transacciones_tipo_cambio_eur_check
      check (tipo_cambio_eur is null or tipo_cambio_eur > 0) not valid;
  end if;
end $$;

alter table public.transacciones
  validate constraint transacciones_tipo_cambio_eur_check;

commit;
