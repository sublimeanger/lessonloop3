-- Session 32 — minimum-viable-shadow data seed for 551ca74e
--
-- This script captures the cluster expansions applied during s32. The
-- seed-shadow-org edge fn handles the org+memberships+teachers+location+
-- rooms+terms+closures skeleton (s31); this script extends that skeleton
-- into a populated Studio org Lauren can actually USE.
--
-- Target: organisations.id = 551ca74e-d47d-4d02-9a4b-24863349a030
-- Owner:  Jamie McKaye  (auth.users.id 29ae9f1e-c528-40ea-b9e8-84c2f03b15a9)
-- Admin:  Lauren Twilley (auth.users.id 1e52dad5-77aa-437a-9cc9-6425001f3e39)
-- Subscription plan in DB: 'academy' (= Studio in UI; see audit/findings/
-- 2026-05-10-subscription-plan-enum-ui-naming-mismatch.md for v1.1 fix).
--
-- Assumes the org skeleton already exists (run seed-shadow-org first, or
-- accept the org_id substitution below if recreating).
--
-- Idempotency: This script is NOT idempotent in itself; running twice
-- will double-seed every cluster. Use reset-shadow-org first if re-running.
--
-- Schema notes captured during s32 cluster discovery:
--   - lessons NOT NULL: org_id, start_at, end_at, lesson_type, status,
--     title, created_by, is_series_exception, is_online, is_open_slot.
--   - check_lesson_conflicts trigger blocks teacher AND room double-booking.
--     Strategy: Teacher A → Room 1, Teacher B → Room 2; unique (day,hour)
--     per teacher (45 students × 1 weekly slot = 45 slots, 6 days × 8 hours
--     gives 48 slots so we fit).
--   - invoices: NOT NULL invoice_number (auto-set via BEFORE INSERT trigger;
--     pass '' or NULL), issue_date, due_date, subtotal_minor, total_minor,
--     tax_minor, vat_rate, currency_code. CHECK constraint payer_xor:
--     payer_student_id XOR payer_guardian_id (exactly one must be non-null).
--   - rate_cards: rate_amount_minor is NUMERIC in MINOR units (pence/cents).
--     Enforced by CHECK rate_amount_minor_is_minor_units (>= 100 OR = 0).
--     s36 renamed from rate_amount + migrated all pound-shaped data.
--   - make_up_waitlist NOT NULL: lesson_duration_minutes, lesson_title,
--     absence_reason (enum), missed_lesson_date, status='waiting' default.
--   - practice_assignments: teacher_user_id NOT NULL (FK to auth.users).
--     Since shadow teachers aren't real users, use Lauren's user_id.
--   - org_memberships has NO FK on user_id but UNIQUE(org_id, user_id).
--     Multi-row inserts: error per-row, so split into per-row inserts with
--     explicit error checks (see seed-shadow-org/index.ts).
--   - org cascade-delete: audit_log inserts during cascade can fail the FK
--     check ("org not present") because the parent is dropped before child
--     audit rows insert. Workaround: explicit child cleanup (delete from
--     org_memberships, teachers, audit_log) BEFORE delete from organisations.

-- =============================================================================
-- PHASE 2.2 — Rate cards (8 cards, org-scoped, no teacher FK)
-- =============================================================================

-- rate_amount_minor in pence: 2000 = £20.00
INSERT INTO rate_cards (org_id, name, duration_mins, rate_amount_minor, currency_code, is_default) VALUES
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '30min Beginner',     30, 2000, 'GBP', true),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '30min Standard',     30, 2200, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '45min Intermediate', 45, 3000, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '60min Advanced',     60, 4000, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '60min Adult',        60, 4500, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '30min Trial Lesson', 30, 1500, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '45min Exam Prep',    45, 3500, 'GBP', false),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', '60min Diploma Prep', 60, 5500, 'GBP', false);

-- =============================================================================
-- PHASE 2.3 — Students + guardians + relationships + instruments + assignments
-- (90 students, 80 guardians [10 siblings sharing a guardian], 90:90:90 link counts)
-- =============================================================================

