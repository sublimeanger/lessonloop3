-- Batch 2B: CC-1 audit-trigger gap closure
--
-- Why
-- ---
-- The Track 0.1 P1 audit walk (docs/AUDIT_LOG_AUDIT_2026-04-26.md) missed
-- two business-critical tables when adding canonical audit triggers in
-- 20260505100000_audit_triggers_t01_p1_parent_tables.sql:
--
--   - make_up_waitlist: state machine spans 8 statuses including money-adjacent
--     transitions (offered -> accepted -> booked, with credit redemption).
--     Existing audit_log entries for this table come only from inside specific
--     RPCs (book_makeup, on_makeup_participant_removed, and post-Batch-2B,
--     respond_to_makeup_offer + cancel_booked_makeup). Any out-of-band
--     UPDATE/INSERT/DELETE writes nothing.
--
--   - term_continuation_responses: parent decisions on term continuation —
--     a money-flow-affecting state transition (decline -> student lost; accept
--     -> re-billing). No audit coverage today; the continuation-respond edge fn
--     does no audit_log writes either.
--
-- Both tables are org-scoped (column org_id exists on both). Both fit the
-- T01-P1 default pattern: log_audit_event_singular(<entity_type>) trigger.
--
-- What
-- ----
-- Two AFTER INSERT OR UPDATE OR DELETE triggers using the existing canonical
-- helper public.log_audit_event_singular() introduced in 20260505100000.
-- entity_type values are singular: 'make_up_waitlist', 'term_continuation_response'.
--
-- Trigger names follow the audit-trigger convention from
-- docs/MIGRATION_CONVENTIONS.md (and the 12 T01-P1 triggers): audit_<table>.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. make_up_waitlist audit trigger
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_make_up_waitlist ON public.make_up_waitlist;

CREATE TRIGGER audit_make_up_waitlist
  AFTER INSERT OR UPDATE OR DELETE ON public.make_up_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('make_up_waitlist');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. term_continuation_responses audit trigger
-- ─────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_term_continuation_responses ON public.term_continuation_responses;

CREATE TRIGGER audit_term_continuation_responses
  AFTER INSERT OR UPDATE OR DELETE ON public.term_continuation_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('term_continuation_response');

-- No NOTIFY needed — triggers on existing tables, no schema change visible
-- via PostgREST.
