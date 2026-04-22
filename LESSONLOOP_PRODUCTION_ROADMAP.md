# LessonLoop Production Roadmap

**Goal:** Take LessonLoop from current state to genuinely production-ready across every feature surface. No compromises, no lighter-touch options. Every flow walked end-to-end, every bug fixed, every cohesion gap closed, every invariant verified.

**Started:** 21 April 2026  
**Current customers:** 0 (target: aggressive customer acquisition begins once all areas close)  
**Estimated duration:** 14-18 weeks at current pace. This is a larger scope than originally scoped — see Scale section below.  
**Methodology:** Per-area inventory → per-journey deep-dive walk → numbered findings → product decisions → committed fixes with hashes → filed items for later passes → update roadmap status.

---

## 🚦 Resuming this work

If you are a Claude session inheriting this work, or Jamie is picking up after a break, do these in order:

1. **Read this file end-to-end.** It tells you which area and journey is in flight, what's closed, what's filed.
2. **Read `POLISH_NOTES.md`** — captures the play-by-play of every commit, every finding, every decision rationale, and every filed item with full context.
3. **Run `git log --oneline -30`** — see recent commits that got us here.
4. **Use `conversation_search`** for "LessonLoop journey" or specific area/journey references — recovers conversation-level decision context that may not have made it into files.
5. **Confirm with Jamie** which area/journey to resume before starting work.

**Working principles — Jamie's defaults (memory-stored):**
- Do everything properly. Fix everything. No compromises. No lighter-touch options.
- When asked to scope, default answer is "everything."
- Always design the proper solution first; never propose lighter-touch alternatives.
- Direct-to-main commits (no feature branches).
- Always provide ready-to-paste Lovable prompts for edge function deploys / verification.
- Same Claude Code window throughout an area.
- Verify state first (`git log -1 --oneline`), end with `git push`.
- Never suggest breaks, sleep, pacing, or "another day."

**Standard workflow per journey:**
1. Inventory files involved (Lovable or Claude Code pastes relevant files verbatim)
2. Walk end-to-end, surface numbered findings (Jn-F1, Jn-F2, …)
3. Triage: real bugs, cohesion gaps, product decisions, filed-for-later
4. Call out product decisions with recommended answer (Jamie says "everything")
5. Write commits with full edit specifications
6. Deploy via Lovable (edge functions / migrations) where relevant
7. Update POLISH_NOTES.md (Fixed / Filed) + this file (mark journey closed)

**Workflow stack:**
- **Claude (this assistant)** — planning, finding analysis, edit specifications, decision framing
- **Claude Code web** — repo file edits, typecheck, commits, pushes
- **Lovable** — Supabase migrations apply, edge function deploys, live RPC verification
- **GitHub web** — tag creation, branch protection workarounds

---

## 📊 Scale

Based on 21 April 2026 repo discovery:

| Dimension | Count |
|---|---|
| Pages (staff + parent + marketing + reports + public) | 60+ |
| Component directories | 33 |
| Hooks (files) | 115 |
| Hook exports | 276 |
| Edge functions | 91 |
| Database RPCs | 112 |
| Tables (public schema) | 82 |
| Enums (state machines) | 25 |
| Triggers | 80+ |
| RLS policies | 518 |
| Migrations | 326 |
| Vitest suites | 26 |
| Playwright e2e suites | 13 |
| Settings tabs | 23 |

This is substantially larger than typical SaaS polish scope. The roadmap below is honest about that.

---

## 📋 Overall progress

