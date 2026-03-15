-- ORG-01: Validate timezone is a valid IANA timezone string
-- ORG-02: Validate currency_code is a supported ISO 4217 code
-- ORG-03: Fix race condition in student/teacher limit triggers (FOR UPDATE)
-- ORG-04: Restrict org-logos uploads to safe image MIME types

-- =====================================================
-- ORG-01: Timezone validation trigger
-- Uses pg_timezone_names (built-in Postgres catalog) to validate
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_org_timezone_currency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valid_currencies text[] := ARRAY[
    'GBP','USD','EUR','AUD','CAD','NZD','CHF','SEK','NOK','DKK',
    'PLN','CZK','HUF','RON','BGN','HRK','JPY','CNY','INR','ZAR',
    'BRL','MXN','SGD','HKD','KRW','TWD','THB','MYR','IDR','PHP',
    'AED','SAR','ILS','TRY'
  ];
BEGIN
  -- Validate timezone against pg_timezone_names (IANA timezones)
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid timezone: %. Must be a valid IANA timezone (e.g. Europe/London).', NEW.timezone;
  END IF;

  -- Validate currency_code against supported list
  IF NEW.currency_code != ALL(_valid_currencies) THEN
    RAISE EXCEPTION 'Invalid currency code: %. Must be a supported ISO 4217 code.', NEW.currency_code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_org_timezone_currency
  BEFORE INSERT OR UPDATE ON public.organisations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_org_timezone_currency();

-- =====================================================
-- ORG-03: Fix race condition in student limit trigger
-- Add FOR UPDATE lock on organisations row to prevent
-- concurrent inserts from both passing the count check
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_student_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _current_count integer;
  _max_students integer;
BEGIN
  -- Lock the org row to prevent concurrent inserts racing past the limit
  SELECT max_students INTO _max_students
  FROM public.organisations
  WHERE id = NEW.org_id
  FOR UPDATE;

  SELECT COUNT(*) INTO _current_count
  FROM public.students
  WHERE org_id = NEW.org_id
    AND deleted_at IS NULL
    AND status != 'inactive';

  IF _current_count >= _max_students THEN
    RAISE EXCEPTION 'Student limit reached for this plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- ORG-03: Fix race condition in teacher limit trigger
-- Same FOR UPDATE approach
-- =====================================================

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
  -- Only check for teacher-countable roles
  IF NEW.role NOT IN ('owner', 'admin', 'teacher') THEN
    RETURN NEW;
  END IF;

  -- Only check active memberships
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Lock the org row to prevent concurrent inserts racing past the limit
  SELECT max_teachers INTO _max_teachers
  FROM public.organisations
  WHERE id = NEW.org_id
  FOR UPDATE;

  SELECT COUNT(*) INTO _current_count
  FROM public.org_memberships
  WHERE org_id = NEW.org_id
    AND role IN ('owner', 'admin', 'teacher')
    AND status = 'active';

  IF _current_count >= _max_teachers THEN
    RAISE EXCEPTION 'Teacher limit reached for this plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- ORG-04: Restrict org-logos uploads to safe MIME types
-- Drop and recreate the INSERT policy with MIME check
-- Blocks SVG (XSS vector), allows only png/jpeg/webp
-- =====================================================

DROP POLICY IF EXISTS "Users can upload logos for their org" ON storage.objects;

CREATE POLICY "Users can upload logos for their org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.extension(name) IN ('png', 'jpg', 'jpeg', 'webp'))
  AND EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.user_id = auth.uid()
    AND org_memberships.org_id::text = (storage.foldername(name))[1]
    AND org_memberships.role IN ('owner', 'admin')
    AND org_memberships.status = 'active'
  )
);

-- Also restrict UPDATE to safe extensions
DROP POLICY IF EXISTS "Admins can update logos" ON storage.objects;

CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.extension(name) IN ('png', 'jpg', 'jpeg', 'webp'))
  AND EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.user_id = auth.uid()
    AND org_memberships.org_id::text = (storage.foldername(name))[1]
    AND org_memberships.role IN ('owner', 'admin')
    AND org_memberships.status = 'active'
  )
);

-- Set max file size for the bucket (2MB = 2097152 bytes)
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'org-logos';
