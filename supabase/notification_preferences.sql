-- Per-user notification channel/type preferences.
-- Apply in Supabase SQL editor before relying on cross-device persistence.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifs boolean NOT NULL DEFAULT true,
  email_notifs boolean NOT NULL DEFAULT true,
  price_alerts boolean NOT NULL DEFAULT true,
  weekly_report boolean NOT NULL DEFAULT false,
  dividend_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification preferences: select own"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Notification preferences: insert own"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Notification preferences: update own"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at_trigger
  ON public.notification_preferences;

CREATE TRIGGER update_notification_preferences_updated_at_trigger
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();
