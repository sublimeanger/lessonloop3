-- Session 33 — shadow org enrichment for 551ca74e
--
-- Builds on top of scripts/seed-shadow-clusters.sql (s32 base seed).
--
-- Phase 1: teacher + instrument variety
--   - 3 new teachers added (Olivia Hartley strings / David Okonkwo woodwinds / Rachel Chen piano)
--   - Sarah Mitchell + James Coleman instruments narrowed to realistic specs
--   - Student-teacher assignments redistributed across 5 teachers (loads 8/17/19/20/26)
--   - 11 doubler students with secondary instruments
--
-- Phase 2: lesson_notes seed
--   - 402 notes (35% of 1124 past lessons) with instrument-family-aware content
--   - Engagement distribution: 5/10/30/35/20% across ratings 1-5
--   - parent_visible 80% TRUE; teacher_private_notes for low-engagement / private
--
-- IMPORTANT data pattern: lessons.teacher_id was NOT updated when students were
-- reassigned. Past lessons retain their original teacher (Sarah/James from s32);
-- only student_teacher_assignments + students.default_teacher_id reflect the new
-- 5-teacher distribution. This is REALISTIC for a mid-reassignment studio:
-- historical lessons keep their actual teacher; new assignments apply forward.
-- Updating lessons.teacher_id would trip the check_lesson_conflicts trigger
-- because each (dow, hr) slot has 2 students (one per original teacher) and
-- some forced-mappings (Sax+Clarinet → David) would put both at the same
-- teacher+time.

-- =============================================================================
-- PHASE 1.1 — Add 3 new teachers
-- =============================================================================

INSERT INTO teachers (org_id, display_name, email, instruments,
                      employment_type, pay_rate_type, pay_rate_value,
                      bio, default_lesson_length_mins) VALUES
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Olivia Hartley',
   'shadow-studio-teacher-3@lessonloop.test',
   ARRAY['Violin','Viola','Cello'], 'contractor', 'per_lesson', 28.00,
   'Strings specialist, ABRSM grades 1-8. 12 years teaching experience.',
   45),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'David Okonkwo',
   'shadow-studio-teacher-4@lessonloop.test',
   ARRAY['Saxophone','Clarinet','Flute'], 'contractor', 'per_lesson', 30.00,
   'Woodwinds teacher with jazz background. Trinity and ABRSM up to grade 8.',
   45),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Rachel Chen',
   'shadow-studio-teacher-5@lessonloop.test',
   ARRAY['Piano'], 'employee', 'hourly', 35.00,
   'Senior piano teacher and head of keyboard department. ABRSM diploma.',
   60);

-- =============================================================================
-- PHASE 1.2 — Narrow existing teacher specialisations
-- =============================================================================

UPDATE teachers SET instruments = ARRAY['Piano','Trumpet']
  WHERE id = '2bccc359-3c8b-4e1d-bfd7-e24abbdfb894';  -- Sarah Mitchell
UPDATE teachers SET instruments = ARRAY['Cello','Flute']
  WHERE id = 'c2066d13-6cf0-4ee3-bddd-bb451212f70f';  -- James Coleman

-- =============================================================================
-- PHASE 1.3 — Redistribute student_teacher_assignments (loads 8/17/19/20/26)
--   Piano (13)    → Rachel 8, Sarah 5
--   Trumpet (12)  → Sarah 12
--   Violin (13)   → Olivia 13
--   Cello (13)    → Olivia 7, James 6
--   Flute (13)    → James 13
--   Clarinet (13) → David 13
--   Saxophone (13)→ David 13
-- =============================================================================

DELETE FROM student_teacher_assignments WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030';

