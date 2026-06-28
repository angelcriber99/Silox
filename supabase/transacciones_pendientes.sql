-- ============================================================
-- Silox — Operaciones Pendientes
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- 1. Añadir columna 'estado' a transacciones
ALTER TABLE public.transacciones
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'Completada';

-- Añadir restricción para los valores permitidos
ALTER TABLE public.transacciones
DROP CONSTRAINT IF EXISTS transacciones_estado_check;

ALTER TABLE public.transacciones
ADD CONSTRAINT transacciones_estado_check CHECK (estado IN ('Completada', 'Pendiente'));

-- 2. Modificar la vista de posiciones para ignorar operaciones 'Pendiente'
--    De esta forma, si vendemos o compramos algo en estado pendiente, 
--    no afecta a las posiciones reales activas.
CREATE OR REPLACE VIEW public.posiciones AS
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
LEFT JOIN public.transacciones t ON a.id = t.activo_id AND t.estado = 'Completada'
GROUP BY a.id, a.ticker, a.isin, a.nombre, a.tipo, a.estrategia, a.moneda;

-- IMPORTANTE: Por seguridad de RLS, re-asignamos el invocador a ON
ALTER VIEW public.posiciones SET (security_invoker = on);

COMMIT;
