# LessonLoop — External Audit Test Checklist

> **Prepared for:** External security & compliance auditor  
> **Platform:** LessonLoop — UK music lesson scheduling, billing & portal SaaS  
> **Last updated:** 2026-02-23  
> **Regulatory context:** UK GDPR, ICO guidance, HMRC record-keeping (6-year minimum)

---

## How to Use This Document

Each test case has:
- **ID** — unique reference (e.g. `SEC-AUTH-01`)
- **Priority** — P0 (critical), P1 (important), P2 (hardening)
- **Pass criteria** — what "pass" looks like
- **Result** — ✅ / ❌ / ⚠️ (to be filled by auditor)

---

## 1. Authentication & Session Management

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-AUTH-01 | P0 | Sign up with valid email + password | Account created, confirmation email sent (no auto-login without verification) | ⚠️ Code path present (`supabase.auth.signUp`), requires live env verification |
| SEC-AUTH-02 | P0 | Sign in with valid credentials | JWT issued, session stored, user redirected to dashboard | ⚠️ Logic implemented; blocked from live validation in this environment |
| SEC-AUTH-03 | P0 | Sign in with wrong password | Auth error, no JWT issued, no information leakage about account existence | ⚠️ Provider behaviour (Supabase) must be verified against production auth config |
| SEC-AUTH-04 | P0 | Access authenticated route without session | Redirect to `/auth` login page | ✅ RouteGuard default redirect updated to `/auth` |
| SEC-AUTH-05 | P0 | Attempt to use expired JWT | Request rejected with 401, session auto-refreshes if refresh token valid | ⚠️ Token refresh event path exists; needs integration test with real tokens |
| SEC-AUTH-06 | P1 | Attempt brute-force login (30+ attempts in 1 min) | Rate limited by auth provider (429 response) | ⚠️ Must be verified at auth provider edge (not reproducible in unit-only context) |
| SEC-AUTH-07 | P1 | Sign out and attempt to reuse old JWT | Token rejected, session invalidated | ⚠️ Client-side sign-out clears session/token; token reuse requires live backend validation |
| SEC-AUTH-08 | P1 | Password reset flow | Reset email sent, old password invalidated, new password works | ⚠️ Reset initiation implemented; full flow needs email + live auth test |
| SEC-AUTH-09 | P2 | Check for session fixation | New session token generated after login, old token invalid | ⚠️ Requires token-level integration verification |
| SEC-AUTH-10 | P2 | Check JWT payload for sensitive data | JWT contains only `sub`, `role`, `iss`, `exp` — no PII | ⚠️ JWT claim set must be inspected in a live issued token |

---

## 2. Authorisation & Role-Based Access Control (RBAC)

### 2.1 Role Hierarchy

Roles: `owner` > `admin` > `teacher` / `finance` > `parent`

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-RBAC-01 | P0 | Teacher tries to access Settings > Organisation | Page not accessible, nav item hidden | |
| SEC-RBAC-02 | P0 | Finance user tries to create/edit a lesson | Action blocked (UI hidden + RLS rejects) | |
| SEC-RBAC-03 | P0 | Parent tries to view another family's student | RLS returns empty result, no data leak | |
| SEC-RBAC-04 | P0 | Parent tries to view another family's invoices | RLS returns empty result | |
| SEC-RBAC-05 | P0 | Teacher tries to edit another teacher's lesson | RLS rejects UPDATE (only own lessons or admin) | |
| SEC-RBAC-06 | P0 | Non-admin tries to invite a new member | UI hidden + RLS rejects INSERT on `invites` | |
| SEC-RBAC-07 | P0 | Admin tries to promote themselves to owner | RLS WITH CHECK blocks role escalation | |
| SEC-RBAC-08 | P0 | Admin tries to demote/remove the owner | RLS blocks modification of owner membership | |
| SEC-RBAC-09 | P1 | Finance user accesses invoices but not students | Invoice data visible, student data limited to names on invoices | |
| SEC-RBAC-10 | P1 | Teacher views only assigned students (academy mode) | Unassigned students not visible in teacher's list | |
| SEC-RBAC-11 | P1 | Verify nav items per role | Each role sees only permitted navigation items | |
| SEC-RBAC-12 | P1 | Disabled member tries to log in and access org | Session valid but org data inaccessible (membership `status != 'active'`) | |

