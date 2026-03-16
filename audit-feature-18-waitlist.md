# Audit Report — Feature 18: Waitlist (Enrolment + Make-Up)

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Enrolment waitlist, make-up waitlist, matching, booking, expiry, RLS, edge functions, RPCs
**Handoff Rating:** NEEDS-WORK (many fixes applied — verified below)

---

## 1. Files Audited

### Database Migrations (Core)
| File | Purpose |
|------|---------|
| `20260222164345_e13bad2c-*.sql` | `make_up_waitlist` table creation, RLS, indexes, trigger |
| `20260222164414_1c942406-*.sql` | `auto_add_to_waitlist()` trigger function |
| `20260222164529_b88ef528-*.sql` | `on_slot_released()` trigger + `find_waitlist_matches()` |
| `20260222230344_e6c8d5d7-*.sql` | Parent UPDATE policy on `make_up_waitlist` |
| `20260227120000_enrolment_waitlist.sql` | `enrolment_waitlist` + `enrolment_waitlist_activity` tables |
| `20260303181000_realtime_waitlist_organisations.sql` | Realtime publication for `make_up_waitlist` |
| `20260315200000_medium_rls_fixes.sql` | `enrolment_waitlist` INSERT/UPDATE RLS policies |
| `20260315200100_fix_redeem_credit_on_makeup_booking.sql` | `confirm_makeup_booking()` — credit redemption |
| `20260315200300_fix_dismiss_other_matched_waitlist.sql` | Mutual exclusion: dismiss stale matches on booking |
| `20260315200400_fix_atomic_waitlist_conversion.sql` | `convert_waitlist_to_student()` atomic RPC |
| `20260315210001_fix_max_credits_per_term.sql` | Per-policy credit cap + voided_at column |
| `20260315210002_fix_duplicate_waitlist_prevention.sql` | Unique index on active waitlist entries |
| `20260315210003_fix_credit_waitlist_link.sql` | Credit-to-waitlist linking in `auto_issue_credit_on_absence()` |
| `20260315210004_fix_match_timezone.sql` | Org timezone in `find_waitlist_matches()` |
| `20260315210005_fix_parent_respond_atomic.sql` | `respond_to_makeup_offer()` atomic RPC |
| `20260315220011_fix_location_audit_findings.sql` | `ON DELETE SET NULL` for location FKs on both waitlist tables |
| `20260316260000_fix_voided_credits_audit.sql` | Final `confirm_makeup_booking()` + `auto_add_to_waitlist()` with voided_at |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/waitlist-expiry/index.ts` | Cron: expire make-up waitlist entries + return stale offers |
| `supabase/functions/waitlist-respond/index.ts` | JWT-verified email link handler for enrolment offer accept/decline |
| `supabase/functions/enrolment-offer-expiry/index.ts` | Cron: expire enrolment waitlist offers past deadline |
| `supabase/functions/send-enrolment-offer/index.ts` | Send offer email with JWT accept/decline links |
| `supabase/functions/notify-makeup-match/index.ts` | Notify admins of make-up match via internal_messages |
| `supabase/functions/notify-makeup-offer/index.ts` | Send make-up offer email to parent via Resend |

### React Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useEnrolmentWaitlist.ts` | Full CRUD + offer/convert/withdraw for enrolment waitlist |
| `src/hooks/useMakeUpWaitlist.ts` | Query/offer/dismiss/confirm/find-matches for make-up waitlist |

### React Components
| File | Purpose |
|------|---------|
| `src/components/waitlist/OfferSlotDialog.tsx` | Admin UI to offer enrolment slot |
| `src/components/waitlist/WaitlistDashboardWidget.tsx` | Dashboard summary widget |
| `src/components/waitlist/WaitlistEntryDetail.tsx` | Detail view for single entry |
| `src/components/makeups/AddToWaitlistDialog.tsx` | Manual add to make-up waitlist |
| `src/components/makeups/WaitlistTable.tsx` | Make-up waitlist table view |

### Pages
| File | Purpose |
|------|---------|
| `src/pages/EnrolmentWaitlistPage.tsx` | Full enrolment waitlist management page |
| `src/pages/MakeUpDashboard.tsx` | Make-up dashboard with waitlist tab |

