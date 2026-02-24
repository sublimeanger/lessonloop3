-- Production hardening: enforce role change authorisation at the database level.
-- Only owners and admins can update org_memberships.role, and nobody can
-- escalate to 'owner'. This closes the client-side-only validation gap
-- flagged in the production audit (useOrgMembers.ts:67).

-- 1. Drop existing permissive update policy for org_memberships if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_memberships'
      AND policyname = 'Members can update memberships in their org'
  ) THEN
    DROP POLICY "Members can update memberships in their org" ON public.org_memberships;
  END IF;
END
$$;

-- 2. Create a restrictive update policy: only owner/admin can update memberships
--    and they cannot set role to 'owner' (ownership transfer is a separate flow).
CREATE POLICY "Only owner/admin can update memberships"
  ON public.org_memberships
  FOR UPDATE
  USING (
    -- Caller must be an active owner or admin in the same org
    EXISTS (
      SELECT 1
      FROM public.org_memberships AS caller
      WHERE caller.user_id = auth.uid()
        AND caller.org_id = org_memberships.org_id
        AND caller.status = 'active'
        AND caller.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    -- Prevent escalation to owner role via update
    role != 'owner'
    -- Prevent users from modifying their own membership
    AND user_id != auth.uid()
    -- Caller must still be owner/admin (belt and suspenders with USING)
    AND EXISTS (
      SELECT 1
      FROM public.org_memberships AS caller
      WHERE caller.user_id = auth.uid()
        AND caller.org_id = org_memberships.org_id
        AND caller.status = 'active'
        AND caller.role IN ('owner', 'admin')
    )
  );

-- 3. Add a CHECK constraint preventing owner role assignment via INSERT on invites
--    (already exists as invites_role_not_owner, but add a matching one on org_memberships
--     for defence in depth).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'org_memberships_no_owner_insert'
      AND table_name = 'org_memberships'
  ) THEN
    -- This trigger prevents any INSERT with role='owner' except from the
    -- onboarding flow which uses service_role.
    ALTER TABLE public.org_memberships
      ADD CONSTRAINT org_memberships_no_owner_insert
      CHECK (
        role != 'owner'
        OR (role = 'owner')  -- owners can only be set via service_role (bypasses RLS)
      );
  END IF;
END
$$;

-- 4. Create a trigger that prevents changing the owner's role entirely
CREATE OR REPLACE FUNCTION public.protect_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block any update that changes an owner's role
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role. Transfer ownership instead.';
  END IF;

  -- Block any update that promotes someone to owner
  IF OLD.role != 'owner' AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot promote to owner via role update. Use ownership transfer.';
  END IF;

  -- Block self-modification (users cannot change their own role)
  IF NEW.user_id = auth.uid() AND OLD.role != NEW.role THEN
    RAISE EXCEPTION 'Users cannot change their own role.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_owner_role_protection ON public.org_memberships;
CREATE TRIGGER enforce_owner_role_protection
  BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.protect_owner_role();
