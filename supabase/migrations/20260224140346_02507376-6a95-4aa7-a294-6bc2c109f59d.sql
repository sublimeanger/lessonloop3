ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS teacher_payment_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS teacher_payment_analytics_enabled boolean NOT NULL DEFAULT true;