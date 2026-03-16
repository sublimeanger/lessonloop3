-- Fix CRITICAL and HIGH findings from Feature 19 audit
--
-- F1-F3 (CRITICAL): Privacy RPCs exist but unused; parents/teachers see teacher_private_notes
-- F4 (CRITICAL): Client-side private note filter is a no-op (frontend fix)
-- F5 (HIGH): Upsert broken for whole-lesson notes (NULLS DISTINCT)
-- F6 (HIGH): Whole-lesson notes leak to all parents in org
-- F7 (HIGH): RPCs lack auth.uid() verification

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- FIX F5: Unique constraint with NULLS NOT DISTINCT
-- Prevents duplicate whole-lesson notes (student_id IS NULL)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lesson_notes DROP CONSTRAINT IF EXISTS uq_lesson_notes_combo;
ALTER TABLE lesson_notes ADD CONSTRAINT uq_lesson_notes_combo
  UNIQUE NULLS NOT DISTINCT (lesson_id, student_id, teacher_id);

-- ═══════════════════════════════════════════════════════════════
-- FIX F6 + F8: Replace ALL RLS policies with correct versions
-- - Splits "Staff can manage" FOR ALL into per-command policies
-- - Fixes parent policy: student_id IS NULL requires lesson participation
-- - Restricts DELETE to admins only
-- ═══════════════════════════════════════════════════════════════

-- Drop all existing policies from both migrations
DROP POLICY IF EXISTS "Staff can manage lesson notes" ON lesson_notes;
DROP POLICY IF EXISTS "Parents can read visible lesson notes" ON lesson_notes;
DROP POLICY IF EXISTS "Staff can view lesson notes in their org" ON lesson_notes;
DROP POLICY IF EXISTS "Teachers can insert lesson notes" ON lesson_notes;
DROP POLICY IF EXISTS "Teachers can update own lesson notes" ON lesson_notes;
DROP POLICY IF EXISTS "Admins can delete lesson notes" ON lesson_notes;
DROP POLICY IF EXISTS "Parents can view visible lesson notes for their children" ON lesson_notes;

-- Staff SELECT
CREATE POLICY "lesson_notes_staff_select" ON lesson_notes
  FOR SELECT USING (is_org_staff(auth.uid(), org_id));

-- Staff INSERT
CREATE POLICY "lesson_notes_staff_insert" ON lesson_notes
  FOR INSERT WITH CHECK (is_org_staff(auth.uid(), org_id));

-- Staff UPDATE: own notes or admin
CREATE POLICY "lesson_notes_staff_update" ON lesson_notes
  FOR UPDATE USING (
    is_org_admin(auth.uid(), org_id)
    OR teacher_id = get_teacher_id_for_user(auth.uid(), org_id)
  );

-- Delete: admins only
CREATE POLICY "lesson_notes_admin_delete" ON lesson_notes
  FOR DELETE USING (is_org_admin(auth.uid(), org_id));

