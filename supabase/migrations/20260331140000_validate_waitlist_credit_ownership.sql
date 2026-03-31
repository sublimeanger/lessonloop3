-- CRD-H4: Validate credit ownership when linking to waitlist
-- Ensures that when a credit_id is set on a make_up_waitlist entry,
-- the credit belongs to the same student and org.

CREATE OR REPLACE FUNCTION validate_waitlist_credit_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.credit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM make_up_credits
      WHERE id = NEW.credit_id
        AND student_id = NEW.student_id
        AND org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'Credit does not belong to this student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_waitlist_credit
  BEFORE INSERT OR UPDATE OF credit_id ON make_up_waitlist
  FOR EACH ROW
  WHEN (NEW.credit_id IS NOT NULL)
  EXECUTE FUNCTION validate_waitlist_credit_ownership();
