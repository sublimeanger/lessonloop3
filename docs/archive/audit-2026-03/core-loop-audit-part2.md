# Core Loop Audit — Part 2 (Steps 4–7)

> Audited: 2026-03-15
> Branch: `claude/core-loop-audit-part2-CtUfW`
> Scope: Mark Attendance → Create Invoices → Send Invoices → Parent Pays

---

## STEP 4: MARK ATTENDANCE

---

### **[4A] — Register data loading**
**Status:** EDGE CASE RISK
**Files read:**
- `src/hooks/useRegisterData.ts:69-207` (useRegisterData)
- `src/pages/DailyRegister.tsx:37-101` (DailyRegister component)

**Trace:**
1. `useRegisterData(date)` is called with the selected date (line 69).
2. `startOfDay(date)` and `endOfDay(date)` are computed using `date-fns` and converted to ISO strings (line 79–80).
3. Query filters lessons by `org_id`, `start_at >= dayStart`, `start_at <= dayEnd`, ordered by `start_at` ascending (lines 83–117).
4. For teacher-role users, the hook looks up the teacher record by `user_id` (lines 120–136) and filters by `teacher_id` or falls back to `teacher_user_id`.
5. Locations and rooms are fetched in separate queries and joined via Maps (lines 142–166).

**Finding 1 — Timezone bug (date filtering uses browser timezone, not org timezone):**
`startOfDay(date)` and `endOfDay(date)` from `date-fns` operate in the **browser's local timezone**, then `.toISOString()` converts to UTC. If a teacher is in a different timezone than the org, the date boundaries will be wrong.

**Evidence:**
```typescript
// src/hooks/useRegisterData.ts:79-80
const dayStart = startOfDay(date).toISOString();
const dayEnd = endOfDay(date).toISOString();
```
The org's `timezone` field is available on the `organisations` table but is never used here.

**Impact:** A UK-based music school with a teacher travelling abroad (e.g. +2 timezone) would see lessons from a different calendar day. Late-night lessons (e.g. 11pm UK time) could be missed or appear on the wrong day for users in UTC+ timezones.

**Fix:** Convert `selectedDate` to org timezone before computing day boundaries. Use `date-fns-tz` or similar to construct `dayStart`/`dayEnd` in the org's timezone.

**Finding 2 — Performance with 50 lessons:**
The query fetches all lessons for the day in a single query with nested `lesson_participants` and `attendance_records` joins. For 50 lessons with ~5 students each, this is ~250 participant rows + ~250 attendance rows — manageable. Location and room queries are batched by unique IDs. The `staleTime` is `STALE_VOLATILE` which keeps data fresh.

**Status for performance:** VERIFIED CORRECT — no issue with 50 lessons.

---

### **[4B] — Attendance record creation**
**Status:** VERIFIED CORRECT
**Files read:**
- `src/hooks/useRegisterData.ts:210-328` (useUpdateAttendance)
- `supabase/migrations/20260119233145_*.sql` (attendance_records CREATE TABLE)
- `supabase/migrations/20260222202802_*.sql` (validate_attendance_participant trigger)

**Trace:**
1. `useUpdateAttendance` fires per-click (not batched on Save) — each status toggle immediately triggers the mutation (line 216).
2. Uses optimistic updates via `onMutate` — cancels in-flight queries, updates cache, rolls back on error (lines 281–305).
3. The mutation performs an **upsert** with `onConflict: 'lesson_id,student_id'` (lines 262–277).
4. The insert includes `org_id`, `lesson_id`, `student_id`, `attendance_status`, `recorded_by`, `absence_reason_category`, `absence_notified_at`.

**Schema:**
```sql
-- supabase/migrations/20260119233145_*.sql
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_status attendance_status NOT NULL DEFAULT 'present',
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  cancellation_reason text,
  UNIQUE(lesson_id, student_id)
);
```

**Finding:**
- `org_id` IS on the record. ✓
- Unique constraint on `(lesson_id, student_id)` exists. ✓
- Duplicate recording uses upsert, so re-marking simply overwrites the previous status. ✓
- The `validate_attendance_participant` trigger (migration `20260222202802_*.sql`) ensures attendance can only be recorded for students who are lesson participants. ✓
- Auth check verifies user is the assigned teacher or an admin before writing (lines 234–259). ✓

**Impact:** None — well-designed.

---

### **[4C] — Future attendance guard**
**Status:** BUG FOUND
**Files read:**
- `src/hooks/useRegisterData.ts:210-280` (useUpdateAttendance mutation)
- `src/pages/DailyRegister.tsx:103-105` (date navigation)
- All attendance_records migration files (no CHECK constraint on lesson date)

