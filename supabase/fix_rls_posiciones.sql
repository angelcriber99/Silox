-- ============================================================
-- Silox — Parche Crítico de Seguridad (Aislamiento de Datos)
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

BEGIN;

-- 1. Asegurar que RLS está activo en las tablas base
ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar la vista actual que está mezclando los datos
DROP VIEW IF EXISTS public.posiciones;

-- 3. Recrear la vista incluyendo el user_id y con Seguridad de Invocador (respeta RLS)
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
GROUP BY a.user_id, a.id, a.ticker, a.isin, a.nombre, a.tipo, a.estrategia, a.moneda;

COMMIT;