### 2.2 Role Checking Functions

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-RBAC-20 | P0 | `is_org_admin()` returns false for teacher | Function correctly evaluates role | |
| SEC-RBAC-21 | P0 | `is_org_member()` returns false for non-member | No cross-org leakage | |
| SEC-RBAC-22 | P0 | `is_parent_of_student()` returns false for unlinked parent | Parent isolation enforced | |
| SEC-RBAC-23 | P0 | `is_invoice_payer()` returns false for non-payer parent | Financial data isolated | |

---

## 3. Multi-Tenancy & Data Isolation

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-MT-01 | P0 | User in Org A queries students — verify no Org B data | RLS `org_id` filter active; zero cross-org rows returned | |
| SEC-MT-02 | P0 | User in Org A crafts direct API call with Org B student ID | RLS rejects — empty result or 404, not 403 (no ID enumeration) | |
| SEC-MT-03 | P0 | User switches orgs — verify data context changes | All queries scoped to new org; old org data inaccessible | |
| SEC-MT-04 | P0 | Verify every data table has `org_id` column + RLS | No table leaks data across organisations | |
| SEC-MT-05 | P1 | Admin in Org A calls `gdpr-export` — verify scoped to Org A | Export contains only Org A data | |
| SEC-MT-06 | P1 | Admin in Org A calls `admin-cleanup` — verify scoped | Cleanup affects only caller's org (ownership check enforced) | |
| SEC-MT-07 | P2 | Enumerate UUIDs to find valid IDs | UUIDs are random (v4), impractical to enumerate | |

---

## 4. Row-Level Security (RLS) Policy Audit

### 4.1 Core Tables

| ID | Priority | Table | Test | Pass Criteria | Result |
|---|---|---|---|---|---|
| SEC-RLS-01 | P0 | `students` | Anon user SELECT | Rejected (RLS active, no anon access) | |
| SEC-RLS-02 | P0 | `students` | Parent SELECT for unlinked student | Empty result | |
| SEC-RLS-03 | P0 | `students` | Soft-deleted student visible only to admin | Normal users see `deleted_at IS NULL` only | |
| SEC-RLS-04 | P0 | `lessons` | Parent SELECT for non-participant child | Empty result | |
| SEC-RLS-05 | P0 | `invoices` | Parent SELECT for non-payer invoice | Empty result | |
| SEC-RLS-06 | P0 | `invoices` | Finance user INSERT | Allowed (via `is_org_finance_team`) | |
| SEC-RLS-07 | P0 | `audit_log` | Teacher SELECT | Rejected (admin-only) | |
| SEC-RLS-08 | P0 | `audit_log` | Any user DELETE | Rejected (no DELETE policy) | |
| SEC-RLS-09 | P0 | `audit_log` | Any user UPDATE | Rejected (no UPDATE policy) | |
| SEC-RLS-10 | P0 | `org_memberships` | User INSERT with role=owner | WITH CHECK blocks owner self-promotion | |
| SEC-RLS-11 | P0 | `calendar_connections` | User A reads User B's connection | Rejected (`user_id = auth.uid()` check) | |
| SEC-RLS-12 | P1 | `attendance_records` | Teacher marks attendance for non-own lesson | Rejected by trigger + RLS | |
| SEC-RLS-13 | P1 | `payments` | Finance records payment for another org's invoice | Rejected by RLS + function check | |
| SEC-RLS-14 | P1 | `make_up_credits` | Double-redemption of a credit | Function raises exception (FOR UPDATE lock) | |

