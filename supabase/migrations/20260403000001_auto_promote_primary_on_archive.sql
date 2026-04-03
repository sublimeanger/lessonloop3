-- Auto-promote primary location when current primary is archived
CREATE OR REPLACE FUNCTION public.trg_auto_promote_primary_on_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_id uuid;
BEGIN
  -- Only act when a primary location is being archived
  IF NEW.is_archived = true AND OLD.is_archived = false AND OLD.is_primary = true THEN
    -- Clear primary on the archived location
    NEW.is_primary := false;

    -- Find the next oldest active location in the same org
    SELECT id INTO _next_id
    FROM public.locations
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_archived = false
    ORDER BY created_at ASC
    LIMIT 1;

    -- Promote it
    IF _next_id IS NOT NULL THEN
      UPDATE public.locations
      SET is_primary = true
      WHERE id = _next_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_primary_on_archive ON public.locations;

CREATE TRIGGER trg_auto_promote_primary_on_archive
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  WHEN (NEW.is_archived = true AND OLD.is_archived = false)
  EXECUTE FUNCTION public.trg_auto_promote_primary_on_archive();
