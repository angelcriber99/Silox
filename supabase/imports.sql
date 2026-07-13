-- Import audit trail for broker/file ingestion workflows.
-- Apply in Supabase SQL editor before relying on import history UI.

CREATE TABLE IF NOT EXISTS public.imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  filename text NOT NULL,
  file_size integer NOT NULL,
  file_type text,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  parsed_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  removed_internal_movements integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_imports_user_created
  ON public.imports(user_id, created_at DESC);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imports: select own"
  ON public.imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Imports: insert own"
  ON public.imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Imports: update own"
  ON public.imports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