-- Students — 90 UK first/last name combinations, age 5-17, split 45/45 between teachers
WITH
  ref AS (
    SELECT
      '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid AS org_id,
      'c2066d13-6cf0-4ee3-bddd-bb451212f70f'::uuid AS teacher_a,  -- James Coleman
      '2bccc359-3c8b-4e1d-bfd7-e24abbdfb894'::uuid AS teacher_b,  -- Sarah Mitchell
      '0363399c-5732-4dc9-b561-03f8f7980048'::uuid AS location_id,
      (SELECT id FROM rate_cards WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND is_default LIMIT 1) AS rate_default
  ),
  names AS (
    SELECT * FROM (VALUES
      ('Emma','Thompson',10),('James','Walker',14),('Sophie','Harrison',8),('Oliver','Brown',12),('Charlotte','Wilson',7),
      ('Harry','Roberts',15),('Amelia','Hughes',9),('George','Clarke',11),('Ava','Hall',13),('Noah','Wright',6),
      ('Isabella','Green',16),('William','Lewis',10),('Mia','Wood',8),('Jack','Cooper',14),('Lily','Ward',12),
      ('Thomas','Bell',9),('Grace','King',7),('Henry','Watson',15),('Olivia','Morris',11),('Charlie','Bailey',13),
      ('Freya','Cox',8),('Alfie','Ross',10),('Evie','Mason',6),('Jacob','Adams',14),('Poppy','Knight',9),
      ('Oscar','Carter',12),('Daisy','Hill',7),('Leo','Murray',16),('Phoebe','Webb',10),('Joshua','Stevens',13),
      ('Florence','Reid',8),('Ethan','Hunt',11),('Ruby','Bird',9),('Samuel','Powell',15),('Hannah','Foster',12),
      ('Theo','Cole',7),('Maya','Dixon',14),('Alexander','Lee',10),('Eliza','Shaw',6),('Toby','Webster',13),
      ('Beatrice','Doyle',11),('Mason','Stone',8),('Willow','Banks',16),('Finley','Sharp',9),('Esme','Lane',12),
      ('Reuben','West',7),('Iris','Page',14),('Dexter','Pearce',10),('Matilda','Ellis',13),('Rory','Fox',6),
      ('Bella','Harper',11),('Felix','Norton',8),('Penelope','Knox',15),('Logan','Booth',10),('Ada','Marsh',12),
      ('Caleb','Holt',9),('Jasmine','Riley',7),('Sebastian','Ford',14),('Lottie','Pope',11),('Ezra','Berry',13),
      ('Margot','Heath',8),('Joel','Pugh',10),('Nora','Vine',16),('Zac','Hardy',12),('Vivienne','Lord',6),
      ('Asher','Gibbs',9),('Talia','Pitt',15),('Cody','Ashford',13),('Aria','Tucker',7),('Otis','Patel',14),
      ('Hazel','Singh',11),('Idris','Khan',10),('Maeve','Bashir',8),('Yusuf','Ahmed',12),('Naima','Begum',16),
      ('Ayaan','Iqbal',6),('Zara','Hussain',9),('Sami','Malik',13),('Aliya','Rahman',7),('Ravi','Kapoor',15),
      ('Priya','Mehra',11),('Arjun','Bose',14),('Anika','Joshi',10),('Diya','Rao',12),('Nathan','OBrien',8),
      ('Sienna','McKenna',13),('Eoin','Boyle',9),('Niamh','Quinn',16),('Cian','Ryan',11),('Saoirse','Nolan',7)
    ) AS v(first_name, last_name, age_years)
  ),
  numbered AS (SELECT first_name, last_name, age_years, row_number() OVER () AS idx FROM names)
INSERT INTO students (org_id, first_name, last_name, status, dob, start_date, default_location_id, default_rate_card_id, default_teacher_id)
SELECT
  ref.org_id, n.first_name, n.last_name, 'active',
  (CURRENT_DATE - ((n.age_years::int * 365 + (n.idx::int * 73) % 360)))::date,
  (CURRENT_DATE - (n.idx::int * 11))::date,
  ref.location_id, ref.rate_default,
  CASE WHEN n.idx::int % 2 = 0 THEN ref.teacher_a ELSE ref.teacher_b END
FROM ref, numbered n;

