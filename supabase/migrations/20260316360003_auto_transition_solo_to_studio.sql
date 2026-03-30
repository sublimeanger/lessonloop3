-- Auto-transition org_type from solo_teacher to studio when the first
-- teacher (non-owner) is added to the organisation.

CREATE OR REPLACE FUNCTION public.trg_auto_transition_solo_to_studio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on teacher role inserts
  IF NEW.role = 'teacher' THEN
    UPDATE public.organisations
    SET org_type = 'studio'
    WHERE id = NEW.org_id
      AND org_type = 'solo_teacher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_solo_to_studio ON public.org_memberships;

CREATE TRIGGER trg_auto_solo_to_studio
  AFTER INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_transition_solo_to_studio();
