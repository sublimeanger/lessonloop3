-- Ensure set_primary_location RPC exists with correct parameter names
-- matching the frontend call: { p_org_id, p_location_id }
-- Idempotent: CREATE OR REPLACE + schema cache refresh

CREATE OR REPLACE FUNCTION public.set_primary_location(p_org_id uuid, p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin of this org
  IF NOT is_org_admin(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not an admin of this organisation';
  END IF;

  -- Verify location exists and belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND org_id = p_org_id AND is_archived = false
  ) THEN
    RAISE EXCEPTION 'Location not found or is archived';
  END IF;

  -- Atomically clear old primary and set new one
  UPDATE public.locations
  SET is_primary = (id = p_location_id)
  WHERE org_id = p_org_id
    AND is_archived = false;
END;
$$;

-- Refresh PostgREST schema cache so the RPC is visible
NOTIFY pgrst, 'reload schema';
