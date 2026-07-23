-- ============================================================
-- Silox — Parche: Permitir tipos de operación de Traspaso
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

BEGIN;

ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_tipo_operacion_check;

ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_tipo_operacion_check 
CHECK (tipo_operacion IN ('Compra', 'Venta', 'Dividendo', 'Traspaso Salida', 'Traspaso Entrada', 'Retirada'));

COMMIT;
