-- Allow org co-members to view each other's profiles
CREATE POLICY "Org members can view co-member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT om2.user_id
    FROM org_memberships om1
    JOIN org_memberships om2 ON om1.org_id = om2.org_id
    WHERE om1.user_id = auth.uid()
      AND om1.status = 'active'
      AND om2.status = 'active'
  )
);