-- =============================================================================
-- A4 fix — allow refund-driven paid → sent transition on invoices
--
-- Section 6 audit (BILLING_FORENSICS.md) found a critical conflict:
-- `recalculate_invoice_paid` attempts `paid → sent` when a refund drops
-- `paid_minor` below `total_minor`, but the original trigger
-- (supabase/migrations/20260222211425_568be73d-...sql) treated `paid` as a
-- terminal state and RAISEd on every transition out. The recalc transaction
-- rolled back; the refund row persisted from a separate Supabase client call;
-- invoice state stayed `paid` with refund evidence sitting alongside — silent
-- ledger corruption.
--
-- Correct mental model: `paid` is NOT a terminal human-state. It is a derived
-- fact from `paid_minor >= total_minor`. A refund that reduces `paid_minor`
-- below `total_minor` legitimately reopens the invoice. The trigger's role is
-- to enforce the invariant `status='paid' implies paid_minor >= total_minor`,
-- not to block refund workflows.
--
-- Change in this migration:
--   - Allow `paid → sent` WHEN `NEW.paid_minor < NEW.total_minor`. Any other
--     transition out of `paid` — including a status-only manual UPDATE that
--     doesn't reduce paid_minor — remains blocked.
--   - `void` remains fully terminal (per audit Section 6 — unblocking void is
--     a separate design decision tracked as C21 / B23 and not in this fix).
--   - Every other allowed/blocked rule preserved verbatim.
--
-- Idempotent: CREATE OR REPLACE FUNCTION replaces the body; the trigger
-- binding from 20260222211425_...sql (CREATE TRIGGER enforce_invoice_status_transition
-- BEFORE UPDATE OF status ON public.invoices) is not touched — the binding is
-- by function name.
--
-- Deploy ordering: apply this SQL first (Supabase SQL Editor, then
-- NOTIFY pgrst, 'reload schema';). No frontend or edge-function deploy
-- coupling. Rollback: re-apply the original body from 20260222211425.
-- =============================================================================

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

  -- paid is a derived status, not a terminal state. Allow paid → sent only
  -- when paid_minor has dropped below total_minor (a refund reopened the
  -- invoice). Manual status-only UPDATEs that leave paid_minor >= total_minor
  -- remain blocked — they would violate the invariant
  -- `status='paid' implies paid_minor >= total_minor`.
  IF OLD.status = 'paid' THEN
    IF NEW.status = 'sent' AND NEW.paid_minor < NEW.total_minor THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invalid status transition from paid to % (paid_minor=%, total_minor=%). Refund-driven paid→sent allowed only when paid_minor < total_minor.',
      NEW.status, NEW.paid_minor, NEW.total_minor;
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
