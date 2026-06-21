CREATE TABLE IF NOT EXISTS public.eventos_recurrentes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  activo_id uuid REFERENCES public.activos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  dia_del_mes integer NOT NULL,
  tipo text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
