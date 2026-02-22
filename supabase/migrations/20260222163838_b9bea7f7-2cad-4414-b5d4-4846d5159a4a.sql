
-- Phase 1: Absence Reason Model

-- 1. Create absence_reason enum
CREATE TYPE absence_reason AS ENUM (
  'sick',
  'school_commitment',
  'family_emergency',
  'holiday',
  'teacher_cancelled',
  'weather_closure',
  'no_show',
  'other'
);

-- 2. Add columns to attendance_records
ALTER TABLE attendance_records
  ADD COLUMN absence_reason_category absence_reason,
  ADD COLUMN absence_notified_at TIMESTAMPTZ;

-- 3. Create make_up_policies table
CREATE TABLE make_up_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  absence_reason absence_reason NOT NULL,
  eligibility TEXT NOT NULL DEFAULT 'not_eligible'
    CHECK (eligibility IN ('automatic', 'waitlist', 'admin_discretion', 'not_eligible')),
  description TEXT,
  UNIQUE (org_id, absence_reason)
);

ALTER TABLE make_up_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view make_up policies"
  ON make_up_policies FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Org admins can manage make_up policies"
  ON make_up_policies FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

-- 4. Seed function for default policies
CREATE OR REPLACE FUNCTION seed_make_up_policies(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO make_up_policies (org_id, absence_reason, eligibility, description)
  VALUES
    (_org_id, 'sick', 'waitlist', 'Student sick — waitlisted for make-up if slot becomes available'),
    (_org_id, 'school_commitment', 'not_eligible', 'Planned school event — no make-up per T&Cs'),
    (_org_id, 'family_emergency', 'admin_discretion', 'Admin decides on case-by-case basis'),
    (_org_id, 'holiday', 'not_eligible', 'Family holiday — no make-up per T&Cs'),
    (_org_id, 'teacher_cancelled', 'automatic', 'Teacher cancelled — credit issued automatically'),
    (_org_id, 'weather_closure', 'admin_discretion', 'Weather/closure — admin decides'),
    (_org_id, 'no_show', 'not_eligible', 'No-show without notice — no make-up'),
    (_org_id, 'other', 'admin_discretion', 'Other reason — admin decides')
  ON CONFLICT (org_id, absence_reason) DO NOTHING;
END;
$$;
