INSERT INTO storage.buckets (id, name, public)
VALUES ('migration-dump', 'migration-dump', false)
ON CONFLICT (id) DO NOTHING;

-- Owners-only read policy (service role bypasses RLS so the edge fn can still write)
DO $$ BEGIN
  CREATE POLICY "owners read migration-dump"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'migration-dump'
      AND EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.user_id = auth.uid() AND m.role = 'owner' AND m.status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;