| # | Area | Status | Journeys closed | Commits |
|---|---|---|---|---|
| 0 | Cross-cutting invariants | ⚪ | 0 of 4 tracks | 0 |
| 1 | Billing & invoicing | 🟡 | 6 of 11 | 35 |
| 2 | Parent portal | ⚪ | 0 of 8 | 0 |
| 3 | Students & guardians | ⚪ | 0 of 6 | 0 |
| 4 | Calendar | ⚪ | 0 of 9 | 0 |
| 5 | Lessons & attendance | ⚪ | 0 of 8 | 0 |
| 6 | Terms & closures | ⚪ | 0 of 4 | 0 |
| 7 | Term continuation | ⚪ | 0 of 3 | 0 |
| 8 | Teachers & payroll | ⚪ | 0 of 5 | 0 |
| 9 | Make-up credits & waitlists | ⚪ | 0 of 5 | 0 |
| 10 | Messaging | ⚪ | 0 of 6 | 0 |
| 11 | Practice tracking | ⚪ | 0 of 3 | 0 |
| 12 | Notes | ⚪ | 0 of 3 | 0 |
| 13 | Resources | ⚪ | 0 of 3 | 0 |
| 14 | Leads, CRM & booking page | ⚪ | 0 of 5 | 0 |
| 15 | LoopAssist (AI assistant) | ⚪ | 0 of 4 | 0 |
| 16 | Reports & analytics | ⚪ | 0 of 4 | 0 |
| 17 | Xero integration | ⚪ | 0 of 5 | 0 |
| 18 | Stripe integration | ⚪ | 0 of 8 | 0 |
| 19 | Calendar integrations (Google / Outlook / iCal / Zoom) | ⚪ | 0 of 5 | 0 |
| 20 | Subscription, trial & plan gating | ⚪ | 0 of 5 | 0 |
| 21 | Onboarding | ⚪ | 0 of 4 | 0 |
| 22 | Settings (23 tabs) | ⚪ | 0 of 23 | 0 |
| 23 | Admin, GDPR & data lifecycle | ⚪ | 0 of 5 | 0 |
| 24 | Auth | ⚪ | 0 of 5 | 0 |
| 25 | Deliverability | ⚪ | 0 of 3 | 0 |
| 26 | iOS app (Capacitor) | ⚪ | 0 of 5 | 0 |
| 27 | Marketing site | ⚪ | 0 of 4 | 0 |

**Status legend:** ⚪ Not started · 🟡 In progress · 🟢 Closed · 🔴 Blocked · 🟠 Has known production blocker

**Total scoped journeys across all areas:** ~168 (Journey 11 added during J4 walk).

---

## Area 0 — Cross-cutting invariants ⚪

These are system-wide concerns that touch multiple areas. They run in parallel with the per-area work and have their own closure criteria.

### Track 0.1 — Audit log completeness 🟠 PRODUCTION BLOCKER

**Problem (discovered 21 April 2026):** 14 of 19 business-critical tables have NO audit trigger. Money-adjacent surfaces (`refunds`, `make_up_credits`, `term_adjustments`, `invoice_installments`, `invoice_items`, `billing_runs`, `rate_cards`, `teacher_profiles`, `profiles`, `guardians`, `lesson_participants`, `student_guardians`, `terms`) leave no trail for out-of-band edits. RPCs manually insert `audit_log` rows but any service-role or RLS-bypass modification goes unrecorded.

**Scope:** Add audit triggers for all remaining business-critical tables. Normalise `audit_log.entity_type` casing (currently mixed singular/plural — C50 flagged in POLISH_NOTES but deferred). Add column-level before/after snapshots for the most sensitive columns (money fields, role fields).

**Why a track, not a journey:** touches every area. Must close before any area can be marked "audit-complete."

### Track 0.2 — RLS uniformity walk ⚪

**Problem:** 518 policies across 82 tables. March 2026 migration cluster (15 days, 30+ fix migrations) suggests pressure. Jamie's memory notes a Klarvo lesson where DELETE/INSERT/UPDATE privileges were accidentally revoked — same risk class here.

**Scope:** Systematic walk of RLS policies per table. Verify every operation for every role is covered. Confirm no table has contradictory or overlapping policies. Document the final matrix (role × table × operation) so regressions are detectable.

### Track 0.3 — Timezone consistency ⚪

**Problem:** Various parts of the code use `new Date()` (UTC) directly versus `toLocaleDateString("en-CA", { timeZone: tz })` (org-local). Billing run edge function was recently fixed to use org timezone for due-date calculation — pattern is correct there but likely not applied everywhere.

**Scope:** Grep-based walk of `new Date()` usage across `src/` and `supabase/functions/`. Flag every location that computes dates for business logic (due dates, attendance cutoffs, reminder cadence, closure exclusion, lesson scheduling). Normalise to org timezone.

### Track 0.4 — Notification consistency ⚪

**Problem:** Push notifications only wired to lesson reminders. Email reminder cadence defined per-type but consistency not verified. Internal notifications and parent-facing notifications use different tables (`internal_messages` vs `message_log` vs `notification_preferences`).

**Scope:** Inventory every notification trigger point. Map channels (email, push, in-app). Identify gaps (invoice sent ≠ push notification today). Normalise recipient-preference checks.

---

## Area 1 — Billing & invoicing 🟡

**Status:** In progress. Journey 7 next.

**Files in scope:** `src/pages/Invoices.tsx`, `src/pages/InvoiceDetail.tsx`, `src/components/invoices/*` (16 files), `src/hooks/useInvoices.ts`, `src/hooks/useBillingRuns.ts`, billing-related edge functions (16), related migrations.

### Journey 1 — Create / edit invoice 🟢 CLOSED

