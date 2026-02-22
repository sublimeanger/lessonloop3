-- RES-007: Auto-delete resource_shares when a student is archived
CREATE OR REPLACE FUNCTION public.cleanup_resource_shares_on_student_archive()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
     OR (NEW.status = 'inactive' AND OLD.status != 'inactive') THEN
    DELETE FROM public.resource_shares WHERE student_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_cleanup_resource_shares_on_student_archive
  AFTER UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_resource_shares_on_student_archive();