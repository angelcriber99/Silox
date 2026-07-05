-- ============================================================
-- Silox — Parche: Añadir Sector y Geografía a Activos
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

BEGIN;

-- 1. Añadir columnas a la tabla activos si no existen
ALTER TABLE public.activos 
ADD COLUMN IF NOT EXISTS sector text DEFAULT 'Desconocido',
ADD COLUMN IF NOT EXISTS geografia text DEFAULT 'Desconocida';

-- 2. Actualizar la vista de posiciones para que incluya estas columnas
DROP VIEW IF EXISTS public.posiciones;

CREATE OR REPLACE VIEW public.posiciones WITH (security_invoker = true) AS
SELECT 
  a.user_id,
  a.id AS activo_id,
  a.ticker,
  a.isin,
  a.nombre,
  a.tipo,
  a.estrategia,
  a.moneda,
  a.sector,
  a.geografia,
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
GROUP BY a.user_id, a.id, a.ticker, a.isin, a.nombre, a.tipo, a.estrategia, a.moneda, a.sector, a.geografia;

COMMIT;