-- Parent SELECT: properly scoped
-- Per-student notes: parent must be guardian of the student
-- Whole-lesson notes: parent must have a child in the lesson
CREATE POLICY "lesson_notes_parent_select" ON lesson_notes
  FOR SELECT USING (
    parent_visible = true
    AND is_org_member(auth.uid(), org_id)
    AND (
      -- Per-student note: parent is guardian of the student
      (student_id IS NOT NULL AND student_id IN (
        SELECT sg.student_id FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE g.user_id = auth.uid()
      ))
      OR
      -- Whole-lesson note: parent has a child enrolled in the lesson
      (student_id IS NULL AND EXISTS (
        SELECT 1 FROM lesson_participants lp
        JOIN student_guardians sg ON sg.student_id = lp.student_id
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE lp.lesson_id = lesson_notes.lesson_id
          AND g.user_id = auth.uid()
      ))
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- FIX F7 + F1-F3: Replace RPCs with auth-verified versions
-- ═══════════════════════════════════════════════════════════════

-- Parent RPC: excludes teacher_private_notes, verifies guardian status
CREATE OR REPLACE FUNCTION get_parent_lesson_notes(
  p_org_id UUID,
  p_student_ids UUID[]
) RETURNS TABLE (
  id UUID,
  lesson_id UUID,
  student_id UUID,
  teacher_id UUID,
  content_covered TEXT,
  homework TEXT,
  focus_areas TEXT,
  engagement_rating SMALLINT,
  parent_visible BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify org membership
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid() AND org_id = p_org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;

  -- Verify caller is guardian of at least one requested student
  IF NOT EXISTS (
    SELECT 1 FROM student_guardians sg
    JOIN guardians g ON g.id = sg.guardian_id
    WHERE g.user_id = auth.uid()
      AND sg.student_id = ANY(p_student_ids)
  ) THEN
    RAISE EXCEPTION 'Not a guardian of the requested students';
  END IF;

  -- Return only public fields for students the caller is actually guardian of
  RETURN QUERY
    SELECT
      ln.id, ln.lesson_id, ln.student_id, ln.teacher_id,
      ln.content_covered, ln.homework, ln.focus_areas,
      ln.engagement_rating,
      ln.parent_visible, ln.created_at, ln.updated_at
    FROM lesson_notes ln
    WHERE ln.org_id = p_org_id
      AND ln.parent_visible = true
      AND ln.student_id = ANY(
        SELECT sg2.student_id FROM student_guardians sg2
        JOIN guardians g2 ON g2.id = sg2.guardian_id
        WHERE g2.user_id = auth.uid()
          AND sg2.student_id = ANY(p_student_ids)
      );
END;
$$;

-- Staff RPC: scopes teacher_private_notes by role, returns joined data
-- Supports flexible JSONB filters for explorer, lesson detail, student notes
CREATE OR REPLACE FUNCTION get_lesson_notes_for_staff(
  p_org_id UUID,
  p_user_id UUID DEFAULT NULL,   -- ignored, auth.uid() used instead
  p_role TEXT DEFAULT NULL,       -- ignored, verified role used instead
  p_filters JSONB DEFAULT '{}'
) RETURNS TABLE (
  id UUID,
  lesson_id UUID,
  student_id UUID,
  org_id UUID,
  teacher_id UUID,
  content_covered TEXT,
  homework TEXT,
  focus_areas TEXT,
  teacher_private_notes TEXT,
  engagement_rating SMALLINT,
  parent_visible BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lesson_title TEXT,
  lesson_start_at TIMESTAMPTZ,
  lesson_status TEXT,
  student_first_name TEXT,
  student_last_name TEXT,
  teacher_display_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_teacher_id UUID;
  v_role TEXT;
BEGIN
  -- Verify authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify org membership and get verified role
  SELECT m.role INTO v_role
  FROM org_memberships m
  WHERE m.user_id = auth.uid() AND m.org_id = p_org_id AND m.status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'teacher') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get teacher_id for private note scoping
  SELECT t.id INTO v_teacher_id
  FROM teachers t
  WHERE t.user_id = auth.uid() AND t.org_id = p_org_id
  LIMIT 1;

  RETURN QUERY
    SELECT
      ln.id, ln.lesson_id, ln.student_id, ln.org_id, ln.teacher_id,
      ln.content_covered, ln.homework, ln.focus_areas,
      -- Column-level privacy: teachers only see own private notes
      CASE
        WHEN v_role IN ('owner', 'admin') THEN ln.teacher_private_notes
        WHEN ln.teacher_id = v_teacher_id THEN ln.teacher_private_notes
        ELSE NULL
      END AS teacher_private_notes,
      ln.engagement_rating,
      ln.parent_visible, ln.created_at, ln.updated_at,
      l.title AS lesson_title,
      l.start_at AS lesson_start_at,
      l.status AS lesson_status,
      s.first_name AS student_first_name,
      s.last_name AS student_last_name,
      teach.display_name AS teacher_display_name
    FROM lesson_notes ln
    JOIN lessons l ON l.id = ln.lesson_id
    LEFT JOIN students s ON s.id = ln.student_id
    LEFT JOIN teachers teach ON teach.id = ln.teacher_id
    WHERE ln.org_id = p_org_id
      -- Optional lesson_id filter
      AND (p_filters->>'lesson_id' IS NULL
           OR ln.lesson_id = (p_filters->>'lesson_id')::UUID)
      -- Optional student_id filter (with optional whole-lesson inclusion)
      AND (
        p_filters->>'student_id' IS NULL
        OR ln.student_id = (p_filters->>'student_id')::UUID
        OR (
          ln.student_id IS NULL
          AND (p_filters->>'include_whole_lesson') = 'true'
          AND EXISTS (
            SELECT 1 FROM lesson_participants lp
            WHERE lp.lesson_id = ln.lesson_id
              AND lp.student_id = (p_filters->>'student_id')::UUID
          )
        )
      )
      -- Optional teacher_id filter
      AND (p_filters->>'teacher_id' IS NULL
           OR ln.teacher_id = (p_filters->>'teacher_id')::UUID)
      -- Optional date range on lesson start_at
      AND (p_filters->>'start_date' IS NULL
           OR l.start_at >= (p_filters->>'start_date')::TIMESTAMPTZ)
      AND (p_filters->>'end_date' IS NULL
           OR l.start_at <= (p_filters->>'end_date')::TIMESTAMPTZ)
      -- Optional visibility filter
      AND (
        p_filters->>'visibility' IS NULL
        OR (p_filters->>'visibility' = 'parent_visible' AND ln.parent_visible = true)
        OR (p_filters->>'visibility' = 'private' AND ln.parent_visible = false)
      )
    ORDER BY ln.created_at DESC
    LIMIT COALESCE((p_filters->>'limit')::INT, 1000)
    OFFSET COALESCE((p_filters->>'offset')::INT, 0);
END;
$$;

COMMIT;
