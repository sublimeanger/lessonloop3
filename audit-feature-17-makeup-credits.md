# Audit Report — Feature 17: Make-Up Credits

**Date:** 2026-03-16
**Auditor:** Claude (automated)
**Prior rating:** NEEDS-WORK (was NOT-READY)
**Scope:** Credit issuance, lifecycle, consumption, loop prevention, double-dip, partial credits, expiry, void, max-per-term, value fallback, waitlist link, audit log

---

## 1. Files Audited (Full List)

### Database Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260124020340_d8ce35e7-…sql` | Initial `make_up_credits` table, RLS, indexes |
| `supabase/migrations/20260222163838_b9bea7f7-…sql` | `absence_reason` enum, `make_up_policies` table, seed function |
| `supabase/migrations/20260222164345_e13bad2c-…sql` | `make_up_waitlist` table, RLS, org expiry setting |
| `supabase/migrations/20260222164414_1c942406-…sql` | `auto_add_to_waitlist()` trigger |
| `supabase/migrations/20260222164435_6c8244d2-…sql` | `auto_issue_credit_on_absence()` initial trigger |
| `supabase/migrations/20260222171214_326f3bde-…sql` | `releases_slot` column, `on_slot_released()` trigger |
| `supabase/migrations/20260222212357_c67ff3cd-…sql` | `applied_to_invoice_id` column, `void_invoice()` RPC |
| `supabase/migrations/20260222233455_21a7fc26-…sql` | (redeem_make_up_credit reference) |
| `supabase/migrations/20260222234306_2e42b72c-…sql` | (redeem_make_up_credit reference) |
| `supabase/migrations/20260223004118_531ed3d7-…sql` | `expired_at` column, `redeem_make_up_credit()` RPC, `create_invoice_with_items()` update |
| `supabase/migrations/20260223004318_a34091f6-…sql` | Unique index `idx_make_up_credits_unique_per_lesson`, `chk_credit_value_positive` CHECK |
| `supabase/migrations/20260223004458_787e661b-…sql` | Trigger evolution (skip zero-value, use `make_up_waitlist_expiry_weeks`) |
| `supabase/migrations/20260223004543_011c49d5-…sql` | Trigger evolution (use `credit_expiry_days` notes fix) |
| `supabase/migrations/20260223004626_6a886441-…sql` | `max_credits_per_term`, `credit_expiry_days` org settings, cap enforcement |
| `supabase/migrations/20260223004743_948e5486-…sql` | `on_makeup_participant_removed()` — restore credit on participant removal |
| `supabase/migrations/20260223004826_709f19da-…sql` | Timezone-aware expiry, `auto_add_to_waitlist()` update |
| `supabase/migrations/20260223005049_3b1eb491-…sql` | `available_credits` VIEW with `credit_status` |
| `supabase/migrations/20260223005321_2ad8748b-…sql` | `auto_add_to_waitlist()` — link `credit_id` on insert |
| `supabase/migrations/20260227100000_term_adjustments.sql` | Term adjustments (credit note support) |
| `supabase/migrations/20260303190000_account_delete_fk_set_null.sql` | FK cascade adjustments |
| **Handoff fix migrations:** | |
| `supabase/migrations/20260315200000_fix_infinite_credit_loop_makeup_absence.sql` | FIX 1: Infinite loop prevention |
| `supabase/migrations/20260315200100_fix_redeem_credit_on_makeup_booking.sql` | FIX 2: `confirm_makeup_booking()` RPC |
| `supabase/migrations/20260315200300_fix_dismiss_other_matched_waitlist.sql` | FIX 5: Dismiss stale matched entries |
| `supabase/migrations/20260315200700_fix_parent_credit_policy_scope.sql` | FIX 5D.2: Parent RLS scoped to children |
| `supabase/migrations/20260315200800_fix_credit_invoice_fk_named.sql` | FIX 5A.1: Named FK for `applied_to_invoice_id` |
| `supabase/migrations/20260315210001_fix_max_credits_per_term.sql` | FIX 7A.1: Per-policy cap, `voided_at` column, count only active |
| `supabase/migrations/20260315210003_fix_credit_waitlist_link.sql` | FIX 8A.3: Link credit → waitlist after issuance |
| `supabase/migrations/20260315210005_fix_parent_respond_atomic.sql` | FIX 8C.4: `respond_to_makeup_offer()` atomic RPC |
| `supabase/migrations/20260315210006_fix_credit_value_fallback.sql` | FIX 6A.3: Fallback chain (invoice → rate card → org default) |
| `supabase/migrations/20260315220002_void_invoice_clear_billing_markers.sql` | Void invoice clears billing markers, restores credits |
| `supabase/migrations/20260315220007_fix_invoice_items_check_credit_notes.sql` | Credit note negative amounts |
| `supabase/migrations/20260316240000_fix_refund_audit_findings.sql` | Refund audit fixes |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/credit-expiry/index.ts` | Daily cron — marks expired credits |
| `supabase/functions/credit-expiry-warning/index.ts` | Daily cron — emails guardians 3 days before expiry |
| `supabase/functions/notify-makeup-offer/index.ts` | Email parent when make-up offer is sent |
| `supabase/functions/notify-makeup-match/index.ts` | Notify on waitlist match |

### Frontend — Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useMakeUpCredits.ts` | Credit CRUD, redemption, eligibility check |
| `src/hooks/useParentCredits.ts` | Parent portal: available credits for children |
| `src/hooks/useAvailableCredits.ts` | Available credits for payer (guardian/student) |
| `src/hooks/useMakeUpWaitlist.ts` | Waitlist CRUD, confirm, dismiss, offer, stats |
| `src/hooks/useMakeUpPolicies.ts` | Policies CRUD, seed defaults |

