
-- Create missing payment_notifications table
CREATE TABLE IF NOT EXISTS public.payment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id),
  amount_minor integer NOT NULL,
  payer_name text NOT NULL,
  invoice_number text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff can view payment notifications"
  ON public.payment_notifications FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Org staff can update payment notifications"
  ON public.payment_notifications FOR UPDATE
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Service role can insert payment notifications"
  ON public.payment_notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_payment_notifications_org
  ON public.payment_notifications (org_id, created_at DESC);

CREATE INDEX idx_payment_notifications_unread
  ON public.payment_notifications (org_id, read)
  WHERE read = false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_notifications;

-- Create missing indexes on guardian_payment_preferences
CREATE INDEX IF NOT EXISTS idx_guardian_payment_prefs_autopay
  ON public.guardian_payment_preferences (org_id, auto_pay_enabled)
  WHERE auto_pay_enabled = true;

CREATE INDEX IF NOT EXISTS idx_guardian_payment_prefs_guardian
  ON public.guardian_payment_preferences (guardian_id);