---

## 2. Schema: Both Waitlist Tables

### 2a. `enrolment_waitlist`

```
id                    UUID PK DEFAULT gen_random_uuid()
org_id                UUID NOT NULL FK→organisations(id) ON DELETE CASCADE
lead_id               UUID FK→leads(id) ON DELETE SET NULL
contact_name          TEXT NOT NULL
contact_email         TEXT
contact_phone         TEXT
guardian_id            UUID FK→guardians(id) ON DELETE SET NULL
child_first_name      TEXT NOT NULL
child_last_name       TEXT
child_age             INTEGER
instrument_id         UUID FK→instruments(id) ON DELETE SET NULL
instrument_name       TEXT NOT NULL (denormalized)
preferred_teacher_id  UUID FK→teachers(id) ON DELETE SET NULL
preferred_location_id UUID FK→locations(id) ON DELETE SET NULL
preferred_days        TEXT[]
preferred_time_earliest TIME
preferred_time_latest   TIME
experience_level      TEXT
lesson_duration_mins  INTEGER DEFAULT 30
position              INTEGER NOT NULL DEFAULT 0
status                TEXT NOT NULL DEFAULT 'waiting'
                      CHECK (waiting|offered|accepted|enrolled|declined|expired|withdrawn|lost)
offered_slot_day      TEXT
offered_slot_time     TIME
offered_teacher_id    UUID FK→teachers(id)
offered_location_id   UUID FK→locations(id) ON DELETE SET NULL
offered_rate_minor    INTEGER
offered_at            TIMESTAMPTZ
offer_expires_at      TIMESTAMPTZ
responded_at          TIMESTAMPTZ
offer_message_id      UUID
converted_student_id  UUID FK→students(id)
converted_at          TIMESTAMPTZ
source                TEXT DEFAULT 'manual' CHECK (manual|lead_pipeline|booking_page|parent_portal|website)
notes                 TEXT
priority              TEXT DEFAULT 'normal' CHECK (normal|high|urgent)
created_by            UUID
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Indexes:** org+status, org+instrument (waiting), org+teacher (waiting), org+location (waiting), offer_expires_at (offered), lead_id, org+instrument+position (waiting)

### 2b. `make_up_waitlist`

```
id                      UUID PK DEFAULT gen_random_uuid()
org_id                  UUID NOT NULL FK→organisations(id) ON DELETE CASCADE
student_id              UUID NOT NULL FK→students(id) ON DELETE CASCADE
guardian_id             UUID FK→guardians(id) ON DELETE SET NULL
missed_lesson_id        UUID NOT NULL FK→lessons(id) ON DELETE CASCADE
missed_lesson_date      DATE NOT NULL
absence_reason          absence_reason ENUM NOT NULL
attendance_record_id    UUID FK→attendance_records(id)
teacher_id              UUID FK→teachers(id)
lesson_duration_minutes INTEGER NOT NULL
lesson_title            TEXT NOT NULL
location_id             UUID FK→locations(id) ON DELETE SET NULL
status                  TEXT NOT NULL DEFAULT 'waiting'
                        CHECK (waiting|matched|offered|accepted|declined|booked|expired|cancelled)
matched_lesson_id       UUID FK→lessons(id)
matched_at              TIMESTAMPTZ
offered_at              TIMESTAMPTZ
responded_at            TIMESTAMPTZ
booked_lesson_id        UUID FK→lessons(id)
credit_id               UUID FK→make_up_credits(id)
preferred_days          TEXT[]
preferred_time_earliest TIME
preferred_time_latest   TIME
notes                   TEXT
expires_at              TIMESTAMPTZ
created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()
```

**Indexes:** org+status, teacher+status (waiting), student+status, expires_at (waiting)
**Unique Index:** `idx_waitlist_active_student` ON (student_id, org_id) WHERE status IN ('waiting', 'matched', 'offered')

---

## 3. Waitlist Lifecycle Diagrams

### 3a. Enrolment Waitlist Lifecycle

```
[Manual Add / Lead Pipeline / Website]
           │
           ▼
       ┌────────┐
       │WAITING │ ◄────────── Declined (back to waiting or lost)
       └───┬────┘
           │ Admin offers slot
           ▼
       ┌────────┐     Cron expires     ┌─────────┐
       │OFFERED │ ─────────────────────►│ EXPIRED │
       └───┬────┘                       └─────────┘
      ┌────┴─────┐
      │          │
      ▼          ▼