### Frontend — Components
| File | Purpose |
|------|---------|
| `src/components/students/MakeUpCreditsPanel.tsx` | Credit list, issue, delete UI |
| `src/components/students/IssueCreditModal.tsx` | Issue credit modal |
| `src/components/students/CreditBalanceBadge.tsx` | Badge showing balance |
| `src/components/makeups/AddToWaitlistDialog.tsx` | Add student to waitlist |
| `src/components/makeups/NeedsActionSection.tsx` | Action items including credits |
| `src/components/makeups/WaitlistTable.tsx` | Waitlist management table |
| `src/components/invoices/CreateInvoiceModal.tsx` | Apply credits to invoices |

### Tests
| File | Purpose |
|------|---------|
| `src/test/billing/MakeUpCredits.test.ts` | Unit tests for credit lifecycle, expiry, eligibility |
| `tests/e2e/makeup-dashboard.spec.ts` | E2E makeup dashboard |
| `tests/e2e/waitlist-makeups-continuation.spec.ts` | E2E waitlist flows |

### Types
| File | Purpose |
|------|---------|
| `src/integrations/supabase/types.ts` | Auto-generated DB types (lines 2683–2778) |

---

## 2. Schema: `make_up_credits` Table

| Column | Type | Nullable | Default | FK / Constraint |
|--------|------|----------|---------|-----------------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `org_id` | `uuid` | NOT NULL | — | FK → `organisations(id)` ON DELETE CASCADE |
| `student_id` | `uuid` | NOT NULL | — | FK → `students(id)` ON DELETE CASCADE |
| `issued_for_lesson_id` | `uuid` | NULL | — | FK → `lessons(id)` ON DELETE SET NULL |
| `issued_at` | `timestamptz` | NOT NULL | `now()` | — |
| `expires_at` | `timestamptz` | NULL | — | — |
| `expired_at` | `timestamptz` | NULL | — | Set by cron or trigger when expired |
| `redeemed_at` | `timestamptz` | NULL | — | Set when credit is used |
| `redeemed_lesson_id` | `uuid` | NULL | — | FK → `lessons(id)` ON DELETE SET NULL |
| `applied_to_invoice_id` | `uuid` | NULL | — | FK → `invoices(id)` ON DELETE SET NULL (named: `fk_credit_invoice`) |
| `credit_value_minor` | `integer` | NOT NULL | `0` | CHECK: `credit_value_minor > 0` |
| `voided_at` | `timestamptz` | NULL | NULL | Added by handoff fix; **no RPC to set it** |
| `notes` | `text` | NULL | — | — |
| `created_by` | `uuid` | NULL | — | FK → `auth.users(id)` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Auto-updated via trigger |

