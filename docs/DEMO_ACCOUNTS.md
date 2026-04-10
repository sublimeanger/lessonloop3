# Demo Accounts

> **Last Updated**: 2026-04-10

Three demo environments are available, each seeded by a dedicated edge function. All require `ALLOW_SEED=true` to run.

---

## 1. Original Demo — Harmony Music Studios (Academy)

**Seed function**: `seed-demo-data`

| Role | Email | Password |
|------|-------|----------|
| Owner | *(uses existing owner account)* | — |
| Parent | `demo-parent@lessonloop.test` | `DemoParent2026!` |

Small-scale academy with 3 teachers, 12 students. Good for quick feature demos.

---

## 2. Agency Demo — Crescendo Music Agency

**Seed function**: `seed-demo-agency`

### Credentials

| Role | Email | Password |
|------|-------|----------|
| **Owner** | `demo-agency-owner@lessonloop.test` | `DemoAgency2026!` |
| Admin | `demo-agency-admin@lessonloop.test` | `DemoAgency2026!` |
| Teacher 1 | `demo-teacher-1@lessonloop.test` | `DemoTeacher2026!` |
| Teacher 2 | `demo-teacher-2@lessonloop.test` | `DemoTeacher2026!` |
| Teacher 3 | `demo-teacher-3@lessonloop.test` | `DemoTeacher2026!` |
| Teacher 4 | `demo-teacher-4@lessonloop.test` | `DemoTeacher2026!` |
| Teacher 5 | `demo-teacher-5@lessonloop.test` | `DemoTeacher2026!` |
| Parent 1 | `demo-parent-1@lessonloop.test` | `DemoParent2026!` |
| Parent 2 | `demo-parent-2@lessonloop.test` | `DemoParent2026!` |
| Parent 3 | `demo-parent-3@lessonloop.test` | `DemoParent2026!` |
| Parent 4 | `demo-parent-4@lessonloop.test` | `DemoParent2026!` |
| Parent 5 | `demo-parent-5@lessonloop.test` | `DemoParent2026!` |
| Parent 6 | `demo-parent-6@lessonloop.test` | `DemoParent2026!` |
| Parent 7 | `demo-parent-7@lessonloop.test` | `DemoParent2026!` |
| Parent 8 | `demo-parent-8@lessonloop.test` | `DemoParent2026!` |
| Parent 9 | `demo-parent-9@lessonloop.test` | `DemoParent2026!` |
| Parent 10 | `demo-parent-10@lessonloop.test` | `DemoParent2026!` |

### Data Volumes

| Entity | Count | Notes |
|--------|-------|-------|
| Org plan | Agency | Full multi-teacher, multi-location |
| Teachers | 5 | Piano/Voice, Violin/Cello, Guitar/Bass/Ukulele, Flute/Clarinet, Drums/Sax/Trumpet |
| Locations | 3 | Crescendo Central (4 rooms), Crescendo North (2 rooms), Online |
| Students | 40 | 35 active, 5 inactive |
| Guardians | 25 | 10 with portal access, some families with 2 guardians |
| Terms | 4 | Autumn 2025, Spring 2026, Summer 2026, Autumn 2026 |
| Lessons | ~800+ | All terms, private + Saturday ensemble |
| Invoices | ~50+ | Autumn paid, Spring mixed (paid/sent/overdue/draft/voided), Summer drafts |
| Payment plans | 5 | 3-installment plans, various states |
| Billing runs | 3 | 2 completed, 1 draft |
| Make-up credits | 8 | Available, redeemed, expired, voided |
| Enrolment waitlist | 6 | Various states |
| Leads | 8 | Full pipeline |
| Practice assignments | 10 | With varied log patterns |
| Resources | 8 | Shared to students |
| Message log | 20 | Invoice sends, reminders, custom |
| Availability | Full weekly per teacher | |
| Booking page | 1 | Enabled |

---

## 3. Solo Teacher Demo — Ms Taylor's Music

**Seed function**: `seed-demo-solo`

### Credentials

| Role | Email | Password |
|------|-------|----------|
| **Owner** | `demo-solo-owner@lessonloop.test` | `DemoSolo2026!` |
| Parent 1 | `demo-solo-parent-1@lessonloop.test` | `DemoParent2026!` |
| Parent 2 | `demo-solo-parent-2@lessonloop.test` | `DemoParent2026!` |

### Data Volumes

| Entity | Count | Notes |
|--------|-------|-------|
| Org plan | Solo Teacher | No VAT |
| Teachers | 1 | Owner = Rebecca Taylor |
| Locations | 2 | Home Studio (Bath) + Online |
| Students | 12 | 10 active, 2 inactive |
| Guardians | 8 | 2 with portal access |
| Terms | 3 | Autumn 2025, Spring 2026, Summer 2026 |
| Lessons | ~150 | Private only |
| Invoices | ~16 | Autumn all paid, Spring mixed |
| Make-up credits | 3 | Available, redeemed, expired |
| Leads | 3 | Enquiry, trial booked, lost |
| Resources | 3 | Shared to students |
| Billing runs | 2 | Both completed |

---

## Running the Seeds

Each function is an edge function that requires:
1. `ALLOW_SEED=true` environment variable
2. A valid authenticated user (Authorization header)

Each run creates a **new org** with a unique ID — safe to run multiple times.
