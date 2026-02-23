-- GRADE-001: Instruments, Exam Boards, Grade Levels & Student Instruments
-- Adds structured music grade framework for tracking what instrument each student plays
-- and what exam grade they're at.

----------------------------------------------------------------------
-- 1. Reference table: instruments
----------------------------------------------------------------------
CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

----------------------------------------------------------------------
-- 2. Reference table: exam_boards
----------------------------------------------------------------------
CREATE TABLE public.exam_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'GB',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

----------------------------------------------------------------------
-- 3. Reference table: grade_levels (per exam board)
----------------------------------------------------------------------
CREATE TABLE public.grade_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_board_id UUID REFERENCES public.exam_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  sort_order INT NOT NULL,
  is_diploma BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

----------------------------------------------------------------------
-- 4. Junction table: student_instruments
----------------------------------------------------------------------
CREATE TABLE public.student_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  exam_board_id UUID REFERENCES public.exam_boards(id) ON DELETE SET NULL,
  current_grade_id UUID REFERENCES public.grade_levels(id) ON DELETE SET NULL,
  target_grade_id UUID REFERENCES public.grade_levels(id) ON DELETE SET NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  started_at DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, instrument_id)
);

----------------------------------------------------------------------
-- 5. Enable RLS
----------------------------------------------------------------------
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_instruments ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- 6. RLS policies — Reference tables (read-only for all authenticated)
----------------------------------------------------------------------

-- instruments: readable by all authenticated (built-in) + org members (custom)
CREATE POLICY "Authenticated users can view built-in instruments"
  ON public.instruments FOR SELECT
  USING (org_id IS NULL);

