
-- Add releases_slot column to make_up_policies
ALTER TABLE public.make_up_policies ADD COLUMN releases_slot BOOLEAN NOT NULL DEFAULT false;

-- Update seed function to include releases_slot defaults
CREATE OR REPLACE FUNCTION public.seed_make_up_policies(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO make_up_policies (org_id, absence_reason, eligibility, description, releases_slot)
  VALUES
    (_org_id, 'sick', 'waitlist', 'Student sick — waitlisted for make-up if slot becomes available', true),
    (_org_id, 'school_commitment', 'not_eligible', 'Planned school event — no make-up per T&Cs', false),
    (_org_id, 'family_emergency', 'admin_discretion', 'Admin decides on case-by-case basis', true),
    (_org_id, 'holiday', 'not_eligible', 'Family holiday — no make-up per T&Cs', false),
    (_org_id, 'teacher_cancelled', 'automatic', 'Teacher cancelled — credit issued automatically', true),
    (_org_id, 'weather_closure', 'admin_discretion', 'Weather/closure — admin decides', true),
    (_org_id, 'no_show', 'not_eligible', 'No-show without notice — no make-up', false),
    (_org_id, 'other', 'admin_discretion', 'Other reason — admin decides', false)
  ON CONFLICT (org_id, absence_reason) DO NOTHING;
END;
$function$;

-- Set sensible defaults for existing rows
UPDATE public.make_up_policies SET releases_slot = true
WHERE absence_reason IN ('sick', 'family_emergency', 'teacher_cancelled', 'weather_closure');

-- Rewrite on_slot_released to use policy table instead of hardcoded reasons
CREATE OR REPLACE FUNCTION public.on_slot_released()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _match RECORD; _releases BOOLEAN;
BEGIN
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student', 'cancelled_by_teacher')
    OR NEW.absence_reason_category IS NULL
  THEN RETURN NEW; END IF;

  SELECT releases_slot INTO _releases FROM make_up_policies
    WHERE org_id = NEW.org_id AND absence_reason = NEW.absence_reason_category;

  IF NOT COALESCE(_releases, false) THEN RETURN NEW; END IF;

  FOR _match IN
    SELECT waitlist_id FROM find_waitlist_matches(NEW.lesson_id, NEW.student_id, NEW.org_id) LIMIT 3
  LOOP
    UPDATE make_up_waitlist SET
      status = 'matched', matched_lesson_id = NEW.lesson_id, matched_at = NOW()
    WHERE id = _match.waitlist_id;
  END LOOP;

  RETURN NEW;
END;
$function$;