### Key Indexes
- `idx_make_up_credits_org_student(org_id, student_id)`
- `idx_make_up_credits_student_available(student_id) WHERE redeemed_at IS NULL`
- `idx_make_up_credits_unique_per_lesson(student_id, issued_for_lesson_id) WHERE issued_for_lesson_id IS NOT NULL` — **UNIQUE** (prevents duplicate credits per lesson)
- `idx_make_up_credits_applied_invoice(applied_to_invoice_id) WHERE applied_to_invoice_id IS NOT NULL`

### `available_credits` VIEW
```sql
SELECT *, CASE
  WHEN redeemed_at IS NOT NULL THEN 'redeemed'
  WHEN expired_at IS NOT NULL THEN 'expired'
  WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
  ELSE 'available'
END AS credit_status
FROM public.make_up_credits;
```
Uses `security_invoker = on`.

---

## 3. Credit Lifecycle Diagram

```
                   ┌────────────────────────────────┐
                   │ TRIGGER: auto_issue_credit_on_  │
                   │ absence() fires on attendance   │
                   │ record INSERT/UPDATE            │
                   └──────────┬─────────────────────┘
                              │
                              ▼
              ┌──────────── ISSUED ────────────┐
              │  (issued_at = NOW())           │
              │  Credit linked to waitlist     │
              │  entry if one exists           │
              └──┬──────┬─────────┬────────┬──┘
                 │      │         │        │
          REDEEM │  APPLY TO  │  EXPIRE │  VOID
         (booking)│  INVOICE  │  (cron) │  (manual)
                 │      │         │        │
                 ▼      ▼         ▼        ▼
            ┌────────┐ ┌──────┐ ┌───────┐ ┌───────┐
            │REDEEMED│ │APPLIED│ │EXPIRED│ │VOIDED │
            │(via    │ │(via   │ │expired│ │voided │
            │confirm_│ │create_│ │_at set│ │_at set│
            │makeup_ │ │invoice│ │by cron│ │(NO RPC│
            │booking)│ │_with_ │ │      │ │EXISTS)│
            │        │ │items) │ │      │ │       │
            └────────┘ └──────┘ └───────┘ └───────┘
                           │
              VOID INVOICE │
                           ▼
                     ┌──────────┐
                     │ RESTORED │
                     │(redeemed │
                     │_at=NULL, │
                     │applied=  │
                     │NULL)     │
                     └──────────┘
```

**Transitions:**
- **Issued → Redeemed**: `confirm_makeup_booking()` auto-redeems oldest available credit via FOR UPDATE SKIP LOCKED
- **Issued → Applied**: `create_invoice_with_items()` with `_credit_ids` locks and marks credits
- **Issued → Expired**: `credit-expiry` cron sets `expired_at` where `expires_at < NOW()`
- **Issued → Voided**: `voided_at` column exists but **no RPC or UI mechanism sets it**
- **Applied → Restored**: `void_invoice()` clears `redeemed_at` and `applied_to_invoice_id`
- **Redeemed (booking) → Restored**: `on_makeup_participant_removed()` restores credit when participant deleted

---

