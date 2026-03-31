-- Prevent admins from demoting owners via direct API calls
CREATE OR REPLACE FUNCTION prevent_owner_demotion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- If changing FROM owner to something else
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    -- Only the owner themselves can change their own role
    IF auth.uid() != OLD.user_id THEN
      RAISE EXCEPTION 'Only the owner can change their own role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_owner_demotion
  BEFORE UPDATE ON org_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'owner' AND NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION prevent_owner_demotion();
