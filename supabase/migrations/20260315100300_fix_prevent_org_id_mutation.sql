-- FIX 8: Prevent org_id changes on UPDATE across all key tables
-- org_id is a tenant isolation boundary and must never be changed after insert.

CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to all critical tables
CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON students FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON lessons FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON invoices FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON org_memberships FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON teachers FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON guardians FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON lesson_notes FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER trg_prevent_org_id_change
  BEFORE UPDATE ON payments FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();
