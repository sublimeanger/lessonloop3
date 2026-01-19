-- Enums for scheduling
CREATE TYPE public.lesson_type AS ENUM ('private', 'group');
CREATE TYPE public.lesson_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'cancelled_by_teacher', 'cancelled_by_student');
CREATE TYPE public.recurrence_pattern AS ENUM ('weekly');

-- 1) recurrence_rules (needed before lessons for FK)
CREATE TABLE public.recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  pattern_type public.recurrence_pattern NOT NULL DEFAULT 'weekly',
  days_of_week integer[] NOT NULL DEFAULT '{}', -- 0=Sunday, 6=Saturday
  interval_weeks integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  end_date date,
  timezone text NOT NULL DEFAULT 'Europe/London',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) lessons
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  lesson_type public.lesson_type NOT NULL DEFAULT 'private',
  status public.lesson_status NOT NULL DEFAULT 'scheduled',
  teacher_user_id uuid NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  online_meeting_url text,
  recurrence_id uuid REFERENCES public.recurrence_rules(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes_private text, -- teacher/admin only
  notes_shared text, -- visible to parent portal
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) lesson_participants
CREATE TABLE public.lesson_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, student_id)
);

-- 4) attendance_records
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_status public.attendance_status NOT NULL DEFAULT 'present',
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  cancellation_reason text,
  UNIQUE(lesson_id, student_id)
);

-- 5) availability_blocks (rename from availability_templates for clarity)
CREATE TABLE public.availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  day_of_week public.day_of_week NOT NULL,
  start_time_local time NOT NULL,
  end_time_local time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) time_off_blocks
CREATE TABLE public.time_off_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_blocks ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is teacher of lesson or admin
CREATE OR REPLACE FUNCTION public.can_edit_lesson(_user_id uuid, _lesson_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = _lesson_id
      AND (
        l.teacher_user_id = _user_id
        OR is_org_admin(_user_id, l.org_id)
      )
  )
$$;

-- RLS Policies for recurrence_rules
CREATE POLICY "Org members can view recurrence rules"
  ON public.recurrence_rules FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create recurrence rules"
  ON public.recurrence_rules FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update recurrence rules"
  ON public.recurrence_rules FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete recurrence rules"
  ON public.recurrence_rules FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for lessons
CREATE POLICY "Org members can view lessons"
  ON public.lessons FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create lessons"
  ON public.lessons FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Teachers can update their lessons, admins can update all"
  ON public.lessons FOR UPDATE
  USING (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

CREATE POLICY "Only admins can delete lessons"
  ON public.lessons FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for lesson_participants
CREATE POLICY "Org members can view lesson participants"
  ON public.lesson_participants FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can add lesson participants"
  ON public.lesson_participants FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update lesson participants"
  ON public.lesson_participants FOR UPDATE
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can remove lesson participants"
  ON public.lesson_participants FOR DELETE
  USING (is_org_member(auth.uid(), org_id));

-- RLS Policies for attendance_records
CREATE POLICY "Org members can view attendance records"
  ON public.attendance_records FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update attendance records"
  ON public.attendance_records FOR UPDATE
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can delete attendance records"
  ON public.attendance_records FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for availability_blocks
CREATE POLICY "Org members can view availability blocks"
  ON public.availability_blocks FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Teachers can create own availability, admins can create for all"
  ON public.availability_blocks FOR INSERT
  WITH CHECK (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teachers can update own availability, admins can update all"
  ON public.availability_blocks FOR UPDATE
  USING (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teachers can delete own availability, admins can delete all"
  ON public.availability_blocks FOR DELETE
  USING (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

-- RLS Policies for time_off_blocks
CREATE POLICY "Org members can view time off blocks"
  ON public.time_off_blocks FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Teachers can create own time off, admins can create for all"
  ON public.time_off_blocks FOR INSERT
  WITH CHECK (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teachers can update own time off, admins can update all"
  ON public.time_off_blocks FOR UPDATE
  USING (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teachers can delete own time off, admins can delete all"
  ON public.time_off_blocks FOR DELETE
  USING (teacher_user_id = auth.uid() OR is_org_admin(auth.uid(), org_id));

-- Triggers for updated_at
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_lessons_org_id ON public.lessons(org_id);
CREATE INDEX idx_lessons_teacher_user_id ON public.lessons(teacher_user_id);
CREATE INDEX idx_lessons_start_at ON public.lessons(start_at);
CREATE INDEX idx_lessons_status ON public.lessons(status);
CREATE INDEX idx_lessons_recurrence_id ON public.lessons(recurrence_id);
CREATE INDEX idx_lesson_participants_lesson_id ON public.lesson_participants(lesson_id);
CREATE INDEX idx_lesson_participants_student_id ON public.lesson_participants(student_id);
CREATE INDEX idx_attendance_records_lesson_id ON public.attendance_records(lesson_id);
CREATE INDEX idx_availability_blocks_teacher ON public.availability_blocks(teacher_user_id);
CREATE INDEX idx_time_off_blocks_teacher ON public.time_off_blocks(teacher_user_id);
CREATE INDEX idx_time_off_blocks_dates ON public.time_off_blocks(start_at, end_at);