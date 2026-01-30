-- Create teachers table (decoupled from auth)
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  instruments text[] NOT NULL DEFAULT '{}',
  employment_type employment_type NOT NULL DEFAULT 'contractor',
  pay_rate_type pay_rate_type,
  pay_rate_value numeric(10,2) DEFAULT 0,
  payroll_notes text,
  bio text,
  status student_status NOT NULL DEFAULT 'active',
  default_lesson_length_mins integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);

-- Add indexes for performance
CREATE INDEX idx_teachers_org_id ON public.teachers(org_id);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_teachers_email ON public.teachers(email);
CREATE INDEX idx_teachers_status ON public.teachers(org_id, status);

-- Enable RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Helper function: get teacher_id for a user in an org
CREATE OR REPLACE FUNCTION public.get_teacher_id_for_user(_user_id uuid, _org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers
  WHERE user_id = _user_id AND org_id = _org_id
  LIMIT 1
$$;

-- RLS Policies for teachers table
CREATE POLICY "Staff can view teachers in org"
  ON public.teachers FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parent can view teachers in org"
  ON public.teachers FOR SELECT
  USING (has_org_role(auth.uid(), org_id, 'parent'));

CREATE POLICY "Admin can create teachers"
  ON public.teachers FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update teachers"
  ON public.teachers FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Teacher can update own record"
  ON public.teachers FOR UPDATE
  USING (user_id = auth.uid() AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Admin can delete teachers"
  ON public.teachers FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- Sensitive pay rate view (admins + self only)
CREATE OR REPLACE VIEW public.teachers_with_pay AS
SELECT 
  t.id,
  t.org_id,
  t.user_id,
  t.display_name,
  t.email,
  t.phone,
  t.instruments,
  t.employment_type,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.pay_rate_type
    ELSE NULL
  END as pay_rate_type,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.pay_rate_value
    ELSE NULL
  END as pay_rate_value,
  CASE 
    WHEN is_org_admin(auth.uid(), t.org_id) OR t.user_id = auth.uid()
    THEN t.payroll_notes
    ELSE NULL
  END as payroll_notes,
  t.bio,
  t.status,
  t.default_lesson_length_mins,
  t.created_at,
  t.updated_at
FROM public.teachers t
WHERE is_org_member(auth.uid(), t.org_id);

-- Migrate existing teacher_profiles to teachers table
INSERT INTO public.teachers (
  org_id, user_id, display_name, email, instruments, employment_type,
  pay_rate_type, pay_rate_value, payroll_notes, bio, default_lesson_length_mins, status
)
SELECT 
  tp.org_id,
  tp.user_id,
  COALESCE(tp.display_name, p.full_name, p.email, 'Unknown Teacher'),
  p.email,
  COALESCE(tp.instruments, '{}'),
  COALESCE(tp.employment_type, 'contractor'),
  tp.pay_rate_type,
  COALESCE(tp.pay_rate_value, 0),
  tp.payroll_notes,
  tp.bio,
  COALESCE(tp.default_lesson_length_mins, 60),
  'active'
FROM public.teacher_profiles tp
JOIN public.profiles p ON p.id = tp.user_id
ON CONFLICT (org_id, email) DO NOTHING;

-- Add teacher_id columns to related tables
ALTER TABLE public.lessons ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN default_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.student_teacher_assignments ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE public.availability_blocks ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;
ALTER TABLE public.practice_assignments ADD COLUMN teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Add indexes for the new columns
CREATE INDEX idx_lessons_teacher_id ON public.lessons(teacher_id);
CREATE INDEX idx_students_default_teacher_id ON public.students(default_teacher_id);
CREATE INDEX idx_student_teacher_assignments_teacher_id ON public.student_teacher_assignments(teacher_id);
CREATE INDEX idx_availability_blocks_teacher_id ON public.availability_blocks(teacher_id);
CREATE INDEX idx_practice_assignments_teacher_id ON public.practice_assignments(teacher_id);

-- Backfill teacher_id in lessons
UPDATE public.lessons l
SET teacher_id = t.id
FROM public.teachers t
WHERE l.teacher_user_id = t.user_id AND l.org_id = t.org_id;

-- Backfill teacher_id in students
UPDATE public.students s
SET default_teacher_id = t.id
FROM public.teachers t
WHERE s.default_teacher_user_id = t.user_id AND s.org_id = t.org_id;

-- Backfill teacher_id in student_teacher_assignments
UPDATE public.student_teacher_assignments sta
SET teacher_id = t.id
FROM public.teachers t
WHERE sta.teacher_user_id = t.user_id AND sta.org_id = t.org_id;

-- Backfill teacher_id in availability_blocks
UPDATE public.availability_blocks ab
SET teacher_id = t.id
FROM public.teachers t
WHERE ab.teacher_user_id = t.user_id AND ab.org_id = t.org_id;

-- Backfill teacher_id in practice_assignments
UPDATE public.practice_assignments pa
SET teacher_id = t.id
FROM public.teachers t
WHERE pa.teacher_user_id = t.user_id AND pa.org_id = t.org_id;

-- Update timestamp trigger
CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger for teachers table
CREATE TRIGGER audit_teachers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event();