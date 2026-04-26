-- Track 0.1 Phase 1 — Audit triggers for walk-surfaced HIGH-tier tables.
--
-- Adds audit triggers to the 4 high-severity tables surfaced by the
-- T01-P0 walk that were not in the original roadmap-named scope:
--
--   - recurring_invoice_templates
--   - recurring_template_items
--   - recurring_template_recipients
--   - guardian_payment_preferences
--
-- All four tables carry org_id directly (verified at migration-write
-- time against their CREATE TABLE statements). No JOIN-resolve helper
-- is required — every trigger registers public.log_audit_event_singular
-- with a per-table singular entity_type, the same shape used for the
-- 12 parent-table triggers in
-- 20260505100000_audit_triggers_t01_p1_parent_tables.sql.
--
-- The walk doc (docs/AUDIT_LOG_AUDIT_2026-04-26.md) noted the
-- recurring-template child tables as "inherits via parent join?" —
-- that concern was resolved by inspecting the schemas:
--   recurring_template_items.org_id is denormalised on the child row
--   (20260424180000_recurring_template_items_table.sql:4)
--   recurring_template_recipients.org_id likewise
--   (20260424170000_recurring_template_recipients_table.sql:5)
-- so the canonical helper applies cleanly.

-- 13. recurring_invoice_templates
DROP TRIGGER IF EXISTS audit_recurring_invoice_templates ON public.recurring_invoice_templates;
CREATE TRIGGER audit_recurring_invoice_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('recurring_invoice_template');

-- 14. recurring_template_items
DROP TRIGGER IF EXISTS audit_recurring_template_items ON public.recurring_template_items;
CREATE TRIGGER audit_recurring_template_items
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_template_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('recurring_template_item');

-- 15. recurring_template_recipients
DROP TRIGGER IF EXISTS audit_recurring_template_recipients ON public.recurring_template_recipients;
CREATE TRIGGER audit_recurring_template_recipients
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_template_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('recurring_template_recipient');

-- 16. guardian_payment_preferences
DROP TRIGGER IF EXISTS audit_guardian_payment_preferences ON public.guardian_payment_preferences;
CREATE TRIGGER audit_guardian_payment_preferences
  AFTER INSERT OR UPDATE OR DELETE ON public.guardian_payment_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('guardian_payment_preference');

NOTIFY pgrst, 'reload schema';
