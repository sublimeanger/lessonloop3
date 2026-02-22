-- RES-006: Remove finance role from teaching-resources storage policies
-- Finance should not have access to teaching resources (pedagogical content)

-- Drop and recreate the SELECT policy without finance
DROP POLICY IF EXISTS "Staff can view org resources" ON storage.objects;
CREATE POLICY "Staff can view org resources"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'teaching-resources'
  AND EXISTS (
    SELECT 1 FROM org_memberships om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin', 'teacher')
      AND om.org_id = (
        SELECT org_id FROM resources r
        WHERE r.file_path = name
        LIMIT 1
      )
  )
);