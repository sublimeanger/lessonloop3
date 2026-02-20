
-- Drop existing policy
DROP POLICY IF EXISTS "Org admins can update memberships" ON public.org_memberships;

-- Recreate with USING + WITH CHECK to prevent privilege escalation
CREATE POLICY "Org admins can update memberships"
  ON public.org_memberships
  FOR UPDATE
  USING (
    public.is_org_admin(auth.uid(), org_id)
    AND (
      -- Admins cannot modify owner rows (only owners can)
      role != 'owner' OR public.has_org_role(auth.uid(), org_id, 'owner'::app_role)
    )
  )
  WITH CHECK (
    -- Cannot set role to owner unless the requester is already the owner
    role != 'owner' OR public.has_org_role(auth.uid(), org_id, 'owner'::app_role)
  );
