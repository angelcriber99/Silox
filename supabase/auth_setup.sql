-- ============================================================
-- Silox — Migración: Añadir Auth (Google) y Row Level Security
-- ============================================================
-- ⚠️ ESTE SCRIPT BORRARÁ LOS DATOS EXISTENTES PARA AÑADIR SEGURIDAD
-- Ejecútalo en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

BEGIN;

-- 1. Asignar los datos existentes a tu usuario y crear columnas
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Coger el ID del único usuario registrado (tú)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay ningún usuario creado en Auth. Inicia sesión en la app primero antes de ejecutar esto.';
  END IF;

  -- Añadir la columna user_id permitiendo nulos temporalmente
  ALTER TABLE public.activos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.transacciones ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.eventos_recurrentes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

  -- Asignar todos tus datos antiguos a tu nueva cuenta
  UPDATE public.activos SET user_id = v_user_id;
  UPDATE public.transacciones SET user_id = v_user_id;
  UPDATE public.eventos_recurrentes SET user_id = v_user_id;

  -- Hacer la columna obligatoria ahora que todos los datos tienen dueño
  ALTER TABLE public.activos ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE public.transacciones ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE public.eventos_recurrentes ALTER COLUMN user_id SET NOT NULL;
END $$;

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