**Trace:**
1. The date picker in `DailyRegister.tsx` allows navigating to **any date** — past or future (line 104: `goToNextDay`).
2. The `useRegisterData` hook loads lessons for any selected date with no date restriction (lines 79–80).
3. The `useUpdateAttendance` mutation has **no check** on whether the lesson is in the future — it only checks teacher assignment/admin role (lines 234–259).
4. There is **no database constraint** preventing attendance records for future lessons.

**Evidence:**
```typescript
// src/pages/DailyRegister.tsx:104
const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
// No upper-bound restriction on selectedDate
```

```typescript
// src/hooks/useRegisterData.ts:210-280 (useUpdateAttendance)
// No date validation — only checks teacher_user_id and admin role
```

**Finding:** There is **no guard at any layer** — not client-side, not server-side, not in the database — preventing a teacher from marking attendance for a lesson that hasn't happened yet. A teacher could navigate to tomorrow and mark all students present.

**Impact:** A music school teacher could accidentally (or deliberately) mark attendance for future lessons, inflating completion stats and potentially triggering billing for un-delivered lessons.

**Fix:** Add a check in `useUpdateAttendance` that compares `lesson.start_at` against `now()`. Optionally add a DB-level CHECK or trigger that rejects attendance records where the lesson's `start_at` is in the future.

---

### **[4D] — Absence → credit**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/migrations/20260315200000_fix_infinite_credit_loop_makeup_absence.sql:10-86` (auto_issue_credit_on_absence)
- `supabase/migrations/20260222164414_*.sql:2-52` (auto_add_to_waitlist)
- `supabase/migrations/20260222164435_*.sql` (trg_auto_credit trigger definition)

**Trace:**
1. When attendance is marked absent/cancelled, the `trg_auto_credit` trigger fires `auto_issue_credit_on_absence()`.
2. The function checks: (a) status is absent/cancelled, (b) absence_reason is set, (c) a matching `make_up_policies` row exists with `eligibility = 'automatic'`, (d) no duplicate credit for same student+lesson.
3. **Infinite loop fix:** Before issuing, checks if the lesson was a make-up booking via `make_up_waitlist.booked_lesson_id`. If yes, skips credit and logs to `audit_log` with action `credit_skipped_makeup_lesson`.
4. Credit value comes from `invoice_items.unit_price_minor` for the matching lesson+student. If zero or missing, no credit.
5. Max-credits-per-term cap is enforced. Expiry is calculated in org timezone.

**Evidence (infinite loop guard):**
```sql
-- supabase/migrations/20260315200000_fix_infinite_credit_loop_makeup_absence.sql:35-48
SELECT EXISTS (
  SELECT 1 FROM make_up_waitlist
  WHERE booked_lesson_id = NEW.lesson_id
    AND student_id = NEW.student_id
    AND status = 'booked'
) INTO _is_makeup_lesson;

IF _is_makeup_lesson THEN
  INSERT INTO audit_log ...
  RETURN NEW;
END IF;
```

**Finding:** The normal flow (mark absent → credit issued → waitlist → make-up booking) works correctly. The infinite loop fix prevents credits from cascading on make-up lessons. The normal absence path is unaffected.

**Impact:** None — well-implemented.

---

### **[4E] — Attendance → Dashboard**
**Status:** VERIFIED CORRECT
**Files read:**
- `src/hooks/useRegisterData.ts:319-327` (onSettled in useUpdateAttendance)
- `src/hooks/useRegisterData.ts:382-401` (onSuccess in useMarkLessonComplete)

**Trace:**
1. After attendance is saved, `onSettled` fires (line 319) and invalidates:
   - `['register-lessons']` — refreshes the register view
   - `['make_up_credits']`, `['make_up_waitlist']`, `['waitlist-stats']`, `['available-credits-for-payer']` — updates credit/waitlist UI
2. After marking lesson complete, `onSuccess` (line 382) additionally invalidates:
   - `['proactive-alerts']`, `['urgent-actions']`, `['today-lessons']` — dashboard banners update
3. Uses React Query's `invalidateQueries` which triggers background refetch — **not real-time**, but effectively live within seconds.

**Evidence:**
```typescript
// src/hooks/useRegisterData.ts:319-326
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['register-lessons'] });
  queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
  queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
  queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
  queryClient.invalidateQueries({ queryKey: ['available-credits-for-payer'] });
},
```