┌──────────┐  ┌──────────┐
│ ACCEPTED │  │ DECLINED │
└────┬─────┘  └──────────┘
     │ Admin converts
     ▼
┌──────────┐
│ ENROLLED │ → convert_waitlist_to_student() RPC
└──────────┘   (creates guardian + student + student_guardians atomically)

Other terminal states: WITHDRAWN (parent/admin), LOST (admin)
```

**Offer channel:** Email via `send-enrolment-offer` with JWT accept/decline links → `waitlist-respond` edge function
**Expiry:** `enrolment-offer-expiry` cron function checks `offer_expires_at`

### 3b. Make-Up Waitlist Lifecycle

```
[Attendance marked absent + policy='waitlist']
           │ auto_add_to_waitlist() trigger
           ▼
       ┌────────┐
       │WAITING │ ◄──── Dismissed match / Declined offer
       └───┬────┘
           │ on_slot_released() trigger finds match
           ▼
       ┌────────┐     48h no response    ┌────────┐
       │MATCHED │─────(waitlist-expiry)──►│WAITING │ (returned to pool)
       └───┬────┘                         └────────┘
           │ Admin offers to parent
           ▼
       ┌────────┐     48h no response    ┌────────┐
       │OFFERED │─────(waitlist-expiry)──►│WAITING │ (returned to pool)
       └───┬────┘                         └────────┘
      ┌────┴─────┐
      │          │
      ▼          ▼
┌──────────┐  ┌──────────┐
│ ACCEPTED │  │ WAITING  │ (declined → reset)
└────┬─────┘  └──────────┘
     │ Admin confirms booking
     ▼
┌──────────┐
│  BOOKED  │ → confirm_makeup_booking() RPC
└──────────┘   (inserts participant + redeems credit + dismisses other matches)

