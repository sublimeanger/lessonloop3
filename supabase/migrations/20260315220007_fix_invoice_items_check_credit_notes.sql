-- Fix 1: Exclude credit-note rows from invoice_items CHECK constraints
-- The process-term-adjustment edge function intentionally writes negative
-- unit_price_minor and amount_minor when creating credit notes (is_credit_note = true
-- on the parent invoice). The previous constraints blocked all negative values.
--
-- PostgreSQL CHECK constraints cannot contain subqueries, so we replace
-- the CHECK constraints with a BEFORE INSERT OR UPDATE trigger that
-- validates amounts by looking up the parent invoice's is_credit_note flag.

-- Drop the overly strict CHECK constraints
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS chk_invoice_items_positive_price;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS chk_invoice_items_positive_amount;

-- Create a trigger function that enforces non-negative amounts only for
-- non-credit-note invoices
CREATE OR REPLACE FUNCTION check_invoice_item_amounts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_is_credit BOOLEAN;
BEGIN
  SELECT is_credit_note INTO v_is_credit
  FROM invoices WHERE id = NEW.invoice_id;

  IF NOT COALESCE(v_is_credit, false) THEN
    IF NEW.unit_price_minor < 0 THEN
      RAISE EXCEPTION 'unit_price_minor must be >= 0 for non-credit-note items';
    END IF;
    IF NEW.amount_minor < 0 THEN
      RAISE EXCEPTION 'amount_minor must be >= 0 for non-credit-note items';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_items_check_amounts
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_item_amounts();