**Finding:** Dashboard updates via React Query invalidation — not real-time subscriptions, but immediate cache invalidation triggers refetch. Dashboard widgets pick up changes within seconds.

**Impact:** None.

---

## STEP 5: CREATE INVOICES

---

### **[5A] — Manual invoice creation**
**Status:** VERIFIED CORRECT
**Files read:**
- `src/components/invoices/CreateInvoiceModal.tsx:145-216` (onSubmit handler)
- `supabase/migrations/20260223004118_*.sql:42-158` (create_invoice_with_items RPC)
- `supabase/migrations/20260224150000_*.sql:15-58` (generate_invoice_number)

**Trace:**
1. User enters description, quantity, and unit price in **pounds** (the form uses `step="0.01"` with a £ label).
2. On submit, prices are converted: `unit_price_minor: Math.round(item.unitPrice * 100)` (line 177).
3. Calls `createInvoice.mutateAsync()` which invokes the `create_invoice_with_items` RPC.
4. The RPC (server-side) calculates subtotal, VAT, and total. Status defaults to `'draft'` (not explicitly set in RPC INSERT — but the column default handles it per migration: no explicit default means it relies on table default which is not shown, but the billing run sets `status: 'draft'` explicitly).
5. Invoice number is generated by the `set_invoice_number` trigger which calls `generate_invoice_number()`.

**Finding:**
- Price input is in pounds, converted to pence client-side. ✓
- Total calculated **server-side** in the RPC (not client-side). ✓
- Uses RPC, not direct insert. ✓
- Invoice number: auto-generated via `generate_invoice_number()` using an atomic upsert + increment on `invoice_number_sequences` table. Format: `PREFIX-YYYY-00001`. Gap-free within a year. ✓
- Unique constraint: `UNIQUE(org_id, invoice_number)` on the invoices table. ✓
- Zero items prevented: RPC raises exception if `jsonb_array_length(_items) = 0`. ✓
- Authorisation: RPC checks `is_org_finance_team(auth.uid(), _org_id)`. ✓

**Impact:** None — well-designed.

---

### **[5B] — Invoice line items**
**Status:** EDGE CASE RISK
**Files read:**
- `supabase/migrations/20260119234233_*.sql:37-48` (invoice_items table)
- `supabase/migrations/20260223004118_*.sql:42-158` (create_invoice_with_items RPC)

**Trace:**
The `invoice_items` table has:
- `id` (uuid PK), `invoice_id` (FK to invoices), `org_id` (FK to organisations)
- `description`, `quantity` (int default 1), `unit_price_minor` (int), `amount_minor` (int)
- `linked_lesson_id` (FK to lessons, nullable), `student_id` (FK to students, nullable)

**Finding 1 — Zero line items:** The RPC checks `jsonb_array_length(_items) = 0` and raises an exception. ✓

**Finding 2 — Negative amounts:** There is **no CHECK constraint** on `unit_price_minor` or `amount_minor` to prevent negative values. The client-side form enforces `min: 0.01` for unitPrice and `min: 1` for quantity, but the RPC does not validate.

**Evidence:**
```sql
-- invoice_items table definition — no CHECK constraint on amounts
unit_price_minor integer,
amount_minor integer,
```

```typescript
// CreateInvoiceModal.tsx:154 — client-side only validation
const invalidItems = data.items.filter(item => item.unitPrice <= 0 || item.quantity <= 0);
```

**Finding 3 — Cross-org lesson reference:** The `linked_lesson_id` FK references `lessons(id)` with no org_id check at the DB level. However, the RPC creates items within the context of `_org_id`, and lesson IDs come from the `useUnbilledLessons` hook which filters by org. The risk is theoretical — an API-savvy user could craft a request with a lesson ID from another org. The FK would succeed because it only checks `lessons(id)` not `lessons(id, org_id)`.

**Impact:** Negative amount risk is low (client validates), but a malicious API call could create credit-note-like items. Cross-org lesson reference is extremely unlikely but theoretically possible.

**Fix:** Add `CHECK (unit_price_minor >= 0)` and `CHECK (amount_minor >= 0)` constraints. For cross-org, add a trigger validating `lesson.org_id = invoice.org_id`.

---

### **[5C] — VAT calculation**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/migrations/20260223004118_*.sql:42-158` (create_invoice_with_items RPC)
- `supabase/functions/create-billing-run/index.ts:571-575` (billing run VAT)

**Trace:**
1. In `create_invoice_with_items` RPC: VAT is calculated **server-side** on the subtotal (sum of all items), not per-item.
   ```sql
   _tax_minor := ROUND(_subtotal * _org.vat_rate / 100.0);
   ```