### 4.2 RLS Completeness

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-RLS-20 | P0 | Run `supabase db lint` — check for tables without RLS | Zero tables missing RLS | |
| SEC-RLS-21 | P0 | Check for `USING (true)` on INSERT/UPDATE/DELETE policies | No overly permissive write policies | |
| SEC-RLS-22 | P1 | Check `USING (true)` on SELECT policies — verify intentional | Only for genuinely public tables (e.g. `instruments`, `exam_boards`, `grade_levels`) | |

---

## 5. Edge Function Security

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-EF-01 | P0 | Call any edge function without `Authorization` header | 401 Unauthorized | |
| SEC-EF-02 | P0 | Call `gdpr-delete` as teacher role | 403 Forbidden (requires admin) | |
| SEC-EF-03 | P0 | Call `gdpr-export` as teacher role | 403 Forbidden (requires admin) | |
| SEC-EF-04 | P0 | Call `looopassist-execute` as teacher role | 403 Forbidden (requires admin) | |
| SEC-EF-05 | P0 | Call cron-triggered functions without cron auth header | Rejected by `validateCronAuth` | |
| SEC-EF-06 | P1 | Edge function error does not leak stack traces or DB schema | Generic error messages returned | |
| SEC-EF-07 | P1 | `calendar-ical-feed` with expired token | 401 with clear message, no data returned | |
| SEC-EF-08 | P1 | `calendar-ical-feed` with invalid token | 404 (no information about token validity) | |
| SEC-EF-09 | P2 | Service role key not exposed in client-side code | Only anon key in frontend bundle | |
| SEC-EF-10 | P2 | Dev-only functions (`admin-seed`, `admin-cleanup`) blocked in production | `isProduction` guard prevents execution | |

---

## 6. Input Validation & Injection Prevention

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SEC-INJ-01 | P0 | SQL injection via student name field | Parameterised queries prevent injection | |
| SEC-INJ-02 | P0 | XSS via lesson notes (shared with parents) | Output sanitised (DOMPurify), scripts not executed | |
| SEC-INJ-03 | P0 | XSS via markdown content in messages | rehype-sanitize strips dangerous tags | |
| SEC-INJ-04 | P1 | File upload with malicious filename | Filename sanitised, content-type validated server-side | |
| SEC-INJ-05 | P1 | File upload exceeding 50MB | Rejected with clear error | |
| SEC-INJ-06 | P1 | File upload with disallowed MIME type | Rejected (only PDF, image, audio, video, Word doc allowed) | |
| SEC-INJ-07 | P1 | Practice log with duration > 720 minutes | Rejected by validation | |
| SEC-INJ-08 | P1 | Closure date range > 365 days | Rejected by validation | |
| SEC-INJ-09 | P2 | Room capacity set to 0 or negative | Rejected (minimum 1) | |
| SEC-INJ-10 | P2 | Term end date before start date | Rejected by validation | |

---

## 7. Financial Data Integrity

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| FIN-INT-01 | P0 | Invoice total = Σ(line items) + VAT − credits | Calculation matches to the penny (minor units) | |
| FIN-INT-02 | P0 | Payment amount exceeding invoice total | Rejected by `record_payment_and_update_status` (>1% tolerance) | |
| FIN-INT-03 | P0 | Invoice status transition: `paid` → any other | Blocked by `enforce_invoice_status_transition` trigger | |
| FIN-INT-04 | P0 | Invoice status transition: `void` → any other | Blocked (terminal state) | |
| FIN-INT-05 | P0 | Invoice status transition: `draft` → `paid` (skipping `sent`) | Blocked (invalid transition) | |
| FIN-INT-06 | P0 | Double-payment on fully paid invoice | Rejected by function | |
| FIN-INT-07 | P0 | Make-up credit double-redemption | Rejected by `FOR UPDATE` lock + redeemed_at check | |
| FIN-INT-08 | P0 | Void invoice with credits applied | Credits restored to available pool | |
| FIN-INT-09 | P1 | Invoice number uniqueness per org per year | Sequence function prevents duplicates | |
| FIN-INT-10 | P1 | VAT calculation at 20% standard UK rate | `£100 subtotal → £20 VAT → £120 total` | |
| FIN-INT-11 | P1 | Currency defaults to GBP | New orgs default to `GBP` | |
| FIN-INT-12 | P1 | Payment plan installments sum to invoice total | Last instalment absorbs rounding difference | |
| FIN-INT-13 | P2 | Billing run deduplication | Same lesson not billed twice across runs | |