## 4. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| CRD-C1 | **CRITICAL** | `available_credits` VIEW does not check `voided_at`. Voided credits appear as "available" and can be redeemed or applied to invoices. | `20260223005049_…sql` | Add `WHEN voided_at IS NOT NULL THEN 'voided'` to the CASE expression, before the `ELSE 'available'` branch. |
| CRD-C2 | **CRITICAL** | `confirm_makeup_booking()` does not filter out `voided_at IS NOT NULL` when selecting credit to redeem. A voided credit can be redeemed during booking. | `20260315200300_…sql` (line 91–95) | Add `AND voided_at IS NULL` to the sub-SELECT in step 7. |
| CRD-C3 | **CRITICAL** | `redeem_make_up_credit()` RPC does not check `voided_at`. A voided credit can be manually redeemed by staff. | `20260223004118_…sql` (line 23–25) | Add `IF _credit.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Credit has been voided'; END IF;` |
| CRD-C4 | **CRITICAL** | No `void_credit` RPC or UI mechanism exists. `voided_at` column was added but is **dead** — there is no way to set it. The UI still uses hard DELETE for credit removal, which destroys the audit trail. | `MakeUpCreditsPanel.tsx` (line 168–174), `useMakeUpCredits.ts` (line 167–186) | Create `void_make_up_credit(_credit_id, _org_id)` RPC that sets `voided_at = NOW()` and logs to `audit_log`. Replace DELETE button with Void action in UI. |
| CRD-H1 | **HIGH** | Credit-expiry cron does not check `voided_at`. Voided credits that haven't expired yet will be marked `expired_at` by the cron, overwriting the void semantics. | `supabase/functions/credit-expiry/index.ts` (line 28–31) | Add `.is("voided_at", null)` to the update query filters. |
| CRD-H2 | **HIGH** | Credit-expiry cron does NOT exclude credits linked to active waitlist entries. A credit tied to a `waiting`/`matched`/`offered`/`accepted` waitlist entry will be expired, stranding the waitlist entry. | `supabase/functions/credit-expiry/index.ts` | Before the update, add a NOT IN subquery or left-join filter: exclude credit IDs that appear in `make_up_waitlist.credit_id` where waitlist status is active. Or handle at DB level with a partial index / trigger. |
| CRD-H3 | **HIGH** | `create_invoice_with_items()` does not check `voided_at` when locking credits for invoice application. A voided credit can be applied to an invoice. | `20260223004118_…sql` (line 91–98) | Add `AND voided_at IS NULL` to the FOR UPDATE query in the credit locking section. |
| CRD-H4 | **HIGH** | `useMakeUpCredits.ts` client-side `availableCredits` filter does not check `voided_at`. Voided credits appear as available in the admin UI. | `src/hooks/useMakeUpCredits.ts` (line 86–91) | Add `&& !c.voided_at` (once `voided_at` is in the TypeScript type — it's currently missing from the generated types since it's not in the types file yet). |
| CRD-M1 | **MEDIUM** | No partial credit / remainder credit support. When a credit value exceeds the make-up lesson cost, the full credit is consumed with no remainder issued. The handoff mentions this as a fix but it is **not implemented**. | `confirm_makeup_booking()`, `create_invoice_with_items()` | Implement: when credit_value_minor > lesson cost, create a new remainder credit for the difference. Or document that partial consumption is intentional business logic (credits are consumed whole). |
| CRD-M2 | **MEDIUM** | `voided_at` column is missing from `src/integrations/supabase/types.ts`. The auto-generated types don't include it, meaning TypeScript code cannot reference `voided_at` without casting. | `src/integrations/supabase/types.ts` (line 2684–2700) | Regenerate Supabase types with `supabase gen types typescript`. |
| CRD-M3 | **MEDIUM** | `MakeUpCreditsPanel` `getCreditStatus()` does not handle `voided_at`. Even if voided, credits show as "Available", "Redeemed", or "Expired" — never "Voided". | `src/components/students/MakeUpCreditsPanel.tsx` (line 30–41) | Add a `voided_at` check that returns `{ label: 'Voided', variant: 'destructive' }`. |
| CRD-M4 | **MEDIUM** | Credit-expiry-warning cron does not check `voided_at`. Will send expiry warnings for voided credits. | `supabase/functions/credit-expiry-warning/index.ts` (line 37–41) | Add `.is("voided_at", null)` filter to the query. |
| CRD-M5 | **MEDIUM** | `max_credits_per_term` uses `date_trunc('quarter', CURRENT_DATE)` as term boundary. This is a calendar quarter, not an academic term. If the org uses academic terms (Sep–Dec, Jan–Mar, Apr–Jul), the cap won't align. | `20260315210006_…sql` (line 86) | Consider using the `terms` table to resolve actual term boundaries if available, or document that "term" means calendar quarter. |
| CRD-L1 | **LOW** | Unit tests (`MakeUpCredits.test.ts`) test pure JS filter functions only. They don't test `voided_at`, `applied_to_invoice_id`, or the DB-level RPC logic. No integration tests for `confirm_makeup_booking`, `redeem_make_up_credit`, or the expiry cron. | `src/test/billing/MakeUpCredits.test.ts` | Add integration tests (or at minimum, update the mock to include `voided_at` and `applied_to_invoice_id` filtering). |
| CRD-L2 | **LOW** | `auto_issue_credit_on_absence()` audit log on credit issuance only happens in the client-side `createCredit` mutation (fire-and-forget `.then(() => {})`). The DB trigger does NOT log issuance to `audit_log`. If a credit is auto-issued by the trigger, there's no issuance audit entry (only cap-reached and skip-makeup entries are logged). | `useMakeUpCredits.ts` (line 117–131), `20260315210006_…sql` | Add an `INSERT INTO audit_log` after the credit INSERT in `auto_issue_credit_on_absence()` for `credit_issued` action. |
| CRD-L3 | **LOW** | The client-side audit log insert in `createCredit` is fire-and-forget (`.then(() => {})`). If it fails, no error is logged or retried. | `src/hooks/useMakeUpCredits.ts` (line 117–131) | At minimum, add `.catch(console.error)`. Ideally, move audit logging to a DB trigger on `make_up_credits` INSERT. |
| CRD-L4 | **LOW** | `on_makeup_participant_removed()` restores credit by checking `_waitlist.credit_id`, but `confirm_makeup_booking()` redeems the oldest available credit by age — NOT the one linked to the waitlist entry (`_entry.credit_id`). This means the restored credit may differ from the one originally redeemed if multiple credits existed. | `20260223004743_…sql`, `20260315200300_…sql` | In `confirm_makeup_booking()`, prefer redeeming `_entry.credit_id` (the waitlist-linked credit) if it's still available, falling back to oldest if not. |