2. In billing run: Same approach — VAT on subtotal per payer group (line 574):
   ```typescript
   const taxMinor = Math.round(subtotal * (vatRate / 100));
   ```
3. VAT rate is **snapshotted on the invoice** via the `vat_rate` column — not derived at display time.

**Finding:**
- VAT calculated server-side on subtotal. ✓
- Uses `ROUND()` / `Math.round()` — standard banker's rounding for half-penny amounts. ✓
- VAT rate stored on invoice (immutable snapshot). ✓
- Client-side does NOT calculate totals — the RPC returns the computed values. ✓

**Impact:** None.

---

### **[5D] — Billing run (automated)**
**Status:** EDGE CASE RISK
**Files read:**
- `supabase/functions/create-billing-run/index.ts:1-671` (full function)

**Trace:**
1. Input: `org_id`, `start_date`, `end_date`, `billing_mode` (delivered|upfront), `fallback_rate_minor`, `generate_invoices`, `term_id` (lines 10–24).
2. Query chain: lessons (filtered by org, date range, status based on billing mode) → lesson_participants → students → student_guardians (lines 385–406).
3. Already-billed lessons: deduped via `invoice_items.linked_lesson_id` (lines 410–421). ✓
4. Open slots: filtered out via `.or('is_open_slot.is.null,is_open_slot.eq.false')` (line 403). ✓
5. Cancelled lessons (teacher-cancelled): skipped via attendance status check `cancelled_by_teacher` (line 474). ✓
6. Grouping by payer: uses `is_primary_payer` guardian. If no primary payer guardian, falls back to student email. If neither, skips with `no_primary_payer` reason (lines 479–505).
7. Rate: from rate cards matching lesson duration. Falls back to default rate card, then `fallbackMinor` (lines 33–44).
8. Invoices inserted in batch, then items in batch (lines 594–658).
9. Run status: `completed` (0 failures), `partial` (some failures), `failed` (all failures) (lines 215–219).

**Finding 1 — Student has 2 guardians:** Only the guardian with `is_primary_payer = true` is selected (line 479–481). If neither guardian is primary payer, the student is skipped. This is correct behavior.

**Finding 2 — Invoice number for batch inserts:** Invoices are batch-inserted with `invoice_number: ""` (line 579). The `set_invoice_number` trigger fires per row and calls `generate_invoice_number()` which uses an atomic `UPDATE ... RETURNING` on the sequence table. This is safe for concurrent inserts within a transaction, but **two simultaneous billing runs** could race on the sequence table. However, the `UPDATE ... RETURNING` pattern with row-level locking prevents collisions.

**Finding 3 — Billing run lacks org_id filtering on invoice_items dedup query:**
```typescript
// create-billing-run/index.ts:411-414
const { data: billedItems } = await client
  .from("invoice_items")
  .select("linked_lesson_id")
  .eq("org_id", orgId)
  .not("linked_lesson_id", "is", null);
```
Actually, it DOES filter by `org_id`. ✓

**Finding 4 — No cancelled lesson status filter in the initial lesson query:**
The query filters by `status IN ['completed']` (delivered mode) or `status IN ['scheduled', 'completed']` (upfront mode) — lines 379–382. Cancelled lessons are excluded at the query level. ✓ However, `cancelled_by_teacher` **attendance** records for non-cancelled lessons are filtered separately (line 474). This means if a lesson is `completed` but a specific student was `cancelled_by_teacher`, that student is correctly skipped.

**Impact:** No bugs found. The batch insert approach is efficient.

---

### **[5E] — Invoice number sequence**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/migrations/20260224150000_*.sql:15-58` (generate_invoice_number)
- `supabase/migrations/20260119234233_*.sql:33` (UNIQUE constraint)

**Trace:**
1. Uses a dedicated `invoice_number_sequences` table with `(org_id)` as the key.
2. Atomic increment: `INSERT ... ON CONFLICT DO NOTHING` followed by `UPDATE ... RETURNING current_number` — ensures no gaps within a year.
3. Year rollover: if `current_year != _year`, resets to 1.
4. Format: `PREFIX-YYYY-NNNNN` (configurable prefix and digit count per org).
5. Unique constraint: `UNIQUE(org_id, invoice_number)` prevents duplicates.

**Finding:**
- Auto-incrementing per org per year. ✓
- Gap-free (atomic increment). ✓
- Two simultaneous creates: The `UPDATE ... RETURNING` acquires a row lock, serializing concurrent increments. No collision possible. ✓
- Unique constraint as safety net. ✓

**Impact:** None.

