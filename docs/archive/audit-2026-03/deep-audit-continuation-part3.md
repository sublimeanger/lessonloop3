# Deep Audit — Continuation & Make-Up Systems (Part 3)

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Sections 7–12: Make-Up Policies, Waitlist & Matching, Parent Portal Credits, Cross-System Interactions, Make-Up Dashboard, Enrolment Waitlist

---

## SECTION 7: MAKE-UP POLICIES

### 7A. Configurable Rules

**Files reviewed:**
- `src/hooks/useMakeUpPolicies.ts` (full)
- `supabase/migrations/20260222163838_...sql` (make_up_policies table + seed function)
- `supabase/migrations/20260222171214_...sql` (releases_slot column + on_slot_released trigger)

**What is configurable:**
- **Per absence-reason eligibility**: 8 absence reasons (sick, school_commitment, family_emergency, holiday, teacher_cancelled, weather_closure, no_show, other), each with eligibility of: `automatic`, `waitlist`, `admin_discretion`, `not_eligible`
- **Releases slot flag**: boolean per reason — controls whether an absence triggers automatic matching via `on_slot_released()` trigger
- **Waitlist expiry weeks**: org-level setting (`make_up_waitlist_expiry_weeks` on `organisations` table, default 8)

**What is NOT configurable:**
- No cancellation notice period setting
- No max credits per term / per student
- No auto-issue on academy cancellation (teacher_cancelled → automatic is a POLICY DEFAULT, not a separate toggle)
- No credit expiry period setting (credits have `expires_at` but no org-level config for duration)
- No limit on how many credits a student can accumulate

### 7B. Where Policy is Checked

- **Server-side**: `auto_issue_credit_on_absence()` trigger (migration `20260222164435`) — checks `make_up_policies` table for `eligibility = 'automatic'`
- **Server-side**: `on_slot_released()` trigger (migration `20260222171214`) — checks `releases_slot` column
- **Client-side**: `useMakeUpPolicies.ts` only reads/displays/updates policies — no client-side enforcement
- **Admin bypass**: Yes, admins can manually add students to waitlist via `AddToWaitlistDialog` regardless of policy. No policy check occurs on manual waitlist insertion.
- **Max credits enforced**: NO — no limit. Silent unlimited accumulation.

### 7C. Multiple Policies Per Org

- One policy per `(org_id, absence_reason)` combination — enforced by `UNIQUE (org_id, absence_reason)` constraint
- No per-instrument or per-age-group policies
- Correct policy selected by matching `absence_reason_category` on the attendance record against the policy table

### [7A.1] MEDIUM — No Max Credits Per Student/Term

**File:** `supabase/migrations/20260222164435_...sql:16`
**Issue:** `auto_issue_credit_on_absence()` only checks for duplicate credits on the *same lesson* but has no cap on total credits per student or per term. A student absent 10 times gets 10 credits.
**Trace:** Read trigger function — only dedup check is `WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id`.
**Impact:** Unlimited credit accumulation could represent significant financial liability. Academy may not realize they owe hundreds of pounds in make-up lessons.
**Fix:** Add org-level `max_credits_per_term` setting. Check in trigger: if student already has N active credits for current term, skip issuance and log a warning.

### [7A.2] LOW — No Credit Expiry Configuration

**File:** `supabase/migrations/20260222164435_...sql:24`
**Issue:** Credits are inserted with no `expires_at` value. The column exists on `make_up_credits` but the auto-issue trigger never sets it. There's no org-level setting to control credit validity period.
**Trace:** INSERT statement in trigger — no expires_at column set.
**Impact:** Credits never expire unless manually expired by admin. Potential for credits to accumulate indefinitely.
**Fix:** Add `credit_expiry_weeks` to `organisations` table. Set `expires_at` in the trigger: `NOW() + (SELECT credit_expiry_weeks FROM organisations WHERE id = NEW.org_id) * INTERVAL '1 week'`.

### [7B.1] MEDIUM — Policy Not Checked on Manual Waitlist Addition

**File:** `src/components/makeups/AddToWaitlistDialog.tsx:103-117`
**Issue:** Admin can add any student to the waitlist for any reason without checking the org's make-up policy. If the policy says "holiday = not_eligible", admin can still manually add with reason "holiday".
**Trace:** `onSubmit()` inserts directly into `make_up_waitlist` — no policy lookup.
**Impact:** Policy becomes advisory only. Inconsistent treatment of absences.
**Fix:** On insert, look up policy for the selected absence_reason. If `not_eligible`, show a warning (but still allow admin override with confirmation).

### [7B.2] LOW — Auto-Seed Race Condition

**File:** `src/hooks/useMakeUpPolicies.ts:71-83`
**Issue:** `seeded` ref prevents re-seeding within the same component lifecycle, but if two browser tabs or two admins access the page simultaneously, the RPC could be called twice. The `ON CONFLICT DO NOTHING` in the seed function prevents duplicates, so this is cosmetic.
**Trace:** `useEffect` fires on mount if policies empty → calls RPC. Two tabs = two RPC calls.
**Impact:** Minimal — ON CONFLICT prevents actual data issues. Double toast possible.
**Fix:** No urgent fix needed. The ON CONFLICT handles it safely.

---

## SECTION 8: WAITLIST & MATCHING

### 8A. Waitlist Entry

**Files reviewed:**
- `src/hooks/useMakeUpWaitlist.ts` (full)
- `src/components/makeups/AddToWaitlistDialog.tsx` (full)

**Who adds:** Admin only (via AddToWaitlistDialog on MakeUpDashboard). Parents cannot add themselves to the make-up waitlist directly.

