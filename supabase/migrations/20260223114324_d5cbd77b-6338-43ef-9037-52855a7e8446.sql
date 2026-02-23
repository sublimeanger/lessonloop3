-- Add guardian_id to calendar_connections for parent iCal feeds
ALTER TABLE public.calendar_connections
  ADD COLUMN guardian_id uuid REFERENCES public.guardians(id) ON DELETE CASCADE;

-- Drop the old unique constraint (user_id, org_id, provider)
-- and replace with one that includes guardian_id so a user can have
-- both a staff connection (guardian_id IS NULL) and a parent connection
ALTER TABLE public.calendar_connections
  DROP CONSTRAINT calendar_connections_user_id_org_id_provider_key;

-- Create a unique index that treats NULL guardian_id distinctly
CREATE UNIQUE INDEX calendar_connections_user_org_provider_guardian_idx
  ON public.calendar_connections (user_id, org_id, provider, COALESCE(guardian_id, '00000000-0000-0000-0000-000000000000'));

-- Allow parents to create/manage their own calendar connections
CREATE POLICY "Parent can create own calendar connection"
  ON public.calendar_connections
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND guardian_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_id AND g.user_id = auth.uid() AND g.org_id = calendar_connections.org_id
    )
  );

CREATE POLICY "Parent can view own calendar connections"
  ON public.calendar_connections
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND guardian_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Parent can update own calendar connection"
  ON public.calendar_connections
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND guardian_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_id AND g.user_id = auth.uid()
    )
  );