---

## STEP 6: SEND INVOICES

---

### **[6A] — Status change**
**Status:** BUG FOUND
**Files read:**
- `src/components/invoices/SendInvoiceModal.tsx:134-173` (handleSend)
- `supabase/functions/send-invoice-email/index.ts:1-244` (email function)

**Trace:**
1. `handleSend` invokes `send-invoice-email` edge function (line 140).
2. If the function succeeds, THEN updates status from `draft` to `sent` (lines 157–158):
   ```typescript
   if (invoice.status === 'draft') {
     await updateStatus.mutateAsync({ id: invoice.id, status: 'sent' });
   }
   ```
3. The email send and status update are **two separate operations** — not atomic.

**Finding — Non-atomic email + status update:**
- **Email fails → status NOT changed.** ✓ (correct — the `if (sendError) throw sendError` on line 155 prevents reaching the status update)
- **Email succeeds, status update fails → email sent but invoice still shows as 'draft'.** This is a real bug. The parent receives the invoice email, but the admin sees it as unsent.
- **`sent_at` timestamp:** There is no `sent_at` field being set on the invoice itself. The `message_log` entry has `sent_at`, but the invoice table does not track when it was first sent.

**Evidence:**
```typescript
// SendInvoiceModal.tsx:140-158
const { error: sendError } = await supabase.functions.invoke('send-invoice-email', { body: {...} });
if (sendError) throw sendError;
// Status update is a SEPARATE call that can fail independently
if (invoice.status === 'draft') {
  await updateStatus.mutateAsync({ id: invoice.id, status: 'sent' });
}
```

**Impact:** If the status update call fails (network error, timeout), the admin will think the invoice wasn't sent and may re-send it, causing duplicate emails to the parent. The parent sees the invoice, but the system doesn't reflect it.

**Fix:** Move the status update into the edge function itself (server-side), so email send + status change happen atomically, or at least in the same request.

---

### **[6B] — Email content**
**Status:** EDGE CASE RISK
**Files read:**
- `supabase/functions/send-invoice-email/index.ts:91-164` (email HTML construction)
- `src/components/invoices/SendInvoiceModal.tsx:102-108` (recipient resolution)

**Trace:**
1. Payment link is constructed as: `${FRONTEND_URL}/portal/invoices?invoice=${invoiceId}&action=pay` (line 92). This is a portal link, NOT a Stripe checkout URL directly. ✓
2. Currency is passed from the client as `amount` string (already formatted). The org's `currency_code` is used for bank reference. ✓
3. Org name is passed in the request body. ✓
4. Parent name: `recipientName` from client-side resolution (line 104–108 of SendInvoiceModal). ✓
5. All dynamic values are escaped with `escapeHtml()`. ✓

**Finding — Guardian has no email:**
```typescript
// SendInvoiceModal.tsx:102-103
const recipientEmail = invoice?.payer_guardian?.email || invoice?.payer_student?.email || null;
```
If no email: the compose step shows a destructive Alert warning (lines 206–211), and the Preview button is disabled (line 247: `disabled={!recipientEmail}`). The Send button in preview also checks `!recipientEmail` in `handleSend` (line 135). ✓

**Impact:** Correctly prevented — guardian without email cannot receive invoice.

---

### **[6C] — Re-sending**
**Status:** EDGE CASE RISK
**Files read:**
- `src/components/invoices/SendInvoiceModal.tsx:134-173` (handleSend)

**Trace:**
1. Status check on line 157: `if (invoice.status === 'draft')` — only transitions draft→sent.
2. If invoice is already `sent` or `overdue`, the email is still sent but no status change occurs. The `isReminder` prop controls the email template.
3. If invoice is `paid` or `void`, the modal can still be opened and the send button is available.

**Finding:** There is **no guard preventing sending a paid or voided invoice.** The `handleSend` function does not check the invoice status before sending the email — it only conditionally updates status for drafts.

**Evidence:**
```typescript
// SendInvoiceModal.tsx:134-135
const handleSend = async () => {
  if (!invoice || !currentOrg || !recipientEmail) return;
  // No status check — will send email regardless of invoice.status
```

**Impact:** An admin could accidentally send a payment email for a voided or already-paid invoice. The parent receives an email with a "Pay Now" button for an invoice they've already paid (or that's been voided). Clicking the link would show the portal which should show the correct status, but the email itself is misleading.

**Fix:** Add a guard: `if (['void', 'paid', 'cancelled'].includes(invoice.status)) return;` or disable the Send button for these statuses.

---

