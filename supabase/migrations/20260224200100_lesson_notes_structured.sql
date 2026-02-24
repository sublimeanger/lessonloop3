-- Structured lesson notes table for post-lesson feedback
CREATE TABLE IF NOT EXISTS lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,  -- null = whole-lesson note
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_covered text,
  homework text,
  focus_areas text,
  engagement_rating smallint CHECK (engagement_rating BETWEEN 1 AND 5),
  teacher_private_notes text,        -- not visible to parents
  parent_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_lesson_notes_lesson_id ON lesson_notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_student_id ON lesson_notes(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_notes_org_id ON lesson_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_teacher_id ON lesson_notes(teacher_id);

-- Enable RLS
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- Staff can fully manage lesson notes within their org
CREATE POLICY "Staff can manage lesson notes"
  ON lesson_notes FOR ALL
  USING (is_org_staff(auth.uid(), org_id));

-- Parents can read visible lesson notes for their children
CREATE POLICY "Parents can read visible lesson notes"
  ON lesson_notes FOR SELECT
  USING (
    parent_visible = true
    AND (
      student_id IN (
        SELECT sg.student_id FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE g.user_id = auth.uid()
      )
      OR student_id IS NULL
    )
    AND is_org_member(auth.uid(), org_id)
  );
