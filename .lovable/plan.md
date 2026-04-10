

# Comprehensive Demo Seed Data — Agency + Solo Teacher

## Summary
Create two new edge functions that seed production-realistic demo data for two org types: a large **Agency** account ("Crescendo Music Agency") and a small **Solo Teacher** account ("Ms Taylor's Music"). Each will have its own org, users, and deeply interconnected data across every feature module.

---

## Account Credentials (planned)

### Agency Demo (Crescendo Music Agency)
| Role | Email | Password |
|------|-------|----------|
| Owner | `demo-agency-owner@lessonloop.test` | `DemoAgency2026!` |
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

### Solo Teacher Demo (Ms Taylor's Music)
| Role | Email | Password |
|------|-------|----------|
| Owner | `demo-solo-owner@lessonloop.test` | `DemoSolo2026!` |
| Parent 1 | `demo-solo-parent-1@lessonloop.test` | `DemoParent2026!` |
| Parent 2 | `demo-solo-parent-2@lessonloop.test` | `DemoParent2026!` |

---

## Data Volumes

### Agency Org
| Entity | Count | Details |
|--------|-------|---------|
| Teachers | 5 | Varied pay rates (hourly, per_lesson, percentage) |
| Locations | 3 | 2 physical studios + 1 online |
| Rooms | 6 | Across the 2 physical locations |
| Students | 40 | 35 active, 5 inactive |
| Guardians | 25 | Some with 1 child, some with 2-3 |
| Parent Portal Users | 10 | Linked to guardian records |
| Terms | 4 | Autumn 2025, Spring 2026, Summer 2026, Autumn 2026 |
| Lessons | ~800+ | Across all terms, all teachers, private + group |
| Invoices | ~50 | Mix of paid, sent, overdue, draft, voided, partial-pay |
| Payment Plans | 5 | With installments in various states |
| Billing Runs | 3 | Completed for Autumn + Spring, draft for Summer |
| Payments | ~30 | Bank transfer, card, manual |
| Make-up Credits | 8 | Available, redeemed, expired, voided |
| Waitlist Entries | 6 | waiting, matched, offered, accepted, cancelled |
| Continuation Runs | 2 | One completed (Autumn→Spring), one active (Spring→Summer) |
| Continuation Responses | ~30 | continuing, withdrawn, no_response |
| Leads | 8 | All pipeline stages |
| Practice Assignments | 10 | With logs (streaks, sporadic, none) |
| Resources | 8 | Shared to various students |
| Message Log | 20 | Invoice sends, reminders, custom messages |
| Availability Blocks | Per teacher, full weekly schedules |
| Closure Dates | UK school holidays + bank holidays |
| Rate Cards | 6 | 30/45/60 min private, group, online discount |
| Booking Page | 1 | Enabled with teachers selected |

### Solo Teacher Org
| Entity | Count |
|--------|-------|
| Teachers | 1 (owner) |
| Locations | 2 (home studio + online) |
| Rooms | 1 |
| Students | 12 (10 active, 2 inactive) |
| Guardians | 8 |
| Parent Portal Users | 2 |
| Terms | 3 |
| Lessons | ~150 |
| Invoices | ~15 |
| Make-up Credits | 3 |
| Continuation Run | 1 |
| Leads | 3 |
| Resources | 3 |

---

## Implementation Plan

### Step 1: Create `supabase/functions/seed-demo-agency/index.ts`
New edge function (~900 lines) that seeds the Agency org. Key sections:

1. **Org creation** — Agency plan, VAT enabled, GBP, all settings populated
2. **User accounts** — Owner, admin, 5 teachers, 10 parents (auth.admin.createUser)
3. **Teacher records** — Varied pay: hourly (£25/hr), per_lesson (£18), percentage (40%)
4. **3 locations + 6 rooms** — "Crescendo Central" (4 rooms), "Crescendo North" (2 rooms), "Online"
5. **40 students** — Realistic UK names, varied DOBs, notes, 5 inactive
6. **25 guardians** — Linked to students with relationships (mother/father/guardian), primary payers set
7. **10 parent portal users** — Each linked to a guardian record with org_membership role=parent
8. **4 terms** — Autumn 2025 through Autumn 2026
9. **Closure dates** — Full UK school holiday calendar
10. **6 rate cards** — Various durations, group vs private, online discount
11. **~800 lessons** — Across all teachers/terms, with recurrence rules, private + group lessons, Saturday ensembles
12. **Attendance** — ~92% present, some late, absences for credit generation, teacher cancellations
13. **50 invoices** — Autumn (all paid), Spring (mix: paid, sent, overdue, partial, draft, voided), Summer (drafts)
14. **5 payment plan invoices** — With installments (some paid, some pending, some overdue)
15. **3 billing runs** — Autumn completed, Spring completed, Summer draft
16. **Make-up credits** — 8 total: 3 available, 2 redeemed, 2 expired, 1 voided
17. **Waitlist entries** — 6 in various states
18. **2 continuation runs** — Autumn→Spring (completed, all processed), Spring→Summer (active, mixed responses)
19. **~30 continuation responses** — continuing, withdrawn (with reasons), no_response
20. **8 leads** — Full pipeline: enquiry, contacted, trial_booked, trial_completed, enrolled, lost
21. **10 practice assignments + logs** — Varied engagement patterns
22. **8 resources** — PDFs, shared to relevant students
23. **20 message_log entries** — Invoice sends, reminders, custom teacher-parent messages
24. **Availability blocks** — Full weekly schedules per teacher
25. **Booking page** — Enabled and configured

### Step 2: Create `supabase/functions/seed-demo-solo/index.ts`
Smaller function (~400 lines) for the Solo Teacher org:

1. **Org** — solo_teacher plan, no VAT, GBP
2. **1 teacher** (owner) + 2 parent portal users
3. **12 students, 8 guardians**
4. **3 terms, ~150 lessons**
5. **~15 invoices** (mix of statuses)
6. **Make-up credits, continuation, leads, resources**

### Step 3: Deploy both functions
Deploy via the edge function deployment tool. Both will use the same guard pattern as the existing `seed-demo-data` function (ALLOW_SEED env check, auth required).

### Step 4: Update documentation
Add a `docs/DEMO_ACCOUNTS.md` file documenting all login credentials and what data each demo org contains.

---

## Technical Details

- Both functions follow the exact same patterns as the existing `seed-demo-data/index.ts` (findOrInsert, ensureUser, batch inserts in chunks of 50, ALLOW_SEED guard)
- Each function creates its own org via direct insert (not onboarding RPC) to avoid rate limits
- Parent portal users: created via `admin.auth.admin.createUser`, profile upserted, org_membership with role=parent, guardian record linked via `user_id`
- Invoice numbers left empty (auto-generated by DB sequence)
- Billing runs: summary JSONB populated with realistic counts
- Continuation responses use `response_token` for portal deep-link testing
- Message log entries simulate invoice sends, overdue reminders, and custom messages
- All lesson times use UTC but represent UK local times (matching existing pattern)

