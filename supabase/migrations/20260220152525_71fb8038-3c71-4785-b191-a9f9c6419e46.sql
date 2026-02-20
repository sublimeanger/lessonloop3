-- Drop existing policy
DROP POLICY IF EXISTS "Org admins can update memberships" ON public.org_memberships;

-- Recreate with WITH CHECK that prevents:
-- 1. Setting anyone's role to 'owner' (only the DB/system can do this)
-- 2. Modifying a row where the CURRENT role is 'owner' (can't demote owners)
CREATE POLICY "Org admins can update memberships"
  ON public.org_memberships
  FOR UPDATE
  USING (
    public.is_org_admin(auth.uid(), org_id)
    AND role != 'owner'
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), org_id)
    AND role != 'owner'
  );