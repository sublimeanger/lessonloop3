-- Refunds table + org-level teacher visibility settings
-- Supports full and partial refunds via Stripe, plus org controls for teacher payment visibility

-- ─── Refunds table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  stripe_refund_id text,
  refunded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Org staff can view refunds
CREATE POLICY "Org staff can view refunds"
  ON refunds FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

-- Service role can insert/update (from edge functions and webhooks)
CREATE POLICY "Service role can manage refunds"
  ON refunds FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_refunds_payment ON refunds (payment_id);
CREATE INDEX idx_refunds_invoice ON refunds (invoice_id);
CREATE INDEX idx_refunds_org ON refunds (org_id, created_at DESC);

-- Unique constraint on stripe_refund_id to prevent duplicate processing
CREATE UNIQUE INDEX idx_refunds_stripe_refund_id ON refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

-- ─── Org-level teacher visibility settings ────────────────────────────────────

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS teacher_payment_notifications_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS teacher_payment_analytics_enabled boolean DEFAULT true;

COMMENT ON COLUMN organisations.teacher_payment_notifications_enabled IS 'When false, teachers do not see real-time payment notification toasts';
COMMENT ON COLUMN organisations.teacher_payment_analytics_enabled IS 'When false, teachers do not see the payment analytics dashboard card';
