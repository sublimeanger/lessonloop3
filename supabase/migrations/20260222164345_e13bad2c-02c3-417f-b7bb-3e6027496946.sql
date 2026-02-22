
-- Create the make-up waitlist table
CREATE TABLE public.make_up_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
  missed_lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  missed_lesson_date DATE NOT NULL,
  absence_reason public.absence_reason NOT NULL,
  attendance_record_id UUID REFERENCES attendance_records(id),
  teacher_id UUID REFERENCES teachers(id),
  lesson_duration_minutes INTEGER NOT NULL,
  lesson_title TEXT NOT NULL,
  location_id UUID REFERENCES locations(id),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','matched','offered','accepted','declined','booked','expired','cancelled')),
  matched_lesson_id UUID REFERENCES lessons(id),
  matched_at TIMESTAMPTZ,
  offered_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  booked_lesson_id UUID REFERENCES lessons(id),
  credit_id UUID REFERENCES make_up_credits(id),
  preferred_days TEXT[],
  preferred_time_earliest TIME,
  preferred_time_latest TIME,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_waitlist_org_status ON make_up_waitlist(org_id, status);
CREATE INDEX idx_waitlist_teacher ON make_up_waitlist(teacher_id, status) WHERE status = 'waiting';
CREATE INDEX idx_waitlist_student ON make_up_waitlist(student_id, status);
CREATE INDEX idx_waitlist_expires ON make_up_waitlist(expires_at) WHERE status = 'waiting';

-- RLS
ALTER TABLE make_up_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view waitlist" ON make_up_waitlist FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Org admins can manage waitlist" ON make_up_waitlist FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Parents can view their children waitlist" ON make_up_waitlist FOR SELECT
  USING (guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER set_make_up_waitlist_updated_at BEFORE UPDATE ON make_up_waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Org-level expiry setting
ALTER TABLE organisations ADD COLUMN make_up_waitlist_expiry_weeks INTEGER DEFAULT 8;
