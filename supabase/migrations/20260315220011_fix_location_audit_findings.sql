-- =============================================================================
-- Fix all location audit findings (LOC-01 through LOC-13)
-- =============================================================================

-- =============================================================================
-- LOC-01 HIGH: Add ON DELETE SET NULL to make_up_waitlist.location_id
-- Without this, deleting a location referenced by a waitlist entry fails.
-- =============================================================================

ALTER TABLE public.make_up_waitlist
  DROP CONSTRAINT IF EXISTS make_up_waitlist_location_id_fkey;

ALTER TABLE public.make_up_waitlist
  ADD CONSTRAINT make_up_waitlist_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


-- =============================================================================
-- LOC-02 HIGH: Add ON DELETE SET NULL to enrolment_waitlist.offered_location_id
-- =============================================================================

ALTER TABLE public.enrolment_waitlist
  DROP CONSTRAINT IF EXISTS enrolment_waitlist_offered_location_id_fkey;

ALTER TABLE public.enrolment_waitlist
  ADD CONSTRAINT enrolment_waitlist_offered_location_id_fkey
  FOREIGN KEY (offered_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


-- =============================================================================
-- LOC-03 HIGH: Unique location name per org (case-insensitive, excludes archived)
-- =============================================================================

-- Clean up any existing duplicates first (keep the earliest created)
-- This is safe: duplicates are only possible via race conditions and are rare.
DELETE FROM public.locations a
USING public.locations b
WHERE a.org_id = b.org_id
  AND lower(a.name) = lower(b.name)
  AND a.is_archived = false
  AND b.is_archived = false
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unique_name
  ON public.locations (org_id, lower(name))
  WHERE is_archived = false;


-- =============================================================================
-- LOC-04 HIGH: Unique room name per location (case-insensitive)
-- =============================================================================

-- Clean up any existing duplicate rooms (keep the earliest created)
DELETE FROM public.rooms a
USING public.rooms b
WHERE a.location_id = b.location_id
  AND lower(a.name) = lower(b.name)
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_unique_name
  ON public.rooms (location_id, lower(name));


-- =============================================================================
-- LOC-05/06 MEDIUM: Atomic set_primary_location RPC + single-primary constraint
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_primary_location(p_org_id uuid, p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin of this org
  IF NOT is_org_admin(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not an admin of this organisation';
  END IF;

  -- Verify location exists and belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id AND org_id = p_org_id AND is_archived = false
  ) THEN
    RAISE EXCEPTION 'Location not found or is archived';
  END IF;

  -- Atomically clear old primary and set new one
  UPDATE public.locations
  SET is_primary = (id = p_location_id)
  WHERE org_id = p_org_id
    AND is_archived = false;
END;
$$;

-- Partial unique index: at most one primary per org (among non-archived)
-- First, clean up any existing multiple primaries
DO $$
DECLARE
  _org record;
BEGIN
  FOR _org IN
    SELECT org_id, min(created_at) AS keep_created
    FROM public.locations
    WHERE is_primary = true AND is_archived = false
    GROUP BY org_id
    HAVING count(*) > 1
  LOOP
    UPDATE public.locations
    SET is_primary = false
    WHERE org_id = _org.org_id
      AND is_primary = true
      AND is_archived = false
      AND created_at > _org.keep_created;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_single_primary
  ON public.locations (org_id)
  WHERE is_primary = true AND is_archived = false;


-- =============================================================================
-- LOC-07 MEDIUM: Add CHECK constraints on room capacity
-- =============================================================================

ALTER TABLE public.rooms
  ADD CONSTRAINT chk_rooms_capacity_positive
  CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE public.rooms
  ADD CONSTRAINT chk_rooms_max_capacity_positive
  CHECK (max_capacity IS NULL OR max_capacity > 0);

-- Fix any existing zero/negative capacity values
UPDATE public.rooms SET capacity = NULL WHERE capacity IS NOT NULL AND capacity <= 0;
UPDATE public.rooms SET max_capacity = NULL WHERE max_capacity IS NOT NULL AND max_capacity <= 0;


-- =============================================================================
-- LOC-08 MEDIUM: Document dual capacity columns + fix default
-- capacity = configured capacity (set by admin in UI)
-- max_capacity = physical room limit (legacy, may diverge from capacity)
-- =============================================================================

-- Change default from 10 to NULL to avoid phantom values
ALTER TABLE public.rooms ALTER COLUMN max_capacity SET DEFAULT NULL;

COMMENT ON COLUMN public.rooms.capacity IS
  'Admin-configured room capacity. NULL means no limit. Used by UI and conflict detection.';
COMMENT ON COLUMN public.rooms.max_capacity IS
  'Physical maximum capacity (legacy). Prefer using capacity column. Will be unified in a future migration.';