Other terminal states: EXPIRED (expires_at passed), CANCELLED (credit voided)
```

**Matching:** `on_slot_released()` trigger fires on attendance_records INSERT/UPDATE → calls `find_waitlist_matches()` → auto-sets up to 3 entries to 'matched'
**Offer channel:** `notify-makeup-offer` sends email to parent; `notify-makeup-match` notifies admins via internal_messages
**Parent response:** `respond_to_makeup_offer()` atomic RPC (accept/decline)
**Booking:** `confirm_makeup_booking()` atomic RPC
**Expiry:** `waitlist-expiry` cron function handles both `expires_at` and stale offers (48h)

---

## 4. Matching Algorithm Documentation

### Trigger: `on_slot_released()`
- **Fires on:** `AFTER INSERT OR UPDATE OF attendance_status, absence_reason_category ON attendance_records`
- **Conditions:** Only fires for `absent` or `cancelled_by_student` with `absence_reason_category IN ('sick', 'family_emergency')`
- **Action:** Calls `find_waitlist_matches()` and auto-matches up to 3 entries

### Match Function: `find_waitlist_matches(_lesson_id, _absent_student_id, _org_id)`
- **Capacity check:** Returns nothing if lesson is full
- **Timezone:** Uses org timezone (fixed in handoff) for day/time extraction
- **Filters:**
  - Status = 'waiting'
  - Different student than the absent one
  - Duration fits (waitlist entry duration ≤ lesson duration)
  - Not expired
  - Preferred days match (if set)
  - Preferred time window matches (if set)
  - No schedule conflict for the student
- **Priority ordering (FIFO with quality tiers):**
  1. Same teacher + same duration (exact match)
  2. Same teacher (different duration)
  3. Same duration (different teacher)
  4. Partial match
  5. Within each tier: FIFO by `created_at ASC`
- **Concurrency:** `FOR UPDATE OF w SKIP LOCKED` prevents double-matching
- **Limit:** 10 results returned, trigger uses top 3

---

## 5. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| WL-C1 | **CRITICAL** | `confirm_makeup_booking()` dismisses other matched entries to status `'unmatched'` but `'unmatched'` is NOT in the CHECK constraint on `make_up_waitlist.status`. The CHECK allows: `waiting, matched, offered, accepted, declined, booked, expired, cancelled`. This means the dismiss step will **fail at runtime** with a CHECK constraint violation. | `20260316260000_fix_voided_credits_audit.sql:141`, `20260315200300_fix_dismiss_other_matched_waitlist.sql:109` | Change `SET status = 'unmatched'` to `SET status = 'waiting'` (reset to pool) OR add `'unmatched'` to the CHECK constraint. Using `'waiting'` with NULL matched_lesson_id is semantically correct and requires no schema change. |
| WL-C2 | **CRITICAL** | `waitlist-respond` and `send-enrolment-offer` edge functions are NOT listed in `config.toml` with `verify_jwt = false`. Since the project has `verify_jwt` disabled platform-wide for listed functions only, these two functions may have JWT verification enabled by default, causing 401 errors when called. `waitlist-respond` is called via unauthenticated email links (no JWT). `send-enrolment-offer` uses Bearer token but verify_jwt may interfere. | `supabase/config.toml`, `supabase/functions/waitlist-respond/index.ts`, `supabase/functions/send-enrolment-offer/index.ts` | Add `[functions.waitlist-respond]` and `[functions.send-enrolment-offer]` with `verify_jwt = false` to config.toml. Both functions do their own auth (JWT signature / Bearer token). |
| WL-C3 | **CRITICAL** | `enrolment-offer-expiry` edge function is NOT listed in `config.toml` with `verify_jwt = false`. It uses `validateCronAuth()` (x-cron-secret header) but without the config entry, Supabase may require a valid JWT first, blocking cron invocations entirely. | `supabase/config.toml`, `supabase/functions/enrolment-offer-expiry/index.ts` | Add `[functions.enrolment-offer-expiry]` with `verify_jwt = false` to config.toml. |
| WL-H1 | **HIGH** | `on_slot_released()` only triggers for `sick` and `family_emergency` absence reasons. If a student is marked absent with any other reason (e.g. `holiday`, `other`), even if the policy says the slot should release, no matching occurs. The hardcoded list is inflexible and doesn't consult `make_up_policies.releases_slot`. | `20260222164529_b88ef528-*.sql:8` | Consult `make_up_policies` table for `releases_slot = true` instead of hardcoding absence reasons, consistent with the comment in the code. |
| WL-H2 | **HIGH** | `notify-makeup-match` edge function uses `validateCronAuth()` but is NOT in config.toml with `verify_jwt = false`. It receives webhook payloads (database trigger → webhook) not cron calls. The auth model is confused — it validates cron auth but is invoked as a webhook. | `supabase/functions/notify-makeup-match/index.ts`, `supabase/config.toml` | Add to config.toml with `verify_jwt = false`. Clarify invocation model: if called by database webhook, use service role auth; if by cron, keep cron auth. |
| WL-H3 | **HIGH** | `useOfferMakeUp()` in `useMakeUpWaitlist.ts` does a plain table UPDATE to set status='offered' — no status validation. A race condition could offer an already-offered or booked entry. There is no server-side RPC to atomically validate the transition. | `src/hooks/useMakeUpWaitlist.ts:137-152` | Create an `offer_makeup_slot()` RPC that locks the row, validates status='matched', and sets 'offered' atomically. |
| WL-H4 | **HIGH** | `useDismissMatch()` does a plain table UPDATE to reset status to 'waiting' — no status validation on the server. Could dismiss an already-booked or offered entry. | `src/hooks/useMakeUpWaitlist.ts:173-194` | Create a server-side RPC or at minimum add `.eq('status', 'matched')` to the UPDATE filter. |
| WL-H5 | **HIGH** | Enrolment waitlist `useRespondToOffer()` does a plain table UPDATE — not atomic. Two concurrent accept calls could both succeed. The `waitlist-respond` edge function also does a non-locked UPDATE. Neither uses `FOR UPDATE` row locking. | `src/hooks/useEnrolmentWaitlist.ts:578-623`, `supabase/functions/waitlist-respond/index.ts:115-123` | Create an atomic RPC similar to `respond_to_makeup_offer()` for enrolment waitlist. The edge function should also use a locked UPDATE or call the RPC. |
| WL-H6 | **HIGH** | `useWithdrawFromWaitlist()` does sequential non-atomic operations: fetch entry → update status → reposition remaining entries. A concurrent withdrawal of two entries in the same instrument queue could produce corrupt positions. | `src/hooks/useEnrolmentWaitlist.ts:674-739` | Create a `withdraw_from_enrolment_waitlist()` RPC that locks affected rows and does position recalculation atomically. |
| WL-M1 | **MEDIUM** | `send-enrolment-offer` falls back `WAITLIST_JWT_SECRET` to `supabaseServiceKey` if not configured. The service role key should never be used as a JWT signing secret — if leaked in a token, it grants full database access. | `supabase/functions/send-enrolment-offer/index.ts:35` | Remove fallback. Require `WAITLIST_JWT_SECRET` to be set. Throw a clear error if missing. |
| WL-M2 | **MEDIUM** | `send-enrolment-offer` uses `escapeHtml()` for email content but constructs `acceptUrl` and `declineUrl` with unescaped query params injected into `href` attributes. If `waitlist_id` or `org_id` contained special characters (unlikely for UUIDs but defensive coding), this could be an XSS vector in email clients. | `supabase/functions/send-enrolment-offer/index.ts:183-184` | URL-encode the token parameter values. |
| WL-M3 | **MEDIUM** | `notify-makeup-offer` sends email from `notifications@lessonloop.app` (wrong domain). The project uses `lessonloop.net`. | `supabase/functions/notify-makeup-offer/index.ts:229` | Change to `notifications@lessonloop.net` to match `send-enrolment-offer` and project domain. |
| WL-M4 | **MEDIUM** | `useAddToEnrolmentWaitlist()` calculates `nextPosition` client-side with a non-locked read. Two concurrent adds for the same instrument could get the same position number. | `src/hooks/useEnrolmentWaitlist.ts:393-403` | Move position calculation to a server-side RPC or use a database sequence/trigger. |
| WL-M5 | **MEDIUM** | `waitlist-expiry` cron function returns stale offered entries (no response in 48h) to 'waiting' status. This is a hardcoded 48-hour window that doesn't consult org-level `enrolment_offer_expiry_hours` (which defaults to 48 but is configurable). Make-up offers should respect org settings. | `supabase/functions/waitlist-expiry/index.ts:15` | Read org-specific expiry settings or use a per-entry `offer_expires_at` column (which doesn't exist on make_up_waitlist). |
| WL-M6 | **MEDIUM** | `enrolment_waitlist.offered_teacher_id` FK to `teachers(id)` has no `ON DELETE` clause (defaults to RESTRICT). Deleting a teacher who was offered in a waitlist entry will fail. | `20260227120000_enrolment_waitlist.sql:52` | Add `ON DELETE SET NULL` to `offered_teacher_id` FK. |
| WL-M7 | **MEDIUM** | `make_up_waitlist.teacher_id` FK to `teachers(id)` has no `ON DELETE` clause (defaults to RESTRICT). Deleting a teacher referenced by waitlist entries will fail. Same for `matched_lesson_id` and `booked_lesson_id` FKs to `lessons(id)` — no ON DELETE clause. | `20260222164345_e13bad2c-*.sql` | Add `ON DELETE SET NULL` for teacher_id, `ON DELETE SET NULL` for matched_lesson_id and booked_lesson_id. |
| WL-L1 | **LOW** | `find_waitlist_matches()` doesn't check instrument match. A piano student on the waitlist could be matched to a guitar lesson slot if duration/time/teacher criteria are met. | `20260315210004_fix_match_timezone.sql` | Add instrument filtering if `make_up_waitlist` stores instrument info (currently it stores `lesson_title` but not `instrument_id`). |
| WL-L2 | **LOW** | `enrolment_waitlist_activity` has no CHECK constraint on `activity_type`. Any string value is accepted. | `20260227120000_enrolment_waitlist.sql:138` | Add a CHECK constraint listing valid activity types. |
| WL-L3 | **LOW** | `auto_add_to_waitlist()` doesn't link `credit_id` at insert time (handled by a separate UPDATE after INSERT in the latest version). However, if both triggers fire in the same transaction and `auto_issue_credit_on_absence` runs AFTER `auto_add_to_waitlist`, the credit linking in auto_issue works. If the order reverses, the waitlist entry would need linking. The dual-linking approach (both functions try to link) is resilient. | Multiple migration files | No action needed — current implementation handles both orderings. |
| WL-L4 | **LOW** | `enrolment_waitlist` `created_by` column has no FK to auth.users. It's just a UUID with no referential integrity. | `20260227120000_enrolment_waitlist.sql:73` | Add FK reference to `auth.users(id) ON DELETE SET NULL` if desired. |
| WL-L5 | **LOW** | `convert_waitlist_to_student()` RPC does not verify the caller is an admin/owner. It's `SECURITY DEFINER` but has no `is_org_admin()` or `is_org_staff()` check. Any authenticated user who knows the entry_id and org_id could call it. | `20260315200400_fix_atomic_waitlist_conversion.sql` | Add `IF NOT is_org_admin(auth.uid(), p_org_id) THEN RAISE EXCEPTION 'Access denied'; END IF;` at the start. |
| WL-L6 | **LOW** | `confirm_makeup_booking()` RPC has no explicit auth check. It's `SECURITY DEFINER` and checks `_org_id` matches but doesn't verify the caller is staff/admin. `auth.uid()` is used for audit but not for authorization. | `20260316260000_fix_voided_credits_audit.sql:36-161` | Add role check: `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied'; END IF;` |

