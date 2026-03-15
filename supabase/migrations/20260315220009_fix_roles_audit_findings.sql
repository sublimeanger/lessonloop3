-- =================================================================
-- FIX: Roles & Permissions audit findings (RP-01, RP-02, RP-03)
-- =================================================================

-- ─────────────────────────────────────────────────────────────────
-- RP-01: Fix vacuous org_memberships_no_owner_insert CHECK constraint
-- The existing CHECK (role != 'owner' OR role = 'owner') is always TRUE.
-- Replace with a trigger that blocks owner INSERT from non-service-role
-- callers. Service-role (onboarding, invite-accept) bypasses RLS but
-- this trigger provides defence-in-depth.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.org_memberships DROP CONSTRAINT IF EXISTS org_memberships_no_owner_insert;

CREATE OR REPLACE FUNCTION public.block_owner_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (used by edge functions) is allowed to insert owner rows.
  -- Normal authenticated users must not.
  IF NEW.role = 'owner' AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Cannot insert owner role directly. Use the onboarding flow.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_owner_insert ON public.org_memberships;
CREATE TRIGGER trg_block_owner_insert
  BEFORE INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.block_owner_insert();

-- ─────────────────────────────────────────────────────────────────
-- RP-02: Migrate off legacy user_roles table
-- Repoint get_user_roles and has_role to org_memberships, update
-- handle_new_user trigger, then drop user_roles.
-- ─────────────────────────────────────────────────────────────────

-- 2a. Redefine get_user_roles to read from org_memberships
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT role), '{}')
  FROM public.org_memberships
  WHERE user_id = _user_id
    AND status = 'active'
$$;

-- 2b. Redefine has_role to read from org_memberships
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND role = _role
      AND status = 'active'
  )
$$;

-- 2c. Redefine handle_new_user to stop inserting into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile (org_membership with owner role is created during onboarding)
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  RETURN NEW;
END;
$$;

-- 2d. Drop the legacy user_roles table and its policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block anonymous access to user_roles" ON public.user_roles;
DROP TABLE IF EXISTS public.user_roles;

-- ─────────────────────────────────────────────────────────────────
-- RP-03: Tighten leads tables RLS from is_org_staff to is_org_admin
-- UI routes restrict leads to owner/admin only. Match at DB level.
-- ─────────────────────────────────────────────────────────────────

-- leads
DROP POLICY IF EXISTS "Staff can view leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can create leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can update leads" ON public.leads;

CREATE POLICY "Admins can view leads" ON public.leads FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can create leads" ON public.leads FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can update leads" ON public.leads FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));
-- DELETE policy "Admins can delete leads" already uses is_org_admin, no change needed

-- lead_students
DROP POLICY IF EXISTS "Staff can view lead students" ON public.lead_students;
DROP POLICY IF EXISTS "Staff can create lead students" ON public.lead_students;
DROP POLICY IF EXISTS "Staff can update lead students" ON public.lead_students;

CREATE POLICY "Admins can view lead students" ON public.lead_students FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can create lead students" ON public.lead_students FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can update lead students" ON public.lead_students FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));
-- DELETE policy already uses is_org_admin

-- lead_activities
DROP POLICY IF EXISTS "Staff can view lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Staff can create lead activities" ON public.lead_activities;

CREATE POLICY "Admins can view lead activities" ON public.lead_activities FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can create lead activities" ON public.lead_activities FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- lead_follow_ups
DROP POLICY IF EXISTS "Staff can view lead follow-ups" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Staff can create lead follow-ups" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Staff can update lead follow-ups" ON public.lead_follow_ups;

CREATE POLICY "Admins can view lead follow-ups" ON public.lead_follow_ups FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can create lead follow-ups" ON public.lead_follow_ups FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Admins can update lead follow-ups" ON public.lead_follow_ups FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));
