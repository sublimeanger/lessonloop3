
ALTER TABLE public.notification_preferences
  ADD COLUMN email_makeup_offers BOOLEAN NOT NULL DEFAULT true;