**Walked:** 21 April 2026  
**Findings:** 21 (F1-F21) · **Fixed:** 14 across 4 commits · **Filed:** 7  
**Key commits:** `538fd7a` · `2d5bfe6` · `546abc2` (RPC) · `5710952` (UI)  
**Notable:** Lovable autonomously fixed two bugs in our `update_invoice_with_items` migration. Process improvement logged: read analogous existing RPC end-to-end before writing new ones.

### Journey 2 — Billing run wizard 🟢 CLOSED

**Walked:** 21 April 2026  
**Findings:** 20 (BR1-BR20) · **Fixed:** 10 across 3 commits · **Filed:** 10  
**Key commits:** `e53eebc` · `5c022cf` · `f2eca70`  
**Notable:** Edge function rewritten from batch INSERTs to per-payer `create_invoice_with_items` RPC. `is_org_active` enforced. Xero sync attempts now tracked in `xero_entity_mappings`. Stricter `delete_billing_run`. Btree_gist-backed overlap exclusion constraint.

### Journey 3 — Sending invoices 🟢 CLOSED

**Walked:** 21 April 2026  
**Findings:** 19 (J3-F1-F19) · **Fixed:** 14 across 4 commits · **Filed:** 5  
**Key commits:** `9b2e76f` · `7741084` · `9a62e33` · `bc6124d` (CRITICAL)  
**Notable:** **J3-F14a was a critical silent-data-lie bug** — bulk send flipped status without sending emails. Caught pre-customer. Bulk void now uses `void_invoice` RPC. Server-rendered preview removes duplicate HTML logic.

### Journey 4 — Managing existing invoice 🟢 CLOSED

**Walked:** 21-22 April 2026  
**Findings:** 29 (J4-F1-F29) · **Fixed:** 13 across 8 commits · **Filed:** 16  
**Key commits:** `3146b6b` · `73829f2` · `30cd45b` · `12fdcc4` · `cc8569c` · `d592c8f` · `78f2a40` (docs) · `1682abd` · `b381c4c` · `4000389` · `55169e3` (docs close)  
**Notable:** **J4-F24 was a critical silent-data-lie bug** — recalc failures after Stripe refunds left `invoice.paid_minor` stale and I1 ledger identity broken. Variant of J3-F14a. Closed with retry+audit helper, manual retry banner, and finance-team-safe RPCs avoiding audit_log RLS changes (Track 0.2 risk). Latent bug caught in `?action=refund` flow: first-payment check excluded fully-refunded first payments. Discoverability fix for paid-invoice header Refund button closes April 2026 QA feedback.

### Journey 5 — Refunds & disputes 🟢 CLOSED

**Walked:** 22 April 2026  
**Findings:** 27 (J5-F1-F27) · **Fixed:** 17 across 10 commits · **Filed:** 10  
**Key commits:** `77a1034` · `ca82742` · `88c2129` · `f82ade7` (Track A) · Track B: see git log for hashes  
**Notable:** Closed the Stripe webhook dispute handling production blocker. Three new webhook event handlers (charge.dispute.created/updated/closed), new payment_disputes table with finance-team RLS, lost-dispute compensating refund cascade via `apply_lost_dispute_cascade` RPC (status=succeeded with `refund_from_dispute_id` FK — `recalculate_invoice_paid` then naturally flips invoice paid→sent/overdue via A4). Dispute banner on InvoiceDetail, list flag, dashboard active-disputes card. Operator submits evidence via Stripe dashboard (no in-app evidence UI scoped in this journey). Track A refund hardening: DB-level SUM safety net on `validate_refund_amount` trigger, notification idempotency, webhook-path notification trigger for Stripe-Dashboard refunds, Stripe reason enum passthrough, `refund.updated/failed` handler for async reversal.

### Journey 6 — Payment plans (installments) 🟢 CLOSED

**Walked:** 23 April 2026  
**Findings:** 16 (J6-F1-F23, gaps included) · **Fixed:** 12 across 4 commits · **Filed:** 4  
**Key commits:** `ce05679` · `c2b2301` · `e63d6e8` · `767e12b` · docs close  
**Notable:** Payment plan removal now atomic via existing `cancel_payment_plan` RPC (previous client-side two-call path left partially_paid installments orphaned). Payment RPCs (`record_stripe_payment`, `record_payment_and_update_status`) now delegate status/paid_minor/overpayment/installment-cascade to `recalculate_invoice_paid` — single source of truth, A4 branch covered for both. Installment-overdue cron keeps its canonical time-based sent→overdue flip but additionally loops affected invoices through recalc so refund drift reconciles same-pass; partially_paid-past-due invoices included in the recalc set. Installment-upcoming reminder now computes real outstanding (not nominal) and falls back to student payer when no guardian. Auto-pay edge fn writes local audit trail (`auto_pay_initiated` / `auto_pay_failed`) independent of webhook delivery. PaymentPlansDashboard recognises partially_paid in health/overdue/next-attention computations and surfaces a "N partial" hint on the progress cell.