---

## 8. Scheduling & Conflict Detection

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SCH-CON-01 | P0 | Double-book teacher at same time | `check_lesson_conflicts` trigger raises exception | |
| SCH-CON-02 | P0 | Double-book room at same time | Trigger raises CONFLICT:ROOM exception | |
| SCH-CON-03 | P0 | Student in two overlapping lessons | UI conflict detection warns (red indicator) | |
| SCH-CON-04 | P0 | Lesson on closure date | UI warns about closure date conflict | |
| SCH-CON-05 | P1 | External busy block overlap | UI shows amber warning (from Google Calendar sync) | |
| SCH-CON-06 | P1 | Lesson duration < 15 or > 240 minutes | Rejected by validation | |
| SCH-CON-07 | P1 | Recurring series edit (this_and_future) | Future lessons shifted, past untouched | |
| SCH-CON-08 | P1 | Cancel lesson → attendance records cleaned up | `cleanup_attendance_on_cancel` trigger fires | |
| SCH-CON-09 | P2 | Schedule at scale (500+ lessons in week view) | Renders within 3 seconds, abort controller prevents stale data | |

---

## 9. GDPR & Data Protection

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| GDPR-01 | P0 | Data export (Art. 15) produces complete CSV per entity | All student, guardian, lesson, invoice, payment data included | |
| GDPR-02 | P0 | Export scoped to requesting org only | No cross-org data in export | |
| GDPR-03 | P0 | Soft-delete sets `deleted_at`, hides from normal queries | Record invisible to non-admins | |
| GDPR-04 | P0 | Anonymisation scrubs PII fields | `first_name='Deleted'`, `last_name='User'`, email/phone/dob=NULL | |
| GDPR-05 | P0 | Anonymised records retain financial links | Invoices and payments preserved for HMRC compliance | |
| GDPR-06 | P0 | GDPR actions logged to audit_log | Export and delete events recorded with actor and timestamp | |
| GDPR-07 | P1 | Deletion candidate identification | Inactive students and orphan guardians surfaced in UI | |
| GDPR-08 | P1 | Orphan guardian auto-cleanup | Removing last student link soft-deletes the guardian | |
| GDPR-09 | P1 | Parent portal consent — invite flow | Guardian must accept invite + terms before accessing data | |
| GDPR-10 | P2 | Registration form shows ToS and Privacy Policy links | Informational consent present at signup | |

---

## 10. Subscription & Plan Enforcement

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| SUB-01 | P0 | Expired trial blocks lesson creation | `check_subscription_active` trigger raises exception | |
| SUB-02 | P0 | Expired trial blocks student creation | Trigger blocks INSERT | |
| SUB-03 | P0 | Expired trial blocks invoice creation | Trigger blocks INSERT | |
| SUB-04 | P0 | Active subscription allows all operations | No write blocks | |
| SUB-05 | P0 | Teacher limit enforcement | `check_teacher_limit` trigger blocks adding beyond plan max | |
| SUB-06 | P1 | Feature gating per plan (e.g. calendar_sync) | `FeatureGate` component hides gated features | |
| SUB-07 | P1 | Subscription fields protected from client-side modification | `protect_subscription_fields` trigger reverts changes from non-service-role | |
| SUB-08 | P2 | `past_due` subscription still allows reads but warns | Grace period behaviour correct | |

---