---

## 6. Handoff Fix Verification Checklist

| # | Handoff Fix | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Mutual exclusion on booking | **PARTIALLY BROKEN** | `confirm_makeup_booking()` dismisses other matched entries but uses status `'unmatched'` which is not in the CHECK constraint (WL-C1). |
| 2 | Atomic waitlist-to-student conversion RPC | **VERIFIED** | `convert_waitlist_to_student()` in `20260315200400` creates guardian+student+link+updates waitlist in one transaction. Called from `useConvertWaitlistToStudent()`. |
| 3 | Enrolment waitlist expiry | **VERIFIED** | `enrolment-offer-expiry` edge function checks `offer_expires_at`. BUT missing from config.toml (WL-C3). |
| 4 | Make-up waitlist expiry | **VERIFIED** | `waitlist-expiry` cron function expires entries past `expires_at` and returns stale offers to waiting. Listed in config.toml. |
| 5 | Duplicate waitlist prevention index | **VERIFIED** | `idx_waitlist_active_student` UNIQUE ON (student_id, org_id) WHERE status IN ('waiting', 'matched', 'offered'). |
| 6 | Offer deadline server-side enforcement | **VERIFIED** | `enrolment-offer-expiry` function checks `offer_expires_at < now()`. `waitlist-expiry` handles make-up offers (48h hardcoded). |
| 7 | Parent accept/decline atomic RPC | **VERIFIED** | `respond_to_makeup_offer()` in `20260315210005` locks row, validates guardian ownership, validates status='offered', performs atomic transition. |
| 8 | Org timezone in match function | **VERIFIED** | `find_waitlist_matches()` in `20260315210004` fetches `COALESCE(o.timezone, 'Europe/London')` and uses it for day/time extraction. |
| 9 | Credit linked to waitlist entry | **VERIFIED** | Both `auto_add_to_waitlist()` and `auto_issue_credit_on_absence()` link credits to waitlist entries. Both exclude voided credits. |
| 10 | Policy check on manual waitlist add | **PARTIAL** | Auto-add checks `make_up_policies.eligibility = 'waitlist'`. Manual add via `AddToWaitlistDialog` does not check policies — admin override is intentional. Enrolment waitlist manual add has no policy gating (expected). |
| 11 | `offered_location_id` ON DELETE SET NULL | **VERIFIED** | Fixed in `20260315220011_fix_location_audit_findings.sql` for both tables. |
| 12 | Credit redemption on booking | **VERIFIED** | `confirm_makeup_booking()` redeems oldest available credit with `FOR UPDATE SKIP LOCKED` and excludes voided credits. |