### Journey 7 — Reminders & overdue automation 🔜 NEXT

**Scope:** `auto-pay-upcoming-reminder`, `overdue-reminders`, `invoice-overdue-check`, `installment-overdue-check`, `installment-upcoming-reminder`, overdue-trigger logic, `overdue_reminder_days [7,14,30]` escalation cadence, message_log dedup (Fix 5a applied — verify).

### Journey 8 — Credits interaction with invoices ⚪

**Scope:** credit application during invoice create/edit (done in Area 1 but credit lifecycle per Area 9), credit freeing on void, credit expiry cascade, `validate_refund_amount` interaction with redeemed credits.

### Journey 9 — Recurring invoice templates ⚪

**Scope:** `recurring_invoice_templates` table + `RecurringBillingTab` UI + `useRecurringInvoiceTemplates` hook. **Suspected gap:** no edge function found that schedules template-triggered invoice creation. May be ship-broken.

### Journey 10 — Stripe auto-pay ⚪

**Scope:** `stripe-auto-pay-installment`, off-session payment method usage, failure handling, customer notification, subscription-separate charge model.

### Journey 11 — Server-side PDF generation ⚪

**Scope:** Replace client-side jsPDF in `useInvoicePdf.ts` with an edge function using headless rendering (Puppeteer or equivalent). Branding-aware (org logo, brand/accent colors). Shared template between portal download, staff download, and invoice-email attachment (closes J3-F5). Likely ~1 session of work + a Lovable deploy for the edge function. Low coupling to other Journey 4 work — extracted during J4 walk because it's architectural, not polish.  
**Why extracted:** J3-F5 filed this as "PDF attachment on invoice emails". J4 walk confirmed the PDF itself is client-only, which means (a) no email attachment possible today, (b) any improvement has to move the renderer server-side first. One journey, not a patch.

### Filed for Area 1

- C50 audit_log entity_type singular/plural consolidation (cross-cutting — see Track 0.1)
- I14/I15 RLS invariants for billing tables (see Track 0.2)
- I20 timezone consistency (see Track 0.3)
- BR6 preview/edge re-query race
- BR10 per-invoice plan-failure summary surfacing
- BR13 shared payer-group helper
- BR17-20 polish (settings surface, save-as-default, scheduled runs, CSV export)
- J3-F4 message_log failure surfacing
- J3-F5 PDF attachment (architectural — see also Journey 4)
- J3-F11 related_id pointing to installment for plan reminders
- J3-F12 send-then-flip atomicity
- J3-F14c bulk send concurrency tuning
- J3-F15-17 polish (unsubscribe, per-org sender, open/click tracking)
- J4-F3 voided-invoice "view payment history" jump (cosmetic)
- J4-F7 server-side PDF → Journey 11
- J4-F12 payments + refunds fetched as two queries (polish)
- J4-F13 invoice.refunds typed as any[] (typing pass)
- J4-F14 recalculate_invoice_paid FOR UPDATE only locks invoice, not payments/refunds (I1 invariant track)
- J4-F15 RefundDialog isProcessing scoped to component (low priority)
- J4-F16 refund notification email fire-and-forget (J3-F4 class)
- J4-F17 RefundDialog success forced-close at 2.5s (polish)
- J4-F18 'cancelled' enum value dead references (enum cleanup)
- J4-F22 PDF audit_log write .then-chained not awaited (polish)
- J4-F25 orphaned pending refund rows accumulate on edge function crash (polish — cron cleanup)
- J4-F27 list Void on partially-paid hits A5 guard instead of pre-filter (polish)

---

## Area 2 — Parent portal ⚪

**Files in scope:** `src/pages/portal/*` (8 pages), `src/components/portal/*` (19 components), `src/components/parent-portal/*`, portal-specific hooks (useParentConversations, useParentCredits, useParentEnquiry, useParentInstruments, useParentLoopAssist, useParentReply).

### Scoped journeys:
1. **View dashboard / home** — PortalHome.tsx (966 lines — second-largest file)
2. **View & pay invoice** — PortalInvoices + payment drawer + Stripe + bank-transfer paths
3. **View schedule** — PortalSchedule.tsx (711 lines)
4. **Reschedule lesson** — reschedule picker flow
5. **Book make-up lesson** — make-up stepper
6. **Messages with school** — PortalMessages + parent reply flow
7. **Practice tracking** — PortalPractice + timer + streaks
8. **Profile & payment methods** — PortalProfile + saved cards + preferences

