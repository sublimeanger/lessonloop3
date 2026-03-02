

# Demo Account Seed Plan — Comprehensive Real-World Data

**Target**: `demo-teacher@lessonloop.test` (User ID: `b633da13-...`, Org ID: `5b905216-...`)

This plan creates a new edge function `seed-demo-data` that populates the demo org with realistic UK music school data touching every feature surface in the app.

---

## Data Architecture

### 1. Organisation Settings
- Update org with full config: VAT enabled (20%), `Europe/London`, `GBP`, `cancellation_notice_hours: 24`, `overdue_reminder_days: [7,14,30]`, `continuation_notice_weeks: 4`, `continuation_assumed_continuing: true`, `parent_can_message_teacher: true`

### 2. Terms (3)
- **Spring 2026**: 2026-01-05 → 2026-03-27 (current term)
- **Summer 2026**: 2026-04-20 → 2026-07-17 (next term)
- **Autumn 2025**: 2025-09-01 → 2025-12-19 (past term, for historical data)

### 3. Teachers (3)
- **Lauren Twilley** (owner, already exists) — Piano, Voice
- **Marcus Chen** — Guitar, Bass, Ukulele
- **Priya Sharma** — Violin, Viola, Cello

### 4. Locations (2) + Rooms (4)
- **Harmony Studios** (123 High Street, Richmond TW9 1DN): Room 1 (cap 1), Room 2 (cap 1), Ensemble Room (cap 8)
- **Online** (type: online): no rooms

### 5. Instruments (8)
Piano, Guitar, Violin, Voice, Drums, Bass, Cello, Ukulele

### 6. Students (12) — mix of active/inactive
| Student | Instrument | Teacher | Status |
|---------|-----------|---------|--------|
| Ella Whitmore | Piano | Lauren | active |
| Noah Patel | Piano | Lauren | active |
| Amelia Brooks | Voice | Lauren | active |
| Oscar Chen | Guitar | Marcus | active |
| Isla Martinez | Guitar | Marcus | active |
| Freddie Young | Bass | Marcus | active |
| Sophia Okafor | Violin | Priya | active |
| Liam Bennett | Violin | Priya | active |
| Ruby Kowalski | Cello | Priya | active |
| George Taylor | Piano | Lauren | inactive |
| Maisie Green | Guitar | Marcus | active |
| Harry Evans | Drums | Lauren | active |

### 7. Guardians (6) + Student-Guardian Links
| Guardian | Children | User Account |
|----------|----------|-------------|
| Sarah Whitmore | Ella, Harry | (no user) |
| Raj Patel | Noah | (no user) |
| Claire Brooks | Amelia, George | (no user) |
| David Martinez | Isla, Oscar | (no user) |
| Jenny Okafor | Sophia | (no user) |
| Anna Bennett | Liam, Ruby | (no user) |

Primary payer flags set appropriately. Maisie and Freddie are self-paying students (no guardian).

### 8. Recurrence Rules + Lessons
- Create weekly recurrence rules for each student-teacher pairing
- Generate 12 weeks of lessons spanning Autumn 2025 and Spring 2026 terms
- Past lessons: `completed` status with attendance records (mix of present/absent/late)
- Future lessons: `scheduled` status
- 2 cancelled lessons (teacher cancelled, student absent) to feed make-up credit system
- Group lesson: "Saturday Ensemble" with Sophia, Liam, Ruby (Priya, Ensemble Room)

### 9. Closure Dates
- Christmas closure: 2025-12-20 → 2026-01-04
- Half-term: 2026-02-16 → 2026-02-20
- Easter: 2026-04-03 → 2026-04-18
- Bank holidays: scattered

### 10. Rate Cards (4)
- Standard 30-min: £35
- Standard 45-min: £48
- Standard 60-min: £60
- Group 60-min: £20

