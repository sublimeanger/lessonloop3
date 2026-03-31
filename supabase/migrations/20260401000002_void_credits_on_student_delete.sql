-- PIP-M4: Void unredeemed make-up credits when a student is soft-deleted.
-- Extends the anonymise_student RPC and adds a trigger for direct updates.

-- Replace anonymise_student to also void unredeemed credits
CREATE OR REPLACE FUNCTION public.anonymise_student(student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.students
  WHERE id = student_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF NOT is_org_admin(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

  -- Void unredeemed credits for deleted student
  UPDATE make_up_credits
  SET voided_at = NOW(), voided_by = auth.uid(),
      notes = COALESCE(notes || ' | ', '') || 'Voided: student deleted'
  WHERE student_id = anonymise_student.student_id
    AND org_id = v_org_id
    AND redeemed_at IS NULL
    AND voided_at IS NULL;
END;
$$;

-- Also add a trigger so direct status changes void credits too
CREATE OR REPLACE FUNCTION public.void_credits_on_student_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
     OR (NEW.status = 'inactive' AND OLD.status != 'inactive') THEN
    UPDATE make_up_credits
    SET voided_at = NOW(), voided_by = auth.uid(),
        notes = COALESCE(notes || ' | ', '') || 'Voided: student deleted'
    WHERE student_id = NEW.id
      AND org_id = NEW.org_id
      AND redeemed_at IS NULL
      AND voided_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_void_credits_on_student_delete
  AFTER UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.void_credits_on_student_delete();