**Data captured:**
- Student (selected from active students list)
- Missed lesson (from student's recent 20 lessons)
- Absence reason (from ABSENCE_REASON_LABELS enum)
- Notes (optional, free text)
- Calculated: lesson_title, lesson_duration_minutes, missed_lesson_date, teacher_id
- NOT captured: preferred_days, preferred_time range, location preference (columns exist but not populated by dialog)

**Duplicate prevention:** None — a student can be on the waitlist multiple times for different missed lessons or even the same missed lesson.

**Credit linked:** `credit_id` column exists on `make_up_waitlist` but is NOT populated by AddToWaitlistDialog. Credits and waitlist entries are loosely coupled.

### [8A.1] HIGH — Preferred Days/Times Never Populated

**File:** `src/components/makeups/AddToWaitlistDialog.tsx:103-117`
**Issue:** The `make_up_waitlist` table has `preferred_days`, `preferred_time_earliest`, `preferred_time_latest` columns but AddToWaitlistDialog never sets them. The `find_waitlist_matches` function uses these for filtering. Since they're always NULL, the NULL checks pass (treated as "any day/time is OK"), meaning matching works but is imprecise.
**Trace:** Insert statement sets only: org_id, student_id, missed_lesson_id, missed_lesson_date, lesson_title, lesson_duration_minutes, teacher_id, absence_reason, notes, status. No preferred_days/time fields.
**Impact:** All waitlist entries match ALL available slots regardless of family's actual availability. False matches that waste admin time and parent goodwill.
**Fix:** Add day/time preference fields to AddToWaitlistDialog form.

### [8A.2] MEDIUM — No Duplicate Waitlist Entry Prevention

**File:** `src/components/makeups/AddToWaitlistDialog.tsx:103-117`
**Issue:** No check prevents adding the same student for the same missed lesson multiple times. No unique constraint on `(student_id, missed_lesson_id)`.
**Trace:** Direct INSERT with no existence check.
**Impact:** Duplicate entries clutter the waitlist and could cause a student to be offered/booked into multiple make-up slots for the same missed lesson.
**Fix:** Add `UNIQUE (org_id, student_id, missed_lesson_id)` constraint on `make_up_waitlist`. Or check in UI before inserting.

### [8A.3] MEDIUM — Credit Not Linked to Waitlist Entry

**File:** `src/components/makeups/AddToWaitlistDialog.tsx:103-117`
**Issue:** The `credit_id` column on `make_up_waitlist` is never populated. Credits and waitlist entries are not linked, making it impossible to track which credit corresponds to which waitlist journey.
**Trace:** INSERT does not set credit_id. No code in the codebase writes to this column.
**Impact:** Cannot enforce "one credit = one make-up". A student could have 1 credit but 3 waitlist entries, each resulting in a booked make-up.
**Fix:** When adding to waitlist, look up the student's available credits for the missed lesson and link one. Or enforce credit requirement before booking.

### 8B. Matching Logic

**File reviewed:** `supabase/migrations/20260222164503_...sql` (find_waitlist_matches function)

**How it finds matches:**
- Takes a lesson_id (the slot with the absence), the absent student's ID, and org_id
- Gets the lesson's duration, day-of-week, and time
- Searches `make_up_waitlist` for entries with `status = 'waiting'` that:
  - Are not the absent student themselves
  - Have duration ≤ the slot's duration
  - Have not expired
  - Match preferred_days (if set) — but these are never set (see 8A.1)
  - Match preferred_time range (if set) — but these are never set
  - Student is not already in a conflicting scheduled lesson

**Match quality tiers:**
1. `exact` — same teacher + same duration + same location
2. `same_teacher` — same teacher + same duration
3. `same_duration` — different teacher but same duration
4. `partial` — everything else

**Ordering:** By quality tier, then FIFO (created_at ASC). Limit 10 results.

**When matching runs:**
- **Automatically:** via `on_slot_released()` trigger when attendance is marked absent/cancelled AND the policy has `releases_slot = true`. Auto-matches up to 3 entries (LIMIT 3).
- **Manually:** Admin clicks "Find Match" on the WaitlistTable, which calls `useFindMatches` → `find_waitlist_matches` RPC.

**Multiple matches same slot:** The auto-trigger matches up to 3 entries to the SAME lesson slot. All 3 get `status = 'matched'`. Admin must then choose which one to offer.

### [8B.1] HIGH — Multiple Entries Auto-Matched to Same Slot Without Mutual Exclusion

**File:** `supabase/migrations/20260222171214_...sql:49-56`
**Issue:** `on_slot_released()` matches up to 3 waitlist entries to the SAME lesson, setting all of them to `status = 'matched'` with `matched_lesson_id = NEW.lesson_id`. If admin offers and books entry #1, entries #2 and #3 remain in `matched` status pointing to the same lesson — but the slot is now taken.
**Trace:** The trigger's `LIMIT 3` loop updates all 3 to matched. `confirm_makeup_booking` only checks if the student is already a participant, not if the lesson is "full".
**Impact:** Admin could offer and book multiple students into the same slot, creating overbooking. No capacity check exists.
**Fix:** After booking confirmation, auto-dismiss other matched entries for the same `matched_lesson_id`. Or check lesson capacity in `confirm_makeup_booking`.

### [8B.2] MEDIUM — Timezone Handling in Match Function

**File:** `supabase/migrations/20260222164503_...sql:21-22`
**Issue:** `_day_name` and `_lesson_time` are extracted using `AT TIME ZONE 'UTC'` rather than the org's timezone. For UK orgs in BST (UTC+1), a lesson at 16:00 BST is stored as 15:00 UTC. The match function compares this UTC time against preferred_time fields which are entered as local times.
**Trace:** `_lesson_time := (_lesson.start_at AT TIME ZONE 'UTC')::TIME` — hardcoded UTC.
**Impact:** During BST, day/time matching could be off by 1 hour. A lesson on Tuesday at 00:30 BST could match as Monday in UTC. Currently mitigated because preferred times are never set (8A.1), but will become a bug when fixed.
**Fix:** Use org timezone: `_lesson.start_at AT TIME ZONE (SELECT timezone FROM organisations WHERE id = _org_id)`.

### 8C. Offer Flow

**Files reviewed:**
- `supabase/functions/notify-makeup-offer/index.ts` (full)
- `src/hooks/useMakeUpWaitlist.ts:128-162` (useOfferMakeUp)
- `src/pages/portal/PortalHome.tsx:68-136` (parent accept/decline handling)

**Flow:**
1. Admin clicks "Offer" on matched entry → `useOfferMakeUp` sets `status = 'offered'`, `offered_at = now()` on client side
2. Edge function `notify-makeup-offer` is invoked → sends email to guardian via Resend with Accept/Decline buttons
3. Email links point to `/portal/home?makeup_action=accept&id={waitlist_id}` and `...decline&id=...`
4. Parent clicks link → PortalHome `useEffect` handles the action:
   - **Accept:** Updates status to `accepted`, sets `responded_at`
   - **Decline:** Resets to `waiting`, clears matched_lesson_id/matched_at/offered_at

**Offer deadline:** Email says "Please respond within 48 hours". The `waitlist-expiry` cron function returns stale offered entries (no response in 48h) back to `waiting` status.

**Parent doesn't respond:** After 48 hours, cron sets status back to `waiting` with matched fields cleared.

**Admin can withdraw offer:** No explicit "withdraw offer" action in UI, but admin can "Dismiss" which resets to waiting.

**Parent accepts → what happens:**
- Status set to `accepted` — but NO automatic booking or credit marking
- Admin must then manually click "Confirm" to call `confirm_makeup_booking` RPC
- RPC adds student as lesson_participant and sets status to `booked`
- Credit is NOT marked as used by `confirm_makeup_booking`

**Parent declines → what happens:**
- Status reset to `waiting`, matched fields cleared
- Entry stays on waitlist for re-matching
- No notification to admin that parent declined

### [8C.1] CRITICAL — Credit Not Consumed on Booking Confirmation

**File:** `supabase/migrations/20260222234306_...sql:222-267` (confirm_makeup_booking)
**Issue:** `confirm_makeup_booking` adds the student to the lesson and sets waitlist status to 'booked', but NEVER marks a credit as redeemed. The `credit_id` on the waitlist entry is always NULL (see 8A.3). Credits accumulate without being consumed.
**Trace:** Full RPC function reviewed — no UPDATE to `make_up_credits`. No call to `redeem_make_up_credit`.
**Impact:** Credits are never consumed. A student with 1 credit could book unlimited make-ups. The credit balance shown to parents will always grow, never shrink from make-up bookings. Financial exposure is unlimited.
**Fix:** In `confirm_makeup_booking`, after booking, find and redeem the oldest available credit for the student: `UPDATE make_up_credits SET redeemed_at = NOW(), redeemed_lesson_id = _entry.matched_lesson_id WHERE id = (SELECT id FROM make_up_credits WHERE student_id = _entry.student_id AND org_id = _org_id AND redeemed_at IS NULL ORDER BY issued_at LIMIT 1)`.

### [8C.2] HIGH — Accepted Status Requires Manual Admin Confirmation

**File:** `src/pages/portal/PortalHome.tsx:90-97`
**Issue:** When parent accepts, status goes to `accepted` — but no notification is sent to admin, and no auto-booking occurs. Admin must notice the accepted entry and manually click "Confirm" on the dashboard. The `NeedsActionSection` only shows `matched` entries, not `accepted` ones.
**Trace:** `useOfferMakeUp` fires on `matched` → `offered`. Parent accept sets to `accepted`. But `NeedsActionSection` uses `useWaitlist({ status: 'matched' })` — so accepted entries are invisible in the action panel.
**Impact:** Parents accept offers but nothing happens until admin checks the full waitlist table. Make-up bookings stall indefinitely after parent acceptance. Parent experience is terrible — they accepted but hear nothing back.
**Fix:** (1) Show `accepted` entries in NeedsActionSection. (2) Send admin notification when parent accepts (realtime channel exists for updates). (3) Or auto-confirm on parent acceptance.

### [8C.3] HIGH — No Offer Deadline Enforcement at Accept Time

**File:** `src/pages/portal/PortalHome.tsx:90-97`
**Issue:** When parent clicks accept link 3 days later (after 48h expiry), the code checks `eq('status', 'offered')`. If `waitlist-expiry` cron ran and reset status to `waiting`, the update returns 0 rows and shows "This offer may have expired". But if the cron hasn't run yet (missed execution, delayed, etc.), the accept goes through on an expired offer.
**Trace:** No check on `offered_at` + 48 hours. Only `status = 'offered'` is checked.
**Impact:** Race condition between cron and parent click. Parent could accept after deadline if cron is slow.
**Fix:** Add check: `AND offered_at > NOW() - INTERVAL '48 hours'` to the update query, or check `expires_at` if it were set.

### [8C.4] MEDIUM — Parent Accept/Decline Not Atomic

**File:** `src/pages/portal/PortalHome.tsx:90-97`
**Issue:** Parent accept is a client-side Supabase update, not an RPC. There's no SELECT FOR UPDATE, meaning two concurrent requests could race.
**Trace:** `supabase.from('make_up_waitlist').update(...)` — no locking.
**Impact:** If parent rapidly clicks accept/decline, or two guardians linked to same student both click, inconsistent state possible. Low probability.
**Fix:** Create an RPC `parent_respond_makeup` with SELECT FOR UPDATE.

### [8C.5] MEDIUM — No Admin Notification on Parent Decline

**File:** `src/pages/portal/PortalHome.tsx:104-123`
**Issue:** When parent declines, the entry silently goes back to `waiting`. No notification sent to admin. Admin has no idea the offer was declined unless they check the waitlist.
**Trace:** Decline handler: update status, clear fields, return. No edge function call.
**Impact:** Admin may assume offer is still pending. Slot goes unused while admin waits for a response that already came.
**Fix:** Call an edge function or send internal_message on decline to notify admin.

### 8D. Open Slot Integration

- **Bulk Slot Generator slots:** No direct integration with make-up matching. Bulk-generated lessons are regular `scheduled` lessons. They would only feed into matching if an attendance record is marked absent/cancelled on one of those slots (triggering `on_slot_released`).
- **No distinction** between "open for new students" vs "open for make-ups" — all lessons are treated equally. No `is_makeup_slot` flag.

### [8D.1] LOW — No Open Slot Integration

**File:** Multiple
**Issue:** There is no mechanism to create "open slots" specifically for make-up students. The matching system only works reactively (when someone is absent from an existing lesson). Academies that want to offer dedicated make-up sessions have no way to do so.
**Trace:** `find_waitlist_matches` searches based on a specific lesson where a student is absent. No "open slot" concept exists.
**Impact:** Academies must wait for absences to create matching opportunities. They cannot proactively offer make-up sessions.
**Fix:** Add ability to create "open make-up slots" that automatically appear in matching results.

---

## SECTION 9: PARENT PORTAL — CREDITS

### 9A. Credit Visibility

**Files reviewed:**
- `src/hooks/useParentCredits.ts` (full)
- `src/pages/portal/PortalHome.tsx:538-599` (credit display)

**Can parents see credit balance?** Yes — PortalHome shows available credits in an emerald card with:
- Count of credits and total value (e.g., "3 make-up credits — £90.00 available")
- Per-credit detail (value, student name, expiry date)
- "Expiring soon" warning for credits expiring within 7 days

**Balance matches admin view?** Partially — parents see from `available_credits` view filtered by `credit_status = 'available'`. Admin view is unknown from reviewed files, but likely uses the same `make_up_credits` table directly.

**Credit history visible?** No — parents only see `available` credits. Redeemed, expired, or voided credits are filtered out by the view.

**Expired/voided visible?** No — only active credits shown.

### [9A.1] LOW — No Credit History for Parents

**File:** `src/hooks/useParentCredits.ts:63`
**Issue:** Query filters `credit_status = 'available'` only. Parents cannot see past credits (redeemed, expired).
**Trace:** `.eq('credit_status', 'available')` filter in queryFn.
**Impact:** Parents have no audit trail. If a credit disappears (expired or admin-voided), parent has no record of it.
**Fix:** Add optional toggle to show all credit history, or separate "Credit History" section.

### 9B. Parent Booking Flow

**File:** `src/pages/portal/PortalHome.tsx:601+`

**Can parents browse available slots?** No. Parents cannot search or browse. They can only:
1. See current waitlist entries and their status (waiting → matched → offered → accepted → booked)
2. Accept or decline an offered make-up lesson

**Book directly or only join waitlist?** Waitlist only — and only admin can add to the waitlist. Parents are passive participants.

**MakeUpStepper:** A visual progress indicator showing the 5 steps: Waiting → Matched → Offered → Accepted → Booked. Pure display component, no interaction.

**Credit immediately deducted?** No — credits are never deducted during the make-up flow (see 8C.1).

**Cancel make-up after booking?** No mechanism exists for parent to cancel a booked make-up. No "cancel booking" button in PortalHome.

### [9B.1] MEDIUM — Parents Cannot Cancel Booked Make-Ups

**File:** `src/pages/portal/PortalHome.tsx`
**Issue:** Once a make-up is booked, parent has no way to cancel it from the portal. If plans change, they must contact the academy directly.
**Trace:** PortalHome shows booked entries but with no actions available (only offered entries have accept/decline).
**Impact:** Poor parent experience. Also, the booked lesson_participant record persists even if parent doesn't show up, with no self-service option.
**Fix:** Add "Cancel Make-Up" button for booked entries that removes the lesson_participant and returns the credit.

### 9C. Notifications

**Channels implemented:**
- **Credit issued:** No notification to parent when credit is auto-issued
- **About to expire:** No notification. The portal shows "expiring soon" badge but no proactive alert
- **Slot found (matched):** No parent notification — only admin notification via `notify-makeup-match`
- **Offer sent:** Email via Resend (`notify-makeup-offer`) with accept/decline links
- **Offer expired:** No notification. Silently reset to waiting by cron

### [9C.1] MEDIUM — No Notification When Credit Issued

**File:** `supabase/migrations/20260222164435_...sql`
**Issue:** When `auto_issue_credit_on_absence()` fires and creates a credit, no notification is sent to the parent. Parent discovers credits only by checking PortalHome.
**Trace:** Trigger function ends after INSERT into make_up_credits — no notification call.
**Impact:** Parents don't know they have credits. Credits may expire before parents realize they exist.
**Fix:** After credit insert, call an edge function to email the parent.

### [9C.2] MEDIUM — No Notification on Offer Expiry

**File:** `supabase/functions/waitlist-expiry/index.ts`
**Issue:** When an offer expires (48h no response), the cron resets status to `waiting` but doesn't notify the parent that the offer expired, nor the admin.
**Trace:** Cron only does UPDATE, no notification calls.
**Impact:** Parent may not realize they missed an offer. Admin doesn't know the offer expired.
**Fix:** Send notification to both parent and admin when offer expires.

---

## SECTION 10: INTERCONNECTIONS & EDGE CASES

### 10A. Continuation + Credits

**No integration found.** The continuation system (`useTermContinuation`) and the credits system (`make_up_credits`) are completely independent. There is:
- No logic to void credits when parent declines continuation
- No logic to carry credits forward to a new term on confirmation
- No check of credit status during continuation flows

### [10A.1] MEDIUM — Credits Not Addressed During Continuation

**File:** Multiple (no integration point exists)
**Issue:** When a parent declines continuation (effectively withdrawing), their credits remain active. When they confirm continuation, credits carry forward by default (they never expire based on term boundaries). But there's no business logic connecting these systems.
**Trace:** Searched for any reference to `make_up_credits` in continuation-related files — none found.
**Impact:** Student withdraws but keeps credits that should arguably be voided. Or credits should have term-scoped expiry.
**Fix:** Add credit expiry alignment with term end dates. On withdrawal, offer option to void or keep credits.

### 10B. Billing Integration

**File reviewed:** `supabase/migrations/20260222211008_...sql` (create_invoice_with_items)

**Credits reduce invoices?** YES — `create_invoice_with_items` accepts `_credit_ids uuid[]` parameter. It:
1. Sums credit values for the provided IDs
2. Subtracts from invoice total: `_total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset)`
3. Marks credits as redeemed: `SET redeemed_at = NOW()`
4. Records `credit_applied_minor` on the invoice

**So credits ARE for invoice reduction, not just make-up lessons.** This is a dual-purpose system.

**Billing run checks credits?** Only if admin manually selects credit IDs when creating the invoice. No automatic application.

**Continuation affects billing?** The continuation system creates leads — billing is separate.

### [10B.1] HIGH — Credits Used for Invoice Reduction But Also for Make-Up Booking — No Double-Dip Prevention

**File:** `supabase/migrations/20260222211008_...sql:70-77` and `confirm_makeup_booking`
**Issue:** A credit can be used BOTH for invoice reduction (via `create_invoice_with_items`) AND for a make-up booking (via the waitlist flow which never actually consumes credits — see 8C.1). Since the make-up flow doesn't consume credits, the real risk is: admin applies credit to an invoice (redeemed_at set), but the student is ALSO booked into a make-up for the same absence — getting both a financial credit AND a make-up lesson.
**Trace:** `create_invoice_with_items` marks credits redeemed. `confirm_makeup_booking` doesn't check credit status at all.
**Impact:** Double benefit: financial discount + free make-up lesson for the same missed lesson.
**Fix:** Credit should be consumed at make-up booking time. Or: if credit is redeemed for invoice, the waitlist entry should be invalidated.

### [10B.2] LOW — Void Invoice Restores Credits

**File:** `supabase/migrations/20260222234306_...sql:206-210` (void_invoice)
**Issue:** When an invoice is voided, credits applied to it are restored (`redeemed_at = NULL`). This is correct behavior but creates a window where the credit could be used again if a make-up was also booked.
**Trace:** `UPDATE make_up_credits SET redeemed_at = NULL, applied_to_invoice_id = NULL WHERE applied_to_invoice_id = _invoice_id`.
**Impact:** Low since it requires admin action and make-up booking is broken anyway (credits not consumed).
**Fix:** Audit trail when credits are restored. Check for related booked make-ups.

### 10C. Reports

- **No dedicated credits report found** in reviewed files
- Credits appear on invoices via `credit_applied_minor` column
- No evidence of credits in revenue report or outstanding report
- **Payroll:** No make-up teaching attribution found — a make-up taught by a different teacher would appear as a regular lesson for that teacher

### [10C.1] LOW — No Dedicated Credits Report

**File:** N/A
**Issue:** No admin report showing credit balance across students, issuance rate, redemption rate, or expiry rate. Admin has no visibility into credit liability.
**Trace:** Searched for credit-related report components — none found.
**Impact:** Academy cannot assess financial exposure from outstanding credits.
**Fix:** Add credits report showing: total outstanding, by student, issuance/redemption trends, upcoming expirations.

### 10D. Term Adjustment Interaction

**Files reviewed:**
- `src/hooks/useTermAdjustment.ts` (full)
- `supabase/functions/process-term-adjustment/index.ts` (full)

**Term shortened → auto credits:** Not exactly. `process-term-adjustment` handles withdrawals (all remaining lessons cancelled) and day changes (some lessons cancelled, new ones created). When `lessons_difference > 0`, it creates a credit note (invoice), NOT a make-up credit. These are separate financial instruments.

**Term extended → continuation deadline:** No interaction. The term adjustment system operates independently of continuation.

**Withdrawal → waitlist check:** YES — the confirm handler checks the `enrolment_waitlist` for waiting families when a withdrawal occurs (lines 920-943). Returns up to 5 matching waitlist entries. But this is informational only — no automatic offer is made.

### [10D.1] MEDIUM — Term Adjustment Creates Credit Notes, Not Make-Up Credits

**File:** `supabase/functions/process-term-adjustment/index.ts:760-881`
**Issue:** When a student withdraws mid-term, the system creates a credit note (negative invoice) rather than make-up credits. These are two separate systems. A withdrawal creates a financial credit, but no make-up lesson opportunities.
**Trace:** `handleConfirm` creates an invoice with `is_credit_note: true` for the adjustment amount.
**Impact:** No confusion — these are intentionally different systems. But admin might expect withdrawal to also create make-up credits. Not a bug, but a documentation gap.
**Fix:** Document the distinction. Optionally offer make-up credits as an alternative to credit notes.

### 10E. WORST-CASE SCENARIOS

### [10E.1] CRITICAL — Cancel → Credit → Waitlist → Match → Accept → Cancel THAT → Second Credit

**File:** Multiple systems
**Issue:** The chain: (1) Lesson cancelled → credit auto-issued. (2) Student added to waitlist → matched → offered → accepted → booked. (3) Student is now a participant in the make-up lesson. (4) Attendance for the MAKE-UP lesson is marked absent. (5) `auto_issue_credit_on_absence()` fires again → SECOND credit issued.
**Trace:** The auto-credit trigger checks `WHERE student_id = NEW.student_id AND issued_for_lesson_id = NEW.lesson_id`. The make-up lesson has a DIFFERENT lesson_id, so the duplicate check passes. A new credit is issued.
**Impact:** Infinite credit loop. Each make-up absence generates a new credit, which can be used for another make-up, which can generate another credit. Financial liability grows without bound.
**Fix:** Add `is_makeup_lesson` flag or track that a lesson was booked as a make-up. The trigger should check if the lesson was itself a make-up and skip credit issuance, or check the chain depth.

### [10E.2] LOW — Credit Expires While Parent Viewing Offer → Accept

**File:** `src/pages/portal/PortalHome.tsx:90-97`
**Issue:** If a credit expires while the parent is viewing the offer page and they click Accept, the accept goes through (it only checks `status = 'offered'`, not credit validity). Since credits aren't consumed at booking time (8C.1), this is moot — but once the credit consumption bug is fixed, this becomes a real race condition.
**Trace:** No credit check in parent accept handler.
**Impact:** Currently no impact due to 8C.1. Future impact: parent accepts but credit is expired when admin tries to confirm.
**Fix:** When fixing 8C.1, add credit validity check at accept time.

### [10E.3] LOW — Parent with 3 Children: Decline 2, Confirm 1

**File:** Continuation system (not in scope of Part 3 in detail, but referenced)
**Issue:** The continuation system handles per-child responses via individual leads. Each lead is independent, so partial responses (decline 2, confirm 1) are handled correctly — each lead has its own status.
**Trace:** `useParentContinuationPending` returns a list of leads, each with independent accept/decline.
**Impact:** This scenario works correctly. No bug found.
**Fix:** None needed.

---

## SECTION 11: MAKE-UP DASHBOARD

### 11A. Stats

**File reviewed:** `src/components/makeups/MakeUpStatsCards.tsx` (full)

**Stats shown:** Needs Action (matched count), Waiting, Offered, Booked This Month

**Calculated from DB:** Yes — `useWaitlistStats()` queries `make_up_waitlist` table and counts by status. Fetches ALL matching rows and counts client-side.

**Include deleted students?** No filter for deleted students. If a student is deleted (CASCADE from `students` table), their waitlist entries are also deleted (ON DELETE CASCADE on student_id FK).

### [11A.1] MEDIUM — "Booked This Month" Shows All-Time Booked Count

**File:** `src/hooks/useMakeUpWaitlist.ts:273-295`
**Issue:** `useWaitlistStats` queries for status IN ('waiting', 'matched', 'offered', 'accepted', 'booked') but does NOT filter by date for 'booked'. The card label says "Booked This Month" but shows all-time booked count.
**Trace:** `.in('status', ['waiting', 'matched', 'offered', 'accepted', 'booked'])` — no date filter.
**Impact:** Misleading stat. Shows total lifetime bookings, not monthly.
**Fix:** Add date filter for booked status: `.or('status.neq.booked, and(status.eq.booked, updated_at.gte.{startOfMonth})')`.

### [11A.2] LOW — Stats Fetches All Rows Client-Side

**File:** `src/hooks/useMakeUpWaitlist.ts:277-289`
**Issue:** Instead of using `count: 'exact', head: true` per status (like enrolment waitlist stats do), this fetches ALL rows and counts client-side. For large academies with hundreds of waitlist entries, this is wasteful.
**Trace:** `.select('status')` returns all matching rows.
**Impact:** Performance degradation at scale. Transfers unnecessary data.
**Fix:** Use Supabase count queries or create an RPC for aggregation.

### 11B. Actions

**Available actions:** Issue credit (not in dashboard — done via policies/triggers), Add to Waitlist (dialog), Send Offer (on matched entries), Dismiss (on matched entries), Find Match (on waiting entries), Refresh.

**Role-protected?** The MakeUpDashboard page is accessible via routes.ts with role restrictions (owner, admin). RLS on `make_up_waitlist` enforces org-admin for mutations. The `notify-makeup-offer` edge function checks admin/owner membership.

### 11C. Realtime

**File:** `src/hooks/useMakeUpWaitlist.ts:70-93`

**Yes — realtime is implemented.** A Supabase channel subscribes to UPDATE events on `make_up_waitlist` filtered by org_id. Invalidates `make_up_waitlist` and `make_up_waitlist_stats` queries on change.

### [11C.1] LOW — Realtime Only Listens for UPDATE, Not INSERT or DELETE

**File:** `src/hooks/useMakeUpWaitlist.ts:77`
**Issue:** Channel only subscribes to `event: 'UPDATE'`. New waitlist entries (INSERT) or deletions won't trigger realtime refresh.
**Trace:** `.on('postgres_changes', { event: 'UPDATE', ... })` — only UPDATE.
**Impact:** If another admin adds a waitlist entry, the current admin's view doesn't update until they manually refresh.
**Fix:** Change to `event: '*'` to capture INSERT, UPDATE, and DELETE.

---

## SECTION 12: ENROLMENT WAITLIST

### 12A. Separate Table

**File reviewed:** `supabase/migrations/20260227120000_enrolment_waitlist.sql` (full)

**Completely separate table** from `make_up_waitlist`. Different schema, different columns, different RLS policies. The `enrolment_waitlist` tracks prospective new students awaiting a slot. The `make_up_waitlist` tracks existing students awaiting a make-up lesson.

No shared discriminator — entirely independent tables.

### 12B. Entry Lifecycle

**Statuses:** `waiting` → `offered` → `accepted` → `enrolled` → (or `declined`, `expired`, `withdrawn`, `lost`)

**Full lifecycle:**
1. Admin adds to waitlist (manual, or from lead pipeline)
2. Admin offers a slot (day, time, teacher, location, rate)
3. Email sent to parent via `send-enrolment-offer` edge function
4. Parent responds:
   - Via email link → `waitlist-respond` edge function (JWT-based, no auth needed)
   - Via portal → `useRespondToOffer` hook
5. If accepted → admin converts to student via `useConvertWaitlistToStudent`
6. If expired → `waitlist-expiry` cron... wait, that's for make-up waitlist only

### [12B.1] HIGH — waitlist-expiry Cron Only Handles Make-Up Waitlist, Not Enrolment Waitlist

**File:** `supabase/functions/waitlist-expiry/index.ts`
**Issue:** The `waitlist-expiry` cron function only operates on `make_up_waitlist` table. The `enrolment_waitlist` has `offer_expires_at` column but NO cron job to expire stale offers.
**Trace:** Cron updates `make_up_waitlist` only. No reference to `enrolment_waitlist`.
**Impact:** Enrolment offers never expire automatically. A family offered a slot 6 months ago still shows as "offered" status. The `offer_expires_at` column exists but is never enforced.
**Fix:** Add enrolment waitlist expiry logic to the cron, or create a separate cron function.

### 12C. waitlist-respond

**File reviewed:** `supabase/functions/waitlist-respond/index.ts` (full)

**Handles ONLY enrolment waitlist.** The function:
1. Verifies a JWT token (with waitlist_id and org_id in payload)
2. Checks `enrolment_waitlist` table — NOT `make_up_waitlist`
3. Updates status to accepted or declined
4. Returns HTML success/failure page

**Make-up waitlist responses** are handled entirely differently — via PortalHome query parameters (`makeup_action=accept`).

### [12C.1] MEDIUM — waitlist-respond Uses Service Role Key as JWT Default

**File:** `supabase/functions/waitlist-respond/index.ts:56`
**Issue:** `const jwtSecret = Deno.env.get("WAITLIST_JWT_SECRET") || supabaseServiceKey`. If `WAITLIST_JWT_SECRET` is not set, the Supabase service role key is used as the JWT signing secret. Anyone who obtains the JWT (from the email URL) could potentially derive the service role key or use the JWT format to forge tokens.
**Trace:** Fallback to `supabaseServiceKey` when env var not set.
**Impact:** Security risk if `WAITLIST_JWT_SECRET` is not configured. Service role key exposure could lead to full database access.
**Fix:** Require `WAITLIST_JWT_SECRET` to be set. Remove fallback to service role key.

### [12C.2] LOW — Declined Enrolment Waitlist Entry Status Mismatch

**File:** `supabase/functions/waitlist-respond/index.ts:155`
**Issue:** When a parent declines via the email link, the function shows "We'll keep you on the waiting list" — but the status is set to `declined`, not `waiting`. The family is NOT actually kept on the list.
**Trace:** `action === "decline"` → update status to `declined`. But message says they'll stay on the list.
**Impact:** Misleading message. Parent thinks they're still on the waiting list but they're not.
**Fix:** Either (1) set status back to `waiting` on decline (and clear offer fields), or (2) change the message to "We've removed you from the waiting list for this slot."

### 12D. Conversion to Student

**File reviewed:** `src/hooks/useEnrolmentWaitlist.ts:629-735` (useConvertWaitlistToStudent)

**Auto-create student record?** YES — the conversion function:
1. Creates or finds guardian (if `guardian_id` is null, creates new guardian)
2. Creates student record
3. Links student to guardian via `student_guardians` with `is_primary_payer: true`
4. Updates waitlist entry: `status = 'enrolled'`, `converted_student_id`, `converted_at`
5. Logs activity

**Lesson created?** NO — no lesson or recurrence rule is created during conversion. The student record is created but they have no scheduled lessons.

**Atomic?** NO — this is a sequence of individual Supabase calls on the client side. If any step fails, the preceding steps are not rolled back.

### [12D.1] HIGH — Non-Atomic Student Conversion Can Leave Orphans

**File:** `src/hooks/useEnrolmentWaitlist.ts:640-720`
**Issue:** Conversion performs 5 sequential database operations (guardian insert, student insert, link insert, waitlist update, activity insert) without a transaction. If step 3 (link) fails, guardian and student exist but are unlinked. If step 4 (waitlist update) fails, the student exists but the waitlist entry still shows as `accepted`.
**Trace:** Each operation is a separate `await supabase.from(...)` call. No transaction wrapper.
**Impact:** Orphaned guardian or student records. Waitlist entry could be converted again, creating duplicate students.
**Fix:** Convert to a server-side RPC that wraps all operations in a single transaction.

### [12D.2] MEDIUM — No Lesson Created on Conversion

**File:** `src/hooks/useEnrolmentWaitlist.ts:629-735`
**Issue:** When converting a waitlist entry to a student, the system creates the student record but not any lessons. The offered slot details (day, time, teacher, location) are on the waitlist entry but not used to create a recurring lesson.
**Trace:** No INSERT into `lessons` or `recurrence_rules` in the conversion function.
**Impact:** After conversion, admin must manually set up the student's lesson schedule. The offered slot details that the parent accepted are lost in practice.
**Fix:** After creating the student, create a recurrence rule and initial lessons based on the offered slot details.

### [12D.3] LOW — Position Repositioning Race Condition

**File:** `src/hooks/useEnrolmentWaitlist.ts:770-785`
**Issue:** `useWithdrawFromWaitlist` repositions remaining entries by decrementing positions one-by-one in a loop. If two withdrawals happen simultaneously for the same instrument, positions could become inconsistent.
**Trace:** Loop: `for (const r of remaining) { await db.from('enrolment_waitlist').update({ position: r.position - 1 }) }`.
**Impact:** Position numbers could become non-sequential or duplicated. Low probability but possible.
**Fix:** Use an RPC with a transaction, or use a single UPDATE with position arithmetic.

---

## SUMMARY TABLE

| Severity | Section 7 | Section 8 | Section 9 | Section 10 | Section 11 | Section 12 | Total |
|----------|-----------|-----------|-----------|------------|------------|------------|-------|
| CRITICAL | 0 | 1 | 0 | 1 | 0 | 0 | **2** |
| HIGH | 0 | 3 | 0 | 1 | 0 | 2 | **6** |
| MEDIUM | 2 | 3 | 2 | 2 | 1 | 2 | **12** |
| LOW | 2 | 1 | 1 | 2 | 2 | 2 | **10** |
| **Total** | **4** | **8** | **3** | **6** | **3** | **6** | **30** |

### Combined Severity Counts (All 3 Parts)

*(Assuming Parts 1 & 2 findings are referenced from claude.md Wave 2/3 context)*

| Severity | Part 3 |
|----------|--------|
| CRITICAL | 2 |
| HIGH | 6 |
| MEDIUM | 12 |
| LOW | 10 |
| **Total** | **30** |

---

## TOP 5 MOST DANGEROUS FINDINGS

### 1. [10E.1] CRITICAL — Infinite Credit Loop via Make-Up Absence Chain
**File:** Auto-issue trigger + make-up booking flow
**Issue:** Cancel lesson → credit issued → waitlisted → make-up booked → absent from make-up → SECOND credit issued → repeat. Each iteration creates a new credit because the trigger only checks for duplicate credits on the same lesson_id, and the make-up lesson has a different ID.
**Impact:** Unbounded financial liability. A single missed lesson could cascade into infinite credits.
**Immediate Fix:** Add flag to lesson_participants or check if the lesson was booked as a make-up. Skip credit issuance for absences from make-up lessons.

### 2. [8C.1] CRITICAL — Credits Never Consumed on Make-Up Booking
**File:** `confirm_makeup_booking` RPC
**Issue:** The RPC adds the student to the lesson and marks the waitlist entry as booked, but never marks any credit as redeemed. Credits accumulate infinitely and can also be applied to invoices.
**Impact:** Students get unlimited free make-up lessons. Credits remain "available" even after make-ups are booked. Combined with invoice credit application, students get both financial credit AND free lessons.
**Immediate Fix:** In `confirm_makeup_booking`, redeem the oldest available credit for the student.

### 3. [8C.2] HIGH — Accepted Entries Invisible to Admin
**File:** NeedsActionSection uses `status: 'matched'` filter
**Issue:** When parent accepts a make-up offer, the entry moves to `accepted` status. But the "Needs Action" section only shows `matched` entries. The accepted entry disappears from admin's attention, and no notification is sent.
**Impact:** Make-up bookings stall after parent acceptance. Parent thinks they accepted but nothing happens. Admin doesn't know they need to confirm.
**Immediate Fix:** Include `accepted` entries in NeedsActionSection. Add admin notification on parent acceptance.

### 4. [8B.1] HIGH — Multiple Entries Matched to Same Slot Without Mutual Exclusion
**File:** `on_slot_released()` trigger
**Issue:** Up to 3 waitlist entries are auto-matched to the same lesson slot. All 3 are set to `matched` status. If one is booked, the other 2 still point to the same (now-full) lesson.
**Impact:** Admin could accidentally overbook a lesson. Stale matched entries confuse the dashboard.
**Immediate Fix:** After `confirm_makeup_booking`, dismiss other entries matched to the same lesson. Or in the booking RPC, check remaining capacity.

### 5. [12D.1] HIGH — Non-Atomic Student Conversion
**File:** `useConvertWaitlistToStudent` hook
**Issue:** 5 sequential database calls without a transaction. Any failure mid-sequence leaves partial data: orphaned guardians, unlinked students, or a waitlist entry that can be converted again.
**Impact:** Data integrity issues. Duplicate students if conversion retried after partial failure.
**Immediate Fix:** Create `convert_waitlist_to_student` RPC that wraps all operations in a single database transaction.

---

## FEATURE COMPLETENESS ASSESSMENT

### Term Continuation: NEEDS-WORK
- Core flow works (create leads, send offers, parent responds)
- Missing: credit interaction, billing integration with continuation
- No auto-expiry of continuation offers found in this audit scope

### Make-Up Credits: NOT-READY
- **Critical gap:** Credits never consumed on make-up booking
- **Critical gap:** Infinite credit loop possible
- No credit limits per student/term
- No credit expiry configuration
- No proactive notifications to parents
- Matching works but preferences never captured
- Accept flow broken (admin not notified)
- Recommend: Do not launch make-up credit system until CRITICAL items fixed

### Enrolment Waitlist: NEEDS-WORK
- Core CRUD works well with activity logging
- Offer flow works (email via JWT)
- **Critical gap:** Offers never auto-expire (no cron)
- **Critical gap:** Student conversion is non-atomic
- No lesson creation on conversion
- Decline message misleading
- JWT secret fallback is security risk

### Cross-System Integration: NOT-READY
- Credits and continuation are completely disconnected
- Credits can be double-dipped (invoice reduction + make-up booking)
- No term-awareness in credit system
- No reports on credit liability
- Term adjustment creates credit notes, not make-up credits (by design but undocumented)
- Withdrawal → enrolment waitlist check is informational only, no auto-action
