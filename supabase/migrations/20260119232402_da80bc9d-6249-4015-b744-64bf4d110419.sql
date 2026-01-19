-- Create enums
CREATE TYPE public.student_status AS ENUM ('active', 'inactive');
CREATE TYPE public.relationship_type AS ENUM ('mother', 'father', 'guardian', 'other');
CREATE TYPE public.employment_type AS ENUM ('employee', 'contractor');
CREATE TYPE public.location_type AS ENUM ('school', 'studio', 'home', 'online');

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob DATE,
  notes TEXT,
  status student_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guardians table
CREATE TABLE public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student_guardians junction table
CREATE TABLE public.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  relationship relationship_type NOT NULL DEFAULT 'guardian',
  is_primary_payer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_id)
);

-- Add new columns to teacher_profiles
ALTER TABLE public.teacher_profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS employment_type employment_type NOT NULL DEFAULT 'contractor';

-- Add new columns to locations
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS location_type location_type NOT NULL DEFAULT 'studio',
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS for students
CREATE POLICY "Org members can view students"
  ON public.students FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create students"
  ON public.students FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can update students"
  ON public.students FOR UPDATE
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Only org admins can delete students"
  ON public.students FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- RLS for guardians
CREATE POLICY "Org members can view guardians"
  ON public.guardians FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create guardians"
  ON public.guardians FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update guardians"
  ON public.guardians FOR UPDATE
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Only org admins can delete guardians"
  ON public.guardians FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- RLS for student_guardians
CREATE POLICY "Org members can view student_guardians"
  ON public.student_guardians FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create student_guardians"
  ON public.student_guardians FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update student_guardians"
  ON public.student_guardians FOR UPDATE
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Only org admins can delete student_guardians"
  ON public.student_guardians FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- RLS for rooms
CREATE POLICY "Org members can view rooms"
  ON public.rooms FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update rooms"
  ON public.rooms FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete rooms"
  ON public.rooms FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- Triggers for updated_at
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guardians_updated_at
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_students_org_id ON public.students(org_id);
CREATE INDEX idx_students_status ON public.students(org_id, status);
CREATE INDEX idx_guardians_org_id ON public.guardians(org_id);
CREATE INDEX idx_student_guardians_student ON public.student_guardians(student_id);
CREATE INDEX idx_student_guardians_guardian ON public.student_guardians(guardian_id);
CREATE INDEX idx_rooms_location ON public.rooms(location_id);
CREATE INDEX idx_rooms_org ON public.rooms(org_id);