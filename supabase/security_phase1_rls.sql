-- portfolio_snapshots RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots: select own" ON public.portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Snapshots: insert own" ON public.portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Snapshots: update own" ON public.portfolio_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Snapshots: delete own" ON public.portfolio_snapshots FOR DELETE USING (auth.uid() = user_id);

-- alertas RLS
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alertas: select own" ON public.alertas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Alertas: insert own" ON public.alertas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Alertas: update own" ON public.alertas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Alertas: delete own" ON public.alertas FOR DELETE USING (auth.uid() = user_id);
