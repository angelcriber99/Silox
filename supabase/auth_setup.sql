-- ============================================================
-- Silox — Migración: Añadir Auth (Google) y Row Level Security
-- ============================================================
-- ⚠️ ESTE SCRIPT BORRARÁ LOS DATOS EXISTENTES PARA AÑADIR SEGURIDAD
-- Ejecútalo en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- 1. Vaciar las tablas para evitar errores de restricción NOT NULL
TRUNCATE TABLE public.transacciones CASCADE;
TRUNCATE TABLE public.eventos_recurrentes CASCADE;
TRUNCATE TABLE public.activos RESTART IDENTITY CASCADE;

-- 2. Añadir la columna user_id y hacerla obligatoria
ALTER TABLE public.activos ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.transacciones ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.eventos_recurrentes ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Habilitar Row Level Security (RLS) en las tablas
ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_recurrentes ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas para la tabla: ACTIVOS
CREATE POLICY "Activos: select own" ON public.activos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Activos: insert own" ON public.activos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Activos: update own" ON public.activos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Activos: delete own" ON public.activos FOR DELETE USING (auth.uid() = user_id);

-- 5. Crear políticas para la tabla: TRANSACCIONES
CREATE POLICY "Transacciones: select own" ON public.transacciones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Transacciones: insert own" ON public.transacciones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Transacciones: update own" ON public.transacciones FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Transacciones: delete own" ON public.transacciones FOR DELETE USING (auth.uid() = user_id);

-- 6. Crear políticas para la tabla: EVENTOS RECURRENTES
CREATE POLICY "Eventos: select own" ON public.eventos_recurrentes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Eventos: insert own" ON public.eventos_recurrentes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Eventos: update own" ON public.eventos_recurrentes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Eventos: delete own" ON public.eventos_recurrentes FOR DELETE USING (auth.uid() = user_id);

COMMIT;
