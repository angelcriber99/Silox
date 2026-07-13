-- Create budget settings table
CREATE TABLE IF NOT EXISTS public.budget_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_allowance numeric(10,2) NOT NULL DEFAULT 500.00,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

ALTER TABLE public.budget_settings
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  category text,
  merchant text,
  date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes text,
  is_automated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para budget_settings
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own budget" ON public.budget_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budget" ON public.budget_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budget" ON public.budget_settings FOR UPDATE USING (auth.uid() = user_id);

-- RLS para expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at in budget_settings
CREATE OR REPLACE FUNCTION update_budget_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_budget_updated_at_trigger
    BEFORE UPDATE ON public.budget_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_updated_at();