---

## 5. Handoff Fix Verification Checklist

| Fix | Description | Status | Notes |
|-----|-------------|--------|-------|
| FIX 1: Infinite credit loop | Check `make_up_waitlist.booked_lesson_id` before issuing credit | **VERIFIED** | `auto_issue_credit_on_absence()` checks `_is_makeup_lesson` via `make_up_waitlist WHERE booked_lesson_id = NEW.lesson_id AND status = 'booked'`. Audit log entry on skip. |
| FIX 2: Redeem credit on booking | `confirm_makeup_booking()` redeems oldest available credit | **VERIFIED** | Uses `FOR UPDATE SKIP LOCKED` on oldest unredeemed/unexpired credit. Returns `redeemed_credit_id`. |
| FIX 3: Credit-waitlist link | Link credit to waitlist entry after issuance | **VERIFIED** | `auto_issue_credit_on_absence()` updates `make_up_waitlist SET credit_id = _new_credit_id` for matching student+lesson. `auto_add_to_waitlist()` also links on insert. |
| FIX 5: Dismiss other matches | Reset stale matched waitlist entries after booking | **VERIFIED** | `confirm_makeup_booking()` step 9 resets other `matched` entries for same lesson to `unmatched`. |
| FIX 5A.1: Named FK | `applied_to_invoice_id` FK renamed to `fk_credit_invoice` | **VERIFIED** | Migration drops auto-named constraint and adds named one. |
| FIX 5D.2: Parent credit RLS | Parents only see own children's credits | **VERIFIED** | Policy `"Parents see own children credits"` uses `student_id IN (SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid())`. |
| FIX 6A.3: Credit value fallback | Invoice item → student rate card → org default rate card | **VERIFIED** | Three-step fallback chain in `auto_issue_credit_on_absence()`. Rate cards use `rate_amount * 100` for minor unit conversion. |
| FIX 7A.1: Max credits per term | Per-policy cap → org cap; count only active credits | **VERIFIED** | `_max_cap := COALESCE(_policy.max_credits_per_term, _org.max_credits_per_term)`. Count excludes redeemed/expired/voided. |
| FIX 7A.1: voided_at column | Add `voided_at` to `make_up_credits` | **PARTIALLY BROKEN** | Column added. But: no RPC to set it, not checked in `available_credits` view, not checked in `redeem_make_up_credit`, not checked in `confirm_makeup_booking` credit selection, not checked in expiry cron. Column is essentially dead. See CRD-C1 through CRD-C4. |
| FIX 8C.4: Atomic parent respond | `respond_to_makeup_offer()` RPC | **VERIFIED** | Locks waitlist row with FOR UPDATE, validates guardian ownership and `offered` status, atomically transitions to `accepted` or back to `waiting`. |
| Credits on waitlist don't expire | Cron should skip credits linked to active waitlist | **BROKEN** | Cron does NOT check for active waitlist linkage. See CRD-H2. |
| Double-dip prevention | FOR UPDATE SKIP LOCKED | **VERIFIED** | Present in `confirm_makeup_booking()`. Also: unique index prevents duplicate issuance, `redeem_make_up_credit()` uses FOR UPDATE, `create_invoice_with_items()` uses FOR UPDATE on credits. |
| Partial credit / remainder | Remainder credit on partial consumption | **MISSING** | Not implemented anywhere. See CRD-M1. |
| Audit log on credit issuance | Log to `audit_log` when credit issued | **PARTIAL** | Only logged in client-side `createCredit` (fire-and-forget). Auto-issued credits from DB trigger have NO audit log entry for issuance. See CRD-L2. |

