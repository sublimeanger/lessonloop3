-- ============================================================
-- SMS Notifications — Database Foundation
-- ============================================================

-- 1. Per-org SMS settings table
CREATE TABLE public.org_sms_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  twilio_phone_number TEXT,
  monthly_sms_limit INTEGER NOT NULL DEFAULT 500,
  sms_sent_this_month INTEGER NOT NULL DEFAULT 0,
  current_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_sms_settings ENABLE ROW LEVEL SECURITY;

-- Org admins can fully manage SMS settings
CREATE POLICY "Org admins can read sms settings"
ON public.org_sms_settings FOR SELECT
USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can insert sms settings"
ON public.org_sms_settings FOR INSERT
WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update sms settings"
ON public.org_sms_settings FOR UPDATE
USING (public.is_org_admin(auth.uid(), org_id));

-- Parents/members can read sms_enabled for conditional UI
CREATE POLICY "Org members can read sms settings"
ON public.org_sms_settings FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER update_org_sms_settings_updated_at
BEFORE UPDATE ON public.org_sms_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SMS preference columns on notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN sms_lesson_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sms_invoice_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sms_payment_receipts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sms_lesson_cancellations BOOLEAN NOT NULL DEFAULT false;

-- 3. SMS consent on guardians
ALTER TABLE public.guardians
  ADD COLUMN sms_opted_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sms_opted_in_at TIMESTAMPTZ;

-- Parents can update their own guardian record's SMS opt-in
CREATE POLICY "Parents can update own guardian sms optin"
ON public.guardians FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Recipient phone on message_log + relax recipient_email NOT NULL for SMS
ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

ALTER TABLE public.message_log
  ALTER COLUMN recipient_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_log_sms
  ON public.message_log(org_id, channel, created_at)
  WHERE channel = 'sms';

-- 5. Normalise existing phone numbers to E.164 format
-- UK numbers: 07xxx -> +447xxx, 0044xxx -> +44xxx
UPDATE public.guardians
SET phone = '+44' || substring(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '(', ''), ')', '') from 2)
WHERE phone IS NOT NULL
  AND phone !~ '^\+'
  AND replace(replace(replace(replace(phone, ' ', ''), '-', ''), '(', ''), ')', '') ~ '^0[1-9]\d{9}$';

UPDATE public.guardians
SET phone = '+44' || substring(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '(', ''), ')', '') from 5)
WHERE phone IS NOT NULL
  AND phone !~ '^\+'
  AND replace(replace(replace(replace(phone, ' ', ''), '-', ''), '(', ''), ')', '') ~ '^0044\d{10}$';

-- Clear unparseable phone numbers (not matching E.164 after normalisation)
UPDATE public.guardians
SET phone = NULL
WHERE phone IS NOT NULL
  AND phone !~ '^\+[1-9]\d{6,14}$';

-- Add E.164 check constraint
ALTER TABLE public.guardians
  ADD CONSTRAINT guardians_phone_e164_check
  CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{6,14}$');

-- 6. Helper function to atomically increment SMS counter
CREATE OR REPLACE FUNCTION public.increment_sms_counter(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO org_sms_settings (org_id, sms_sent_this_month, current_month)
  VALUES (_org_id, 1, date_trunc('month', CURRENT_DATE)::date)
  ON CONFLICT (org_id) DO UPDATE
  SET sms_sent_this_month = CASE
    WHEN org_sms_settings.current_month < date_trunc('month', CURRENT_DATE)::date
    THEN 1  -- Reset counter for new month
    ELSE org_sms_settings.sms_sent_this_month + 1
  END,
  current_month = date_trunc('month', CURRENT_DATE)::date,
  updated_at = now();
END;
$$;