## 11. Calendar Sync Security

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| CAL-SEC-01 | P0 | iCal feed URL without valid token | 401/404 — no data returned | |
| CAL-SEC-02 | P0 | iCal feed with expired token | 401 with expiry message | |
| CAL-SEC-03 | P0 | Regenerating iCal token invalidates old URL | Old token returns no data | |
| CAL-SEC-04 | P0 | Google OAuth tokens stored encrypted at rest | Tokens in `calendar_connections` protected by RLS + DB encryption | |
| CAL-SEC-05 | P1 | Parent iCal feed scoped to own children only | No other students' lessons in feed | |
| CAL-SEC-06 | P1 | Admin sync health dashboard scoped to own org | `get_org_calendar_health` checks `is_org_admin` | |
| CAL-SEC-07 | P1 | Cron-triggered functions reject non-cron callers | `validateCronAuth` rejects regular user JWTs | |
| CAL-SEC-08 | P2 | Google API token refresh uses refresh_token, not stored password | OAuth2 flow correct, no credential storage | |

---

## 12. Audit Trail Integrity

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| AUD-01 | P0 | Attendance change triggers audit entry | `audit_attendance_changes` trigger fires, before/after captured | |
| AUD-02 | P0 | Payment recorded — audit entry created | `record_payment_and_update_status` inserts audit row | |
| AUD-03 | P0 | Invoice voided — audit entry with details | `void_invoice` logs installments_voided + credits_restored | |
| AUD-04 | P0 | Audit log has no UPDATE/DELETE policies | Immutable — records cannot be tampered with | |
| AUD-05 | P0 | Audit log only readable by admins | RLS `is_org_admin` on SELECT | |
| AUD-06 | P1 | AI action execution logged | `ai_action_proposals` table records proposal + result + status | |
| AUD-07 | P1 | Credit redemption logged | Audit entry with credit_id, student_id, lesson_id | |
| AUD-08 | P1 | Payment plan creation logged | Audit entry with installment_count, frequency, remaining_minor | |
| AUD-09 | P2 | Streak milestones logged | Audit entry at 3, 7, 14, 30, 60, 100 day streaks | |

---

## 13. AI Subsystem (LoopAssist) Safety

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| AI-01 | P0 | AI read query returns scoped data only | Queries filtered by org_id, no cross-tenant data | |
| AI-02 | P0 | AI proposed action requires explicit confirmation | `status='pending'` until user confirms; no auto-execution | |
| AI-03 | P0 | AI action execution restricted to admin roles | `looopassist-execute` checks `is_org_admin` | |
| AI-04 | P1 | AI action rejection logged | Declined proposals retain `status='rejected'` record | |
| AI-05 | P1 | AI rate limiting active | `check_rate_limit` function enforces per-user request caps | |
| AI-06 | P2 | AI interaction metrics captured | Response time, action proposed/executed, feedback recorded | |

---

## 14. Data Integrity Guards

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| INT-01 | P0 | Delete student with upcoming lessons | Blocked — `DeleteValidationDialog` shows linked lessons | |
| INT-02 | P0 | Delete guardian who is primary payer on open invoices | Blocked — must reassign payer first | |
| INT-03 | P0 | Delete location with upcoming lessons | Blocked — must cancel/move lessons first | |
| INT-04 | P0 | Attendance recorded for non-participant student | Trigger `validate_attendance_participant` raises exception | |
| INT-05 | P1 | Availability blocks cannot overlap on same day | UI validation prevents save | |
| INT-06 | P1 | Organisation name cannot be empty string | Validation rejects blank names | |
| INT-07 | P1 | Resource shares cleaned up on student archive | `cleanup_resource_shares_on_student_archive` trigger fires | |
| INT-08 | P2 | `ON DELETE CASCADE` on foreign keys prevents orphaned records | Deleting parent record cascades to children | |

---