---

## 6. RLS Policy Matrix — `make_up_credits`

| Policy Name | Operation | Condition | Roles |
|-------------|-----------|-----------|-------|
| `"Users can view make_up_credits in their org"` | SELECT | `org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND status = 'active')` | All org members (owner, admin, teacher, finance) |
| `"Parents see own children credits"` | SELECT | `student_id IN (SELECT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id WHERE g.user_id = auth.uid())` | Parents (guardians) |
| `"Admins can insert make_up_credits in their org"` | INSERT | `org_id IN (… WHERE role IN ('owner', 'admin', 'teacher'))` | Owner, Admin, Teacher |
| `"Admins can update make_up_credits in their org"` | UPDATE | `org_id IN (… WHERE role IN ('owner', 'admin'))` | Owner, Admin |
| `"Admins can delete make_up_credits in their org"` | DELETE | `org_id IN (… WHERE role IN ('owner', 'admin'))` | Owner, Admin |

### `available_credits` VIEW
- Uses `security_invoker = on` — inherits calling user's RLS from base `make_up_credits` table.

### `make_up_waitlist` RLS
| Policy | Operation | Condition |
|--------|-----------|-----------|
| `"Org members can view waitlist"` | SELECT | Org membership |
| `"Org admins can manage waitlist"` | ALL | `is_org_admin()` |
| `"Parents can view their children waitlist"` | SELECT | `guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())` |

### Cross-org isolation
- All tables use `org_id` in RLS USING clauses joined to `org_memberships`.
- `SECURITY DEFINER` functions set `search_path TO 'public'` and validate org membership via `is_org_staff()` / `is_org_finance_team()` / `is_org_admin()`.
- No cross-org access vectors identified.

### Noted RLS gap
- Teachers can INSERT credits (via the insert policy). Whether this is intentional depends on business requirements — the handoff doesn't specify. Teachers can also view all credits in their org, which is reasonable for a music school context.

---

## 7. Verdict

### **NOT READY** for production

**Rationale:** The `voided_at` column was added as a handoff fix but is a dead column — no RPC, no UI, and critically, it's not checked in the `available_credits` view, the `redeem_make_up_credit` RPC, the `confirm_makeup_booking` RPC, or the expiry cron. This means:

1. If an admin somehow sets `voided_at` directly in the DB, the credit still appears as "available" and can be redeemed or applied to invoices (CRD-C1, CRD-C2, CRD-C3).
2. There is no way to void a credit through the application — the UI uses hard DELETE which destroys the audit trail (CRD-C4).
3. Credits linked to active waitlist entries will be expired by the cron, breaking the waitlist flow (CRD-H2).

### Blocking issues (must fix before production):
- **CRD-C1**: Update `available_credits` view to check `voided_at`
- **CRD-C2**: Update `confirm_makeup_booking()` to check `voided_at`
- **CRD-C3**: Update `redeem_make_up_credit()` to check `voided_at`
- **CRD-C4**: Create `void_make_up_credit()` RPC and replace DELETE with Void in UI
- **CRD-H1**: Update credit-expiry cron to skip voided credits
- **CRD-H2**: Update credit-expiry cron to skip credits on active waitlist

### Should fix before production:
- **CRD-H3**: Update `create_invoice_with_items()` to check `voided_at`
- **CRD-H4**: Update client-side available filter to check `voided_at`
- **CRD-L2**: Add DB-level audit log for auto-issued credits

### Can defer:
- CRD-M1 (partial credits — document as intentional if not needed)
- CRD-M2 (regenerate types)
- CRD-M5 (term boundary definition)
- CRD-L1 (test coverage)
- CRD-L3 (fire-and-forget audit)
- CRD-L4 (credit-waitlist mismatch on restore)