---

## 7. RLS Policy Matrix

### `enrolment_waitlist`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Org members can view enrolment waitlist | SELECT | `is_org_member(auth.uid(), org_id)` |
| Org admins can manage enrolment waitlist | ALL | `is_org_admin(auth.uid(), org_id)` |
| Parents can view their own waitlist entries | SELECT | `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` |
| Staff can insert waitlist entries | INSERT | `is_org_staff(auth.uid(), org_id)` |
| Staff can update waitlist entries | UPDATE | `is_org_staff(auth.uid(), org_id)` |

**Gap:** No DELETE policy exists. Admins have ALL via the admin policy. Staff cannot delete. Parents cannot delete. This is correct — entries should be withdrawn/lost, not deleted.

### `enrolment_waitlist_activity`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Org members can view waitlist activity | SELECT | `is_org_member(auth.uid(), org_id)` |
| Org admins can manage waitlist activity | INSERT | `is_org_admin(auth.uid(), org_id)` |

**Gap:** Staff can INSERT waitlist entries but cannot INSERT activity records (only admins can). Activity logging from `useAddToEnrolmentWaitlist()` by staff users will fail silently or error. The `convert_waitlist_to_student()` RPC is SECURITY DEFINER so bypasses RLS.

### `make_up_waitlist`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| Org members can view waitlist | SELECT | `org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active')` |
| Org admins can manage waitlist | ALL | `is_org_admin(auth.uid(), org_id)` |
| Parents can view their children waitlist | SELECT | `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` |
| Parents can update their waitlist entries | UPDATE | `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` |

