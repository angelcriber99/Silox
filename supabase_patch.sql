-- ============================================================
-- Silox — Parche Fiscal y Corrección de Dividendos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- 1. Añadir columnas fiscales y arreglar la restricción de cantidad
ALTER TABLE public.transacciones
ADD COLUMN IF NOT EXISTS retencion_origen numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_origen_moneda text,
ADD COLUMN IF NOT EXISTS retencion_destino numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_destino_moneda text;

ALTER TABLE public.transacciones 
DROP CONSTRAINT IF EXISTS transacciones_cantidad_check;

ALTER TABLE public.transacciones 
ADD CONSTRAINT transacciones_cantidad_check CHECK (cantidad >= 0);

-- 2. Corregir la vista de posiciones para que los Dividendos NO afecten a las unidades ni al coste
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
LEFT JOIN public.transacciones t ON a.id = t.activo_id
GROUP BY a.id, a.ticker, a.isin, a.nombre, a.tipo, a.estrategia, a.moneda;

COMMIT;
