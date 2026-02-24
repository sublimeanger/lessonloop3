-- Stripe Embedded Payments: guardian payment preferences & payment notifications
-- Supports saved payment methods, auto-pay, and real-time teacher notifications

-- Guardian payment preferences (saved cards, auto-pay)
CREATE TABLE IF NOT EXISTS guardian_payment_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_customer_id text,
  auto_pay_enabled boolean DEFAULT false,
  default_payment_method_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(guardian_id, org_id)
);

ALTER TABLE guardian_payment_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians can view own payment prefs"
  ON guardian_payment_preferences FOR SELECT
  USING (guardian_id IN (
    SELECT id FROM guardians WHERE user_id = auth.uid()
  ));

CREATE POLICY "Guardians can manage own payment prefs"
  ON guardian_payment_preferences FOR ALL
  USING (guardian_id IN (
    SELECT id FROM guardians WHERE user_id = auth.uid()
  ))
  WITH CHECK (guardian_id IN (
    SELECT id FROM guardians WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org staff can view guardian payment prefs"
  ON guardian_payment_preferences FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

-- Index for auto-pay cron lookups
CREATE INDEX idx_guardian_payment_prefs_autopay
  ON guardian_payment_preferences (org_id, auto_pay_enabled)
  WHERE auto_pay_enabled = true;

CREATE INDEX idx_guardian_payment_prefs_guardian
  ON guardian_payment_preferences (guardian_id);

-- Payment notifications (real-time teacher notifications when parents pay)
CREATE TABLE IF NOT EXISTS payment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id),
  amount_minor integer NOT NULL,
  payer_name text NOT NULL,
  invoice_number text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff can view payment notifications"
  ON payment_notifications FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Org staff can update payment notifications"
  ON payment_notifications FOR UPDATE
  USING (is_org_staff(auth.uid(), org_id));

-- Service role can insert (from webhooks)
CREATE POLICY "Service role can insert payment notifications"
  ON payment_notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_payment_notifications_org
  ON payment_notifications (org_id, created_at DESC);

CREATE INDEX idx_payment_notifications_unread
  ON payment_notifications (org_id, read)
  WHERE read = false;

-- Enable realtime on payment_notifications for teacher toast notifications
ALTER PUBLICATION supabase_realtime ADD TABLE payment_notifications;