---

## Area 3 — Students & guardians ⚪

**Files:** `src/pages/Students.tsx`, `StudentDetail.tsx`, `StudentsImport.tsx`, `src/components/students/*` (11 + import/ + wizard/), `useStudents` and related hooks, RPCs `anonymise_student`, `anonymise_guardian`, `void_credits_on_student_delete`, `convert_waitlist_to_student`.

### Scoped journeys:
1. **Create student (manual)** — student wizard flow
2. **Bulk import students (CSV)** — csv-import-execute, csv-import-mapping, undo RPC
3. **Edit / archive student** — soft delete, archive cascades (resource shares, make-up credits)
4. **Guardian CRUD + primary payer** — student_guardians pivot, is_primary_payer
5. **Grade change** — grade_change_history, useGradeChange
6. **Instruments** — student_instruments, useInstruments

---

## Area 4 — Calendar ⚪

**Biggest surface in the app.** 32 components, drag-resize, recurrence, conflict detection, multiple views.

### Scoped journeys:
1. **Create single lesson**
2. **Create recurring series** — recurrence_rules, series edits (single / future / all)
3. **Drag-reschedule**
4. **Resize / edit duration**
5. **Conflict detection & resolution** — check_lesson_conflicts RPC, conflicts hook
6. **Cancellation flow** — lesson_status transitions, attendance cascades, credit issuance
7. **Open slots** — is_open_slot, trg_prevent_past_open_slot, slot-release triggers
8. **Views** — day / week / month / teacher-colour mode, virtual scrolling perf
9. **Calendar filters & search**

---

## Area 5 — Lessons & attendance ⚪

### Scoped journeys:
1. **Mark attendance (daily register)** — DailyRegister.tsx + attendance_records
2. **Batch attendance** — BatchAttendance.tsx
3. **Absence handling** — absence_reason enum, auto-credit trigger (trg_auto_credit), auto-waitlist
4. **Teacher cancellation** — cancelled_by_teacher handling, billing exclusion (already touched)
5. **Lesson participants** — multi-student lessons, per-participant rate snapshot
6. **Lesson notes** — overlaps with Area 12 but core notes-on-lesson here
7. **Lesson reminders** — send-lesson-reminders edge fn, push + email fan-out
8. **Attendance audit trail** — trg_audit_attendance (already in place)

---

## Area 6 — Terms & closures ⚪

### Scoped journeys:
1. **Create / edit term** — terms table, enforce_term_no_overlap, term wizard
2. **Closure dates** — closure_dates table, create/edit, org-wide vs location-scoped
3. **Term-based billing mode** — delivered vs upfront (partially walked in Journey 2)
4. **Term adjustments** — term_adjustments table, credit-note generation, process-term-adjustment edge fn

---

## Area 7 — Term continuation ⚪

**Scope:** The parent-facing "continue for next term?" flow. Non-trivial multi-step process.

### Scoped journeys:
1. **Create continuation run** — create-continuation-run, term_continuation_runs
2. **Parent respond (accept/decline)** — continuation-respond, term_continuation_responses
3. **Bulk process** — bulk-process-continuation, materialise_continuation_lessons RPC

---

## Area 8 — Teachers & payroll ⚪

### Scoped journeys:
1. **Teacher CRUD** — Teachers.tsx (1010 lines)
2. **Teacher availability** — availability_templates, availability_blocks, time_off_blocks
3. **Pay rates** — pay_rate_type enum (per_lesson / hourly / percentage), rate_cards, teacher_profiles
4. **Payroll report** — usePayroll, get_teachers_with_pay RPC
5. **Teacher performance** — useTeacherPerformance, teacher performance report

---

## Area 9 — Make-up credits & waitlists ⚪

**Complex lifecycle.** 4 tables (make_up_credits, make_up_waitlist, make_up_policies seeded), 6+ RPCs (offer_makeup_slot, confirm_makeup_booking, find_waitlist_matches, respond_to_makeup_offer, dismiss_makeup_match, redeem_make_up_credit, on_slot_released, on_makeup_participant_removed), 2 edge fns (notify-makeup-offer, notify-makeup-match, waitlist-expiry).

### Scoped journeys:
1. **Issue credit** — manual + auto (absence → trg_auto_credit)
2. **Offer make-up slot** — find_waitlist_matches + notify-makeup-offer
3. **Parent responds** — respond_to_makeup_offer, confirm_makeup_booking
4. **Redeem credit on invoice** — already partly walked in Area 1 Journey 1
5. **Expiry & voiding** — credit-expiry, credit-expiry-warning cron fns, void_make_up_credit

---

