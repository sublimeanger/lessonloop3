# Area 2 — Parent Portal audit, running fixes document

**Started:** 2026-04-28
**Status:** all 8 portal journeys + cross-cutting walk complete. Active findings doc — rows get crossed off as fixes ship. Once fully closed out, this moves to `docs/archive/audit-2026-04/`.
**Repo tip when audit captured:** `9bb39c67` (after PR #364 merged).
**Scope:** Multi-journey audit of the Area 2 parent portal. Source of truth for fix-brief authoring; see the priority list at the bottom.

---

## Walk progress

| Journey | Page | Lines | Status | Findings raised | HIGH |
|---|---|---|---|---|---|
| J1 | PortalHome | 966 | walked | 30 (3 withdrawn) | 5 |
| J2 | PortalSchedule | 711 | walked | 23 (3 withdrawn) | 2 |
| J3 | PortalInvoices | 611 | walked | 28 (6 withdrawn) | 3 |
| J4 | PortalMessages | 434 | walked | 19 (7 withdrawn) | 2 |
| J5 | PortalPractice | 169 + 1254 components | walked | 20 (1 withdrawn) | 2 |
| J6 | PortalContinuation | 503 + 822 hooks + 421 edge fn | walked | 11 (1 withdrawn) | 2 |
| J7 | PortalResources | 264 + 158 audio + 143 modal + 408 hooks | walked | 13 (3 withdrawn) | 0 |
| J8 | PortalProfile | 335 + 210 PaymentMethods + 71 hooks | walked | 9 | 1 |
| Cross | ChildFilter, PortalLayout, PortalSidebar, PortalBottomNav, ChildSwitcher, Header, ParentLoopAssist (273 + 170 hook + 374 edge fn), useUnreadMessages, useProactiveAlerts, useParentOnboardingProgress, useRealtimePortalPayments, useParentCredits, usePortalLink, PortalWelcomeDialog, ParentOnboardingChecklist | ~2300 | walked | 14 (1 withdrawn, 1 folded) | 0 |

**HIGH count: 17 raw findings → 14 distinct fix briefs.** Two duplicates merged (J1-F17 ≡ J3-F7 money-math; J6-F4 + J6-F5 are facets of one RLS migration), plus J5-F11 + J6-F4/F5 + J8-F9 are three separate RLS-lockdown migrations.

**MED count: 25.** **LOW count: ~110.**

---

## State verified during pre-walk (don't re-verify)

- **Auth chain:** `auth.uid() → guardians.user_id → student_guardians.guardian_id → student_guardians.student_id` via `is_parent_of_student()` SECURITY DEFINER (single canonical definition since Jan 2026, never redefined).
- **`audit_log` INSERT for authenticated:** **blocked** by `20260401000000_auth_rls_hardening.sql` line 408. All `audit_log` writes go through SECURITY DEFINER triggers/functions that bypass RLS.
- **`invoice_status` enum:** `draft, sent, paid, overdue, void`. `partially_paid` is on `invoice_installments`, not `invoices`.
- **`make_up_waitlist.status` enum:** `waiting, matched, offered, accepted, declined, booked, expired, cancelled` (8 states).
- **`invoice.paid_minor`:** maintained net-of-refunds by `recalculate_invoice_paid` RPC, which is called from every payment-recording and refund-recording RPC. Trustworthy as canonical "amount paid" figure.
- **F-01 from March 2026 audit (stripe-create-payment-intent guardian check):** **closed in code** (lines 70–109). The March audit doc is stale on this.
- **Parent SELECT RLS verified:**
  - `make_up_credits` — scoped via guardian chain (`fix_parent_credit_policy_scope`).
  - `attendance_records` — scoped via `is_parent_of_student`.
  - `invoices` — scoped via `is_invoice_payer`.
  - `payments` — scoped via `is_invoice_payer`.
  - `refunds` — scoped via `payer_guardian_id IN guardian-of-user OR payer_student_id IN student-of-user`.
- **`toZonedTime(...).getHours()` is robust across runtime TZ** — empirically tested. Pattern at `DashboardHero.tsx:154` and `PortalHome.tsx:326` is correct.

---

## All findings catalog (J1 + J2 + J3)

### J1 — PortalHome

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J1-F1 | **HIGH** | Silent audit lie | Make-up decline writes `audit_log` from authenticated client (lines 181–192). Authenticated INSERT on `audit_log` is RLS-blocked. Fire-and-forget swallows rejection. Plural `entity_type='make_up_waitlist'` also violates T01-P3 singular convention. | `PortalHome.tsx:181-192` | Move audit write into `respond_to_makeup_offer` RPC (SECURITY DEFINER bypasses RLS); also add for cancel-booked-makeup. Use singular entity_type. |
| J1-F2 | MED | Idempotency | Email-link `?makeup_action=` URL params cleared in `finally` of effect — on RPC error, params persist; back-button replay possible. | `PortalHome.tsx:83-115` | Clear URL params **before** RPC call, not after. |
| J1-F3 | LOW | UX | Email-link make-up acceptance toast lacks lesson info. Inline accept on same page (lines 145–151) shows "X — Tuesday 5 May at 3pm". Asymmetric. | `PortalHome.tsx:100` | Fetch waitlist entry on email-link path, render same description. |
| J1-F4 | **HIGH** | Silent data integrity | Parent cancel-booked-makeup does raw UPDATE on `make_up_waitlist` (status `booked → waiting`). Doesn't delete the underlying `lesson_participants` row, so the `on_makeup_participant_removed` trigger (which restores credit + writes audit) never fires. Result: parent loses make-up credit + ghost lesson stays on teacher's calendar. | `PortalHome.tsx:220-232` | Create `cancel_booked_makeup(_waitlist_id)` SECURITY DEFINER RPC that DELETEs the `lesson_participants` row inside a transaction. The existing trigger does the rest. |
| J1-F5 | MED | Stale state | `nextLesson` derived from two unrelated queries (`useParentSummary`, `useChildrenWithDetails`) not realtime-synchronised; can disagree mid-update. | `PortalHome.tsx:267-272` | Single source of truth — derive both from `useParentDashboardData` directly, drop the parallel summary query. |
| J1-F6 | MED | Cache invalidation | Make-up handlers invalidate `['make_up_waitlist_parent']` only — don't invalidate `parent-summary` or `parent-dashboard-data`. Stale "Next lesson" tile if cancelled lesson was the next one. | `PortalHome.tsx:110, 152, 196, 237` | Add `parent-dashboard-data` and `parent-summary` to invalidation in all 4 handlers. |
| J1-F7 | LOW | Perf cosmetic | `toZonedTime(new Date(), tz).getHours()` called 4× in JSX hero. | `PortalHome.tsx:326-331` | Memoise `currentHour` once per render. |
| J1-F8 | LOW | Copy edge case | Multi-child copy when `selectedChildId` set could mis-render with multi-name fallback. | `PortalHome.tsx:337-345` | Defensive only. |
| J1-F9 | LOW | Stale UI | "in 1h 15m" countdown text stale until next render. Parent leaves Home open → countdown rots. | `PortalHome.tsx:464` | Tick a `now` state every minute when countdown visible. |
| ~~J1-F10~~ | ~~MED~~ | ~~TZ~~ | **WITHDRAWN** — empirically tested, `toZonedTime(...).getHours()` is robust. | — | — |
| J1-F11 | LOW | UX | `expiringSoon[0].expires_at` shown when count > 1 — could mislead if multiple credits expire on different dates. | `PortalHome.tsx:591` | Show range or "earliest 5 May". |
| ~~J1-F12~~ | — | — | **WITHDRAWN** — instant comparison correct. | — | — |
| J1-F13 | MED | TZ inconsistency | `formatTimeUK` called without `tz` arg on lines 143, 681, 708 (make-up offer toast / inline offer card / booked make-up display). Same calls *with* `tz` on lines 451, 549. Travelling parents see wrong times. | `PortalHome.tsx:143, 681, 708` | Pass `tz` to all three. |
| J1-F14 | LOW | UX consistency | Make-up accept fires immediately, decline shows confirm dialog. Inverse asymmetry — accept commits the parent's child to a slot. | `PortalHome.tsx:685-698` | Add confirm dialog to accept (or remove from decline). |
| J1-F15 | **HIGH** | Hardcoded currency | `formatCurrencyMinor(entry.offered_rate_minor, 'GBP')` — hardcoded GBP. Wrong for any non-UK org. | `PortalHome.tsx:784` | Use `currencyCode`. Cross-cutting sweep also needed. |
| J1-F16 | LOW | Display | `{entry.offered_slot_time}` shown raw (line 770). PostgreSQL TIME comes back as `"16:00:00"`. | `PortalHome.tsx:770` | Format `HH:mm`. |
| J1-F17 | **HIGH** | Money math | `get_parent_dashboard_data` per-guardian outstanding only counts `payer_guardian_id` invoices; per-child only counts `payer_student_id` invoices. Mixed-payer households see different totals under different filters. **Same bug surface as J3-F7.** | migration `20260417220000` | Per-guardian outstanding should `OR`-include student-payer for own children. Single migration fix; both J1-F17 and J3-F7 close. |
| ~~J1-F18~~ | — | — | **WITHDRAWN** — `mutateAsync` errors surfaced via `onError` toast. | — | — |
| J1-F19 | LOW | Race | RequestModal opening with stale state. | — | — |
| J1-F20 | LOW | Multi-device | `PortalWelcomeDialog` uses localStorage per-userId — different device = sees welcome again. | `PortalWelcomeDialog.tsx:11-26` | Move to `hint_completions` table or accept per-device behaviour. |
| J1-F21 | LOW | Dialog flash | Welcome dialog mounts after first paint → quick flicker. | `PortalWelcomeDialog.tsx:16-21` | Read localStorage during initial state. |
| J1-F22 | LOW | UX consistency | `ParentOnboardingChecklist` uses raw paths `/portal/profile` etc. — clicking with `?child=` filter active drops the filter. | `ParentOnboardingChecklist.tsx:26-30` | Use `usePortalLink()` like PortalHome does. |
| J1-F23 | LOW | Race | Celebration → dismiss after 5s with localStorage save. Browser close within 5s → celebration replays. | `ParentOnboardingChecklist.tsx:105-111` | Save localStorage immediately on celebration trigger; remove from timeout. |
| J1-F24 | LOW | Cosmetic | motion.div animate cycle on every render. | `ParentOnboardingChecklist.tsx:188-192` | Defensive only. |
| J1-F25 | LOW | Defensive | `MakeUpStepper` only handles 5 of 8 enum states. Bad input → blank stepper. | `MakeUpStepper.tsx:4-10` | Add `if (activeIndex === -1) return null;` guard. |
| J1-F26 | MED | Info disclosure | Parents read full `organisations` row including `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `past_due_since`, `cancels_at`, `max_students`, `max_teachers`. | `OrgContext.tsx:39-62` | Strip subscription internals from parent's `useOrg` selection, or add column-level grants. |
| J1-F27 | LOW | Double-fetch | `useUnreadMessagesCount` + `useParentSummary.unreadMessages` both query `message_log`. | `useUnreadMessages.ts` + `useParentPortal.ts:534-546` | Keep `useUnreadMessagesCount` (has realtime), drop the summary version. |
| J1-F28 | LOW | N+1 | `useParentCredits` does guardian → links → available_credits in 3 queries. | `useParentCredits.ts:33-66` | Single query with FK joins. |
| J1-F29 | **HIGH** | Audit gap | `respond_to_makeup_offer` RPC writes no `audit_log` entry. Combined with J1-F1, parent accept/decline of make-up offers has zero audit coverage. | migration `20260315210005` | Add `INSERT INTO audit_log` inside the SECURITY DEFINER RPC. Same fix as J1-F1. |
| J1-F30 | MED | Realtime | `useParentWaitlistEntries` has no realtime subscription. Parent doesn't see new make-up offers until refetch. | `useMakeUpWaitlist.ts:313-350` | Add a postgres_changes subscription scoped to `guardian_id`. |

### J2 — PortalSchedule

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J2-F1 | LOW | UX | `requestedLessonIds` is in-memory `Set`; navigation away allows duplicate change requests. | `PortalSchedule.tsx:66, 156` | Server-side dedup, or persist on `message_requests` query. |
| ~~J2-F2~~ | — | — | **WITHDRAWN** — `differenceInHours` on instants correct. | — | — |
| J2-F3 | MED | UX (data) | `**markdown**` syntax used in `message_requests.message`. Admin renders with `whitespace-pre-wrap` → literal asterisks. | `PortalSchedule.tsx:179` | Strip the asterisks; use plain "Proposed new time:" prefix. |
| J2-F4 | — | — | (Note only — Schedule uses `formatInTimeZone` correctly; useful contrast for J1-F13 fix pattern.) | — | — |
| J2-F5 | — | — | (Withdrawn — `target=_blank` blocks `javascript:` in modern browsers.) | — | — |
| J2-F6 | LOW | Perf | `LessonCard` defined inside render → identity changes each render → unmount/remount of every card. | `PortalSchedule.tsx:286` | Hoist `LessonCard` to module scope or use `useMemo`. |
| J2-F7 | LOW | Product decision | Attendance % counts `late` as positive. | `PortalSchedule.tsx:622` | Product decision (filed for later). |
| J2-F8 | MED | TZ | `startOfToday()` returns midnight in browser TZ; used to bucket lessons. Cross-TZ parents bucket near midnight wrong. | `PortalSchedule.tsx:191-193` | Use `toZonedTime(new Date(), tz)` then `startOfDay`. Same fix family as J1-F13 / J2-F12 / J2-F13. |
| J2-F9 | LOW | RLS hole | `message_requests` INSERT RLS doesn't validate `lesson_id`/`student_id` belong to guardian. Hook validates client-side. Direct API call could insert any `lesson_id`. | migration `20260119235724:195-205` | Tighten WITH CHECK to verify lesson_id and student_id chain. |
| J2-F10 | LOW | UX consistency | `LessonChangeSheet` cancel form lacks late-cancel notice that `RescheduleSlotPicker` shows. | `LessonChangeSheet.tsx:198-234` | Add `isLateCancel` warning to cancel form too. |
| ~~J2-F11~~ | — | — | **WITHDRAWN** — `mutateAsync` errors surfaced. | — | — |
| J2-F12 | **HIGH** | TZ broken | `RescheduleSlotPicker` is timezone-naive throughout. Uses `format()`, `setHours/setMinutes/startOfDay`, `selectedDate.getDay()` against browser TZ; `availability_blocks.start_time_local` is teacher/org TZ. NY parent rescheduling Tokyo teacher's lesson sees slots at "9am NY" instead of "9am Tokyo". | `RescheduleSlotPicker.tsx:118-193` (slot generation), 218 (display), 286 | Pass `orgTimezone`. Use `formatInTimeZone` for display, `toZonedTime` before slot-math, `(toZonedTime(d, tz)).getDay()` for day-of-week lookup. |
| J2-F13 | MED | TZ | Closure-date matching uses `format(d, 'yyyy-MM-dd')` browser-local. Wrong closures for cross-TZ parents. | `RescheduleSlotPicker.tsx:126, 244` | Use `formatInTimeZone(d, orgTz, 'yyyy-MM-dd')`. |
| J2-F14 | MED | Conflict | Slot picker only checks teacher's existing lessons; doesn't check parent's child's lessons with other teachers. Parent picks a slot that conflicts with another lesson. | `RescheduleSlotPicker.tsx:81-101` | Also fetch `lesson_participants` for the child in the same window; check conflicts both ways. |
| J2-F15 | LOW | Perf | O(N×M) slot generation. | `RescheduleSlotPicker.tsx:143-190` | Acceptable; defer. |
| J2-F16 | LOW | Perf | Slot picker fetches ±21 days of teacher lessons but only renders one day. | `RescheduleSlotPicker.tsx:85-86` | Tighten window to `selectedDate ± 1 day`. |
| J2-F17 | LOW | Perf | Slot picker queries churn on date-picker tap. | `RescheduleSlotPicker.tsx:81-101` | Accept; React Query caches. |
| J2-F18 | MED | Realtime scope | `useParentLessons` realtime subscription is `org_id=eq.X` — receives every lesson UPDATE in the org. | `useParentPortal.ts:194-217` | Server-side function or accept firehose with RLS scoping reads. |
| J2-F19 | LOW | N+1 | Three sequential auth queries (guardian → links → students). Same as J1-F28. | `useParentPortal.ts:225-247` | Single RPC. |
| J2-F20 | LOW | Perf | Status filter applied client-side after fetch. | `useParentPortal.ts:315` | Move to query. |
| ~~J2-F21~~ | — | — | **WITHDRAWN** — `attendance_records` parent SELECT correctly RLS-scoped. | — | — |
| J2-F22 | LOW | UX | Structured lesson notes hidden when no child filter active. Multi-child parent doesn't see them on Schedule. | `PortalSchedule.tsx:124` | Pass `undefined` always; have `useParentLessonNotes` resolve children from guardian. |
| J2-F23 | LOW | Consistency | `useParentLessonNotes` is RPC-based; `useParentLessons` is direct queries. No principle. | — | Cleanup target. |
| J2-F24 | **HIGH** | Schema drift | `parent_reschedule_policy_override` on `locations` is in the schema with CHECK constraint, but **nobody reads it**. Lessons at locked-down locations are still rescheduleable from the portal. | `PortalSchedule.tsx:127-129`; `locations.parent_reschedule_policy_override` | Resolve effective policy as `location.override ?? org.parent_reschedule_policy`. Apply per-lesson rather than once for the whole page. |
| J2-F25 | MED | Security | iCal token entropy fine, but no UI to revoke. Token in URL valid 90d. Leaked URL = no recovery without DB surgery. | `useCalendarConnections.ts:273-320` | Add "revoke calendar feed" button on Schedule's calendar-subscribe card. |
| J2-F26 | LOW | Defense in depth | `calendar-ical-feed` edge function has no rate-limit. | `supabase/functions/calendar-ical-feed/index.ts` | Add rate-limit by token. |

### J3 — PortalInvoices

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| ~~J3-F1~~ | — | — | **WITHDRAWN** — invoices SELECT properly RLS-scoped. | — | — |
| J3-F2 | LOW | Currency | Hardcoded GBP fallback. | `PortalInvoices.tsx:215` | Use derived constant. |
| J3-F3 | MED | Polling | Polling logic uses `paid_minor > 0` to detect "payment landed", which fires on any prior payment. Wrong for installment users. | `PortalInvoices.tsx:152` | Capture `paid_minor` snapshot before redirect, compare for change. |
| J3-F4 | LOW | Idempotency | `verifyAndPoll` re-runs on remount with stale URL params. Stripe verify is idempotent so harmless. | `PortalInvoices.tsx:94-184` | Defer. |
| J3-F5 | MED | UX security | `?action=pay&invoice=xxx` auto-opens payment drawer. Phishing-adjacent. | `PortalInvoices.tsx:187-197` | Require explicit "Open payment" tap on pre-filled drawer state. |
| J3-F6 | — | — | (Note only — line 275 client-side outstanding total IS correct, contradicting J1-F17's bug.) | — | — |
| J3-F7 | **HIGH** | Money math | `useParentInvoices` filters on `payer_guardian_id` only. Mixed-payer households: invoices billed to student directly never appear in the list. **Same fix as J1-F17.** | `useParentPortal.ts:382` | `.or('payer_guardian_id.eq.X,payer_student_id.in.(child_ids)')`. |
| ~~J3-F8~~ | — | — | **WITHDRAWN** — `partially_paid` is on installments, not invoices. | — | — |
| J3-F9 | LOW | Cosmetic | Client-side `isOverdue` derivation contradicts DB-status filter near day boundary. | `PortalInvoices.tsx:248` | Defer; cron eventually catches up. |
| J3-F10 | LOW | DRY | `currentOrg?.currency_code || 'GBP'` repeated 8 times. | `PortalInvoices.tsx` various | Derived constant at top. |
| J3-F11 | MED | Product UX | Native iOS app shows "visit lessonloop.net" with no escape. Email link likely re-opens app. | `PortalInvoices.tsx:601-606`, `PaymentDrawer.tsx:106-167` | Out of scope — product decision. **Decision (2026-04-28):** Option C — email "Pay invoice" links open Safari direct to the pay page (not the iOS app); in-app unpaid-invoice card opens Safari direct-to-pay-page. No "visit lessonloop.net" wall. |
| J3-F12 | LOW | Display | Line items show `description` only, not the child name from `student_id`. | `PortalInvoices.tsx:553-565` | Resolve student name from `invoice_items.student_id`. |
| J3-F13 | LOW | Errors | `downloadPdf` not awaited at component level. Internal toast handles. | `PortalInvoices.tsx:577` | Defer. |
| ~~J3-F14~~ | — | — | **WITHDRAWN** — `payments` SELECT properly scoped. | — | — |
| J3-F15 | LOW | Branding | Stripe Elements colorPrimary hardcoded `#2563eb`; `org.brand_color` exists. | `PaymentDrawer.tsx:218` | Pull from `currentOrg.brand_color`. |
| J3-F16 | MED | Stripe quota | Each drawer-open creates a new PaymentIntent unless within 300ms close debounce. Chatty. | `PaymentDrawer.tsx:63-78` | Reuse PI within session by invoice + (installmentId or 'remaining' or 'full') key. |
| J3-F17 | **HIGH** | Cache race | Inline payment success animation invalidates query cache before webhook fires. Parent sees "Payment Successful" but list still shows "Awaiting Payment". | `PaymentDrawer.tsx:391-397` | Either poll for `paid_minor` change before showing success, or call a `verify-payment-intent` edge function. |
| J3-F18 | MED | Verification | Embedded `confirmPayment` `return_url` lacks `payment_intent` param consumption. Always falls through to 16s polling. | `PaymentDrawer.tsx:380-381` + `PortalInvoices.tsx:117-126` | Add `verify-payment-intent` edge function; PortalInvoices reads `payment_intent` URL param. |
| J3-F19 | **HIGH** | Refund netting | `stripe-create-payment-intent` calculates `amountDue` from raw `payments.SUM`. Doesn't subtract refunds. Partially-refunded simple invoices rejected as "fully paid". | `supabase/functions/stripe-create-payment-intent/index.ts:118-124` | Replace `amountDue` with `invoice.total_minor - (invoice.paid_minor || 0)`. |
| J3-F20 | LOW | Edge case | Stripe customer email lookup could match across orgs. | `stripe-create-payment-intent:262-264` | Filter `stripe.customers.list` results by metadata `lessonloop_org_id`. |
| J3-F21 | MED | Audit | `stripe-create-payment-intent` writes no `audit_log` entry. Only `stripe_checkout_sessions` row. Inconsistent with canonical audit table convention. (Not HIGH — completion *does* land in audit_log.) | `stripe-create-payment-intent:341-361` | Add `INSERT INTO audit_log` (action='payment_initiated'). |
| ~~J3-F22~~ | — | — | **WITHDRAWN** — `stripe-update-payment-preferences` is per-guardian. | — | — |
| J3-F23 | LOW | Audit | `guardian_payment_preferences` upsert (auto-pay toggle) has no `audit_log` entry. Money-flow-affecting setting. | `stripe-update-payment-preferences/index.ts:51-61` | Add audit_log INSERT. |
| ~~J3-F24~~ | — | — | **WITHDRAWN** — toast handled. | — | — |
| J3-F25 | LOW | Drift | `installmentOutstanding` math duplicated between `stripe-create-payment-intent` and `useParentInstallments`. | edge function + `PaymentPlanInvoiceCard.tsx:40-89` | Extract to a SQL view or a single TS helper imported both ways. |
| ~~J3-F26~~ | — | — | **WITHDRAWN** — refunds parent SELECT scoped. | — | — |
| J3-F27 | MED | Bait UX | Pay button on `partially_paid` installment shows full `amount_minor` not the remaining outstanding. Edge function charges correct amount, but label lies. | `PaymentPlanInvoiceCard.tsx:180, 204` | Use `outstandingMap.get(nextInstallment.id)` for both the displayed amount and button label. |
| J3-F28 | LOW | UX | "Pay remaining" link hidden until `paidCount > 0`. Parent who hasn't paid any installment can't pay-it-all. | `PaymentPlanInvoiceCard.tsx:282` | Drop the `paidCount > 0` guard. |

### J4 — PortalMessages

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J4-F1 | LOW | TZ | `formatMessageTime` and `formatConversationDate` use `format()` without `tz`. CC-4 family. | `PortalMessages.tsx:26-38` | Pass `tz`, switch to `formatInTimeZone`. |
| J4-F2 | **HIGH** | Data corruption | `/<[a-z][\s\S]*>/i.test(msg.body)` mis-classifies plain text containing `<` ("Will my kid be ready by <date>?"). DOMPurify strips the unknown tag → "Will my kid be ready by ?". | `PortalMessages.tsx:76`; same pattern in `ThreadMessageItem.tsx:61` (admin-side, same bug); `PortalMessages.tsx:173` uses sister regex `<[^>]*>` for preview-strip. | Replace heuristic with explicit `body_format` column on `message_log` (text vs html), or always render through `sanitizeHtml` with text passing through cleanly. CC-10. |
| J4-F3 | — | — | (Reserved during walk; merged into J4-F12.) | — | — |
| J4-F4 | LOW | Race | `markAsRead` 800ms timeout captures stale `unreadIds`; new staff message during the wait stays unread. | `PortalMessages.tsx:108-117` | Refetch `unreadIds` inside the timeout closure, or use `useEffect` cleanup chain. |
| J4-F5 | LOW | UX | Auto-scroll on `messages.length` change fights user scroll-up. | `PortalMessages.tsx:120-124` | Detect "user near bottom" before auto-scrolling. |
| J4-F6 | LOW | Edge case | Reply-target falls back to first message if no staff message exists. Odd UX for parent-initiated unanswered threads. | `PortalMessages.tsx:128-130` | If only parent messages exist, target the parent's last message; or block reply until staff replies. |
| J4-F7 | LOW | Data corruption | `lastMessagePreview.replace(/<[^>]*>/g, '')` — naive `<x>` removal strips parent-typed angle brackets. Same hazard as J4-F2. | `PortalMessages.tsx:173` | Use `stripHtml(...)` from sanitize lib. CC-10. |
| J4-F8 | LOW | TZ | Request created_at format with no `tz`. | `PortalMessages.tsx:384` | CC-4. |
| J4-F9 | LOW | TZ | Lesson date on request card with no `tz`. | `PortalMessages.tsx:398` | CC-4. |
| ~~J4-F10~~ | — | — | **WITHDRAWN** — `request.admin_response` rendered as text, React-escaped. | — | — |
| ~~J4-F11~~ | — | — | **WITHDRAWN** — `request.message` rendered as text, React-escaped. | — | — |
| J4-F12 | MED | Realtime scope | `useParentConversations` realtime is `org_id=eq.X` — receives every message_log change in the org. Comment line 47 acknowledges TODO. | `useParentConversations.ts:49-76` | CC-5. |
| J4-F13 | **HIGH** | Data invisibility | Parent's own `parent_enquiry` messages are invisible in their own inbox. Two layers: **RLS** — parent SELECT on `message_log` only matches `recipient_type='guardian'`, so messages parent sent (`recipient_type='staff'`) are denied. **Hook** — `useParentConversations` filters `message_type='parent_reply'` only, never `parent_enquiry`. Result: parent sends "I have a question" → staff replies → parent opens thread → sees only staff reply, not their own message. | RLS migration `20260120215924:52-60`; `useParentConversations.ts:84-132`; also affects `useParentOnboardingProgress.ts:53-58` (CC-F13 — checks wrong table because parent has no SELECT on own sent messages today). | (a) Add RLS policy `Parent can view own sent messages` (`sender_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'parent')`). (b) Update `useParentConversations` to also query `sender_user_id=auth.uid() AND message_type IN ('parent_enquiry','parent_reply')`. (c) Thread-grouping at lines 183–202 already handles via thread_id. (d) Update `useParentOnboardingProgress.hasSentMessage` to query `message_log` by `sender_user_id` instead of `internal_messages` — fixes the dead onboarding checklist item. |
| ~~J4-F14~~ | — | — | (Folded into J4-F13 fix scope — dead outbound query rewritten as part of the same change.) | — | — |
| ~~J4-F15~~ | — | — | **WITHDRAWN** — `message_log` IS the audit trail for messaging. | — | — |
| ~~J4-F16~~ | — | — | **WITHDRAWN** — acceptable design. | — | — |
| ~~J4-F17~~ | — | — | **WITHDRAWN** — escapeHtml/sanitizeHtml on different paths both safe. | — | — |
| ~~J4-F18~~ | — | — | **WITHDRAWN** — `useMessagingSettings` mutation is RLS-blocked for parents. | — | — |
| J4-F19 | LOW | Info disclosure | Parents read full `org_messaging_settings` row via "Org members can read". UI flags only, low concern. | migration `20260223021325:35-37` | Acceptable; or scope SELECT to specific columns via view. |

### J5 — PortalPractice

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J5-F1 | LOW | UX | Hero streak badge picks `activeStreaks[0]` arbitrarily. Multi-child parent with mixed streaks sees one number with no attribution. | `PortalPractice.tsx:60-64` | Show child name on the badge, or aggregate to "best streak" with attribution. |
| J5-F2 | LOW | UX | Same as F1 — first-active selection on the streak hero is arbitrary. | `PortalPractice.tsx:103` | Combine with F1 fix. |
| J5-F3 | **HIGH** | Wrong gamification | `PracticeMilestones` and `WeeklyGoalCard` compute against the **paginated** `allLogs` set (first 50 logs only). Century Club (#100) shows locked for any parent with >50 sessions until they scroll PracticeHistory. "First Practice" picks earliest of *loaded* set, not earliest ever. Month Master needs 20-day months — possibly truncated by pagination. | `PortalPractice.tsx:32-35`; `PracticeMilestones.tsx:15-76`; `WeeklyGoalCard.tsx:40-54` | Move milestone calculation server-side: dedicated lightweight RPC `get_practice_milestones(student_ids)` that returns the four computed dates, OR a `practice_milestones` table written by a trigger when each milestone is hit. |
| J5-F4 | MED | Multi-child semantics | `WeeklyGoalCard` aggregates days across all children when no filter active. "5 days a week" goal can be met by either child practicing those days. Confusing. | `WeeklyGoalCard.tsx:40-54` | Either require child filter for the card to render, or scope per-child internally. Product decision. **Decision (2026-04-28):** Option A — Weekly Goal card requires an active child filter to render. No cross-child aggregation. |
| J5-F5 | MED | Multi-child semantics | `daysPracticed` set-of-dates conflates children. Alice + Bob both Monday = 1 day. | `WeeklyGoalCard.tsx:50` | Same fix as F4. **Decision (2026-04-28):** Option A — Weekly Goal card requires an active child filter to render. No cross-child aggregation. |
| J5-F6 | LOW | TZ | `startOfWeek(new Date(), ...)` browser-local for week boundary. CC-4. | `WeeklyGoalCard.tsx:41-43` | Use `zonedNow(orgTz)` once helper exists. |
| J5-F7 | LOW | Multi-device | Goal in localStorage per-childId, not synced across devices. | `WeeklyGoalCard.tsx:16-24` | Acceptable; or move to a `parent_practice_goals` row keyed on (guardian_id, student_id). |
| J5-F8 | LOW | Cache key | `useWeeklyProgress` query key uses unsorted `studentIds`; ordering changes invalidate cache. | `usePractice.ts:290` | Sort the array in the key. |
| J5-F9 | LOW | TZ | Week boundaries computed in browser TZ for `useWeeklyProgress`. CC-4. | `usePractice.ts:286-287` | Use org TZ. |
| J5-F10 | — | — | (Withdrawn — `practice_streaks` SELECT is properly RLS-scoped via `is_parent_of_student`.) | — | — |
| ~~J5-F11~~ | ~~**HIGH**~~ | ~~RLS hole~~ | ~~`practice_streaks` INSERT/UPDATE policies use `is_org_member(...)`. **Any org member, including parents, can directly INSERT or UPDATE streak rows for any student in their org** — including students they're not the parent of. RLS replaced earlier `WITH CHECK(true)` policies but didn't tighten enough. Legitimate path is the SECURITY DEFINER trigger which bypasses RLS; the loose policies are unnecessary attack surface.~~ | ~~migration `20260315100000:11-16`~~ | ~~Drop INSERT/UPDATE policies entirely (only the `update_practice_streak` SECURITY DEFINER trigger writes). Or tighten WITH CHECK to `is_org_staff(auth.uid(), org_id) OR is_parent_of_student(auth.uid(), student_id)`.~~ [already shipped 2026-03-16 by 20260316310000_fix_practice_tracking_audit.sql §F3 — walker missed; formally accounted for in PR #367] |
| J5-F12 | LOW | TZ | `practice_date` defaults to browser-local `format(new Date(), 'yyyy-MM-dd')` in `useLogPractice` and PracticeTimer quick-log. Org-TZ vs browser-TZ mismatch can cause streak trigger to see future-dated practices. | `usePractice.ts:426`, `PracticeTimer.tsx:265` | CC-4. Use `formatInTimeZone(new Date(), orgTz, 'yyyy-MM-dd')`. |
| J5-F13 | — | — | (Folded into J5-F12 — same root cause.) | — | — |
| J5-F14 | LOW | Race | 60s client-side dedup; two-device race could double-log. | `usePractice.ts:428-437` | Server-side unique constraint, or accept. |
| ~~J5-F15~~ | — | — | **WITHDRAWN** — practice_logs INSERT properly RLS-scoped via `is_parent_of_student`. | — | — |
| J5-F16 | LOW | TZ | `parseISO(log.practice_date)` → browser-local midnight; `startOfWeek` in browser TZ. Week buckets shift across TZ. | `PracticeHistory.tsx:38-39` | CC-4. |
| J5-F17 | LOW | TZ | Day labels use `format` not `formatInTimeZone`. | `PracticeHistory.tsx:121` | CC-4. |
| J5-F18 | LOW | Perf | `useChildrenStreaks` fetches guardian links with no `org_id` filter on guardians; multi-org user → wasted rows. | `usePracticeStreaks.ts:80-88` | Add `.eq('org_id', currentOrg.id)`. |
| J5-F19 | LOW | N+1 | Three sequential auth queries (guardian → links → streaks). Same as J1-F28, J2-F19. | `usePracticeStreaks.ts` | Single RPC across all hooks. |
| J5-F20 | LOW | TZ | `today` for assignment end_date filter is browser-local. | `usePractice.ts:206` | CC-4. |

### J6 — PortalContinuation

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J6-F1 | LOW | UX | TokenResponse useEffect doesn't validate token before user clicks. Comment says "Fetch token details by attempting a 'lookup'" but no fetch happens. Parent finds out token is invalid only on Submit. | `PortalContinuation.tsx:52-63` | Add a GET `/continuation-status?token=X` endpoint that returns student name + term name + deadline, render those before accepting the click. |
| J6-F2 | LOW | UX | `presetAction='continuing'` doesn't auto-submit. Asymmetry with `'withdrawing'` (which shows form). | `PortalContinuation.tsx:60-62` | Either auto-submit on presetAction='continuing' (with an explicit confirm step), or remove the prop. Product decision. |
| ~~J6-F3~~ | — | — | **WITHDRAWN** — Token entropy is `gen_random_bytes(32)` (256-bit), token endpoint is rate-limited per-token. Brute force infeasible. | — | — |
| ~~J6-F4~~ | ~~**HIGH**~~ | ~~RLS leak~~ | ~~"Org members can view continuation runs/responses" RLS on both tables grants every parent the ability to SELECT every other family's continuation responses across the whole org, including: `withdrawal_reason`, `withdrawal_notes` (free text potentially with personal info), `next_term_fee_minor`, `lesson_summary` (lesson titles + fees), and **`response_token`** (= bearer credential for email-link impersonation). The narrower "Parents can view their own continuation responses" policy is dead because RLS policies OR.~~ | ~~migration `20260228100000:33-35, 99-101`~~ | ~~Drop both "Org members can view…" policies. Replace with: (a) "Org staff can view…" using `is_org_staff`. (b) Keep "Parents can view their own continuation responses" — it now becomes load-bearing. (c) For `term_continuation_runs`, add "Parents can view runs they have responses in" via EXISTS join. (d) Long-term: drop `response_token` from columns parents can see — column-level grants or a parent-facing view that strips it. (e) As defense-in-depth, add per-IP rate limit on `/continuation-respond` token path (currently per-token; if tokens leak via this hole, each token has its own bucket).~~ [shipped 2026-04-28, PR #367, migration 20260511100000] |
| ~~J6-F5~~ | ~~**HIGH**~~ | ~~RLS bypass~~ | ~~Parent UPDATE policy on `term_continuation_responses` allows direct supabase-client UPDATEs that **bypass all server-side validation in the edge function**: deadline enforcement, run-status check, `response_method` tagging, `is_processed` flag (parents could mark their withdrawal as processed), `term_adjustment_id`, `next_term_invoice_id`. WITH CHECK only restricts response to ('continuing','withdrawing') and guardian_id ownership. A parent can: (a) submit responses after the deadline, (b) bypass `run.status='deadline_passed'` block, (c) tamper with `is_processed`/`term_adjustment_id` to forge processing state.~~ | ~~migration `20260228100000:111-117`~~ | ~~**Drop the parent UPDATE policy entirely.** Force all parent writes through `continuation-respond` edge function (which already does proper validation). Pattern matches J5-F11 fix.~~ [shipped 2026-04-28, PR #367, migration 20260511100000] |
| J6-F6 | LOW | TZ | `new Date(notice_deadline + 'T00:00:00').toLocaleDateString(...)` parses date in browser-local TZ, can shift display by a day for cross-TZ parents. | `PortalContinuation.tsx:358-368` | CC-4. Use `formatInTimeZone(parseISO(notice_deadline), orgTz, 'd MMMM yyyy')`. |
| J6-F7 | MED | Validation | Confirm Withdrawal button doesn't validate that `withdrawalReason` is selected. Empty submit would succeed. | `PortalContinuation.tsx:415-428` | Add `disabled={!withdrawalReason}` to the button, and server-side enforce in the edge function. |
| ~~J6-F8~~ | — | — | (Folded into J6-F5 — same direct-RLS bypass route.) | — | — |
| J6-F9 | LOW | Defensive | `useParentContinuationPending` `select('*')` retrieves `response_token` and other columns the UI doesn't need. Surfaces token in browser memory. | `useTermContinuation.ts:261-273` | Replace `*` with explicit column list excluding `response_token`. |
| J6-F10 | MED | Audit gap | No `audit_log` entry on continuation response — neither token-based nor portal-based. The response is a contractually significant act with financial implications (commit to next term or trigger refund/withdrawal). Only record is the row update with `response_at`/`response_method`. | `continuation-respond/index.ts` (no calls), no trigger on `term_continuation_responses` | CC-1. Add audit_log writes inside both `handleTokenResponse` and `handlePortalResponse` after the successful UPDATE. Or add an AFTER UPDATE trigger that logs old→new response transitions. |
| J6-F11 | LOW | UX | When token-flow user is logged into a different org, PortalLayout wraps with that org's nav while responding to an email link possibly for a different org. Cosmetic confusion. | `PortalContinuation.tsx:470-486` | Detect token's org via lookup, switch context, or render standalone for token flow regardless of auth state. |
| J6-F12 | LOW | Maintenance | `lesson_summary` JSONB is read untyped by client. No schema enforcement; admin-side mutation could break parent UI silently. | `PortalContinuation.tsx:311, 328-345` | Add a TS interface + validate at the edge function boundary, or normalise the columns into a related table. Out of audit scope. |

### J7 — PortalResources

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| ~~J7-F1~~ | — | — | **WITHDRAWN** — Storage RLS properly scopes parent SELECT via `resource_shares` join. `createSignedUrl` enforces SELECT RLS before issuing URL. | — | — |
| J7-F2 | LOW | Defensive | Download via `<a target="_blank">` with no `rel="noreferrer"` — signed URL exposed in Referrer header on subsequent navigations. Acceptable risk for 1-hour TTL. | `PortalResources.tsx:50` | Add `a.rel = 'noreferrer noopener'`. |
| J7-F3 | LOW | TZ | `format(new Date(resource.created_at), 'dd MMM yyyy')` browser-local. Date label only — TZ skew rarely changes the date. | `PortalResources.tsx:209` | CC-4 (low priority within sweep). |
| ~~J7-F4~~ | — | — | **WITHDRAWN** — `resource_shares` SELECT RLS requires `is_parent_of_student`. Parent only sees shares for own children even when joined to a multi-share resource. | — | — |
| J7-F5 | LOW | Perf | `<AudioPlayer>` creates a signed URL on mount for every audio resource in the list, regardless of whether the parent intends to play. List of 10 audio files = 10 RLS-checked storage requests + 10 refresh timers. | `AudioPlayer.tsx:23-48` | Lazy-init: only generate signed URL on first Play click. Start refresh timer at that point. |
| J7-F6 | — | — | (Cancellation guard correct; no finding.) | — | — |
| J7-F7 | LOW | Reasonable | 55-min refresh inside a 60-min TTL — 5-min safety margin. Reasonable, no fix. | `AudioPlayer.tsx:43` | — |
| J7-F8 | LOW | UX | `playing` state desyncs from system audio controls (lock screen pause). Cosmetic. | `AudioPlayer.tsx:50-58` | Listen to `onPlay`/`onPause` events on the audio element. |
| J7-F9 | — | — | (Signed URL not revokable; standard for the pattern, no fix.) | — | — |
| ~~J7-F10~~ | — | — | **WITHDRAWN** — `useToast` is used in `ResourceDownloadButton`. | — | — |
| J7-F11 | — | — | (Folded into J7-F4.) | — | — |
| J7-F12 | LOW | Defensive | PDF preview `<iframe>` has no `sandbox` attribute. Modern browsers don't execute PDF JS, but defence-in-depth missing. | `ResourcePreviewModal.tsx:103-107` | Add `sandbox="allow-same-origin allow-popups"` (or stricter). |
| J7-F13 | LOW | Billing enforcement | `usePortalFeatures` is a UI-only feature gate. Storage RLS doesn't check plan. A parent on a downgraded org could still call `useSharedResources` directly via DevTools and download. Standard SaaS UI-gate pattern. | `usePortalFeatures.ts`; `useResources.ts:348` | Acceptable UI-only enforcement; or add a server-side check in `useSharedResources` against `org.plan`. Product decision. |

### J8 — PortalProfile

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| J8-F1 | LOW | Hygiene | Parent direct UPDATE on `guardians` works (RLS scoped). WITH CHECK only restricts user_id; columns `email`, `deleted_at` are mutable. Self-harm only (parent corrupts own row). | `PortalProfile.tsx:118-122`; migration `20260222230700` | Tighten WITH CHECK to restrict mutable columns: e.g., a CHECK function or trigger blocking changes to email except via verification flow, and blocking `deleted_at` set by self. |
| J8-F2 | LOW | Hygiene | `profiles` UPDATE policy has no WITH CHECK — only USING. User could mutate `email`, `has_completed_onboarding`, etc. `email` desync from `auth.users.email` is display-only (login uses auth.users). | migration `20260119230917:63-66` | Add `WITH CHECK (auth.uid() = id)` to mirror USING. Optional: column-level trigger blocking `email` updates. |
| J8-F3 | LOW | Hygiene | `notification_preferences` UPDATE policy has no WITH CHECK. User could move row to a different `org_id` or `user_id`. Practical impact limited (unique constraint + service-role-only INSERT post-hardening). | migration `20260123014004:30-32` | Add `WITH CHECK (user_id = auth.uid() AND is_org_member(auth.uid(), org_id))` to mirror INSERT. |
| J8-F4 | — | — | (Folded into J8-F3.) | — | — |
| J8-F5 | LOW | UX | No "Set as default" UI when parent has multiple saved cards. Parent can't choose default. | `PaymentMethodsCard.tsx` | Add a "Make default" action per card row. Calls `stripe-update-payment-preferences` with `defaultPaymentMethodId`. |
| J8-F6 | LOW | Audit gap | No audit_log on payment method removal. CC-1 family. | `stripe-detach-payment-method/index.ts:64-72` | Add audit_log INSERT inside the function after detach. Or audit trigger on `guardian_payment_preferences` already exists — covers `default_payment_method_id` clear; add explicit audit for the detach event. |
| J8-F7 | LOW | Audit gap | No audit_log on auto-pay toggle. Auto-pay is contractually significant (commits parent to future automatic payments). CC-1 family. | `stripe-update-payment-preferences/index.ts:53-62` | Add audit_log INSERT inside the function for `auto_pay_enabled` changes (and `default_payment_method_id` changes). |
| ~~J8-F8~~ | ~~MED~~ | ~~Validation gap~~ | ~~`stripe-update-payment-preferences` accepts `defaultPaymentMethodId` and writes it to DB without validating that the pm belongs to the guardian's Stripe customer. Stripe would refuse cross-customer charges, so practical exploit limited; but DB ends up referencing strangers' pm IDs.~~ | ~~`stripe-update-payment-preferences/index.ts:48-50`~~ | ~~Validate via Stripe `pm.customer === prefs.stripe_customer_id` before persisting (mirror the pattern in `stripe-detach-payment-method:60`).~~ [shipped 2026-04-28, PR #367, edge fn stripe-update-payment-preferences (folded into J8-F9 fix)] |
| ~~J8-F9~~ | ~~**HIGH**~~ | ~~RLS bypass~~ | ~~`guardian_payment_preferences` parent UPDATE policy has no WITH CHECK. Parent can `supabase.from(...).update({ stripe_customer_id: 'cus_other_user' })` directly. The `stripe-create-payment-intent` edge fn (line 250-254) reads `stripe_customer_id` and uses it as the Stripe customer for the charge. Parent can therefore (a) point themselves at another customer's Stripe record, (b) when they go to checkout, Stripe shows that customer's saved cards — **financial cross-charge between users is possible if the attacker can find the target's Stripe customer ID** (which is not particularly secret). Also bypasses J8-F8 validation by skipping the edge function entirely.~~ | ~~migration `20260224152820:42-50`~~ | ~~Drop the parent UPDATE policy entirely. Force all writes through `stripe-update-payment-preferences` and `stripe-detach-payment-method` edge fns, both of which already authenticate properly. Same fix pattern as J6-F5 and J5-F11.~~ [shipped 2026-04-28, PR #367, migration 20260511100000 + edge fn] — but post-deploy SQL verification caught a redundant FOR ALL policy from earlier migration 20260224110000 that bypassed this fix; full closure shipped 2026-04-29 in PR #368 via migration 20260512100000_drop_redundant_guardian_payment_prefs_policies.sql. |

### Cross-cutting walk

| ID | Sev | Category | Finding | Location | Fix sketch |
|---|---|---|---|---|---|
| CC-F1 | — | — | (No finding — `useUnreadMessagesCount` realtime properly scoped to `recipient_id=eq.${guardianId}`. Comment explicitly notes PERF-M5 status correct.) | `useUnreadMessages.ts:18-40` | — |
| CC-F2 | LOW | UX | Mobile parents have no Profile entry in `PortalBottomNav` (6 tabs visible, no Profile). Have to use sidebar drawer instead. | `PortalBottomNav.tsx:9-16` | Add Profile or compress 7 items into 5 by combining Practice/Resources where features overlap. Product decision. |
| CC-F3 | MED | UX regression | `ParentLoopAssist` is mounted in PortalLayout but **no UI affordance opens it for parents**. The Header LoopAssist button is gated `showLoopAssist = ['owner', 'admin', 'teacher'].includes(currentRole)` — staff only. The component contains a comment `// Removed: ParentLoopAssistButton is no longer needed - LoopAssist opens from the Header` — but the Header doesn't gate-allow parents. So parents have no way to open it. Confirmed by March 2026 audit (feature 22) which expected parent-side LoopAssist to be accessible. | `ParentLoopAssist.tsx:273` (comment); `Header.tsx:25` (gate) | Either (a) add `'parent'` to the `showLoopAssist` allowlist in `Header.tsx:25`, or (b) restore the `ParentLoopAssistButton` somewhere parent-visible (sidebar/bottom-nav), or (c) remove the dead-mounted `ParentLoopAssist` from `PortalLayout` and the entire codepath. Product decision: is parent LoopAssist supposed to ship? **Decision (2026-04-28):** Parent LoopAssist does NOT ship. Remove dead-mounted component, hook, and edge function in a future fix PR (option c). |
| CC-F4 | — | — | (No finding — `ReactMarkdown` with `rehypeRaw + rehypeSanitize` for AI output. Sanitisation order correct.) | `ParentLoopAssist.tsx:262-266` | — |
| CC-F5 | — | — | (No finding — conversation history not persisted; ephemeral acceptable.) | `useParentLoopAssist.ts:18` | — |
| CC-F6 | — | — | (No finding — fetch over JWT auth; standard.) | `useParentLoopAssist.ts:53-61` | — |
| CC-F7 | LOW | Money-math (CC-2 family) | `parent-loopassist-chat` invoices query uses `payer_guardian_id` only — same blindspot as J3-F7 / J1-F17. Parent gets a misleading invoice list from the AI ("you have 3 outstanding invoices") missing student-payer cases. | `parent-loopassist-chat/index.ts:169-176` | CC-2 fix needs to apply here too. Either parameterise the query helper or duplicate the OR-branch logic. |
| CC-F8 | LOW | Currency (CC-3 family) | Hardcoded GBP fallback `cc = orgData?.currency_code \|\| "GBP"` and currency symbol mapping in chat. | `parent-loopassist-chat/index.ts:247-248` | CC-3 sweep. |
| CC-F9 | LOW | TZ (CC-4 family) | `now.toLocaleDateString("en-GB", ...)` runs in Deno (UTC) without org TZ context. AI sees UTC date, may answer "Monday" when org's local time is "Sunday evening". | `parent-loopassist-chat/index.ts:264-266` | Inject org TZ into context; format with `formatInTimeZone`. |
| CC-F10 | LOW | Audit gap | No audit_log of LoopAssist queries. Lower priority — same data is already accessible to the parent through UI; LoopAssist is a different surface for the same data. Not blocking; not adding to CC-1. | `parent-loopassist-chat/index.ts` | Optional defence-in-depth. |
| CC-F11 | LOW | Perf | `useProactiveAlerts` is called from `Header.tsx` for parents (since Header is shared) but `enabled: !!currentOrg?.id` doesn't gate on staff role. Hook fires every 60 seconds (`refetchInterval: 60000`) for parents — 5+ Supabase queries every minute that nothing renders. | `Header.tsx:22`; `useProactiveAlerts.ts:171` | Pass `enabled` based on `showNotifications` or staff role check. Or short-circuit at hook level via role check. |
| CC-F12 | — | — | (Not a bug — multi-device welcome dialog acceptable.) | `PortalWelcomeDialog.tsx` | — |
| CC-F13 | LOW | Wrong table (downstream of J4-F13) | `useParentOnboardingProgress.hasSentMessage` queries `internal_messages` (the staff-internal table) instead of `message_log`. **Always returns false for parents.** Onboarding checklist item "Send a message" never marks complete. Once J4-F13 RLS fix lands, this hook should be updated to query `message_log` with `sender_user_id=userId AND message_type IN ('parent_enquiry','parent_reply')`. | `useParentOnboardingProgress.ts:53-58` | Fold into J4-F13 fix scope. |
| CC-F14 | MED | Realtime over-broadcast (CC-5 family) | `useRealtimePortalPayments` listens to `org_id=eq.X` for both invoices UPDATE and payments INSERT. Receives all invoice/payment changes across the whole org. Same wasteful broadcast pattern. | `useRealtimePortalPayments.ts:22-39` | CC-5. Filter by `payer_guardian_id=eq.X` (where the row supports it) or `student_id IN (children)` via a more specific RT subscription. |

---

## Cross-cutting themes (running)

### CC-1 — Audit gap on parent-driven money-or-money-adjacent surfaces
**Findings:** J1-F1, J1-F29, J3-F21, J3-F23, J6-F10, J8-F6, J8-F7
**Pattern:** Several parent surfaces silently skip `audit_log` writes. The 1 April 2026 RLS hardening blocks authenticated INSERTs to `audit_log`, and several SECURITY DEFINER RPCs/edge functions that *could* write audit entries don't.
**Fix shape:** One migration that ensures every parent-action RPC writes `audit_log` for every state-changing call. Surfaces:
- `respond_to_makeup_offer` (RPC) → audit accept/decline
- `cancel_booked_makeup` (new RPC, see J1-F4 fix) → audit cancel
- `stripe-create-payment-intent` (edge fn) → audit payment_initiated
- `stripe-update-payment-preferences` (edge fn) → audit auto_pay_toggled / default_method_changed
- `stripe-detach-payment-method` (edge fn) → audit pm_removed
- `continuation-respond` (edge fn) → audit continuation_response_submitted (token + portal paths both)
**Also:** add audit triggers for `make_up_waitlist` and `term_continuation_responses` themselves (Track 0.1 P1 missed make_up_waitlist; continuation never had audit coverage). The audit trigger on `guardian_payment_preferences` already exists from `20260426174938` — confirm it's recording the events listed above.

### CC-2 — Money-math mismatch (mixed-payer households)
**Findings:** J1-F17, J3-F7, CC-F7
**Pattern:** Code paths filter by `payer_guardian_id` only. Invoices billed directly to a student (e.g. adult-learner students with `payer_student_id` set) silently disappear from per-guardian aggregates. Four surfaces:
- `get_parent_dashboard_data` per-guardian outstanding (RPC)
- `useParentInvoices` query (hook)
- `outstandingMap` derivations downstream
- `parent-loopassist-chat` invoices fetch (edge fn)
**Fix shape:** Single migration replacing both filters with `payer_guardian_id = X OR payer_student_id IN (X's children)`. Three matching code-path changes (hook, RPC, edge fn).

### CC-3 — Hardcoded currency
**Findings:** J1-F15 (HIGH), J3-F2 / F10 / F15 (LOW)
**Pattern:** Some places hardcode `'GBP'` instead of using `currentOrg.currency_code`. claude.md rule explicit. Sweep needed across all portal pages.
**Fix shape:** Single grep/sed pass. After J4–J8 walks I'll have the full list.

### CC-4 — TZ-naïve display & boundary calculation
**Findings:** J1-F13, J2-F8, J2-F12, J2-F13
**Pattern:** Three classes:
1. `formatTimeUK(date)` called without `tz` arg.
2. `startOfToday()` / `selectedDate.getDay()` against browser TZ.
3. Slot generation in `RescheduleSlotPicker` uses `setHours/setMinutes/startOfDay` without `tz`.
**Fix shape:** New `src/lib/zoned.ts` with helpers (`zonedNow(tz)`, `zonedToday(tz)`, `zonedStartOfDay(date, tz)`, `zonedDayOfWeek(date, tz)`). Sweep across portal to use them.

### CC-5 — Realtime subscriptions over-broadcast
**Findings:** J1-F30 (no realtime at all on parent waitlist), J2-F18 (lesson realtime is org-wide firehose), J4-F12 (message_log realtime is org-wide), CC-F14 (`useRealtimePortalPayments` is org-wide on invoices + payments)
**Pattern:** Either no subscription or an unfiltered org-wide one. Each receiver gets every change in the org and the only thing that filters is the `useQuery` invalidation cascade hitting RLS. Compare `useUnreadMessagesCount` which scopes to `recipient_id` correctly.
**Fix shape:** Per-hook decisions; can't be one fix:
- `useRealtimePortalPayments` invoices: `payer_guardian_id=eq.X` (or use a Postgres function to scope across both payer_guardian/payer_student).
- `useRealtimePortalPayments` payments: filter via `invoice_id IN (parent's invoices)` — or accept the org-wide subscription if listing on invoices route only.
- `useParentConversations` realtime: scope by `recipient_id=eq.guardianId` (mirror useUnreadMessagesCount).
- Lessons subscription (J2-F18): student_id `IN` parent's children.

### CC-6 — Org-row over-exposure to parents
**Findings:** J1-F26
**Pattern:** Parents read full `organisations` row including `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `past_due_since`, `cancels_at`, `max_students`, `max_teachers`. Type explicitly enumerates all of these.
**Fix shape:** Either (a) column-level grants on organisations for parent role, or (b) `useOrg` strips sensitive columns when role is parent. Probably (b).

### CC-7 — Hook validation vs RLS source-of-truth
**Findings:** J2-F9
**Pattern:** Validation exists in hooks but not in RLS / RPC. Hook validation is UX, not security.
**Fix shape:** Audit against RLS for every parent INSERT path. Filed as cross-cutting walk after J8.

### CC-8 — Refund netting drift
**Findings:** J3-F19
**Pattern:** Edge function reimplemented "total paid" math without consulting `invoice.paid_minor` (which is canonical, refund-netted via `recalculate_invoice_paid`).
**Fix shape:** One-line replacement in `stripe-create-payment-intent`. Worth a sweep across other edge functions / RPCs that compute "amount due" — could surface more.

### CC-9 — Inline payment success / cache race
**Findings:** J3-F17
**Pattern:** Inline (no-redirect) payment success on PaymentDrawer trusts the webhook to land before UI updates. PortalInvoices' redirect path has polling fallback; inline path doesn't.
**Fix shape:** Either add polling to inline path, or new `verify-payment-intent` edge function called inline.

### CC-10 — HTML-detection regex hazard
**Findings:** J4-F2, J4-F7, plus admin-side `ThreadMessageItem.tsx:61` (out of Area 2 scope but same bug class)
**Pattern:** `/<[a-z][\s\S]*>/i.test(body)` and `body.replace(/<[^>]*>/g, '')` are used to "detect" or "strip" HTML content. Both naively match `<text>` content the user typed. DOMPurify then strips the "tag", corrupting the user's message.
**Fix shape:** Add a `body_format` column on `message_log` (`text` | `html`, default `text`). Sender code sets it explicitly. Renderer dispatches on column, never on regex. Also closes the equivalent admin-side bug at `ThreadMessageItem.tsx:61` — but that's outside Area 2 scope; flag for next portal/admin walk.

---

## HIGH-priority fix briefs to be authored after the cross-cutting walk

In the order I'd ship (by smallest blast radius / cleanest fix first):

1. ~~**J5-F11 — practice_streaks RLS lockdown** — 3-line migration dropping the loose INSERT/UPDATE policies. Closes a vandalism vector (any parent can corrupt any student's streaks in their org). Highest leverage, smallest fix; ship first.~~ [already shipped 2026-03-16; PR #367 formalises the close]
2. ~~**J6-F4 + J6-F5 — term_continuation RLS lockdown (combined brief)** — single migration. Drop "Org members can view continuation runs/responses" policies (replace with staff-only + parent-own). Drop parent UPDATE policy (force all writes through edge function). Closes both findings together: leak + bypass were two facets of the same over-permissive RLS design. Critical: parent-cross-family read includes `response_token` which doubles as a bearer credential.~~ [shipped 2026-04-28, PR #367]
3. ~~**J8-F9 — guardian_payment_preferences RLS lockdown** — single migration. Drop the parent UPDATE policy. Force all writes through `stripe-update-payment-preferences` + `stripe-detach-payment-method` edge fns. Closes financial cross-charge vector (parent could mutate `stripe_customer_id` to point at another user's Stripe record, then charge their saved cards via checkout). Same pattern as #1 and #2.~~ [shipped 2026-04-28, PR #367; full closure 2026-04-29, PR #368]
4. **CC-3 hardcoded currency sweep** — single PR after full sweep complete (J1-F15 + any cross-cutting finds). Doc-only changes once the list is final, plus literal text replacements.
5. **J2-F24 — location reschedule policy override resolved** — small page change in PortalSchedule.
6. **CC-2 money-math mismatch** — single migration changes `get_parent_dashboard_data`; hook change in `useParentInvoices`. Closes J1-F17 + J3-F7.
7. **J3-F19 refund netting in payment-intent** — one-line edge function fix. Lovable deploys.
8. **J1-F4 cancel-booked-makeup RPC** — new SECURITY DEFINER RPC; PortalHome change to call it; deletes deprecated raw UPDATE. Lovable applies migration.
9. **CC-1 audit gaps** — single migration adds audit_log writes inside the relevant SECURITY DEFINER paths and audit triggers on `make_up_waitlist` + `term_continuation_responses`. Closes J1-F1 + J1-F29 + J6-F10 + J8-F6 + J8-F7 (and folds J3-F21/F23 if scope allows).
10. **J4-F13 parent's own messages invisible** — RLS policy add + hook query rewrite. Two-part fix (RLS migration + Lovable hook change). High-confidence one-shot.
11. **J5-F3 milestone server-side compute** — new RPC `get_practice_milestones(student_ids)` that does the full-history math; drop `allLogs` prop drilling on PortalPractice. Or trigger-driven `practice_milestones` table. Pick one in the brief.
12. **CC-10 HTML-detection regex hazard** — add `body_format` column migration + sender + renderer changes. Single PR, touches PortalMessages and admin-side ThreadMessageItem.
13. **CC-4 TZ-naïve sweep** — new `lib/zoned.ts`, replace callsites in PortalHome, PortalSchedule, PortalMessages, PortalPractice, PortalContinuation, PortalResources, RescheduleSlotPicker, PracticeHistory, PracticeTimer, useWeeklyProgress, useLogPractice, useParentPracticeAssignments, WeeklyGoalCard. Closes J1-F13 + J2-F8 + J2-F12 + J2-F13 + J4-F1 + J4-F8 + J4-F9 + J5-F6 + J5-F9 + J5-F12 + J5-F16 + J5-F17 + J5-F20 + J6-F6 + J7-F3. Largest single fix; do last.
14. **J3-F17 inline-success cache race** — add `verify-payment-intent` edge function; PaymentDrawer waits for verification before showing success. New edge fn → Lovable deploys.

That ordering puts the **three RLS holes first** (J5-F11, J6-F4+F5, J8-F9) — they share the same pattern (loose policies that don't restrict columns or bypass an edge function), are the smallest fixes with the biggest security impact, and are migration-only with no UI changes. After those, the standard priority order applies. TZ sweep last for the same validation reason.

---

## MED fix briefs (deferred, batch into per-area cleanup commits at end of Area 2)

J1-F2, J1-F5, J1-F6, J1-F13 (rolled into CC-4), J1-F26 (CC-6), J1-F30 (CC-5), J2-F3, J2-F8 (CC-4), J2-F13 (CC-4), J2-F14, J2-F18 (CC-5), J2-F25, J3-F3, J3-F5, J3-F11 (product decision — escalate), J3-F16, J3-F18, J3-F21 (CC-1), J3-F27, J4-F12 (CC-5), J5-F4, J5-F5, J6-F7, J6-F10 (CC-1), J8-F8, CC-F3 (product decision — escalate), CC-F14 (CC-5).

## LOW fix briefs (batch into per-area cleanup commits at end of Area 2)

J1-F3, J1-F7, J1-F8, J1-F9, J1-F11, J1-F14, J1-F16, J1-F19, J1-F20, J1-F21, J1-F22, J1-F23, J1-F24, J1-F25, J1-F27, J1-F28, J2-F1, J2-F6, J2-F7 (product decision), J2-F10, J2-F15, J2-F16, J2-F17, J2-F19, J2-F20, J2-F22, J2-F23, J2-F26, J3-F2, J3-F4, J3-F9, J3-F10, J3-F12, J3-F13, J3-F15, J3-F20, J3-F23 (CC-1), J3-F25, J3-F28, J4-F1 (CC-4), J4-F4, J4-F5, J4-F6, J4-F7 (CC-10), J4-F8 (CC-4), J4-F9 (CC-4), J4-F19, J5-F1, J5-F2, J5-F6 (CC-4), J5-F7, J5-F8, J5-F9 (CC-4), J5-F12 (CC-4), J5-F14, J5-F16 (CC-4), J5-F17 (CC-4), J5-F18, J5-F19, J5-F20 (CC-4), J6-F1, J6-F2, J6-F6 (CC-4), J6-F9, J6-F11, J6-F12, J7-F2, J7-F3 (CC-4), J7-F5, J7-F8, J7-F12, J7-F13, J8-F1, J8-F2, J8-F3, J8-F5, J8-F6 (CC-1), J8-F7 (CC-1), CC-F2, CC-F7 (CC-2), CC-F8 (CC-3), CC-F9 (CC-4), CC-F10, CC-F11, CC-F13 (folds into J4-F13).

---

## Stale-doc flags surfaced during the walk

- `docs/archive/audit-2026-03/audit-feature-22-parent-portal.md` — the F-01 "stripe-create-payment-intent missing guardian-invoice ownership check" finding is **closed in code** but the doc shows it as open. Fine, it's archived; just noting that the archive can't be trusted as a source of "still open" findings.
- `docs/AUDIT_LOG_AUDIT_2026-04-26.md` — coverage list does not include `make_up_waitlist`. Track 0.1 follow-up needed (folded into CC-1 above).
- `docs/MIGRATION_CONVENTIONS.md` — not yet read; I'll read it before authoring the migration in fix #3 / #6.
- `docs/SECURITY_MODEL.md` — verified parent-RBAC section against actual RLS for the tables I touched. Did not exhaustively cross-check.

---

## Next session: start with fix-brief authoring

**State:** All audit walks complete. No new walks needed. Move directly to authoring fix briefs in the order listed in the HIGH-priority section above.

**First three to ship (all migration-only, no UI changes, ship as separate PRs):**

1. **J5-F11 — practice_streaks RLS lockdown.** Drop `Users can insert own streaks` and `Users can update own streaks` from migration `20260315100000`. Verify `update_practice_streak` SECURITY DEFINER trigger still fires correctly (it bypasses RLS). New migration file in `supabase/migrations/`. Ready-to-paste Lovable prompt.

2. **J6-F4 + J6-F5 — term_continuation RLS lockdown.** Single migration that:
   - Drops `Org members can view continuation runs` on `term_continuation_runs`
   - Drops `Org members can view continuation responses` on `term_continuation_responses`
   - Drops `Parents can update their own continuation responses` on `term_continuation_responses`
   - Adds `Org staff can view continuation runs` (`is_org_staff(auth.uid(), org_id)`)
   - Adds `Org staff can view continuation responses` (`is_org_staff`)
   - Adds `Parents can view runs they have responses in` via EXISTS join
   - Keeps existing `Parents can view their own continuation responses` (now load-bearing)
   - Verify `continuation-respond` edge fn already does proper validation (it does, per audit walk).

3. **J8-F9 — guardian_payment_preferences RLS lockdown.** Drop `Parents can update own payment preferences` from migration `20260224152820`. Force all parent writes through `stripe-update-payment-preferences` and `stripe-detach-payment-method` (already authenticated). Also fold J8-F8 into the same brief: add Stripe-customer ownership validation in `stripe-update-payment-preferences:48-50` mirroring the pattern in `stripe-detach-payment-method:60`.

**For each brief:**
- Migration filename per `docs/MIGRATION_CONVENTIONS.md` conventions (read first).
- Ready-to-paste Lovable prompt for the migration deploy + verification.
- Manual smoke-test checklist (e.g., for #1: parent attempts direct INSERT on practice_streaks in supabase JS console — should fail; legitimate practice log via UI still increments streaks).
- Direct PR URL for review.

**After the first three RLS lockdowns ship and verify, continue down the priority list:** #4 CC-3 currency sweep, #5 J2-F24, #6 CC-2, etc.

**Open product decisions to surface to Jamie before authoring corresponding briefs:**
- ~~**CC-F3** — Is parent LoopAssist supposed to ship?~~ **Resolved 2026-04-28: NO. Remove dead code in future fix PR.**
- ~~**J3-F11** — Native iOS payment redirect UX.~~ **Resolved 2026-04-28: Option C (Safari direct-to-pay-page).**
- ~~**J5-F4 / J5-F5** — Multi-child weekly goal semantics.~~ **Resolved 2026-04-28: Option A (require child filter).**

**All Area 2 product decisions resolved. Ready to author fix briefs.**

**Ready to start.**
