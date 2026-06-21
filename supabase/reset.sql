-- ============================================================
-- Silox — Reset completo de datos de cartera
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- ⚠️  ESTO BORRA TODOS LOS ACTIVOS Y TRANSACCIONES. IRREVERSIBLE.
-- La vista `posiciones` se recalcula sola (no hay que truncarla).
-- ============================================================

BEGIN;

TRUNCATE TABLE public.transacciones;
TRUNCATE TABLE public.activos RESTART IDENTITY CASCADE;

COMMIT;

-- Verificar que quedó vacío:
-- SELECT COUNT(*) FROM activos;
-- SELECT COUNT(*) FROM transacciones;
-- SELECT COUNT(*) FROM posiciones;