## Area 10 — Messaging ⚪

**13 edge functions.** Two distinct systems: staff↔parent threaded messaging, and one-off system emails.

### Scoped journeys:
1. **Send staff→parent message** — send-parent-message, threaded
2. **Parent reply** — send-parent-reply, useParentReply
3. **Bulk compose** — BulkComposeModal, send-bulk-message, message_batches
4. **Internal (staff↔staff)** — internal_messages, notify-internal-message
5. **Message requests** — message_requests table (gate parent→staff initiation)
6. **Message templates** — message_templates, org_messaging_settings

---

## Area 11 — Practice tracking ⚪

### Scoped journeys:
1. **Teacher assigns practice** — practice_assignments, CreateAssignmentModal
2. **Student logs practice** — practice_logs, portal timer, streak updates
3. **Teacher review + parent view** — practice trends chart, streaks, milestones, streak-notification edge fn

---

## Area 12 — Notes ⚪

### Scoped journeys:
1. **Create lesson note** — LessonNotesForm + send-notes-notification
2. **Notes explorer** — NotesExplorer.tsx (cross-lesson search)
3. **Privacy & sharing** — private flag (migration 20260315100100 hints at past fix), parent visibility

---

## Area 13 — Resources ⚪

### Scoped journeys:
1. **Upload resource** — UploadResourceModal, Supabase storage
2. **Share resource** — resource_shares, per-student sharing, cleanup-on-archive trigger
3. **Subscription gates** — check_subscription_resource_* triggers, orphan cleanup

---

## Area 14 — Leads, CRM & booking page ⚪

**Sizeable distinct product within the app.** 1797 lines of code across Leads/LeadDetail/BookingPage.

### Scoped journeys:
1. **Public booking page** — BookingPage.tsx (1068 lines — largest file), booking-get-slots, booking-submit, IP rate limit
2. **Lead pipeline (Kanban)** — LeadKanbanBoard, lead_stage enum, useLeads
3. **Lead detail** — LeadDetail, activities, follow-ups, timeline
4. **Convert lead → student** — ConvertLeadWizard, convert_lead RPC, enrolment-offer-expiry
5. **Lead funnel analytics** — LeadFunnelChart, conversion rate tracking

---

## Area 15 — LoopAssist (AI assistant) ⚪

### Scoped journeys:
1. **Chat (staff)** — looopassist-chat (note three-o typo — documented legacy), action registry consumption
2. **Execute action proposals** — looopassist-execute, ai_action_proposals, destructive-action gating
3. **Proactive alerts** — ProactiveAlerts, useProactiveAlerts
4. **Chat (parent)** — parent-loopassist-chat, ParentLoopAssist component

---

## Area 16 — Reports & analytics ⚪

### Scoped journeys:
1. **Revenue report** — get_revenue_report RPC, Revenue.tsx
2. **Outstanding / overdue** — Outstanding.tsx
3. **Attendance / cancellations / lessons delivered / utilisation** — 4 report pages
4. **Teacher performance / payroll** — TeacherPerformance.tsx, Payroll.tsx

---

## Area 17 — Xero integration ⚪

**Partly hardened in Area 1 Journey 2.** Full walk still needed.

### Scoped journeys:
1. **OAuth connect / reconnect** — xero-oauth-start, xero-oauth-callback, token refresh
2. **Sync invoice** — xero-sync-invoice (attempt tracking landed), failure recovery
3. **Sync payment** — xero-sync-payment (accounting.payments scope unblocked April 17, end-of-April live)
4. **Disconnect & cleanup** — xero-disconnect, mapping cleanup
5. **Reconciliation dashboard** — surface sync_status per invoice/payment

---

## Area 18 — Stripe integration ⚪

**19 edge functions. Biggest integration surface.**

