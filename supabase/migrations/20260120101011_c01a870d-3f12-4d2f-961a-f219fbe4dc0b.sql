-- Add soft delete columns to students and guardians tables
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.guardians 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add updated_at to payments table if not exists
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger for payments updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for guardians updated_at
DROP TRIGGER IF EXISTS update_guardians_updated_at ON public.guardians;
CREATE TRIGGER update_guardians_updated_at
  BEFORE UPDATE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON public.students(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guardians_deleted_at ON public.guardians(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted records for normal queries
-- Students: update existing policies to exclude deleted records

-- Drop and recreate students policies to filter deleted records
DROP POLICY IF EXISTS "Org members can view org students" ON public.students;
CREATE POLICY "Org members can view org students"
  ON public.students
  FOR SELECT
  USING (
    deleted_at IS NULL 
    AND is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Parents can view their linked students" ON public.students;
CREATE POLICY "Parents can view their linked students"
  ON public.students
  FOR SELECT
  USING (
    deleted_at IS NULL 
    AND is_parent_of_student(auth.uid(), id)
  );

-- Create policy for admin-only access to deleted records
CREATE POLICY "Admins can view deleted students"
  ON public.students
  FOR SELECT
  USING (
    deleted_at IS NOT NULL 
    AND is_org_admin(auth.uid(), org_id)
  );

-- Guardians: update policies to exclude deleted records
DROP POLICY IF EXISTS "Org members can view guardians" ON public.guardians;
CREATE POLICY "Org members can view guardians"
  ON public.guardians
  FOR SELECT
  USING (
    deleted_at IS NULL 
    AND is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "Admins can view deleted guardians"
  ON public.guardians
  FOR SELECT
  USING (
    deleted_at IS NOT NULL 
    AND is_org_admin(auth.uid(), org_id)
  );

-- Create a function to anonymise personal data
CREATE OR REPLACE FUNCTION public.anonymise_student(student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
  SET 
    first_name = 'Deleted',
    last_name = 'User',
    email = NULL,
    phone = NULL,
    dob = NULL,
    notes = NULL,
    deleted_at = now(),
    status = 'inactive'
  WHERE id = student_id;
END;
$$;

-- Create a function to anonymise guardian data
CREATE OR REPLACE FUNCTION public.anonymise_guardian(guardian_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guardians
  SET 
    full_name = 'Deleted User',
    email = NULL,
    phone = NULL,
    deleted_at = now()
  WHERE id = guardian_id;
END;
$$;