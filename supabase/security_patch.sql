-- ============================================================
-- Silox — Parche de Seguridad Crítico (Data Leak)
-- ============================================================
-- ⚠️ ESTE SCRIPT SOLUCIONA LA VISIBILIDAD DE CARTERAS AJENAS
-- Ejecútalo en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- En PostgreSQL, las Vistas (Views) se ejecutan por defecto con los 
-- permisos del creador (admin), saltándose el Row Level Security (RLS) 
-- de las tablas base. 
--
-- Al activar `security_invoker = on`, obligamos a la vista a ejecutarse 
-- con los permisos del usuario que hace la petición, forzando a que 
-- pase por el filtro RLS de activos y transacciones.

ALTER VIEW public.posiciones SET (security_invoker = on);

COMMIT;
