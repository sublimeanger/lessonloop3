-- Batch 2E: CC-2 money-math mismatch (J1-F17, J3-F7, CC-F7)
--
-- Why
-- ---
-- Three guardian-level aggregates in get_parent_dashboard_data only count
-- invoices where payer_guardian_id = the parent's guardian_id. Mixed-payer
-- households also have invoices billed directly to a student (payer_student_id
-- set, payer_guardian_id NULL) — typical for adult-learner students who pay
-- via their own Stripe customer record. Those invoices silently disappear
-- from:
--   - outstanding_balance (under-counts owed total)
--   - overdue_count (under-reports overdue items)
--   - oldest_unpaid_invoice_id (may point at a newer invoice if the oldest
--     overdue is student-payer)
--
-- The per-child outstanding inside the children sub-query is intentionally
-- left at payer_student_id only — that aggregate represents "invoices
-- specifically billed to this child" and student-only is correct there.
-- The bug is the asymmetry: per-guardian should aggregate across BOTH
-- guardian-payer (for any child) AND student-payer for own children.
--
-- What
-- ----
-- Replace get_parent_dashboard_data so all three guardian-level aggregates
-- include both payer types, scoped to the parent's children. Per-child
-- aggregate unchanged. All other behaviour (auth check, paid_minor net-of,
-- empty-children early return) preserved.
--
-- Idempotent: single CREATE OR REPLACE FUNCTION. Same signature as before
-- (_user_id uuid, _org_id uuid). NOTIFY pgrst at end.

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
  -- CRITICAL: Verify the caller is requesting their own data
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

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
          -- Per-child aggregate is INTENTIONALLY student-only. This represents
          -- "invoices specifically billed to this child" — guardian-payer
          -- invoices spanning multiple children are summed at the per-guardian
          -- aggregate below, not duplicated per child.
          COALESCE((
            SELECT SUM(i.total_minor - COALESCE(i.paid_minor, 0))::int
            FROM invoices i
            WHERE i.payer_student_id = s.id
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
    -- CC-2 FIX: include BOTH payer_guardian_id (any of this guardian's
    -- invoices) AND payer_student_id (invoices billed directly to own
    -- children, typical for adult-learner students). Net-of-paid math
    -- preserved from A6 fix (subtract paid_minor).
    'outstanding_balance', COALESCE((
      SELECT SUM(total_minor - COALESCE(paid_minor, 0))::int
      FROM invoices
      WHERE org_id = _org_id
        AND status IN ('sent', 'overdue')
        AND (
          payer_guardian_id = _guardian_id
          OR payer_student_id = ANY(_student_ids)
        )
    ), 0),
    'overdue_count', (
      SELECT COUNT(*)::int
      FROM invoices
      WHERE org_id = _org_id
        AND status = 'overdue'
        AND (
          payer_guardian_id = _guardian_id
          OR payer_student_id = ANY(_student_ids)
        )
    ),
    'oldest_unpaid_invoice_id', (
      SELECT id
      FROM invoices
      WHERE org_id = _org_id
        AND status IN ('sent', 'overdue')
        AND (
          payer_guardian_id = _guardian_id
          OR payer_student_id = ANY(_student_ids)
        )
      ORDER BY due_date ASC
      LIMIT 1
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;

NOTIFY pgrst, 'reload schema';
