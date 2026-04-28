-- Closes J6-F4, J6-F5, J8-F9 from docs/audits/2026-04-area-2-parent-portal.md
-- Same PR also folds J8-F8 (edge function validation) into supabase/functions/stripe-update-payment-preferences/index.ts.
-- J5-F11 was already closed by 20260316310000_fix_practice_tracking_audit.sql (March 2026); walker missed it.

-- ============================================================================
-- Why
-- ============================================================================
-- Three parent-facing tables had over-permissive RLS that allowed parents to
-- bypass server-side validation by writing directly via the supabase-js client:
--
--   * term_continuation_runs:
--     "Org members can view continuation runs" used is_org_member, granting
--     every authenticated parent SELECT access to every other family's
--     continuation runs — leaking next_term_fee_minor, lesson_summary,
--     and (via the responses table linked through run_id) response_token
--     which doubles as a bearer credential for email-link impersonation.
--
--   * term_continuation_responses:
--     "Org members can view continuation responses" granted org-wide SELECT,
--     leaking withdrawal_reason, withdrawal_notes, lesson_summary, and the
--     response_token bearer credential to every parent in the org.
--     "Parents can update their own continuation response" allowed direct
--     UPDATEs that bypassed every validation in the continuation-respond
--     edge function: deadline enforcement, run-status check, response_method
--     tagging, is_processed flag, term_adjustment_id, next_term_invoice_id.
--     A parent could (a) submit responses after the deadline, (b) bypass
--     run.status='deadline_passed' block, (c) tamper with is_processed /
--     term_adjustment_id to forge processing state.
--
--   * guardian_payment_preferences:
--     "Parents can update own payment preferences" had no WITH CHECK clause.
--     A parent could supabase.from('guardian_payment_preferences').update({
--       stripe_customer_id: 'cus_someone_else'
--     }) directly. stripe-create-payment-intent reads stripe_customer_id and
--     uses it as the Stripe customer for the charge — financial cross-charge
--     between users was possible if the attacker found another user's Stripe
--     customer ID.
--
-- ============================================================================
-- What
-- ============================================================================
-- Drop every direct user write path. Force all parent writes through the
-- already-authenticated edge functions:
--   * continuation-respond                  (term_continuation_responses)
--   * stripe-update-payment-preferences     (guardian_payment_preferences)
--   * stripe-detach-payment-method          (guardian_payment_preferences)
--
-- For SELECT, replace org-wide policies with staff-only and parent-own:
--   * term_continuation_runs       — staff: full SELECT; parents: only runs
--                                    they have responses in (EXISTS join).
--   * term_continuation_responses  — staff: full SELECT; parents: own only
--                                    (already in place via "Parents see own
--                                    responses" from 20260315200500, kept).
--
-- The "Org admins can ..." policies on both tables remain — admins legitimately
-- need full read/write for the continuation workflow.
--
-- guardian_payment_preferences keeps "Staff can view payment preferences",
-- "Staff can manage payment preferences", and "Parents can view own payment
-- preferences". Only the parent UPDATE policy is dropped.
--
-- ============================================================================
-- Idempotency
-- ============================================================================
-- All DROP POLICY statements use IF EXISTS. CREATE POLICY statements are
-- preceded by their own DROP POLICY IF EXISTS per the convention in
-- docs/MIGRATION_CONVENTIONS.md §"Idempotency". Safe to re-apply.
--
-- No NOTIFY pgrst — RLS-only changes on existing tables, no schema diff
-- visible to PostgREST.

-- ============================================================================
-- J6-F4: term_continuation_runs — drop over-permissive SELECT
-- ============================================================================

DROP POLICY IF EXISTS "Org members can view continuation runs"
  ON public.term_continuation_runs;

DROP POLICY IF EXISTS "Org staff can view continuation runs"
  ON public.term_continuation_runs;

CREATE POLICY "Org staff can view continuation runs"
  ON public.term_continuation_runs FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

DROP POLICY IF EXISTS "Parents can view runs they have responses in"
  ON public.term_continuation_runs;

CREATE POLICY "Parents can view runs they have responses in"
  ON public.term_continuation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.term_continuation_responses tcr
      JOIN public.guardians g ON g.id = tcr.guardian_id
      WHERE tcr.run_id = term_continuation_runs.id
        AND g.user_id = auth.uid()
    )
  );

-- ============================================================================
-- J6-F4 + J6-F5: term_continuation_responses — drop over-permissive SELECT,
-- drop parent UPDATE bypass, leave existing staff/admin and parent-own SELECT
-- ============================================================================

DROP POLICY IF EXISTS "Org members can view continuation responses"
  ON public.term_continuation_responses;

DROP POLICY IF EXISTS "Org staff can view continuation responses"
  ON public.term_continuation_responses;

CREATE POLICY "Org staff can view continuation responses"
  ON public.term_continuation_responses FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

-- Drop the parent UPDATE bypass — all parent writes must go through
-- the continuation-respond edge function.
DROP POLICY IF EXISTS "Parents can update their own continuation response"
  ON public.term_continuation_responses;
DROP POLICY IF EXISTS "Parents can update their own continuation responses"
  ON public.term_continuation_responses;

-- Note: "Parents see own responses" (from 20260315200500) is the load-bearing
-- parent SELECT policy and is intentionally NOT dropped. "Org admins can manage
-- continuation responses" (FOR ALL, from 20260228100000) is also intentionally
-- preserved — admins need full access for the continuation workflow.

-- ============================================================================
-- J8-F9: guardian_payment_preferences — drop parent UPDATE bypass
-- ============================================================================
-- Parent writes must go through stripe-update-payment-preferences (auto_pay,
-- defaultPaymentMethodId) or stripe-detach-payment-method (PM removal). Both
-- already authenticate the user and validate guardian ownership; J8-F8 is
-- closed in the same PR by adding Stripe-side PM ownership validation to
-- stripe-update-payment-preferences.

DROP POLICY IF EXISTS "Parents can update own payment preferences"
  ON public.guardian_payment_preferences;

-- "Staff can view payment preferences", "Staff can manage payment preferences",
-- and "Parents can view own payment preferences" are intentionally kept.