-- Guardians — 80 rows (skip idx%9=0 so 10 students share previous-student's guardian)
WITH students_ranked AS (
  SELECT id, first_name, last_name, row_number() OVER (ORDER BY created_at, id) AS idx
  FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
)
INSERT INTO guardians (org_id, full_name, email, phone)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid,
  CASE (sr.idx % 4)
    WHEN 0 THEN 'Mr ' || sr.last_name
    WHEN 1 THEN 'Mrs ' || sr.last_name
    WHEN 2 THEN 'Ms ' || sr.last_name
    ELSE 'Mx ' || sr.last_name
  END,
  'shadow-guardian-' || sr.idx || '@lessonloop.test',
  '07700 900' || lpad(sr.idx::text, 3, '0')
FROM students_ranked sr WHERE sr.idx % 9 != 0;

-- Link students to guardians (siblings share)
WITH
  students_ranked AS (
    SELECT id AS student_id, last_name, row_number() OVER (ORDER BY created_at, id) AS sidx
    FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  guardians_ranked AS (
    SELECT id AS guardian_id, substring(email FROM 'shadow-guardian-(\d+)@')::int AS sidx
    FROM guardians WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  student_to_guardian AS (
    SELECT s.student_id, CASE WHEN s.sidx % 9 = 0 THEN s.sidx - 1 ELSE s.sidx END AS guardian_sidx, s.sidx
    FROM students_ranked s
  )
INSERT INTO student_guardians (org_id, student_id, guardian_id, relationship, is_primary_payer)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, sg.student_id, g.guardian_id,
  (ARRAY['mother','father','guardian','mother','father']::relationship_type[])[(sg.sidx % 5) + 1],
  TRUE
FROM student_to_guardian sg
JOIN guardians_ranked g ON g.sidx = sg.guardian_sidx;

-- Instruments — 1 primary per student, cycling through 7 popular instruments
WITH
  students_ranked AS (
    SELECT id AS student_id, row_number() OVER (ORDER BY created_at, id) AS idx
    FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  instrument_pool AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, name) AS iidx
    FROM instruments WHERE org_id IS NULL
      AND name IN ('Piano','Voice','Violin','Guitar','Drums','Cello','Flute','Clarinet','Saxophone','Trumpet')
  ),
  grade_pool AS (
    SELECT id, row_number() OVER (ORDER BY sort_order) AS gidx FROM grade_levels WHERE NOT is_diploma
  )
INSERT INTO student_instruments (student_id, org_id, instrument_id, is_primary, current_grade_id)
SELECT
  s.student_id, '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, i.id, TRUE, g.id
FROM students_ranked s
JOIN instrument_pool i ON i.iidx = ((s.idx - 1) % (SELECT count(*) FROM instrument_pool)) + 1
JOIN grade_pool g ON g.gidx = ((s.idx - 1) % LEAST((SELECT count(*) FROM grade_pool), 8)) + 1;

-- Teacher assignments (mirroring students.default_teacher_id)
INSERT INTO student_teacher_assignments (org_id, student_id, teacher_id, is_primary)
SELECT org_id, id, default_teacher_id, TRUE
FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030';

-- =============================================================================
-- PHASE 2.4 — Recurrence rules + lessons + lesson_participants
-- =============================================================================

-- 90 recurrence rules — one per student (1:1 by creation order)
WITH students_ranked AS (
  SELECT row_number() OVER (ORDER BY created_at, id) AS idx
  FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
)
INSERT INTO recurrence_rules (org_id, pattern_type, days_of_week, interval_weeks, start_date, timezone)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, 'weekly',
  ARRAY[((s.idx::int - 1) % 6) + 1], 1,
  (CURRENT_DATE - INTERVAL '12 weeks')::date,
  'Europe/London'
FROM students_ranked s;

-- ~2068 lessons (90 students × 24 weeks of recurrence, minus closure-day skips)
-- Teacher A → Room 1; Teacher B → Room 2. Per-teacher unique (day,hour) slot.
WITH
  students_ranked AS (
    SELECT id AS student_id, default_teacher_id, first_name,
           row_number() OVER (PARTITION BY default_teacher_id ORDER BY created_at, id) AS per_teacher_idx,
           row_number() OVER (ORDER BY created_at, id) AS global_idx
    FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  recur_ranked AS (
    SELECT id AS recur_id, row_number() OVER (ORDER BY created_at, id) AS idx
    FROM recurrence_rules WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  student_recur AS (
    SELECT s.student_id, s.default_teacher_id, s.first_name, s.global_idx, s.per_teacher_idx, r.recur_id,
           ((s.per_teacher_idx - 1) % 6) + 1 AS day_of_week,
           9 + ((s.per_teacher_idx - 1) / 6)::int AS lesson_hour
    FROM students_ranked s
    JOIN recur_ranked r ON r.idx = s.global_idx
  ),
  instr_per_student AS (
    SELECT si.student_id, i.name AS instrument_name
    FROM student_instruments si
    JOIN instruments i ON i.id = si.instrument_id
    WHERE si.org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND si.is_primary
  ),
  week_offsets AS (SELECT generate_series(-12, 11) AS wk),
  closures AS (SELECT date FROM closure_dates WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'),
  candidate AS (
    SELECT
      sr.student_id, sr.default_teacher_id, sr.recur_id, sr.first_name, sr.day_of_week, sr.lesson_hour, w.wk,
      ips.instrument_name,
      (date_trunc('week', CURRENT_DATE) + (w.wk * 7 + (sr.day_of_week - 1)) * INTERVAL '1 day')::date AS lesson_date
    FROM student_recur sr
    JOIN week_offsets w ON TRUE
    JOIN instr_per_student ips ON ips.student_id = sr.student_id
  ),
  filtered AS (
    SELECT c.* FROM candidate c
    WHERE NOT EXISTS (SELECT 1 FROM closures cl WHERE cl.date = c.lesson_date)
  )
INSERT INTO lessons (
  org_id, start_at, end_at, lesson_type, status, title, created_by,
  teacher_id, location_id, room_id, recurrence_id, is_online, is_open_slot
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid,
  (f.lesson_date + (f.lesson_hour || ' hours')::interval) AT TIME ZONE 'Europe/London',
  (f.lesson_date + (f.lesson_hour || ' hours')::interval + INTERVAL '30 minutes') AT TIME ZONE 'Europe/London',
  'private',
  CASE WHEN f.lesson_date < CURRENT_DATE THEN 'completed'::lesson_status ELSE 'scheduled'::lesson_status END,
  f.instrument_name || ' lesson — ' || f.first_name,
  '1e52dad5-77aa-437a-9cc9-6425001f3e39'::uuid,
  f.default_teacher_id,
  '0363399c-5732-4dc9-b561-03f8f7980048'::uuid,
  CASE WHEN f.default_teacher_id = 'c2066d13-6cf0-4ee3-bddd-bb451212f70f'
       THEN 'f05f10b8-43ec-4180-af2b-dff2af2dac3b'::uuid
       ELSE 'e1b16649-0b31-4d43-86f3-0198eb64caf6'::uuid END,
  f.recur_id, FALSE, FALSE
FROM filtered f;

-- lesson_participants (1 per lesson, by recurrence_id linkage)
WITH
  students_ranked AS (
    SELECT id AS student_id, row_number() OVER (ORDER BY created_at, id) AS idx
    FROM students WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  recur_ranked AS (
    SELECT id AS recur_id, row_number() OVER (ORDER BY created_at, id) AS idx
    FROM recurrence_rules WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  recur_to_student AS (
    SELECT s.student_id, r.recur_id FROM students_ranked s JOIN recur_ranked r ON r.idx = s.idx
  )
INSERT INTO lesson_participants (org_id, lesson_id, student_id)
SELECT '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, l.id, rs.student_id
FROM lessons l
JOIN recur_to_student rs ON rs.recur_id = l.recurrence_id
WHERE l.org_id='551ca74e-d47d-4d02-9a4b-24863349a030';

-- =============================================================================
-- PHASE 2.5 — Attendance records on past lessons (~1124 rows: 92% present, 5% absent, 3% late)
-- =============================================================================

INSERT INTO attendance_records (
  org_id, lesson_id, student_id, attendance_status, recorded_by, recorded_at, absence_reason_category
)
SELECT
  l.org_id, l.id, lp.student_id,
  CASE
    WHEN (('x' || substr(md5(l.id::text), 1, 8))::bit(32)::int % 100) < 85 THEN 'present'::attendance_status
    WHEN (('x' || substr(md5(l.id::text), 1, 8))::bit(32)::int % 100) < 95 THEN 'absent'::attendance_status
    ELSE 'late'::attendance_status
  END,
  '1e52dad5-77aa-437a-9cc9-6425001f3e39'::uuid,
  l.end_at + ((('x' || substr(md5(l.id::text), 9, 4))::bit(16)::int % 1800) || ' seconds')::interval,
  CASE
    WHEN (('x' || substr(md5(l.id::text), 1, 8))::bit(32)::int % 100) BETWEEN 85 AND 94 THEN
      (ARRAY['sick','school_commitment','family_emergency','holiday','no_show']::absence_reason[])[
        ((('x' || substr(md5(l.id::text), 13, 4))::bit(16)::int % 5) + 1)
      ]
    ELSE NULL
  END
FROM lessons l
JOIN lesson_participants lp ON lp.lesson_id = l.id
WHERE l.org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND l.status = 'completed';

-- =============================================================================
-- PHASE 2.6 — Make-up credits + waitlist (20 credits for sick/family_emergency absences; 4 waitlist)
-- =============================================================================

WITH absent_records AS (
  SELECT ar.id AS attendance_id, ar.student_id, ar.lesson_id, ar.recorded_at,
    row_number() OVER (ORDER BY ar.recorded_at) AS rn
  FROM attendance_records ar
  WHERE ar.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
    AND ar.attendance_status = 'absent'
    AND ar.absence_reason_category IN ('sick','family_emergency')
)
INSERT INTO make_up_credits (org_id, student_id, issued_for_lesson_id, issued_at, credit_value_minor, created_by)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, ar.student_id, ar.lesson_id, ar.recorded_at,
  2000,
  '1e52dad5-77aa-437a-9cc9-6425001f3e39'::uuid
FROM absent_records ar WHERE ar.rn <= 20;

WITH absent_for_waitlist AS (
  SELECT ar.student_id, ar.lesson_id, l.start_at::date AS missed_date, l.title,
    row_number() OVER (ORDER BY ar.recorded_at DESC) AS rn, ar.absence_reason_category
  FROM attendance_records ar JOIN lessons l ON l.id = ar.lesson_id
  WHERE ar.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
    AND ar.attendance_status = 'absent' AND ar.absence_reason_category = 'sick'
)
INSERT INTO make_up_waitlist (
  org_id, student_id, missed_lesson_id, missed_lesson_date, absence_reason,
  lesson_duration_minutes, lesson_title, status
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, a.student_id, a.lesson_id, a.missed_date,
  a.absence_reason_category, 30, a.title, 'waiting'
FROM absent_for_waitlist a WHERE a.rn <= 4;

-- =============================================================================
-- PHASE 3.1 — Invoices (one per student with completed lessons, 70/20/5/5 status mix)
-- =============================================================================

WITH
  students_with_lessons AS (
    SELECT s.id AS student_id, row_number() OVER (ORDER BY s.created_at, s.id) AS idx,
      count(l.id) FILTER (WHERE l.status = 'completed') AS completed_count
    FROM students s
    LEFT JOIN lesson_participants lp ON lp.student_id = s.id AND lp.org_id = s.org_id
    LEFT JOIN lessons l ON l.id = lp.lesson_id
    WHERE s.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
    GROUP BY s.id
    HAVING count(l.id) FILTER (WHERE l.status = 'completed') > 0
  )
INSERT INTO invoices (
  org_id, invoice_number, status, issue_date, due_date,
  currency_code, subtotal_minor, total_minor, tax_minor, vat_rate, payer_student_id
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, '',  -- trigger auto-generates invoice_number
  CASE
    WHEN sl.idx % 20 < 14 THEN 'paid'::invoice_status
    WHEN sl.idx % 20 < 18 THEN 'outstanding'::invoice_status
    WHEN sl.idx % 20 = 18 THEN 'overdue'::invoice_status
    ELSE 'draft'::invoice_status
  END,
  (CURRENT_DATE - INTERVAL '8 weeks')::date,
  (CURRENT_DATE - INTERVAL '6 weeks')::date,
  'GBP', sl.completed_count * 2000, sl.completed_count * 2000, 0, 0, sl.student_id
FROM students_with_lessons sl;

-- =============================================================================
-- PHASE 3.2 — Invoice items (one per completed lesson on each invoice)
-- =============================================================================

WITH invoice_to_student AS (
  SELECT i.id AS invoice_id, i.payer_student_id AS student_id
  FROM invoices i WHERE i.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
)
INSERT INTO invoice_items (
  invoice_id, org_id, description, quantity, unit_price_minor, amount_minor, linked_lesson_id
)
SELECT
  its.invoice_id, '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid,
  l.title || ' (' || to_char(l.start_at AT TIME ZONE 'Europe/London', 'DD Mon YYYY') || ')',
  1, 2000, 2000, l.id
FROM invoice_to_student its
JOIN lesson_participants lp ON lp.student_id = its.student_id AND lp.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
JOIN lessons l ON l.id = lp.lesson_id AND l.status = 'completed' AND l.org_id='551ca74e-d47d-4d02-9a4b-24863349a030';

-- =============================================================================
-- PHASE 3.3 — Payments (full on paid invoices, 50% partial on first 5 outstanding)
-- =============================================================================

WITH paid_invoices AS (
  SELECT i.id AS invoice_id, i.total_minor,
    row_number() OVER (ORDER BY i.created_at, i.id) AS rn
  FROM invoices i
  WHERE i.org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND i.status = 'paid'
)
INSERT INTO payments (org_id, invoice_id, amount_minor, currency_code, method, provider, paid_at)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, pi.invoice_id, pi.total_minor, 'GBP',
  CASE
    WHEN pi.rn % 20 < 12 THEN 'card'::payment_method
    WHEN pi.rn % 20 < 17 THEN 'bank_transfer'::payment_method
    ELSE 'cash'::payment_method
  END,
  CASE WHEN pi.rn % 20 < 12 THEN 'stripe'::payment_provider ELSE 'manual'::payment_provider END,
  (CURRENT_DATE - INTERVAL '4 weeks' + (pi.rn || ' minutes')::interval)
FROM paid_invoices pi;

WITH outstanding_invoices AS (
  SELECT i.id AS invoice_id, i.total_minor,
    row_number() OVER (ORDER BY i.created_at, i.id) AS rn
  FROM invoices i
  WHERE i.org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND i.status = 'outstanding'
)
INSERT INTO payments (org_id, invoice_id, amount_minor, currency_code, method, provider, paid_at)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, oi.invoice_id, (oi.total_minor / 2),
  'GBP', 'card'::payment_method, 'stripe'::payment_provider,
  (CURRENT_DATE - INTERVAL '2 weeks' + (oi.rn || ' minutes')::interval)
FROM outstanding_invoices oi WHERE oi.rn <= 5;

-- =============================================================================
-- PHASE 4 — Message log + templates + practice + recurring templates
-- =============================================================================

-- 40 historical message_log entries, distributed across 4 message_types
WITH guardian_pool AS (
  SELECT id AS guardian_id, email, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM guardians WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030' AND email IS NOT NULL
)
INSERT INTO message_log (
  org_id, recipient_email, message_type, subject, body, status, channel, created_at
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, gp.email,
  CASE (gp.rn % 4)
    WHEN 0 THEN 'invoice_sent' WHEN 1 THEN 'lesson_reminder'
    WHEN 2 THEN 'attendance_followup' ELSE 'practice_reminder' END,
  CASE (gp.rn % 4)
    WHEN 0 THEN 'Your invoice for ' || to_char((CURRENT_DATE - INTERVAL '6 weeks')::date, 'Month YYYY') || ' is ready'
    WHEN 1 THEN 'Lesson reminder — tomorrow at 4pm'
    WHEN 2 THEN 'We missed you in last week''s lesson'
    ELSE 'Daily practice reminder' END,
  CASE (gp.rn % 4)
    WHEN 0 THEN 'Hi, your invoice is attached. Please pay within 14 days.'
    WHEN 1 THEN 'Hi, just a reminder of your lesson tomorrow at the studio.'
    WHEN 2 THEN 'Hi, sorry you couldn''t make last week''s lesson. Can we rebook?'
    ELSE 'Hi, a quick reminder to practise for 15 minutes today!' END,
  CASE WHEN gp.rn % 10 = 0 THEN 'pending' ELSE 'delivered' END,
  'email',
  (CURRENT_DATE - INTERVAL '12 weeks' + (gp.rn * 2 || ' days')::interval)
FROM guardian_pool gp WHERE gp.rn <= 40;

-- 5 message_templates
INSERT INTO message_templates (org_id, name, subject, body, channel) VALUES
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Lesson reminder', 'Lesson reminder for {{student_name}}', 'Hi {{guardian_name}}, just a reminder of {{student_name}}''s lesson on {{lesson_date}} at {{lesson_time}}.', 'email'),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Term invoice', 'Term invoice for {{student_name}}', 'Hi {{guardian_name}}, please find attached the invoice for {{student_name}}''s lessons this term. Payment is due within 14 days.', 'email'),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Welcome new student', 'Welcome to Lauren''s Studio!', 'Hi {{guardian_name}}, we''re delighted to welcome {{student_name}} to our music school. Here''s what to expect in their first lesson.', 'email'),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Make-up offer', 'We have a make-up slot for {{student_name}}', 'Hi {{guardian_name}}, we have a make-up slot available for {{student_name}}''s missed lesson on {{missed_date}}. Reply to confirm.', 'email'),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Missed lesson follow-up', 'Sorry we missed {{student_name}}', 'Hi {{guardian_name}}, we noticed {{student_name}} wasn''t at their lesson today. Hope everything''s OK. Reply to rebook.', 'email');

-- Practice assignments — 1 per student. teacher_user_id NOT NULL FK → Lauren (admin proxy)
INSERT INTO practice_assignments (
  org_id, student_id, teacher_user_id, title, start_date, status
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, s.id,
  '1e52dad5-77aa-437a-9cc9-6425001f3e39'::uuid,
  'Daily practice — ' || (
    SELECT i.name FROM student_instruments si JOIN instruments i ON i.id = si.instrument_id
    WHERE si.student_id = s.id AND si.is_primary LIMIT 1
  ) || ' technique',
  (CURRENT_DATE - INTERVAL '3 weeks')::date, 'active'
FROM students s WHERE s.org_id='551ca74e-d47d-4d02-9a4b-24863349a030';

-- Practice logs — ~165 rows spread across past 30 days, by 50 assignments
WITH
  assignments AS (
    SELECT id AS assignment_id, student_id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM practice_assignments WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  days AS (SELECT generate_series(0, 29) AS dayoff)
INSERT INTO practice_logs (
  org_id, student_id, assignment_id, logged_by_user_id, practice_date, duration_minutes
)
SELECT
  '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, a.student_id, a.assignment_id,
  '1e52dad5-77aa-437a-9cc9-6425001f3e39'::uuid,
  (CURRENT_DATE - (d.dayoff || ' days')::interval)::date,
  (ARRAY[15, 20, 30, 45])[((a.rn + d.dayoff) % 4) + 1]
FROM assignments a
JOIN days d ON TRUE
WHERE (a.rn + d.dayoff) % 9 = 0 AND a.rn <= 50;

-- Recurring invoice templates (2: one per teacher)
INSERT INTO recurring_invoice_templates (
  org_id, name, frequency, next_run_date, created_by, billing_mode, delivered_statuses, apply_credits_automatically
) VALUES
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Monthly billing — James',
   'monthly', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date,
   '1e52dad5-77aa-437a-9cc9-6425001f3e39', 'delivered', ARRAY['present']::text[], TRUE),
  ('551ca74e-d47d-4d02-9a4b-24863349a030', 'Monthly billing — Sarah',
   'monthly', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date,
   '1e52dad5-77aa-437a-9cc9-6425001f3e39', 'delivered', ARRAY['present']::text[], TRUE);

-- Recipients (12 per teacher = 24 total)
WITH
  teacher_templates AS (
    SELECT id, name,
      CASE WHEN name ILIKE '%James%' THEN 'c2066d13-6cf0-4ee3-bddd-bb451212f70f'::uuid
           ELSE '2bccc359-3c8b-4e1d-bfd7-e24abbdfb894'::uuid END AS teacher_id
    FROM recurring_invoice_templates WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  ),
  student_picks AS (
    SELECT s.id AS student_id, s.default_teacher_id,
      row_number() OVER (PARTITION BY s.default_teacher_id ORDER BY s.created_at, s.id) AS rn
    FROM students s WHERE s.org_id='551ca74e-d47d-4d02-9a4b-24863349a030'
  )
INSERT INTO recurring_template_recipients (template_id, student_id, org_id, is_active)
SELECT tt.id, sp.student_id, '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid, TRUE
FROM teacher_templates tt
JOIN student_picks sp ON sp.default_teacher_id = tt.teacher_id
WHERE sp.rn <= 12;

-- Template items (1 per template = 2)
INSERT INTO recurring_template_items (template_id, org_id, description, amount_minor, quantity, order_index)
SELECT id, '551ca74e-d47d-4d02-9a4b-24863349a030'::uuid,
  'Standard monthly billing — 4 weekly lessons × £20 = £80', 8000, 1, 0
FROM recurring_invoice_templates WHERE org_id='551ca74e-d47d-4d02-9a4b-24863349a030';
