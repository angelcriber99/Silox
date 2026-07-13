CREATE TABLE IF NOT EXISTS public.portfolio_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  total_value numeric(14,2) NOT NULL,
  total_invested numeric(14,2) NOT NULL
);

ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portfolio_history'
      AND policyname = 'Users can view their own portfolio history'
  ) THEN
    CREATE POLICY "Users can view their own portfolio history"
      ON public.portfolio_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portfolio_history'
      AND policyname = 'Users can insert their own portfolio history'
  ) THEN
    CREATE POLICY "Users can insert their own portfolio history"
      ON public.portfolio_history FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portfolio_history'
      AND policyname = 'Users can delete their own portfolio history'
  ) THEN
    CREATE POLICY "Users can delete their own portfolio history"
      ON public.portfolio_history FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_timestamp
  ON public.portfolio_history(user_id, timestamp DESC);