### 11. Invoices (8) — full lifecycle
| Invoice | Payer | Status | Amount | Notes |
|---------|-------|--------|--------|-------|
| LL-2025-00001 | Sarah Whitmore | paid | £420 | Autumn term - Ella |
| LL-2025-00002 | Raj Patel | paid | £350 | Autumn term - Noah |
| LL-2026-00001 | Sarah Whitmore | sent | £455 | Spring term - Ella + Harry |
| LL-2026-00002 | Raj Patel | sent | £350 | Spring term - Noah |
| LL-2026-00003 | Claire Brooks | overdue | £350 | Spring term - Amelia |
| LL-2026-00004 | David Martinez | draft | £700 | Spring term - Isla + Oscar |
| LL-2026-00005 | Freddie Young (self) | sent | £350 | Spring term |
| LL-2026-00006 | Jenny Okafor | paid | £350 | Autumn term - Sophia |

With invoice items linked to lessons where applicable. One invoice with a payment plan (3 monthly installments).

### 12. Payments (for paid/partial invoices)
- Full payments for paid invoices (bank_transfer, card mix)
- One partial payment on Sarah's Spring invoice

### 13. Make-Up Credits (3)
- 1 available credit for Ella (teacher cancelled)
- 1 redeemed credit for Noah (used on replacement lesson)
- 1 expired credit for Amelia

### 14. Make-Up Waitlist (3 entries)
- Ella: `waiting` (matching teacher cancelled slot)
- Oscar: `matched` (matched to a future lesson)
- Sophia: `offered` (offered but not yet responded)

### 15. Term Continuation Run
- Run for Spring → Summer 2026, status: `sent`
- Responses: 8 continuing, 1 withdrawing (George — already inactive), 2 pending

### 16. Leads (5)
| Lead | Stage | Source |
|------|-------|--------|
| Tom Henderson | enquiry | website |
| Lisa Park | contacted | referral |
| James Cooper | trial_booked | website |
| Fatima Hassan | trial_completed | social_media |
| Ben Wright | converted | referral |

### 17. Practice Assignments + Logs
- 4 active practice assignments (Ella, Noah, Sophia, Oscar)
- Practice logs over past 3 weeks for Ella (building a streak) and Noah (sporadic)

### 18. Teacher Availability Blocks
- Lauren: Mon-Fri 09:00-17:00
- Marcus: Mon, Wed, Fri 14:00-20:00
- Priya: Tue, Thu 10:00-18:00, Sat 09:00-13:00

### 19. Messages (4 threads)
- Owner → Sarah Whitmore: welcome + reply
- Owner → David Martinez: invoice reminder
- Priya → Jenny Okafor: lesson feedback
- Internal admin message about upcoming term

### 20. Resources (3)
- "Beginner Scales PDF" shared with Ella, Noah
- "Grade 3 Pieces" shared with Sophia
- "Guitar Chord Chart" shared with Oscar, Isla

### 21. Booking Page
- Enabled with slug `harmony-studios`, title, description, welcome/confirmation messages

### 22. Make-Up Policies
- Seed via existing `seed_make_up_policies` RPC

### 23. Notification Preferences
- Default for all guardian users (opt-in everything except marketing)

### 24. Enrolment Waitlist
- 1 entry: prospective student waiting for a Piano slot

---

## Implementation

**Single new edge function**: `supabase/functions/seed-demo-data/index.ts`

- Uses service role client (same pattern as `seed-e2e-data`)
- Hardcodes the demo org ID and user ID
- Idempotent: checks for existing records before inserting
- Follows dependency order (terms → teachers → students → lessons → invoices → continuation)
- Handles invoice status transitions correctly (draft → sent → paid/overdue)
- Creates realistic UK date/time data in `Europe/London` timezone

**Also fix build errors** in `create-continuation-run/index.ts`, `enrolment-offer-expiry/index.ts`, and `looopassist-execute/index.ts` by adding proper type annotations to Supabase query results.

