-- Closes J8-F9 fully (PR #367 closed it partially — see Why below).
-- Caught by post-deploy SQL verification on PR #367 — the workflow's
-- "verify policies on production after Lovable apply" step paid for itself.

-- ============================================================================
-- Why
-- ============================================================================
-- PR #367 (migration 20260511100000) dropped "Parents can update own payment
-- preferences" from guardian_payment_preferences, intending to close J8-F9.
-- The Area 2 audit walker had read 20260224152820 (the migration the audit
-- referenced) and seen four policies on the table. Post-deploy SQL on
-- production showed SIX policies — three more than the audit described.
--
-- The three extra policies came from 20260224110000_stripe_embedded_payments.sql
-- (four hours EARLIER the same day, 24 Feb 2026), which originally created the
-- table and policies before 20260224152820 redefined them. The earlier set was
-- never dropped, so both sets coexisted:
--
--   Earlier set (20260224110000), still live:
--     "Guardians can view own payment prefs"     SELECT
--     "Guardians can manage own payment prefs"   FOR ALL  ← bypasses J8-F9
--     "Org staff can view guardian payment prefs" SELECT
--
--   Later set (20260224152820), partially cleaned by PR #367:
--     "Staff can view payment preferences"       SELECT
--     "Staff can manage payment preferences"     FOR ALL  (staff legitimately need this)
--     "Parents can view own payment preferences" SELECT
--     "Parents can update own payment preferences" UPDATE  ← dropped by PR #367
--
-- "Guardians can manage own payment prefs" is FOR ALL with USING + WITH CHECK
-- on guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid()).
-- That allows a parent to UPDATE any column on their own row, including
-- stripe_customer_id. The audit-described attack — pointing stripe_customer_id
-- at another user's Stripe customer to enable cross-charge — was therefore
-- still live in production after PR #367 merged. SQL verification caught it.
--
-- ============================================================================
-- What
-- ============================================================================
-- Drop all three earlier-set policies. Each duplicates a later-set policy with
-- nearly identical intent; consolidating on the later set leaves a clean set
-- of four policies on the table:
--
--   "Staff can view payment preferences"       SELECT  (is_org_staff)
--   "Staff can manage payment preferences"     FOR ALL (is_org_staff)
--   "Parents can view own payment preferences" SELECT  (own guardian)
--   (no parent UPDATE/INSERT/DELETE — all parent writes route through
--    stripe-update-payment-preferences or stripe-detach-payment-method,
--    both authenticated edge functions with proper validation)
--
-- ============================================================================
-- Idempotency
-- ============================================================================
-- All DROP POLICY IF EXISTS. Safe to re-apply.
--
-- No NOTIFY pgrst — RLS-only changes on existing table.

DROP POLICY IF EXISTS "Guardians can view own payment prefs"
  ON public.guardian_payment_preferences;

DROP POLICY IF EXISTS "Guardians can manage own payment prefs"
  ON public.guardian_payment_preferences;

DROP POLICY IF EXISTS "Org staff can view guardian payment prefs"
  ON public.guardian_payment_preferences;
