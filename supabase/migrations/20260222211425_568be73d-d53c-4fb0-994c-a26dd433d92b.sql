
-- Enforce invoice status transitions server-side
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

  -- paid and void are terminal states
  IF OLD.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Validate allowed transitions
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

CREATE TRIGGER enforce_invoice_status_transition
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_status_transition();
