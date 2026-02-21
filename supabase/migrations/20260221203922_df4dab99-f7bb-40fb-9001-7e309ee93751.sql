
CREATE OR REPLACE FUNCTION public.get_parent_dashboard_data(_user_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _guardian_id UUID;
  _student_ids UUID[];
  _result JSON;
BEGIN
  SELECT id INTO _guardian_id
  FROM guardians
  WHERE user_id = _user_id AND org_id = _org_id
  LIMIT 1;

  IF _guardian_id IS NULL THEN
    RETURN json_build_object('children', '[]'::json, 'next_lesson', null, 'outstanding_balance', 0, 'overdue_count', 0, 'oldest_unpaid_invoice_id', null);
  END IF;

  SELECT array_agg(student_id) INTO _student_ids
  FROM student_guardians
  WHERE guardian_id = _guardian_id;

  IF _student_ids IS NULL THEN
    RETURN json_build_object('children', '[]'::json, 'next_lesson', null, 'outstanding_balance', 0, 'overdue_count', 0, 'oldest_unpaid_invoice_id', null);
  END IF;

  SELECT json_build_object(
    'guardian_id', _guardian_id,
    'children', (
      SELECT COALESCE(json_agg(child_row), '[]'::json)
      FROM (
        SELECT
          s.id,
          s.first_name,
          s.last_name,
          s.status,
          s.dob,
          COALESCE((
            SELECT COUNT(*)::int
            FROM lesson_participants lp
            JOIN lessons l ON l.id = lp.lesson_id
            WHERE lp.student_id = s.id
              AND l.start_at >= now()
              AND l.status = 'scheduled'
          ), 0) AS upcoming_lesson_count,
          (
            SELECT json_build_object('id', l.id, 'title', l.title, 'start_at', l.start_at, 'end_at', l.end_at)
            FROM lesson_participants lp
            JOIN lessons l ON l.id = lp.lesson_id
            WHERE lp.student_id = s.id
              AND l.start_at >= now()
              AND l.status = 'scheduled'
            ORDER BY l.start_at ASC
            LIMIT 1
          ) AS next_lesson,
          COALESCE((
            SELECT SUM(i.total_minor)::int
            FROM invoices i
            WHERE (i.payer_student_id = s.id OR i.payer_guardian_id = _guardian_id)
              AND i.status IN ('sent', 'overdue')
              AND i.org_id = _org_id
          ), 0) AS outstanding_balance
        FROM students s
        WHERE s.id = ANY(_student_ids)
          AND s.status = 'active'
          AND s.deleted_at IS NULL
        ORDER BY s.first_name
      ) child_row
    ),
    'next_lesson', (
      SELECT json_build_object('id', l.id, 'title', l.title, 'start_at', l.start_at, 'end_at', l.end_at, 'location_name', loc.name)
      FROM lesson_participants lp
      JOIN lessons l ON l.id = lp.lesson_id
      LEFT JOIN locations loc ON loc.id = l.location_id
      WHERE lp.student_id = ANY(_student_ids)
        AND l.start_at >= now()
        AND l.status = 'scheduled'
      ORDER BY l.start_at ASC
      LIMIT 1
    ),
    'outstanding_balance', COALESCE((
      SELECT SUM(total_minor)::int
      FROM invoices
      WHERE payer_guardian_id = _guardian_id
        AND status IN ('sent', 'overdue')
        AND org_id = _org_id
    ), 0),
    'overdue_count', (
      SELECT COUNT(*)::int
      FROM invoices
      WHERE payer_guardian_id = _guardian_id
        AND status = 'overdue'
        AND org_id = _org_id
    ),
    'oldest_unpaid_invoice_id', (
      SELECT id
      FROM invoices
      WHERE payer_guardian_id = _guardian_id
        AND status IN ('sent', 'overdue')
        AND org_id = _org_id
      ORDER BY due_date ASC
      LIMIT 1
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;
