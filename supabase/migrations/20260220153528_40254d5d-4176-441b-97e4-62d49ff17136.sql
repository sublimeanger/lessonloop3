-- Drop the existing update policy
DROP POLICY IF EXISTS "Org admins can update memberships" ON public.org_memberships;

-- Recreate with WITH CHECK that prevents privilege escalation:
-- 1. USING: admins can only target non-owner rows (can't demote/disable the owner)
-- 2. WITH CHECK: can't set role to 'owner' (prevents self-promotion)
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