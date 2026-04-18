-- =============================================================================
-- A5 fix — block void of invoices with paid_minor > 0
--
-- Section 6 audit flagged A5: voiding a partially-paid invoice strands the
-- payment. `void_invoice` raises only on `status IN ('paid','void')`, so a
-- 'sent' invoice with £30 paid voids silently. The payment row persists
-- (attributed to the now-voided invoice), paid_minor stays at £30, no refund
-- is auto-created, and LessonLoop has no family-credit concept in the data
-- model today (Section 7 will build that) — so the £30 is orphaned cash.
--
-- Fix: force refund-first workflow. Block void when paid_minor > 0. If the
-- operator wants to cancel a partially-paid invoice they must first refund
-- every payment (via the Refund action on the payment history), which drops
-- paid_minor to zero via `recalculate_invoice_paid`. Once paid_minor = 0 the
-- void succeeds normally.
--
-- Upgrade path (C31 in queue): once Section 7 lands a family-account
-- balance concept, this guard can be replaced with an auto-convert flow
-- ("void and credit £X to family account"). For now, Choice 1 from the A5
-- Phase 1 summary.
--
-- Two-layer guard:
--   Layer 1 — void_invoice RPC: human-friendly error message with amount in
--             pounds. The RPC is the canonical path, called from
--             useUpdateInvoiceStatus in the frontend.
--   Layer 2 — enforce_invoice_status_transition trigger: catches any direct
--             UPDATE invoices SET status='void' that bypasses the RPC.
--
-- Idempotent: two CREATE OR REPLACE FUNCTION statements. No DDL, no data
-- migration. Ends with NOTIFY pgrst, 'reload schema';.
--
-- Rollback: re-apply the prior bodies (void_invoice from 20260315220002;
-- enforce_invoice_status_transition from 20260417200000).
-- =============================================================================


-- Layer 1 — void_invoice RPC: block when paid_minor > 0, format pounds in message

CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice RECORD;
  _installments_voided integer;
  _credits_restored integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT id, status, credit_applied_minor, payment_plan_enabled, paid_minor INTO _invoice
  FROM invoices WHERE id = _invoice_id AND org_id = _org_id FOR UPDATE;

  IF _invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', _invoice.status;
  END IF;

  -- A5 FIX: refuse void when payments have been recorded. Forces refund-first
  -- workflow so the £X paid doesn't end up orphaned on a voided invoice.
  IF COALESCE(_invoice.paid_minor, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice with £% in paid payments. Refund the payments first, then void.',
      to_char(_invoice.paid_minor / 100.0, 'FM999,999,999.00');
  END IF;

  -- Clear billing markers so voided lessons can be re-billed
  UPDATE invoice_items
  SET linked_lesson_id = NULL
  WHERE invoice_id = _invoice_id;

  UPDATE invoices SET status = 'void', payment_plan_enabled = false WHERE id = _invoice_id;

  UPDATE invoice_installments SET status = 'void', updated_at = NOW()
  WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue');
  GET DIAGNOSTICS _installments_voided = ROW_COUNT;

  _credits_restored := 0;
  IF _invoice.credit_applied_minor > 0 THEN
    UPDATE make_up_credits
    SET redeemed_at = NULL, applied_to_invoice_id = NULL, notes = 'Credit restored — invoice voided'
    WHERE applied_to_invoice_id = _invoice_id AND org_id = _org_id AND redeemed_at IS NOT NULL;
    GET DIAGNOSTICS _credits_restored = ROW_COUNT;
  END IF;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'invoice_voided', 'invoice', _invoice_id,
    jsonb_build_object('installments_voided', _installments_voided, 'credits_restored', _credits_restored,
      'credit_applied_minor', _invoice.credit_applied_minor));
END;
$function$;


-- Layer 2 — trigger: also block direct UPDATE bypass

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if status hasn't changed
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- void is terminal; no transition out
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'Invalid status transition from void to % (void is terminal)', NEW.status;
  END IF;

  -- paid is a derived status (A4 fix): allow paid → sent only when paid_minor
  -- has dropped below total_minor (refund reopened the invoice).
  IF OLD.status = 'paid' THEN
    IF NEW.status = 'sent' AND NEW.paid_minor < NEW.total_minor THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invalid status transition from paid to % (paid_minor=%, total_minor=%). Refund-driven paid→sent allowed only when paid_minor < total_minor.',
      NEW.status, NEW.paid_minor, NEW.total_minor;
  END IF;

  -- A5 FIX: block any transition to void when paid_minor > 0. Catches direct
  -- UPDATE invoices SET status='void' that bypasses the void_invoice RPC.
  -- Layer 1 (RPC) provides the operator-facing error; this trigger is the
  -- defense-in-depth safety net for service-role / SQL-Editor callers.
  IF NEW.status = 'void' AND COALESCE(NEW.paid_minor, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice: paid_minor=% > 0. Refund payments first, then void.', NEW.paid_minor;
  END IF;

  -- Validate allowed transitions for non-terminal prior states
  IF OLD.status = 'draft' AND NEW.status NOT IN ('sent', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'sent' AND NEW.status NOT IN ('paid', 'overdue', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'overdue' AND NEW.status NOT IN ('paid', 'sent', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
