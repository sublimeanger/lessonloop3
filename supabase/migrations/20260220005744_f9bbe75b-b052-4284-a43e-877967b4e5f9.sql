CREATE OR REPLACE FUNCTION public.get_unbilled_lesson_ids(_org_id UUID, _start TEXT, _end TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT l.id FROM lessons l
  WHERE l.org_id = _org_id
    AND l.start_at >= _start::timestamptz
    AND l.start_at <= _end::timestamptz
    AND l.status IN ('completed', 'scheduled')
    AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.linked_lesson_id = l.id)
$$;