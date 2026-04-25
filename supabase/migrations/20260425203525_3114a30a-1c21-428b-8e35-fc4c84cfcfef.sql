-- J10-F8 / J10-F12 — Per-attempt log of auto-pay charges + per-guardian pause state.

CREATE TABLE IF NOT EXISTS auto_pay_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL REFERENCES invoice_installments(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  amount_minor integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('succeeded','failed','requires_action','skipped_paused')),
  stripe_payment_intent_id text,
  stripe_status text,
  stripe_error_code text,
  stripe_error_type text,
  stripe_error_message text,
  notification_sent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_installment_attempted
  ON auto_pay_attempts(installment_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_org_attempted
  ON auto_pay_attempts(org_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_pay_attempts_guardian_attempted
  ON auto_pay_attempts(guardian_id, attempted_at DESC);

ALTER TABLE auto_pay_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org staff can view auto_pay_attempts" ON auto_pay_attempts;
CREATE POLICY "Org staff can view auto_pay_attempts" ON auto_pay_attempts
  FOR SELECT TO authenticated
  USING (is_org_staff(auth.uid(), org_id));

-- Pause state on guardian_payment_preferences.
ALTER TABLE guardian_payment_preferences
  ADD COLUMN IF NOT EXISTS auto_pay_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_pay_paused_reason text,
  ADD COLUMN IF NOT EXISTS consecutive_failure_count integer NOT NULL DEFAULT 0;

-- Extend message_log.source CHECK to allow 'auto_pay_cron'.
ALTER TABLE public.message_log DROP CONSTRAINT IF EXISTS message_log_source_check;
ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_source_check
  CHECK (source IN (
    'user_manual',
    'recurring_scheduler',
    'recurring_manual_run',
    'parent_portal',
    'recurring_scheduler_alert',
    'auto_pay_cron'
  ));

NOTIFY pgrst, 'reload schema';