## 15. Performance & Resilience

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| PERF-01 | P1 | Calendar renders 3,000+ lessons | No crash, renders within 5 seconds | |
| PERF-02 | P1 | Billing run with 200+ students | Completes without timeout, deduplication correct | |
| PERF-03 | P1 | Dashboard loads within 2 seconds | Stats queries optimised with indexes | |
| PERF-04 | P2 | Supabase 1000-row default limit accounted for | Pagination used where data may exceed limit | |
| PERF-05 | P2 | Abort controllers prevent stale data on rapid navigation | Old queries cancelled when user navigates away | |

---

## 16. UK-Specific Compliance

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| UK-01 | P0 | Financial records retained for 6+ years | Invoices and payments never hard-deleted | |
| UK-02 | P0 | All monetary values stored as minor units (pence) | No floating-point arithmetic in financial calculations | |
| UK-03 | P1 | Default currency is GBP | New organisations default to `GBP` | |
| UK-04 | P1 | Default timezone is Europe/London | All scheduling uses `Europe/London` by default | |
| UK-05 | P1 | Date display format is DD/MM/YYYY | No US-style MM/DD/YYYY formatting | |
| UK-06 | P1 | VAT at 20% standard rate tested | Calculations verified | |
| UK-07 | P2 | Term calendar supports UK school term patterns | Closure dates, half-terms configurable | |

---

## 17. Infrastructure & Configuration

| ID | Priority | Test | Pass Criteria | Result |
|---|---|---|---|---|
| INF-01 | P0 | Service role key not in client-side JavaScript bundle | Only `VITE_SUPABASE_PUBLISHABLE_KEY` exposed | |
| INF-02 | P0 | HTTPS enforced on all endpoints | No HTTP fallback | |
| INF-03 | P1 | CORS headers restrict allowed origins | Production CORS not set to `*` | |
| INF-04 | P1 | Edge function secrets stored securely (not in code) | API keys in environment variables / vault | |
| INF-05 | P2 | Leaked password protection enabled | Supabase auth config | |
| INF-06 | P2 | Email auto-confirm disabled for production | Users must verify email | |

---

## Summary Statistics

| Category | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| Authentication | 5 | 3 | 2 | 10 |
| RBAC | 8 | 4 | 0 | 12 |
| Role Functions | 4 | 0 | 0 | 4 |
| Multi-Tenancy | 4 | 2 | 1 | 7 |
| RLS Policies | 11 | 3 | 0 | 14 |
| Edge Functions | 5 | 3 | 2 | 10 |
| Input Validation | 3 | 5 | 2 | 10 |
| Financial Integrity | 8 | 4 | 1 | 13 |
| Scheduling | 4 | 4 | 1 | 9 |
| GDPR | 6 | 3 | 1 | 10 |
| Subscription | 5 | 2 | 1 | 8 |
| Calendar Sync | 4 | 3 | 1 | 8 |
| Audit Trail | 5 | 3 | 1 | 9 |
| AI Safety | 3 | 2 | 1 | 6 |
| Data Integrity | 4 | 3 | 1 | 8 |
| Performance | 0 | 3 | 2 | 5 |
| UK Compliance | 2 | 4 | 1 | 7 |
| Infrastructure | 2 | 2 | 2 | 6 |
| **Totals** | **87** | **53** | **20** | **160** |

---

## Appendix A: Testing Tools

| Tool | Purpose |
|---|---|
| Supabase SQL Editor | Direct RLS policy testing with `SET ROLE` |
| Vitest | 274 automated unit/integration tests |
| Browser DevTools | Network inspection, JWT decoding |
| `curl` / Postman | Edge function auth testing |
| Supabase Linter | Automated RLS completeness check |

## Appendix B: Related Documentation

| Document | Path |
|---|---|
| Security Model | `docs/SECURITY_MODEL.md` |
| GDPR Compliance | `docs/GDPR_COMPLIANCE.md` |
| Audit Logging | `docs/AUDIT_LOGGING.md` |
| API Reference | `docs/API_REFERENCE.md` |
| Automated Test Plan | `docs/TEST_PLAN.md` |
| Data Model | `docs/DATA_MODEL.md` |