WITH student_inst AS (
  SELECT s.id AS student_id, i.name AS instrument,
    row_number() OVER (PARTITION BY i.name ORDER BY s.created_at, s.id) AS rn_in_inst
  FROM students s
  JOIN student_instruments si ON si.student_id = s.id AND si.is_primary
  JOIN instruments i ON i.id = si.instrument_id
  WHERE s.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
)
INSERT INTO student_teacher_assignments (org_id, student_id, teacher_id, is_primary)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid,
  si.student_id,
  CASE
    WHEN si.instrument = 'Piano' AND si.rn_in_inst <= 8  THEN (SELECT id FROM teachers WHERE display_name='Rachel Chen'    AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Piano'                          THEN (SELECT id FROM teachers WHERE display_name='Sarah Mitchell' AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Trumpet'                        THEN (SELECT id FROM teachers WHERE display_name='Sarah Mitchell' AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Violin'                         THEN (SELECT id FROM teachers WHERE display_name='Olivia Hartley' AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Cello' AND si.rn_in_inst <= 7  THEN (SELECT id FROM teachers WHERE display_name='Olivia Hartley' AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Cello'                          THEN (SELECT id FROM teachers WHERE display_name='James Coleman'  AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Flute'                          THEN (SELECT id FROM teachers WHERE display_name='James Coleman'  AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Clarinet'                       THEN (SELECT id FROM teachers WHERE display_name='David Okonkwo'  AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
    WHEN si.instrument = 'Saxophone'                      THEN (SELECT id FROM teachers WHERE display_name='David Okonkwo'  AND org_id='551ca74e-d47d-4d02-9a4b-24863349a030')
  END,
  TRUE
FROM student_inst si;

UPDATE students s
SET default_teacher_id = sta.teacher_id
FROM student_teacher_assignments sta
WHERE sta.student_id = s.id
  AND sta.org_id = '551ca74e-d47d-4d02-9a4b-24863349a030'
  AND s.org_id = '551ca74e-d47d-4d02-9a4b-24863349a030';

-- =============================================================================
-- PHASE 1.4 — 11 doubler students (secondary instrument with is_primary=FALSE)
-- =============================================================================

WITH
  primary_with_inst AS (
    SELECT s.id AS student_id, i.name AS instrument,
      row_number() OVER (PARTITION BY i.name ORDER BY s.created_at, s.id) AS rn
    FROM students s
    JOIN student_instruments si ON si.student_id = s.id AND si.is_primary
    JOIN instruments i ON i.id = si.instrument_id
    WHERE s.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  doubler_targets AS (
    SELECT student_id,
      CASE rn
        WHEN 1 THEN '9bdbb955-0afc-41f4-9f84-bae723df2dce'::uuid  -- Violin
        WHEN 2 THEN '811718a2-dcf6-4923-b5c9-7f7447440807'::uuid  -- Cello
        WHEN 3 THEN '5725affa-e804-414c-9f0d-f244ba835367'::uuid  -- Flute
        WHEN 4 THEN 'fe5e6dc3-f4f7-42b5-8c28-64b7695667cf'::uuid  -- Clarinet
      END AS secondary_instrument_id
    FROM primary_with_inst WHERE instrument='Piano' AND rn <= 4
    UNION ALL
    SELECT student_id, 'f26f08cb-2321-4b56-8947-3b500c494182'::uuid  -- Piano
    FROM primary_with_inst WHERE (instrument='Violin' AND rn <= 2) OR (instrument='Cello' AND rn <= 2)
    UNION ALL
    SELECT student_id, 'f26f08cb-2321-4b56-8947-3b500c494182'::uuid
    FROM primary_with_inst
    WHERE (instrument='Saxophone' AND rn = 1) OR (instrument='Clarinet' AND rn = 1) OR (instrument='Flute' AND rn = 1)
  )
INSERT INTO student_instruments (student_id, org_id, instrument_id, is_primary)
SELECT student_id, '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, secondary_instrument_id, FALSE
FROM doubler_targets;

-- =============================================================================
-- PHASE 2 — lesson_notes seed (~402 notes, 35% of past lessons)
--
-- Content libraries grouped by instrument family (keys/strings/woodwinds/brass).
-- Deterministic selection via md5(lesson_id) hash slices for reproducibility +
-- variety. engagement 5/10/30/35/20%; parent_visible 80% TRUE;
-- teacher_private_notes populated when parent_visible=FALSE OR engagement<=2.
-- =============================================================================

WITH
  family_content AS (
    SELECT 'keys' AS family, ARRAY[
      'Scales: C, G, D major hands together, 2 octaves',
      'Hanon exercises 1-5, focus on evenness',
      'Bach Minuet in G — measures 1-16, articulation work',
      'Sight-reading: 2 pieces from ABRSM grade 3 book',
      'Chord inversions in C major, all 12 keys',
      'Czerny Op. 599 no. 12-15',
      'Mozart sonata K545 first movement — development section',
      'Pedalling technique: half-pedal exercises',
      'Improvisation over a 12-bar blues in F',
      'Sight-reading + theory: time signatures 6/8 and 9/8',
      'Beethoven Für Elise — A section memorisation',
      'Hanon 6-10 with metronome at 92bpm',
      'Aural training: interval recognition (minor 3rd, perfect 5th)',
      'Arpeggios in C, G, D, A major root position',
      'Chopin Prelude in E minor — phrasing and dynamics'
    ] AS content, ARRAY[
      'Practise Hanon 1-5 daily, 10 mins',
      'Memorise the A section of Minuet in G',
      'C major scale with metronome at 80bpm',
      'Sight-read 1 new piece per day from the ABRSM book',
      'Review chord inversions in all 12 keys, 5 mins/day',
      'Czerny 12-15, slow practice with hands separate first',
      'Listen to 2 recordings of Mozart K545 first movement',
      'Pedalling practice: 10 minutes with a slow piece',
      'Improvise over a 12-bar blues for 5 minutes daily',
      'Aural training: 5 minutes of interval recognition daily'
    ] AS homework, ARRAY[
      'Hand independence', 'Pedal control', 'Dynamic contrast',
      'Articulation', 'Rhythm precision', 'Reading ahead',
      'Memorisation', 'Phrase shaping'
    ] AS focus_areas_pool
    UNION ALL SELECT 'strings', ARRAY[
      'Bow technique: long bows on open strings, even tone',
      'Scales: D major and G major 2 octaves with shifts',
      'Suzuki book 2 — Long, Long Ago',
      'Etudes: Wohlfahrt Op. 45 no. 8',
      'Intonation work with drone in D major',
      'Vibrato introduction on G string',
      'Bach Cello Suite I Prelude — opening 8 bars',
      'String crossings: spiccato exercises',
      'Position changes: 1st to 3rd position on D string',
      'Sight-reading: 2 short pieces from Trinity grade 3',
      'Double-stops: open string with finger 1',
      'Bow distribution exercises with metronome',
      'Aural training: identify major vs minor 3rds',
      'Repertoire: Elgar Salut d''Amour theme',
      'Posture and bow hold review'
    ], ARRAY[
      'Practise long bows for 5 mins on each open string',
      'Suzuki Long, Long Ago slowly with metronome',
      'Wohlfahrt no. 8 — work on bars 1-16 hands slowly',
      'Intonation: 10 minutes with drone in D major',
      'Position changes 1st-3rd: 10 reps per practice',
      'Bach Prelude opening 8 bars by next lesson',
      'Sight-read 1 new Trinity grade 3 piece daily',
      'Vibrato: 5 mins of slow vibrato on G string',
      'String crossings: spiccato for 5 mins daily',
      'Listen to Elgar Salut d''Amour recordings'
    ], ARRAY[
      'Bow control', 'Intonation', 'Tone production',
      'Position work', 'Sight-reading', 'Vibrato',
      'Phrasing', 'Right-hand technique'
    ]
    UNION ALL SELECT 'woodwinds', ARRAY[
      'Long tones: 1 minute per note, focus on tone consistency',
      'Scales: B-flat and F major 2 octaves',
      'Klosé method book — exercise 12',
      'Articulation exercises: single-tonguing on G major',
      'Embouchure work: 5 mins of pure tone exercises',
      'Sight-reading: 2 pieces from grade 4 book',
      'Breath control: long phrases without breaths',
      'Jazz scales: B-flat major and its dorian/mixolydian modes',
      'Repertoire: Mozart Concerto K622 first movement — opening',
      'Tonguing patterns: 4 even semiquavers, 3 + 1',
      'Dynamics: ppp to fff on a sustained note',
      'Improvisation over a 12-bar blues in B-flat',
      'Vibrato exercises (advanced students)',
      'Aural training: intervals up to perfect 5th',
      'Lip flexibility / register transitions'
    ], ARRAY[
      'Long tones daily, 1 minute per note across the range',
      'B-flat scale with metronome at 80bpm',
      'Klosé exercise 12 — bars 1-16 slowly',
      'Articulation: 5 minutes of single-tonguing daily',
      'Embouchure: 5 minutes of pure tone exercises',
      'Sight-read 1 new piece daily',
      'Breath control: 4-bar phrases without breath',
      'Listen to Mozart K622 recordings',
      'Practise tonguing patterns at 80bpm',
      'Improvise over a 12-bar blues for 5 minutes'
    ], ARRAY[
      'Tone production', 'Breath support', 'Articulation',
      'Embouchure', 'Reading', 'Range',
      'Vibrato', 'Intonation'
    ]
    UNION ALL SELECT 'brass', ARRAY[
      'Long tones in middle register',
      'Lip slurs: 1-3-5-3-1 pattern in B-flat major',
      'Scales: B-flat and F major 1 octave',
      'Articulation: single-tonguing on G',
      'Range work: chromatic exercises up to high C',
      'Embouchure flexibility: 5-note slurs',
      'Sight-reading: 2 grade 3 pieces',
      'Brass band repertoire: a slow march excerpt',
      'Lip trills in middle register',
      'Mouthpiece buzzing exercises',
      'Double-tonguing introduction',
      'Mute work: straight mute vs harmon',
      'Improvisation over 12-bar blues in B-flat',
      'Sight-reading + theory: brass band notation',
      'Posture and breathing review'
    ], ARRAY[
      'Long tones daily, 1 min per note',
      'Lip slurs: 1-3-5-3-1 daily',
      'B-flat scale at 80bpm',
      '5 minutes of articulation drills',
      'Chromatic range work',
      'Sight-read 1 new piece per day',
      'Mouthpiece buzzing 5 mins daily',
      'Listen to brass band recordings',
      'Practise double-tonguing at slow tempo',
      'Posture/breathing review'
    ], ARRAY[
      'Tone consistency', 'Lip flexibility', 'Range',
      'Articulation', 'Endurance', 'Breath support',
      'Phrasing', 'Intonation'
    ]
  ),
  lesson_pool AS (
    SELECT
      l.id AS lesson_id, l.org_id,
      lp.student_id, l.teacher_id,
      CASE
        WHEN i.name = 'Piano' THEN 'keys'
        WHEN i.name IN ('Violin','Viola','Cello') THEN 'strings'
        WHEN i.name IN ('Flute','Clarinet','Saxophone') THEN 'woodwinds'
        WHEN i.name IN ('Trumpet','Trombone','Horn','Tuba') THEN 'brass'
        ELSE 'keys'
      END AS family,
      ('x' || substr(md5(l.id::text), 1, 8))::bit(32)::int AS h1,
      ('x' || substr(md5(l.id::text), 9, 8))::bit(32)::int AS h2,
      ('x' || substr(md5(l.id::text), 17, 8))::bit(32)::int AS h3,
      ('x' || substr(md5(l.id::text), 25, 8))::bit(32)::int AS h4
    FROM lessons l
    JOIN lesson_participants lp ON lp.lesson_id = l.id
    JOIN students s ON s.id = lp.student_id
    JOIN student_instruments si ON si.student_id = s.id AND si.is_primary
    JOIN instruments i ON i.id = si.instrument_id
    WHERE l.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
      AND l.status = 'completed'
  ),
  sampled AS (
    SELECT * FROM lesson_pool WHERE abs(h1) % 100 < 35
  ),
  with_content AS (
    SELECT s.lesson_id, s.org_id, s.student_id, s.teacher_id, s.h1, s.h2, s.h3, s.h4,
      fc.content, fc.homework, fc.focus_areas_pool
    FROM sampled s JOIN family_content fc ON fc.family = s.family
  ),
  with_picks AS (
    SELECT *,
      content[(abs(h1) % array_length(content,1)) + 1] AS c1,
      content[(abs(h2) % array_length(content,1)) + 1] AS c2,
      homework[(abs(h2) % array_length(homework,1)) + 1] AS hw1,
      homework[(abs(h3) % array_length(homework,1)) + 1] AS hw2,
      focus_areas_pool[(abs(h1) % array_length(focus_areas_pool,1)) + 1] AS fa1,
      focus_areas_pool[(abs(h2) % array_length(focus_areas_pool,1)) + 1] AS fa2,
      CASE
        WHEN abs(h4) % 100 < 5 THEN 1::smallint
        WHEN abs(h4) % 100 < 15 THEN 2::smallint
        WHEN abs(h4) % 100 < 45 THEN 3::smallint
        WHEN abs(h4) % 100 < 80 THEN 4::smallint
        ELSE 5::smallint
      END AS engagement,
      (abs(h3) % 100 < 80) AS visible
    FROM with_content
  )
INSERT INTO lesson_notes (
  lesson_id, org_id, student_id, teacher_id,
  content_covered, homework, focus_areas, engagement_rating,
  parent_visible, teacher_private_notes
)
SELECT
  wp.lesson_id, wp.org_id, wp.student_id, wp.teacher_id,
  CASE WHEN wp.c1 = wp.c2 THEN wp.c1 ELSE wp.c1 || ' | ' || wp.c2 END,
  CASE WHEN wp.hw1 = wp.hw2 THEN wp.hw1 ELSE wp.hw1 || ' | ' || wp.hw2 END,
  CASE WHEN wp.fa1 = wp.fa2 THEN wp.fa1 ELSE wp.fa1 || ', ' || wp.fa2 END,
  wp.engagement, wp.visible,
  CASE
    WHEN NOT wp.visible AND wp.engagement <= 2 THEN 'Concerning lack of engagement — possible burnout or external stress. Will follow up with guardian if not improved by next week.'
    WHEN NOT wp.visible AND wp.engagement = 3 THEN 'Average lesson but practice consistency seems off. Parent dynamic may need a check-in call.'
    WHEN NOT wp.visible THEN 'Strong session — keeping note private as it covers internal teacher reflection on pacing.'
    WHEN wp.engagement = 1 THEN 'Very distracted today — possibly tired or unwell. Worth a parent check-in.'
    WHEN wp.engagement = 2 THEN 'Struggling with motivation. Behind on practice for 2+ weeks now.'
    ELSE NULL
  END
FROM with_picks wp
ON CONFLICT DO NOTHING;
