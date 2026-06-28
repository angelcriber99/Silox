-- Índices compuestos para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_transacciones_user_fecha ON public.transacciones(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_transacciones_activo ON public.transacciones(activo_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_activos_user ON public.activos(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON public.portfolio_snapshots(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_user ON public.alertas(user_id);
CREATE INDEX IF NOT EXISTS idx_eventos_user ON public.eventos_recurrentes(user_id, dia_del_mes);
