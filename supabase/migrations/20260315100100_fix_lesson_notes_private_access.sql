-- FIX 3: Parent can read teacher_private_notes via RLS
-- FIX 4: Teachers can read other teachers' private notes
--
-- Postgres RLS is row-level, not column-level. The parent SELECT policy
-- returns ALL columns including teacher_private_notes when parent_visible = true.
-- Similarly, the staff SELECT policy exposes teacher_private_notes to all staff.
--
-- Solution: Create RPC functions that control which columns are returned.

-- ═══════════════════════════════════════════════════════════════
-- FIX 3: Secure parent access — excludes private notes entirely
-- ═══════════════════════════════════════════════════════════════
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
  parent_visible BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ln.id, ln.lesson_id, ln.student_id, ln.teacher_id,
    ln.content_covered, ln.homework, ln.focus_areas,
    ln.parent_visible, ln.created_at, ln.updated_at
  FROM lesson_notes ln
  WHERE ln.org_id = p_org_id
    AND ln.student_id = ANY(p_student_ids)
    AND ln.parent_visible = true;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FIX 4: Secure staff access — teachers only see own private notes
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_lesson_notes_for_staff(
  p_org_id UUID,
  p_user_id UUID,
  p_role TEXT,
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
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_role IN ('owner', 'admin') THEN
    -- Admins/owners see everything including all private notes
    RETURN QUERY
      SELECT ln.id, ln.lesson_id, ln.student_id, ln.org_id, ln.teacher_id,
             ln.content_covered, ln.homework, ln.focus_areas,
             ln.teacher_private_notes, ln.engagement_rating,
             ln.parent_visible, ln.created_at, ln.updated_at
      FROM lesson_notes ln
      WHERE ln.org_id = p_org_id;
  ELSE
    -- Teachers see all notes but private_notes only for their own
    RETURN QUERY
      SELECT ln.id, ln.lesson_id, ln.student_id, ln.org_id, ln.teacher_id,
             ln.content_covered, ln.homework, ln.focus_areas,
             CASE WHEN ln.teacher_id = (
               SELECT t.id FROM teachers t
               WHERE t.user_id = p_user_id AND t.org_id = p_org_id
               LIMIT 1
             ) THEN ln.teacher_private_notes ELSE NULL END,
             ln.engagement_rating,
             ln.parent_visible, ln.created_at, ln.updated_at
      FROM lesson_notes ln
      WHERE ln.org_id = p_org_id;
  END IF;
END;
$$;