CREATE POLICY "Org members can view custom instruments"
  ON public.instruments FOR SELECT
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can create custom instruments"
  ON public.instruments FOR INSERT
  WITH CHECK (is_custom = true AND org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update custom instruments"
  ON public.instruments FOR UPDATE
  USING (is_custom = true AND org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete custom instruments"
  ON public.instruments FOR DELETE
  USING (is_custom = true AND org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id));

-- exam_boards: read-only for all authenticated
CREATE POLICY "Authenticated users can view exam boards"
  ON public.exam_boards FOR SELECT
  USING (true);

-- grade_levels: read-only for all authenticated
CREATE POLICY "Authenticated users can view grade levels"
  ON public.grade_levels FOR SELECT
  USING (true);

----------------------------------------------------------------------
-- 7. RLS policies — student_instruments (org-scoped, same as student_guardians)
----------------------------------------------------------------------
CREATE POLICY "Org members can view student_instruments"
  ON public.student_instruments FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create student_instruments"
  ON public.student_instruments FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update student_instruments"
  ON public.student_instruments FOR UPDATE
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can delete student_instruments"
  ON public.student_instruments FOR DELETE
  USING (public.is_org_member(auth.uid(), org_id));

----------------------------------------------------------------------
-- 8. updated_at trigger for student_instruments
----------------------------------------------------------------------
CREATE TRIGGER update_student_instruments_updated_at
  BEFORE UPDATE ON public.student_instruments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

----------------------------------------------------------------------
-- 9. Seed data: Exam Boards
----------------------------------------------------------------------
INSERT INTO public.exam_boards (name, short_name, country_code, sort_order) VALUES
  ('Associated Board of the Royal Schools of Music', 'ABRSM', 'GB', 1),
  ('Trinity College London', 'Trinity', 'GB', 2),
  ('Rockschool (RSL Awards)', 'RSL', 'GB', 3),
  ('London College of Music', 'LCM', 'GB', 4),
  ('Australian Music Examinations Board', 'AMEB', 'AU', 5),
  ('Royal Conservatory of Music', 'RCM', 'CA', 6);

----------------------------------------------------------------------
-- 10. Seed data: Universal Grade Levels (exam_board_id = NULL)
----------------------------------------------------------------------
INSERT INTO public.grade_levels (exam_board_id, name, short_name, sort_order, is_diploma, description) VALUES
  (NULL, 'No Exam Track', 'N/A', -1, false, 'Student is not following a formal exam pathway'),
  (NULL, 'Beginner (Pre-Grade)', 'Pre', 0, false, 'Just starting out, learning basic technique and simple pieces');

----------------------------------------------------------------------
-- 11. Seed data: ABRSM Grade Levels
----------------------------------------------------------------------
INSERT INTO public.grade_levels (exam_board_id, name, short_name, sort_order, is_diploma, description)
SELECT eb.id, gl.name, gl.short_name, gl.sort_order, gl.is_diploma, gl.description
FROM public.exam_boards eb,
(VALUES
  ('Prep Test', 'Prep', 1, false, 'Simple pieces and basic scales, building foundational skills'),
  ('Initial Grade', 'Init', 2, false, 'First structured assessment, introductory level pieces'),
  ('Grade 1', 'G1', 3, false, 'First formal grade, basic scales and short pieces'),
  ('Grade 2', 'G2', 4, false, 'Developing technique, slightly longer pieces'),
  ('Grade 3', 'G3', 5, false, 'Early intermediate, introducing more musical expression'),
  ('Grade 4', 'G4', 6, false, 'Intermediate, broader range of keys and techniques'),
  ('Grade 5', 'G5', 7, false, 'Strong intermediate, prerequisite for higher ABRSM grades; theory often required'),
  ('Grade 6', 'G6', 8, false, 'Advanced intermediate, demanding repertoire'),
  ('Grade 7', 'G7', 9, false, 'Advanced, concert-level pieces'),
  ('Grade 8', 'G8', 10, false, 'Highest graded exam, near-professional standard'),
  ('DipABRSM', 'Dip', 11, true, 'Diploma level, post-Grade 8 professional qualification'),
  ('LRSM', 'LRSM', 12, true, 'Licentiate diploma, advanced professional performance'),
  ('FRSM', 'FRSM', 13, true, 'Fellowship diploma, highest ABRSM qualification')
) AS gl(name, short_name, sort_order, is_diploma, description)
WHERE eb.short_name = 'ABRSM';

----------------------------------------------------------------------
-- 12. Seed data: Trinity Grade Levels
----------------------------------------------------------------------
INSERT INTO public.grade_levels (exam_board_id, name, short_name, sort_order, is_diploma, description)
SELECT eb.id, gl.name, gl.short_name, gl.sort_order, gl.is_diploma, gl.description
FROM public.exam_boards eb,
(VALUES
  ('Initial', 'Init', 2, false, 'Introductory grade assessment'),
  ('Grade 1', 'G1', 3, false, 'First formal grade, basic scales and short pieces'),
  ('Grade 2', 'G2', 4, false, 'Developing technique, slightly longer pieces'),
  ('Grade 3', 'G3', 5, false, 'Early intermediate, introducing more musical expression'),
  ('Grade 4', 'G4', 6, false, 'Intermediate, broader range of keys and techniques'),
  ('Grade 5', 'G5', 7, false, 'Strong intermediate level'),
  ('Grade 6', 'G6', 8, false, 'Advanced intermediate, demanding repertoire'),
  ('Grade 7', 'G7', 9, false, 'Advanced, concert-level pieces'),
  ('Grade 8', 'G8', 10, false, 'Highest graded exam, near-professional standard'),
  ('ATCL', 'ATCL', 11, true, 'Associate diploma, post-Grade 8 qualification'),
  ('LTCL', 'LTCL', 12, true, 'Licentiate diploma, advanced professional performance'),
  ('FTCL', 'FTCL', 13, true, 'Fellowship diploma, highest Trinity qualification')
) AS gl(name, short_name, sort_order, is_diploma, description)
WHERE eb.short_name = 'Trinity';

----------------------------------------------------------------------
-- 13. Seed data: Rockschool Grade Levels
----------------------------------------------------------------------
INSERT INTO public.grade_levels (exam_board_id, name, short_name, sort_order, is_diploma, description)
SELECT eb.id, gl.name, gl.short_name, gl.sort_order, gl.is_diploma, gl.description
FROM public.exam_boards eb,
(VALUES
  ('Debut', 'Debut', 1, false, 'Entry level, introductory pieces and skills'),
  ('Grade 1', 'G1', 3, false, 'First formal grade, basic technique'),
  ('Grade 2', 'G2', 4, false, 'Developing technique and musicality'),
  ('Grade 3', 'G3', 5, false, 'Early intermediate level'),
  ('Grade 4', 'G4', 6, false, 'Intermediate, broader range of styles'),
  ('Grade 5', 'G5', 7, false, 'Strong intermediate level'),
  ('Grade 6', 'G6', 8, false, 'Advanced intermediate, demanding repertoire'),
  ('Grade 7', 'G7', 9, false, 'Advanced level'),
  ('Grade 8', 'G8', 10, false, 'Highest graded exam, near-professional standard')
) AS gl(name, short_name, sort_order, is_diploma, description)
WHERE eb.short_name = 'RSL';

----------------------------------------------------------------------
-- 14. Seed data: Instruments
----------------------------------------------------------------------
INSERT INTO public.instruments (name, category, sort_order, is_custom, org_id) VALUES
  -- Keyboard
  ('Piano', 'Keyboard', 100, false, NULL),
  ('Organ', 'Keyboard', 101, false, NULL),
  ('Electronic Keyboard', 'Keyboard', 102, false, NULL),
  -- Strings
  ('Violin', 'Strings', 200, false, NULL),
  ('Viola', 'Strings', 201, false, NULL),
  ('Cello', 'Strings', 202, false, NULL),
  ('Double Bass', 'Strings', 203, false, NULL),
  ('Harp', 'Strings', 204, false, NULL),
  -- Guitar
  ('Classical Guitar', 'Guitar', 300, false, NULL),
  ('Acoustic Guitar', 'Guitar', 301, false, NULL),
  ('Electric Guitar', 'Guitar', 302, false, NULL),
  ('Bass Guitar', 'Guitar', 303, false, NULL),
  ('Ukulele', 'Guitar', 304, false, NULL),
  -- Woodwind
  ('Flute', 'Woodwind', 400, false, NULL),
  ('Oboe', 'Woodwind', 401, false, NULL),
  ('Clarinet', 'Woodwind', 402, false, NULL),
  ('Bassoon', 'Woodwind', 403, false, NULL),
  ('Recorder', 'Woodwind', 404, false, NULL),
  ('Saxophone', 'Woodwind', 405, false, NULL),
  -- Brass
  ('Trumpet', 'Brass', 500, false, NULL),
  ('Cornet', 'Brass', 501, false, NULL),
  ('French Horn', 'Brass', 502, false, NULL),
  ('Trombone', 'Brass', 503, false, NULL),
  ('Tuba', 'Brass', 504, false, NULL),
  ('Euphonium', 'Brass', 505, false, NULL),
  -- Percussion
  ('Percussion', 'Percussion', 600, false, NULL),
  ('Drum Kit', 'Percussion', 601, false, NULL),
  ('Tuned Percussion', 'Percussion', 602, false, NULL),
  -- Voice
  ('Singing — Classical', 'Voice', 700, false, NULL),
  ('Singing — Musical Theatre', 'Voice', 701, false, NULL),
  ('Singing — Popular', 'Voice', 702, false, NULL),
  -- Other
  ('Music Theory', 'Other', 800, false, NULL),
  ('Composition', 'Other', 801, false, NULL),
  ('Music Production', 'Other', 802, false, NULL);