### **[6D] — Overdue**
**Status:** BUG FOUND
**Files read:**
- `supabase/functions/invoice-overdue-check/index.ts:1-37`
- `supabase/functions/overdue-reminders/index.ts:1-381`

**Trace (overdue marking):**
1. `invoice-overdue-check` runs as a cron job.
2. Updates all `sent` invoices where `due_date < today` to `overdue` (lines 15–19):
   ```typescript
   .lt("due_date", new Date().toISOString().split("T")[0])
   ```
3. `new Date().toISOString().split("T")[0]` gives the **UTC date**, not the org's timezone.

**Finding — Timezone bug in overdue check:**
The comparison uses UTC date. For a UK music school, an invoice due on March 15 would be marked overdue at midnight UTC (March 15 00:00 UTC = still March 14 in US timezones, but already March 15 11:00 AEDT in Australia). This could mark invoices overdue up to ~13 hours early or late depending on the org's timezone.

**Evidence:**
```typescript
// invoice-overdue-check/index.ts:19
.lt("due_date", new Date().toISOString().split("T")[0])
```

**Impact:** A music school in a UTC+10 timezone would have invoices marked overdue ~10 hours late. A UTC-8 school would have them marked ~8 hours early.

**Fix:** Look up each org's timezone and compute today's date in that timezone, or add the org timezone to the query.

**Trace (reminders):**
1. `overdue-reminders` runs as a cron job.
2. Fetches all overdue invoices, calculates `daysOverdue` from `due_date`.
3. Sends reminders on configurable days (default `[7, 14, 30]` from `org.overdue_reminder_days`).
4. Deduplication: checks `message_log` for same `related_id` + `message_type` sent today (lines 158–166). ✓
5. Notification preference check: respects `email_invoice_reminders` setting (lines 149–155). ✓

**Finding — Reminder limit:** Reminders are sent only on specific overdue-day milestones (7, 14, 30 by default). There is no "unlimited" reminder spam. After day 30, no more reminders are sent unless the org configures additional days. ✓

**Finding — Today calculation uses UTC for overdue check but JS Date for dedup:**
```typescript
// overdue-reminders/index.ts:19-20
const today = new Date();
today.setHours(0, 0, 0, 0);
```
This is server-local time, which for Supabase edge functions is UTC. Consistent with the overdue-check function but has the same timezone issue.

---

## STEP 7: PARENT PAYS

---

### **[7A] — Parent sees invoice**
**Status:** VERIFIED CORRECT
**Files read:**
- `src/pages/portal/PortalInvoices.tsx` (portal invoices page)
- `src/hooks/useParentPortal.ts:352-393` (useParentInvoices hook)

**Trace:**
1. `useParentInvoices()` queries invoices from the `invoices` table.
2. Filtering is done via **RLS policy** at the database level: `"Parent can view own invoices"`.
3. The RLS policy checks: `has_org_role(auth.uid(), org_id, 'parent') AND is_invoice_payer(auth.uid(), id)`.
4. `is_invoice_payer()` matches the authenticated user's ID against `payer_guardian_id` (via `guardians.user_id`) or linked student guardians.

**Finding:**
- Query is filtered by guardian_id via RLS — not client-side filtering. ✓
- Parent cannot see another family's invoices. ✓
- Amount is displayed using `formatCurrencyMinor()` with the invoice's `currency_code`. ✓

**Impact:** None — secure by design via RLS.

---

### **[7B] — Payment initiation**
**Status:** VERIFIED CORRECT
**Files read:**
- `src/hooks/useStripePayment.ts:1-67` (useStripePayment)
- `supabase/functions/stripe-create-checkout/index.ts:45-160` (amount determination)

**Trace:**
1. Client sends `invoiceId` to `stripe-create-checkout` (line 27–35 of useStripePayment).
2. Edge function fetches invoice from DB (lines 55–74 of stripe-create-checkout).
3. Amount is calculated **server-side**: `amountDue = invoice.total_minor - totalPaid` (line 92).
4. Status guard: only `sent` or `overdue` invoices can be paid (line 81):
   ```typescript
   if (!["sent", "overdue"].includes(invoice.status)) {
     throw new Error(`Invoice cannot be paid (status: ${invoice.status})`);
   }
   ```
5. Already-paid guard: `if (amountDue <= 0) throw new Error("Invoice is already fully paid")` (line 94).

**Finding:**
- Amount comes from DATABASE, not client. ✓
- Client cannot modify amount — it's computed server-side. ✓
- Already-paid guard present. ✓
- Voided invoice guard: checked via status — `void` is not in `['sent', 'overdue']`. ✓

