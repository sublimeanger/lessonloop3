-- =============================================================================
-- A6 fix — parent dashboard outstanding balance uses net-of-paid math
--
-- Section 7 audit found `get_parent_dashboard_data` was computing
-- outstanding_balance as raw SUM(total_minor) for sent/overdue invoices at
-- two sites (per-child and per-guardian). Partially-paid invoices counted at
-- their full total rather than the remaining balance, so the parent portal
-- dashboard showed a number inflated by the already-paid amount — while
-- `src/pages/portal/PortalInvoices.tsx:275` (client-side, over the same
-- invoices) correctly computed `total_minor - paid_minor`. Same portal,
-- contradictory numbers on two surfaces.
--
-- Two SUM sites fixed:
--   1. Per-child outstanding_balance (scoped to `payer_student_id = s.id`)
--   2. Per-guardian outstanding_balance (scoped to `payer_guardian_id`)
-- Both now subtract `COALESCE(paid_minor, 0)`.
--
-- Why no refund join: post-A4 (`20260417200000_paid_to_sent_on_refund.sql`)
-- and post-A3 (`20260417190000_installment_partially_paid_state.sql`), the
-- `recalculate_invoice_paid` RPC writes `invoices.paid_minor = SUM(payments)
-- − SUM(succeeded refunds)`. So `paid_minor` is already net-of-refunds;
-- subtracting it from `total_minor` yields the correct outstanding without a
-- refunds JOIN. A refund JOIN would double-subtract.
--
-- Idempotent: single CREATE OR REPLACE FUNCTION. No DDL, no data backfill.
-- Ends with NOTIFY pgrst, 'reload schema';.
--
-- Rollback: re-apply the body of `20260222230314_c096f5c1-...sql`.
-- =============================================================================

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
          -- A6 FIX: subtract paid_minor so partially-paid invoices report
          -- their remaining balance, not their full total.
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
    -- A6 FIX: subtract paid_minor at the per-guardian aggregate too.
    'outstanding_balance', COALESCE((
      SELECT SUM(total_minor - COALESCE(paid_minor, 0))::int
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

NOTIFY pgrst, 'reload schema';
