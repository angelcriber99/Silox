begin;

-- The previous view subtracted sale proceeds from purchase consideration.
-- That is net cash flow, not the acquisition cost of the units still open.
-- Consume completed lots FIFO and retain purchase commissions in their basis.
create or replace view public.posiciones
with (security_invoker = true)
as
with confirmed as (
  select
    t.id,
    t.activo_id,
    t.tipo_operacion,
    t.cantidad,
    t.precio_unitario,
    coalesce(t.comision, 0) as comision,
    t.fecha,
    t.created_at
  from public.transacciones t
  where t.estado = 'Completada'
), position_totals as (
  select
    activo_id,
    sum(
      case
        when tipo_operacion in ('Compra', 'Traspaso Entrada') then cantidad
        when tipo_operacion in ('Venta', 'Traspaso Salida', 'Retirada') then -cantidad
        else 0
      end
    ) as unidades,
    sum(comision) as comisiones_total,
    count(id) as num_operaciones,
    max(fecha) as ultima_operacion
  from confirmed
  group by activo_id
), disposed as (
  select
    activo_id,
    sum(cantidad) as disposed_quantity
  from confirmed
  where tipo_operacion in ('Venta', 'Traspaso Salida', 'Retirada')
  group by activo_id
), buy_lots as (
  select
    activo_id,
    cantidad,
    ((cantidad * precio_unitario) + comision) / nullif(cantidad, 0) as unit_cost,
    coalesce(
      sum(cantidad) over (
        partition by activo_id
        order by fecha, created_at, id
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as cumulative_before,
    sum(cantidad) over (
      partition by activo_id
      order by fecha, created_at, id
      rows between unbounded preceding and current row
    ) as cumulative_after
  from confirmed
  where tipo_operacion in ('Compra', 'Traspaso Entrada')
    and cantidad > 0
), fifo_costs as (
  select
    lot.activo_id,
    sum(
      (
        greatest(lot.cumulative_after - coalesce(disposed.disposed_quantity, 0), 0)
        - greatest(lot.cumulative_before - coalesce(disposed.disposed_quantity, 0), 0)
      ) * lot.unit_cost
    ) as open_cost
  from buy_lots lot
  left join disposed on disposed.activo_id = lot.activo_id
  group by lot.activo_id
)
select
  asset.user_id,
  asset.id as activo_id,
  asset.ticker,
  asset.isin,
  asset.nombre,
  asset.tipo,
  asset.estrategia,
  asset.moneda,
  asset.sector,
  asset.geografia,
  asset.notas,
  coalesce(position_totals.unidades, 0) as unidades,
  coalesce(fifo_costs.open_cost, 0) as coste_total,
  coalesce(position_totals.comisiones_total, 0) as comisiones_total,
  coalesce(position_totals.num_operaciones, 0) as num_operaciones,
  position_totals.ultima_operacion
from public.activos asset
left join position_totals on position_totals.activo_id = asset.id
left join fifo_costs on fifo_costs.activo_id = asset.id;

grant select on public.posiciones to authenticated;

commit;