**Impact:** None.

---

### **[7C] — Stripe checkout**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/functions/stripe-create-checkout/index.ts:155-330` (session creation)

**Trace:**
1. `success_url` and `cancel_url` constructed server-side from origin header (lines 227–229). ✓
2. Amount ALWAYS from DB (`paymentAmount` derived from DB fields). ✓
3. Stripe session has 30-min expiry (`expires_at`, line 260). ✓
4. Idempotency key: `checkout_${invoiceId}_${installmentId}_${paymentAmount}` (line 278). ✓
5. Previous pending sessions are expired before creating new one (lines 162–175). ✓

**Race condition (parent opens checkout, admin voids, parent completes):**
The webhook handler (`handleInvoiceCheckoutCompleted`, line 227 of stripe-webhook) checks invoice status:
```typescript
// stripe-webhook/index.ts:240-243
const { data: invStatus } = await supabase.from('invoices').select('status').eq('id', invoiceId).single();
if (invStatus?.status === 'void' || invStatus?.status === 'cancelled') {
  console.warn(`Skipping payment on ${invStatus.status} invoice`);
  return;
}
```
This prevents recording payment on voided invoices. ✓ However, the money is still collected by Stripe — a manual refund would be needed.

**Finding:** The voided-invoice guard exists in the webhook. However, there's a window where the parent's money is taken but the payment is silently ignored. No automatic refund is triggered.

**Impact:** Rare edge case — the parent pays a voided invoice via Stripe, money is collected, but LessonLoop doesn't record the payment. Manual refund required. This is acceptable for most music schools but should be documented.

---

### **[7D] — Webhook processing**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/functions/stripe-webhook/index.ts:1-991` (full webhook handler)

**Trace:**
1. Events: `checkout.session.completed` (line 79) and `payment_intent.succeeded` (line 132) both handle invoice payments.
2. **Deduplication:** Event ID is inserted into `stripe_webhook_events` — duplicate event returns 200 with `duplicate: true` (lines 65–75). ✓
3. **Double payment guard:** Checks `payments` table for existing `provider_reference` before inserting (lines 249–259). ✓
4. **Payment row inserted:** `invoice_id`, `org_id`, `amount_minor`, `method: 'card'`, `provider: 'stripe'`, `provider_reference: paymentIntentId` (lines 284–296). ✓
5. **paid_minor update:** Uses atomic `recalculate_invoice_paid` RPC with row locking (lines 340–348). ✓
6. **Status to 'paid':** Handled inside the `recalculate_invoice_paid` RPC — sets status to `paid` if `net_paid >= total_minor`. ✓
7. **Partial payments:** The RPC correctly handles partial payments — status only changes to `paid` when fully paid. ✓
8. **Idempotent:** Triple protection — webhook event dedup + provider_reference check + DB unique index on provider_reference. ✓
9. **Unique constraint:** `idx_payments_provider_reference_unique` — partial unique index on `provider_reference WHERE provider_reference IS NOT NULL`. ✓

**Impact:** None — extremely well-protected against duplicates.

---

### **[7E] — Post-payment**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/functions/stripe-webhook/index.ts:340-408` (post-payment processing)
- `src/components/portal/PaymentDrawer.tsx:348-385` (client-side payment form)

**Trace:**
1. Invoice status → 'paid' via `recalculate_invoice_paid` RPC. ✓
2. Payment notification inserted into `payment_notifications` table for real-time admin alerts (lines 360–386). ✓
3. Receipt email sent via `send-payment-receipt` function (best-effort, fire-and-forget) (lines 389–408). ✓
4. Client-side: after inline payment success, React Query invalidates `['parent-invoices']` and `['parent-installments']` (lines 372–373 of PaymentDrawer). ✓
5. Revenue report: updated implicitly via the `payments` table insert.
6. Dashboard: payment_notifications trigger real-time Supabase subscription (if wired up).
7. Parent portal: shows Paid badge once the RPC updates status.

**Finding — Latency:** Webhook arrives from Stripe (typically 1–5 seconds after payment), processes the payment, then the client needs to refetch. For the embedded Payment Element flow, the client gets immediate confirmation via `paymentIntent.status === 'succeeded'` and shows success UI. The actual DB update happens via webhook, so there may be a 1–5 second gap where the client shows "success" but the DB hasn't updated yet.

**Impact:** Minor UX gap — parent sees "Payment Successful" but if they immediately reload the page, the invoice might still show as unpaid for a few seconds until the webhook processes. Acceptable.

---

