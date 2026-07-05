-- ============================================================
-- Silox — Parche Vista Posiciones (Incluir Pendientes)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- Recrear la vista de posiciones para INCLUIR operaciones 'Pendiente'
-- Así el Dashboard refleja el estado final de las operaciones en curso.
CREATE OR REPLACE VIEW public.posiciones WITH (security_invoker = true) AS
SELECT 
  a.id AS activo_id,
  a.ticker,
  a.isin,
  a.nombre,
  a.tipo,
  a.estrategia,
  a.moneda,
  COALESCE(SUM(
    CASE 
      WHEN t.tipo_operacion = 'Compra' THEN t.cantidad 
      WHEN t.tipo_operacion = 'Venta' THEN -t.cantidad 
      ELSE 0 
    END
  ), 0) AS unidades,
  COALESCE(SUM(
    CASE 
      WHEN t.tipo_operacion = 'Compra' THEN (t.cantidad * t.precio_unitario)
      WHEN t.tipo_operacion = 'Venta' THEN -(t.cantidad * t.precio_unitario)
      ELSE 0
    END
  ), 0) AS coste_total,
  COALESCE(SUM(t.comision), 0) AS comisiones_total,
  COUNT(t.id) AS num_operaciones,
  MAX(t.fecha) AS ultima_operacion
FROM public.activos a
LEFT JOIN public.transacciones t ON a.id = t.activo_id
GROUP BY a.id, a.ticker, a.isin, a.nombre, a.tipo, a.estrategia, a.moneda;

-- IMPORTANTE: Por seguridad de RLS, re-asignamos el invocador a ON
ALTER VIEW public.posiciones SET (security_invoker = on);

COMMIT;