**Gap:** No explicit INSERT policy for staff (non-admin). Auto-add is via SECURITY DEFINER trigger (bypasses RLS). Manual add by non-admin staff would fail. The admin ALL policy covers admin inserts.

### Role Access Summary

| Role | Enrolment Waitlist | Make-Up Waitlist |
|------|-------------------|------------------|
| Owner/Admin | Full CRUD | Full CRUD |
| Teacher | Read + Insert + Update (staff policies) | Read only (no INSERT/UPDATE policy for staff) |
| Finance | Read (org member) | Read (org member) |
| Parent | Read own entries | Read own + Update own (accept/decline) |

---

## 8. Verdict

### **NOT PRODUCTION READY**

#### Blockers (must fix before launch):

1. **WL-C1 (CRITICAL):** `'unmatched'` status not in CHECK constraint — `confirm_makeup_booking()` mutual exclusion step will fail at runtime. This is a **data-corrupting bug** that prevents make-up bookings from completing when other entries are matched to the same lesson.

2. **WL-C2 + WL-C3 (CRITICAL):** Three edge functions missing from `config.toml` — `waitlist-respond`, `send-enrolment-offer`, `enrolment-offer-expiry`. These may fail with 401 JWT errors in production, breaking the entire enrolment offer flow and expiry cron.

3. **WL-L5 + WL-L6 (escalated to HIGH for production):** Two SECURITY DEFINER RPCs (`convert_waitlist_to_student`, `confirm_makeup_booking`) have **no authorization check**. Any authenticated user can convert waitlist entries to students or confirm make-up bookings for any org.

#### Should fix (high priority):

4. **WL-H3/H4:** Make-up offer and dismiss operations are non-atomic client-side UPDATEs with no status validation.
5. **WL-H5:** Enrolment offer response is non-atomic (race condition on concurrent accepts).
6. **WL-M1:** Service role key used as JWT signing secret fallback.
7. **WL-M3:** Wrong email domain (`lessonloop.app` vs `lessonloop.net`).

#### Can defer to post-beta:

8. **WL-H1:** Hardcoded absence reasons in `on_slot_released()`.
9. **WL-M4/M5/M6/M7:** Position calculation, expiry configuration, FK cascade gaps.
10. **WL-L1-L4:** Instrument matching, activity type validation, FK integrity.