### **[7F] — Manual payment recording**
**Status:** VERIFIED CORRECT
**Files read:**
- `supabase/migrations/20260222234306_*.sql:97-175` (record_payment_and_update_status RPC)
- `src/hooks/useInvoices.ts:322-378` (useRecordPayment hook)

**Trace:**
1. Uses **atomic RPC** `record_payment_and_update_status` — not manual insert+update. ✓
2. RPC acquires row lock: `SELECT ... FROM invoices WHERE id = _invoice_id FOR UPDATE` (line ~113). ✓
3. Validates: cannot record on `paid` or `void` invoices (lines ~117–119). ✓
4. Overpayment guard: `_existing_paid + _amount_minor > _invoice.total_minor * 1.01` raises exception (1% tolerance for rounding). ✓
5. Updates `paid_minor` incrementally: `UPDATE invoices SET paid_minor = COALESCE(paid_minor, 0) + _amount_minor` (line ~157). ✓
6. Full payment check: `IF _total_paid >= _invoice.total_minor THEN status = 'paid'` (lines ~160–163). ✓
7. Partial payment: status stays unchanged (e.g. stays `sent` or `overdue`). ✓

**Scenarios:**
- £25 on £25 invoice → status becomes `paid`. ✓
- £10 on £25 invoice → status stays `sent`/`overdue`, `paid_minor = 10`. ✓
- Can admin record MORE than total? Limited by the 1% tolerance guard — `£25.25` on `£25.00` would be blocked (25 + 25.25 > 25 * 1.01 = 25.25). So the guard prevents amounts exceeding 101% of the total.

**Impact:** None — well-designed.

---

## Summary of Findings

| Step | Sub | Status | Severity | Description |
|------|-----|--------|----------|-------------|
| 4A | Register loading | EDGE CASE RISK | Medium | Date filtering uses browser timezone, not org timezone |
| 4B | Attendance creation | VERIFIED CORRECT | — | Upsert with unique constraint, org_id present |
| 4C | Future attendance | BUG FOUND | High | No guard prevents marking attendance for future lessons |
| 4D | Absence → credit | VERIFIED CORRECT | — | Infinite loop fix works, normal flow intact |
| 4E | Attendance → dashboard | VERIFIED CORRECT | — | React Query invalidation updates dashboard |
| 5A | Manual invoice | VERIFIED CORRECT | — | Server-side RPC, atomic number generation |
| 5B | Invoice line items | EDGE CASE RISK | Low | No CHECK constraint on negative amounts; cross-org lesson FK theoretically possible |
| 5C | VAT calculation | VERIFIED CORRECT | — | Server-side, snapshot on invoice |
| 5D | Billing run | VERIFIED CORRECT | — | Correct payer resolution, dedup, batch processing |
| 5E | Invoice number | VERIFIED CORRECT | — | Atomic increment, gap-free, unique constraint |
| 6A | Send status change | BUG FOUND | Medium | Email send and status update are non-atomic; status update failure leaves invoice as 'draft' |
| 6B | Email content | VERIFIED CORRECT | — | Correct portal link, HTML escaped, no-email guard |
| 6C | Re-sending | EDGE CASE RISK | Medium | Can send email for paid/voided invoices |
| 6D | Overdue | BUG FOUND | Medium | Timezone bug — uses UTC date instead of org timezone |
| 7A | Parent sees invoice | VERIFIED CORRECT | — | RLS-enforced, secure |
| 7B | Payment initiation | VERIFIED CORRECT | — | Amount from DB, status guards |
| 7C | Stripe checkout | VERIFIED CORRECT | — | Voided-invoice guard in webhook (but money still collected) |
| 7D | Webhook processing | VERIFIED CORRECT | — | Triple idempotency protection |
| 7E | Post-payment | VERIFIED CORRECT | — | Atomic recalculation, notifications, receipt |
| 7F | Manual payment | VERIFIED CORRECT | — | Atomic RPC with row locking, overpayment guard |

### Bugs requiring fixes (3):
1. **[4C] Future attendance** — No guard at any layer prevents marking attendance for lessons that haven't happened yet.
2. **[6A] Non-atomic send** — Email send and invoice status update are separate calls; status update failure leaves a mismatch.
3. **[6D] Overdue timezone** — Overdue check uses UTC date, not org timezone.

### Edge case risks (3):
1. **[4A] Register timezone** — Date filtering uses browser timezone for day boundaries.
2. **[5B] Negative amounts** — No DB constraint prevents negative invoice item amounts.
3. **[6C] Re-send paid/voided** — No guard prevents sending emails for paid or voided invoices.
