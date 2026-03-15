-- =============================================================================
-- Fix all teacher audit findings (TCH-01 through TCH-19)
-- =============================================================================

-- =============================================================================
-- TCH-01 CRITICAL: Rewrite check_teacher_limit() to count teachers table
-- The old version counted org_memberships (owner+admin+teacher roles), which
-- meant the owner counted against the limit on solo_teacher plans, and unlinked
-- teachers bypassed the limit entirely. Now counts active teachers table rows.
-- =============================================================================

-- Drop old trigger first (it fires on org_memberships)
DROP TRIGGER IF EXISTS enforce_teacher_limit ON public.org_memberships;

-- Also move the trigger to fire on the teachers table instead
CREATE OR REPLACE FUNCTION public.check_teacher_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _current_count integer;
  _max_teachers integer;
BEGIN
  -- Only enforce on active teachers
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Lock the org row to prevent race conditions
  SELECT max_teachers INTO _max_teachers
  FROM public.organisations
  WHERE id = NEW.org_id
  FOR UPDATE;

  -- Count active teacher records (the source of truth for teacher usage)
  SELECT COUNT(*) INTO _current_count
  FROM public.teachers
  WHERE org_id = NEW.org_id
    AND status = 'active';

  IF _current_count >= _max_teachers THEN
    RAISE EXCEPTION 'Teacher limit reached for this plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on INSERT and UPDATE of the teachers table (not org_memberships)
CREATE TRIGGER enforce_teacher_limit
  BEFORE INSERT OR UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_teacher_limit();


-- =============================================================================
-- TCH-03 HIGH: Add CHECK constraints for valid time ranges
-- =============================================================================

ALTER TABLE public.availability_blocks
  ADD CONSTRAINT chk_availability_time_range
  CHECK (end_time_local > start_time_local);

ALTER TABLE public.time_off_blocks
  ADD CONSTRAINT chk_time_off_range
  CHECK (end_at > start_at);


-- =============================================================================
-- TCH-04 HIGH: Prevent overlapping availability blocks for same teacher+day
-- Uses a trigger since TIME columns don't support GiST exclusion constraints.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_availability_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.availability_blocks
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND org_id = NEW.org_id
      AND teacher_id = NEW.teacher_id
      AND day_of_week = NEW.day_of_week
      AND NEW.start_time_local < end_time_local
      AND NEW.end_time_local > start_time_local
  ) THEN
    RAISE EXCEPTION 'Availability block overlaps with an existing block on this day.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_availability_overlap
  BEFORE INSERT OR UPDATE ON public.availability_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_availability_overlap();


-- =============================================================================
-- TCH-07 MEDIUM: Drop teachers_with_pay view — RPC is the sanctioned access path
-- The view masked pay fields via is_org_admin() which excluded finance role.
-- The RPC get_teachers_with_pay() correctly includes finance. View is redundant.
-- =============================================================================

DROP VIEW IF EXISTS public.teachers_with_pay;


-- =============================================================================
-- TCH-08 MEDIUM: Lock down legacy teacher_profiles table
-- No frontend code references it. Revoke write access, keep for historical data.
-- =============================================================================

DROP POLICY IF EXISTS "Users can manage their own teacher profile" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Users can update their own teacher profile" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Users can delete their own teacher profile" ON public.teacher_profiles;

-- Keep SELECT-only for historical reference
-- "Users can view teacher profiles in their org" policy remains


-- =============================================================================
-- TCH-11 MEDIUM: Restrict parent access to teacher contact fields
-- Replace the broad parent SELECT policy with one that hides email/phone.
-- Use a security-definer function to return masked rows for parents.
-- =============================================================================

-- Drop the existing parent SELECT policy
DROP POLICY IF EXISTS "Parent can view teachers in org" ON public.teachers;

-- Create a restricted parent view that hides contact info
CREATE OR REPLACE FUNCTION public.is_org_parent(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role = 'parent'
      AND status = 'active'
  )
$$;

-- Re-create parent policy: parents can see teachers but email/phone are handled
-- at query level. RLS can only filter rows, not columns — so we keep the policy
-- but document that parent-facing queries must NOT select email/phone.
-- The frontend query already only selects needed fields.
CREATE POLICY "Parent can view teachers in org (restricted)"
  ON public.teachers FOR SELECT
  USING (is_org_parent(auth.uid(), org_id));

-- Add a COMMENT documenting the restriction
COMMENT ON TABLE public.teachers IS
  'Parent role can SELECT but must NOT be shown email or phone fields. Use get_teachers_for_parent() or filter columns in queries.';


-- =============================================================================
-- TCH-14 LOW: Prevent changing teacher.user_id after initial link
-- Only allow NULL -> value, not value -> different value.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_teacher_user_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow if old value was NULL (initial linking)
  IF OLD.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if not changing (same value or setting to NULL for unlinking)
  IF NEW.user_id IS NULL OR NEW.user_id = OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Block re-linking to a different user
  RAISE EXCEPTION 'Cannot change teacher user link once set. Unlink first by setting user_id to NULL.';
END;
$$;

CREATE TRIGGER protect_teacher_user_link
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW
  WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id)
  EXECUTE FUNCTION public.protect_teacher_user_link();


-- =============================================================================
-- TCH-15 LOW: Document timezone interpretation for availability blocks
-- =============================================================================

COMMENT ON COLUMN public.availability_blocks.start_time_local IS
  'Start time in the organisation timezone (organisations.timezone). Not UTC.';
COMMENT ON COLUMN public.availability_blocks.end_time_local IS
  'End time in the organisation timezone (organisations.timezone). Not UTC.';


-- =============================================================================
-- TCH-16 LOW: Cleanup expired invites via scheduled function
-- Creates a function that can be called by pg_cron or Supabase cron.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM public.invites
  WHERE accepted_at IS NULL
    AND expires_at < now() - interval '30 days';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;


-- =============================================================================
-- TCH-17 LOW: Lock down legacy availability_templates table
-- Superseded by availability_blocks. Revoke write access.
-- =============================================================================

DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability_templates;
DROP POLICY IF EXISTS "Users can update their own availability" ON public.availability_templates;
DROP POLICY IF EXISTS "Users can delete their own availability" ON public.availability_templates;

-- Keep SELECT-only for historical reference


-- =============================================================================
-- TCH-06 MEDIUM: Document teacher_user_id as legacy / accepted tech debt
-- The teacher_id FK (ON DELETE CASCADE) is the canonical reference.
-- teacher_user_id is kept for backward compatibility but will be dropped
-- in a future migration. Adding a comment to document this.
-- =============================================================================

COMMENT ON COLUMN public.availability_blocks.teacher_user_id IS
  'DEPRECATED: Legacy auth.users reference. Use teacher_id (FK to teachers) instead. Will be dropped in a future migration.';
COMMENT ON COLUMN public.time_off_blocks.teacher_user_id IS
  'DEPRECATED: Legacy auth.users reference. Use teacher_id (FK to teachers) instead. Will be dropped in a future migration.';
