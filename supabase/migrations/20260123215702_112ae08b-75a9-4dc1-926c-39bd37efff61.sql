-- Create storage bucket for organisation logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true);

-- Allow authenticated users to upload logos for their org
CREATE POLICY "Users can upload logos for their org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.user_id = auth.uid()
    AND org_memberships.org_id::text = (storage.foldername(name))[1]
    AND org_memberships.role IN ('owner', 'admin')
    AND org_memberships.status = 'active'
  )
);

-- Allow public read access to logos
CREATE POLICY "Public read access for logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'org-logos');

-- Allow admins to update logos
CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.user_id = auth.uid()
    AND org_memberships.org_id::text = (storage.foldername(name))[1]
    AND org_memberships.role IN ('owner', 'admin')
    AND org_memberships.status = 'active'
  )
);

-- Allow admins to delete logos
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.user_id = auth.uid()
    AND org_memberships.org_id::text = (storage.foldername(name))[1]
    AND org_memberships.role IN ('owner', 'admin')
    AND org_memberships.status = 'active'
  )
);