### Scoped journeys:
1. **Stripe Connect onboarding** — stripe-connect-onboard, stripe-connect-status
2. **Subscription checkout** — stripe-subscription-checkout (LessonLoop's own SaaS billing)
3. **Invoice checkout (parent-facing)** — stripe-create-checkout, stripe-verify-session
4. **Payment intent (embedded / portal)** — stripe-create-payment-intent, payment_intent.succeeded webhook
5. **Auto-pay installments** — stripe-auto-pay-installment (overlaps Area 1 Journey 10)
6. **Customer portal / payment methods** — stripe-customer-portal, stripe-list-payment-methods, stripe-detach-payment-method, stripe-update-payment-preferences
7. **Refund** — stripe-process-refund, charge.refunded webhook
8. **Webhook reliability & dispute handling 🟠 BLOCKER** — stripe-webhook (988 lines). **Does NOT handle `charge.dispute.*` events** — chargebacks silently unhandled. Also missing: `invoice.finalized`, `invoice.voided`, `payment_method.attached`, `customer.updated`.

---

## Area 19 — Calendar integrations (Google / Outlook / iCal / Zoom) ⚪

### Scoped journeys:
1. **Google / Outlook OAuth** — calendar-oauth-start, calendar-oauth-callback
2. **External busy sync** — calendar-fetch-busy, calendar-refresh-busy (pg_cron scheduled), external_busy_blocks
3. **Lesson → external event** — calendar-sync-lesson, calendar_event_mappings
4. **iCal feed** — calendar-ical-feed, generate_ical_token, ical-expiry-reminder
5. **Zoom integration** — zoom-oauth-*, zoom-sync-lesson, zoom_meeting_mappings (lightweight, fire-and-forget)

---

## Area 20 — Subscription, trial & plan gating ⚪

### Scoped journeys:
1. **Trial lifecycle** — trial-reminder-1day/3day/7day, trial-expired, trial-winback
2. **Plan gating (feature enforcement)** — FeatureGate component, enforce_subscription_active_* triggers
3. **Upgrade flow** — stripe-subscription-checkout, UpgradeBanner
4. **Plan changes (upgrade / downgrade / cancel)** — customer.subscription.updated webhook, grandfathering
5. **Trial-expired UX** — TrialExpiredModal, restricted-mode behaviour

---

## Area 21 — Onboarding ⚪

### Scoped journeys:
1. **Sign-up flow** — Signup.tsx, handle_new_user, handle_new_organisation
2. **Org setup wizard** — WelcomeStep, PlanSelector, PlanRecommendationStep, TeachingProfileStep, SetupStep
3. **Migration-from-competitor import** — MigrationStep, csv-import flow
4. **First-run experience** — useFirstRun, OnboardingProgress, contextual hints (hint_completions table)

---

## Area 22 — Settings (23 tabs) ⚪

**Each tab is its own walk.** Treating as 23 sub-journeys.

### Scoped journeys (1 per tab):
1. **ProfileTab** · 2. **OrganisationTab** · 3. **BrandingTab** · 4. **BillingTab** · 5. **AccountingTab**  
6. **InvoiceSettingsTab** · 7. **RecurringBillingTab** · 8. **RateCardsTab** · 9. **SchedulingSettingsTab**  
10. **CalendarIntegrationsTab** · 11. **ZoomIntegrationTab** · 12. **TeacherAvailabilityTab**  
13. **MessagingSettingsTab** · 14. **NotificationsTab** · 15. **MusicSettingsTab** · 16. **BookingPageTab**  
17. **ContinuationSettingsTab** · 18. **LoopAssistPreferencesTab** · 19. **HelpToursTab**  
20. **AuditLogTab** · 21. **PrivacyTab** · 22. **DataImportTab** · 23. **OrgMembersTab**

---

## Area 23 — Admin, GDPR & data lifecycle ⚪

### Scoped journeys:
1. **Team / org members** — OrgMembersTab + InviteMemberDialog + invite-accept / invite-get
2. **GDPR export** — gdpr-export edge fn
3. **GDPR delete** — gdpr-delete, account-delete
4. **Anonymisation** — anonymise_student, anonymise_guardian RPCs
5. **Orphan cleanup & data integrity** — cleanup-orphaned-resources, cleanup_expired_invites, cleanup_rate_limits

---

## Area 24 — Auth ⚪

### Scoped journeys:
1. **Sign-in / sign-up** — Login.tsx, Signup.tsx, Supabase auth
2. **Password reset** — ForgotPassword, ResetPassword
3. **Email verification** — VerifyEmail
4. **Invite acceptance** — AcceptInvite, invite-accept
5. **Session & role resolution** — useAuth, useOrg, RouteGuard, role buckets

---

## Area 25 — Deliverability ⚪

### Scoped journeys:
1. **Resend setup** — from-domain, SPF/DKIM/DMARC verification
2. **Bounce & complaint handling** — no known handler today; email deliverability monitoring gap
3. **Unsubscribe behaviour** — transactional emails have no unsubscribe (legally fine); verify no marketing path leaks through same sender

---

## Area 26 — iOS app (Capacitor) ⚪

### Scoped journeys:
1. **App launch & deep links** — Capacitor config, URL schemes
2. **Push notifications** — src/services/pushNotifications.ts, push_tokens, send-push (only wired to lesson reminders currently)
3. **iOS-specific UX** — useIOSKeyboardHeight, SafeArea, keyboard avoidance
4. **Android back button** — useAndroidBackButton
5. **Build & release** — App Store submission pipeline, bundle version management, splash / icon

---

## Area 27 — Marketing site ⚪

**37 pages.** Mostly static, SSG-rendered, should be lower-risk than app features.

### Scoped journeys:
1. **Static pages** — home, about, pricing, features deep-dives, use-cases, comparisons
2. **Kickstarter capture** — kickstarter_signups capture, follow-up flow (gap: no sender wired)
3. **Blog** — Blog.tsx, BlogPost.tsx (verify content pipeline)
4. **Marketing chat** — marketing-chat edge fn, MarketingChatWidget, IP rate limit

---

## Known production blockers 🟠

Must be closed before any paid customer signs up:

1. ~~**Stripe webhook missing dispute handling** (Area 18 Journey 8) — chargebacks invisible. Real money loss.~~ **CLOSED** in Area 1 Journey 5, 22 April 2026. Three dispute event handlers landed, lost-cascade wired, operator notification + UI surfaces shipped. Area 18 Journey 8 now scoped to other missing events (`invoice.finalized`, `invoice.voided`, `payment_method.attached`, `customer.updated`) + broader webhook reliability.
2. **Audit log gaps on 14 business-critical tables** (Track 0.1) — money-adjacent data modifiable without trail.
3. **Recurring invoice templates have no scheduler** (Area 1 Journey 9) — UI suggests feature works; no cron fires. Verify and fix or remove UI.
4. **RLS walk not done** (Track 0.2) — March 2026 fix cluster suggests pressure; residual gaps likely.

---

## Scope decisions log

Recording decisions made during roadmap construction so future sessions understand why the structure is what it is.

- **21 April 2026:** 28 total areas (was 16 in original loose plan). Calendar split from lessons, term continuation split from terms, practice / notes / resources each split out, leads/CRM/booking merged into one area (they're the same user pipeline), subscription/trial split from settings, cross-cutting Area 0 added for invariants.
- **21 April 2026:** Audit log gap re-scoped after discovery found 14/19 tables (not "10 billing-adjacent" as initially noted) lack triggers. Elevated to production blocker.
- **21 April 2026:** Stripe dispute handling flagged as blocker after webhook event-list inspection.
- **21 April 2026:** Settings treated as 23 sub-journeys not 1 area. Each tab is its own polish pass.
- **21 April 2026 (Journey 4 walk):** Extracted server-side PDF generation from J3-F5 filed list into dedicated Journey 11 — it's an architectural rewrite, not polish. Unblocks invoice PDF email attachment.
- **22 April 2026 (Journey 4 close):** J4-F24 (silent recalc failure) closed via 3-attempt retry helper + audit_log trail + finance-team-safe read RPC + InvoiceDetail banner. Deliberately avoided relaxing audit_log SELECT RLS — narrow RPC approach keeps Track 0.2 risk surface unchanged.
- **22 April 2026 (Journey 5 close):** Dispute state surfaces via new `payment_disputes` table + UI banner + list flag, NOT via `invoice_status` enum extension. Kept enum blast radius at zero. Lost-dispute cascade uses existing `refunds` table with `refund_from_dispute_id` FK — `recalculate_invoice_paid` A4 path handles the invoice state flip naturally, no trigger or RPC changes to that function.
- **22 April 2026:** Journey 5 chose NOT to build in-app dispute evidence UI. Operator submits evidence via Stripe dashboard link surfaced in DisputeBanner. Keeps journey scope finite; evidence upload is a candidate for a later polish pass.
- **23 April 2026 (Journey 6 close):** Did NOT duplicate `cancel_payment_plan` — existing RPC already had the right semantics (locks + paid/partially_paid guard + atomic DELETE+UPDATE+audit). Pointed the hook at it instead of creating `remove_payment_plan`.
- **23 April 2026 (Journey 6, audit):** Kept the time-based `sent → overdue` flip in the `installment-overdue-check` cron rather than folding it into `recalculate_invoice_paid`. The helper's A4 branch covers refund-reopen only; a generic "time-aware" helper would widen its contract and affect every delegating RPC. Cron-only concern stays in the cron; recalc stays pure.

---

## How this file evolves

**Update triggers** (any of these means update this file):
1. Journey closes — move from ⚪/🟡 to 🟢 with commit hashes + finding counts
2. New journey discovered mid-walk — add to scoped list
3. Production blocker discovered — add to blockers section
4. Scope decision made — append to decisions log

**Who updates:**
- Claude updates when closing journeys (always include commit hash)
- Jamie or any assistant can add scope decisions
- Never silently re-order areas — add decisions log entry

**Versioning:**
This file is version-controlled in the main repo. History is git log.

---

_Last meaningful update: 23 April 2026 (Journey 6 closed — payment plans / installments hardened)._
