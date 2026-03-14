# LessonLoop Codebase Bug Audit Report

**Date:** 2026-03-14
**Auditor:** Claude Code (automated)
**Scope:** Full codebase — `/home/user/lessonloop3/src/`, `supabase/functions/`, `supabase/migrations/`
**Mode:** Read-only audit. No fixes applied.

---

## Table of Contents

1. [Hardcoded Values & Leaks](#category-1-hardcoded-values--leaks)
2. [Currency & Locale Bugs](#category-2-currency--locale-bugs)
3. [Timezone Bugs](#category-3-timezone-bugs)
4. [Null/Undefined Crashes](#category-4-nullundefined-crashes)
5. [Missing Error Handling](#category-5-missing-error-handling)
6. [Double-Click / Race Conditions](#category-6-double-click--race-conditions)
7. [Missing RLS Policies](#category-7-missing-rls-policies)
8. [Edge Function Auth](#category-8-edge-function-auth)
9. [Orphan Features / Dead Code](#category-9-orphan-features--dead-code)
10. [Accessibility Gaps](#category-10-accessibility-gaps)
11. [Security — Missing Input Validation](#category-11-security--missing-input-validation)
12. [Stripe Integration](#category-12-stripe-integration)
13. [Summary](#summary)

---

## Category 1: Hardcoded Values & Leaks

### [CAT-1] [HIGH] — Hardcoded fallback URL uses wrong domain
**File:** `src/components/settings/BookingPageTab.tsx:108`
**Issue:** Fallback URL is `'https://app.lessonloop.com'` — the actual domain is `lessonloop.net`. If this fallback is ever reached (SSR/non-browser context), booking page links will point to a non-existent domain.
**Impact:** Broken booking page URLs in edge cases.
**Fix:** Change to `'https://app.lessonloop.net'` or use an environment variable.

### [CAT-1] [HIGH] — Hardcoded marketing base URL
**File:** `src/config/routes.ts:80` and `src/config/routes-ssg.ts:13`
**Issue:** `const MARKETING_BASE = 'https://lessonloop.net'` is hardcoded. If the domain changes, multiple files need updating.
**Impact:** Fragile coupling to domain name.
**Fix:** Extract to environment variable `VITE_MARKETING_URL`.

### [CAT-1] [MEDIUM] — Performance TODOs indicating unbounded real-time listeners
**File:** `src/hooks/useCalendarData.ts:199`
**Issue:** `// TODO (PERF-M5): This subscribes to ALL lesson changes org-wide. At scale, consider...`
**Impact:** At scale, every lesson change triggers re-render for every connected client in the org.
**Fix:** Filter real-time subscriptions by teacher_id or date range.

**File:** `src/hooks/useInternalMessages.ts:39`
**Issue:** `// TODO (PERF-M5): Subscribes to all INSERT events on internal_messages for the org.`
**Impact:** Same unbounded subscription pattern.

**File:** `src/hooks/useMessageThreads.ts:112`
**Issue:** `// TODO (PERF-M5): Subscribes to all INSERT events on message_log for the org.`
**Impact:** Same unbounded subscription pattern.

**File:** `src/hooks/useParentConversations.ts:47`
**Issue:** `// TODO (PERF-M5): Subscribes to ALL message_log changes for the org.`
**Impact:** Same unbounded subscription pattern.

**File:** `src/hooks/useRealtimeInvoices.ts:14`
**Issue:** `// TODO (PERF-M5): This opens 4 org-wide postgres_changes listeners.`
**Impact:** 4 simultaneous unbounded listeners on invoices-related tables.

### [CAT-1] [LOW] — Console statements in production code (8 total)
**Files:**
- `src/hooks/useEnrolmentWaitlist.ts` (2 occurrences)
- `src/hooks/useStripeElements.ts` (1)
- `src/hooks/useGradeChangeHistory.ts` (1)
- `src/lib/native/camera.ts` (2)
- `src/lib/native/deepLinks.ts` (1)
- `src/pages/public/BookingPage.tsx` (1)

**Issue:** 8 console.log/warn/error statements remain in production code.
**Impact:** Debug noise in browser console; minor information leakage.
**Fix:** Remove or replace with structured logger.

---

## Category 2: Currency & Locale Bugs

### [CAT-2] [HIGH] — Hardcoded GBP symbol in app components (breaks multi-currency orgs)
**File:** `src/components/waitlist/WaitlistEntryDetail.tsx:199`
**Issue:** `£{(entry.offered_rate_minor / 100).toFixed(2)}` — Hardcoded `£` and manual division by 100 instead of using `formatCurrencyMinor()`.
**Impact:** Orgs using EUR/USD/AUD see wrong currency symbol.
**Fix:** Use `formatCurrencyMinor(entry.offered_rate_minor, currentOrg?.currency_code)`.

**File:** `src/components/students/TeachingDefaultsCard.tsx:190`
**Issue:** `£{(rate.rate_amount / 100).toFixed(2)}` — Same pattern.
**Impact:** Wrong symbol for non-GBP orgs.

**File:** `src/components/teachers/TeacherQuickView.tsx:200`
**Issue:** `£{(teacher.pay_rate_value ?? 0).toFixed(2)}` — Same pattern.
**Impact:** Wrong symbol for non-GBP orgs.

**File:** `src/components/settings/BillingTab.tsx:124`
**Issue:** `<span className="text-4xl font-semibold">£{currentPrice}</span>` — Stripe billing display hardcoded to £.
**Impact:** Incorrect currency display for non-GBP Stripe billing.

### [CAT-2] [HIGH] — Inconsistent currency symbol resolution (ad-hoc ternaries)
**File:** `src/components/invoices/CreateInvoiceModal.tsx:345,372`
**Issue:** `currentOrg?.currency_code === 'GBP' ? '£' : currentOrg?.currency_code || '£'` — Manual ternary instead of `currencySymbol()` utility.
**Impact:** Only handles GBP explicitly; other currencies show raw code like "EUR".
**Fix:** Use `currencySymbol(currentOrg?.currency_code)` from `src/lib/utils.ts`.

**File:** `src/components/invoices/RefundDialog.tsx:204`
**Issue:** `{currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'}` — Manual mapping misses AUD, CAD, NZD.
**Impact:** AUD/CAD/NZD orgs see `$` instead of their specific currency symbol.

**File:** `src/components/students/IssueCreditModal.tsx:37`
**Issue:** `const currencySymbol = currentOrg?.currency_code === 'GBP' ? '£' : '$'` — Binary choice ignores EUR and other currencies.
**Impact:** EUR orgs see `$` instead of `€`.

### [CAT-2] [MEDIUM] — Duplicate currency formatting functions
**File:** `src/components/students/MakeUpCreditsPanel.tsx:27-32`
**Issue:** Custom `formatCurrency()` function duplicates `formatCurrencyMinor()` from `src/lib/utils.ts`.
**Impact:** Inconsistent formatting; maintenance burden.

**File:** `src/components/settings/BillingTab.tsx:992-997`
**Issue:** Custom `formatAmount()` function instead of using central utility.

**File:** `src/components/dashboard/PaymentAnalyticsCard.tsx:44-47`
**Issue:** Custom `formatYAxis()` with abbreviated amounts.

### [CAT-2] [MEDIUM] — Missing currency parameter in formatCurrency calls
**File:** `src/components/students/MakeUpCreditsPanel.tsx:131`
**Issue:** `formatCurrency(credit.credit_value_minor)` — no currency parameter; silently defaults to GBP.
**Impact:** Non-GBP orgs see amounts formatted as GBP.

**File:** `src/components/students/StudentTabsSection.tsx:247`
**Issue:** `formatCurrencyMinor(inv.total_minor)` — missing currency parameter.

### [CAT-2] [MEDIUM] — Manual division by 100 instead of formatCurrencyMinor()
**Files:**
- `src/components/waitlist/WaitlistEntryDetail.tsx:199`
- `src/components/invoices/PaymentPlanSetup.tsx:402-403`
- `src/components/invoices/RecordPaymentModal.tsx:147`
- `src/components/invoices/RefundDialog.tsx:211`
- `src/components/students/TeachingDefaultsCard.tsx:190`
- `src/components/teachers/TeacherQuickView.tsx:200`

**Issue:** `(amount_minor / 100).toFixed(2)` pattern used instead of the centralized `formatCurrencyMinor()` utility.
**Impact:** Inconsistent number formatting (no locale-aware grouping, no currency-specific decimals).
**Fix:** Replace all with `formatCurrencyMinor(amount, currencyCode)`.

### [CAT-2] [LOW] — Inconsistent Intl.NumberFormat locale
**File:** `src/components/invoices/RecordPaymentModal.tsx:62`
**Issue:** Uses `'en'` locale instead of `'en-GB'`.
**Impact:** Minor formatting differences (comma vs period placement in edge cases).

### [CAT-2] [LOW] — Date formatting is correct (no issues found)
All date formats use UK convention (`dd/MM/yyyy`). No US-format `MM/dd` patterns found in `src/`.

---

## Category 3: Timezone Bugs

### [CAT-3] [HIGH] — TeacherAvailabilityTab uses browser timezone for filtering AND time extraction
**File:** `src/components/settings/TeacherAvailabilityTab.tsx:130-137`
**Issue:** Line 130 uses `new Date().toISOString()` for filtering. Lines 135-137 use `getHours()` and `getDay()` on UTC ISO strings parsed as local time. This is a double bug: wrong filter boundary AND wrong time extraction.
**Impact:** Teacher availability calculations completely broken when device timezone differs from Europe/London. Lessons matched to wrong availability blocks.
**Fix:** Use `toZonedTime(new Date(), orgTimezone)` for the current time, and convert lesson times before extracting hours/day.

### [CAT-3] [HIGH] — Teachers.tsx uses browser timezone for future lesson filtering
**File:** `src/pages/Teachers.tsx:339,374,388`
**Issue:** `.gte('start_at', new Date().toISOString())` — Compares UTC lesson timestamps against browser's UTC "now" without org timezone awareness.
**Impact:** When removing teachers, users in non-London timezones may see incorrect future lessons for cancellation.
**Fix:** Calculate "now" using org timezone: `fromZonedTime(new Date(), orgTimezone).toISOString()`.

### [CAT-3] [HIGH] — Locations.tsx uses browser timezone for usage stats
**File:** `src/pages/Locations.tsx:191,502`
**Issue:** `.gte('start_at', new Date().toISOString())` — Same pattern as Teachers.tsx.
**Impact:** Location usage stats may be incorrect based on user's device timezone.

### [CAT-3] [HIGH] — PortalHome greeting uses browser time instead of org timezone
**File:** `src/pages/portal/PortalHome.tsx:309-314`
**Issue:** `new Date().getHours()` used for greeting logic ("Good morning/afternoon/evening") and background gradient. DashboardHero.tsx correctly uses `toZonedTime(new Date(), tz).getHours()` — PortalHome does not.
**Impact:** UK parents in other timezones see wrong greeting and wrong background color.
**Fix:** Match the DashboardHero pattern: `toZonedTime(new Date(), orgTimezone).getHours()`.

### [CAT-3] [HIGH] — UrgentActions uses browser timezone for past lesson filtering
**File:** `src/hooks/useUrgentActions.ts:41`
**Issue:** `.lt('end_at', new Date().toISOString())` — Filters past lessons using browser UTC.
**Impact:** Wrong urgent actions shown when device timezone differs from Europe/London.

### [CAT-3] [MEDIUM] — 21 instances of .toLocaleDateString() using browser locale
**Files:**
- `src/pages/Continuation.tsx` (3 instances)
- `src/pages/portal/PortalContinuation.tsx` (1)
- `src/pages/public/BookingPage.tsx` (1)
- `src/components/continuation/ContinuationRunWizard.tsx` (1)
- `src/components/continuation/ContinuationResponseDetail.tsx` (3)
- `src/components/invoices/RefundDialog.tsx` (1)
- `src/components/term-adjustments/AdjustmentHistoryPanel.tsx` (2)
- `src/components/term-adjustments/AdjustmentPreviewCard.tsx` (2)
- `src/components/students/StudentInfoCard.tsx` (1)
- `src/components/settings/PendingInvitesList.tsx` (2)
- `src/hooks/useLeadAnalytics.ts` (1)
- `src/hooks/useLeadActivities.ts` (1)
- `src/components/messages/BulkComposeModal.tsx` (1)

**Issue:** `.toLocaleDateString()` uses the browser's locale and timezone, not the org's configured timezone.
**Impact:** Dates may display in US format (MM/DD/YYYY) or wrong day for users in non-London timezones.
**Fix:** Replace with `formatDateUK()` or `formatDateForOrg()` using org timezone.

### [CAT-3] [MEDIUM] — PortalHome expiry checks may cross day boundaries incorrectly
**File:** `src/pages/portal/PortalHome.tsx:639,645,771`
**Issue:** `isBefore(new Date(), parseISO(entry.expires_at))` — Uses browser UTC for expiry comparison. If expiry times represent org-timezone-aware boundaries, this is wrong.
**Impact:** Offers/entries may appear expired or active at the wrong time near midnight in different timezones.

### [CAT-3] [LOW] — Statistics: 209 `new Date()` instances, only 83 timezone conversions
**Issue:** Across 99 files, `new Date()` is used 209 times. Only 83 timezone-aware conversions exist across 15 files. The remaining ~126 instances may or may not need conversion depending on context, but the inconsistency indicates timezone awareness is not systematic.

---

## Category 4: Null/Undefined Crashes

### [CAT-4] [HIGH] — Set constructor crashes on undefined from failed Supabase query
**File:** `src/pages/Students.tsx:447`
**Issue:** `return new Set(data?.map(d => d.payer_student_id)).size;` — If `data` is null, `data?.map()` returns `undefined`, and `new Set(undefined)` throws "Set initializer must be iterable".
**Impact:** StudentsOverdueBanner crashes the entire page when the overdue invoice query fails (network error, permission issue).
**Fix:** `new Set(data?.map(d => d.payer_student_id) ?? []).size`.

### [CAT-4] [MEDIUM] — CalendarPage teachers.map() without defensive chaining
**File:** `src/pages/CalendarPage.tsx:208`
**Issue:** `teachers={teachers.map(t => ({ id: t.id, name: t.name }))}` — `teachers` defaults to `[]` via the hook, but no optional chaining on `.map()`. If the hook fails before applying defaults, this crashes.
**Impact:** Calendar page crashes if useTeachersAndLocations hook fails mid-initialization.
**Fix:** `teachers={(teachers ?? []).map(t => ({ id: t.id, name: t.name }))}`.

### [CAT-4] [MEDIUM] — CalendarPage destructuring assumes all hook values exist
**File:** `src/pages/CalendarPage.tsx:34`
**Issue:** `const { teachers, locations, rooms, instruments } = useTeachersAndLocations();` — Destructuring without fallbacks. If hook returns partial data, downstream code crashes.
**Impact:** Calendar page crashes with "Cannot read property 'map' of undefined" if any hook field is missing.

### [CAT-4] [LOW] — Invoices page filter chains on array (safe but brittle)
**File:** `src/pages/Invoices.tsx:85-92`
**Issue:** Chained `.filter().filter()` patterns on the `invoices` array. Currently safe because `invoices` defaults to `[]`, but no intermediate null checks.
**Impact:** Would crash if the default fallback mechanism changes.

### [CAT-4] [LOW] — Dashboard stats uses proper nullish coalescing (no issue)
**File:** `src/pages/Dashboard.tsx:193-198`
**Issue:** All `stats?.property ?? 0` patterns are correctly handled. No crash risk.

---

## Category 5: Missing Error Handling

### [CAT-5] [CRITICAL] — Lesson deletion ignores query error, may delete entire recurring series
**File:** `src/components/calendar/LessonDetailPanel.tsx:415-419`
**Issue:** When deleting recurring lessons, the query to fetch future lessons doesn't check the error field:
```typescript
const { data: futureLessons } = await supabase
  .from('lessons').select('id')
  .eq('recurrence_id', lesson.recurrence_id!)
  .gte('start_at', lesson.start_at);
```
If this query fails, `futureLessons` is null, and `(futureLessons || []).map()` returns an empty array. The subsequent delete operation may then fall through to a broader delete path, potentially deleting ALL lessons in the recurrence instead of just future ones.
**Impact:** Data loss — entire recurring lesson series deleted instead of just future lessons.
**Fix:** Check `error` field and abort if the future lessons query fails.

### [CAT-5] [HIGH] — Bulk message recipient queries silently fail
**File:** `src/hooks/useBulkMessage.ts:97-145`
**Issue:** 5 sequential Supabase queries in `useRecipientPreview` (lines 97, 110, 117, 135, 140) destructure only `data` without checking `error`. If any query fails, the function silently returns empty/partial recipient lists.
**Impact:** Bulk messages may be sent to fewer recipients than expected with no error shown to user.
**Fix:** Check `error` on each query; throw or surface errors to the UI.

### [CAT-5] [HIGH] — Widespread missing error checks in hooks
**Files and approximate line counts:**
- `src/hooks/useReports.ts` — 2 unguarded queries
- `src/hooks/useTeacherAvailability.ts` — 2 unguarded queries
- `src/hooks/useRegisterData.ts` — 8 unguarded queries
- `src/hooks/useDeleteValidation.ts` — 4 unguarded queries

**Issue:** Database queries destructure only `{ data }` without checking the `error` field returned by Supabase.
**Impact:** Silent data loss, incomplete UI states, incorrect business logic decisions.
**Fix:** Destructure `{ data, error }` and handle error cases (throw, log, or surface to UI).

---

## Category 6: Double-Click / Race Conditions

### [CAT-6] [MEDIUM] — Invoice list dropdown actions lack double-click protection
**File:** `src/components/invoices/InvoiceList.tsx:154,161,165,174`
**Issue:** DropdownMenuItem onClick handlers (`onSend`, `onMarkPaid`, `onSendReminder`, `onVoid`) fire immediately without disabled state. Rapid clicking calls the handler multiple times.
**Impact:** Potential duplicate invoice sends, duplicate payment recordings, or double-void operations. While the underlying mutations may have `isPending` guards, the dropdown UI doesn't prevent the second click from queuing.
**Fix:** Add `disabled` prop to DropdownMenuItems based on mutation `isPending` state, or debounce handlers.

### [CAT-6] [MEDIUM] — Various mutation calls on click without button disable
**Files:**
- `src/components/makeups/NeedsActionSection.tsx` — `onClick={() => dismissMutation.mutate(entry.id)}`
- `src/components/settings/ZoomIntegrationTab.tsx` — `onClick={() => disconnectCalendar.mutate({...})}`
- `src/components/settings/BrandingTab.tsx` — `onClick={() => saveMutation.mutate()}`
- `src/components/settings/ProfileTab.tsx` — Multiple onClick mutation calls

**Issue:** Mutation calls bound directly to onClick without corresponding `disabled={mutation.isPending}` on the button.
**Impact:** Double-clicks can fire duplicate mutations.
**Fix:** Add `disabled={mutation.isPending}` to each button.

### [CAT-6] [LOW] — Bulk lesson actions lack idempotency guard
**File:** `src/hooks/useBulkLessonActions.ts:54-103`
**Issue:** The `bulkUpdate` function sets `isBulkUpdating(true)` but has no guard preventing a second call before the first completes.
**Impact:** Unlikely in practice (UI usually prevents), but theoretically two bulk operations could run simultaneously.

### [CAT-6] [LOW] — Well-protected patterns (no issues)
- `src/components/invoices/SendInvoiceModal.tsx:289` — `disabled={isSending}` with try/finally
- `src/components/invoices/RecordPaymentModal.tsx:183` — `disabled={recordPayment.isPending}`
- `src/components/calendar/LessonDetailPanel.tsx:471-520` — `disabled={actionInProgress}` on all action buttons

---

## Category 7: Missing RLS Policies

### [CAT-7] [CRITICAL] — teachers_with_pay view has no RLS policy
**File:** `src/hooks/usePayroll.ts:113`
**Issue:** The `teachers_with_pay` database view is queried from client code but has no RLS policy in the migrations. This view contains sensitive payroll information (teacher pay rates, salary structures).
**Impact:** Any authenticated user in the org could query this view directly via the Supabase client, potentially accessing teacher compensation data regardless of their role.
**Fix:** Add RLS policy to restrict `teachers_with_pay` to owner/admin/finance roles only.

---

## Category 8: Edge Function Auth

### [CAT-8] [MEDIUM] — booking-get-slots has no user authentication
**File:** `supabase/functions/booking-get-slots/index.ts`
**Issue:** No `getUser()`, `getClaims()`, or Authorization header check. Uses SERVICE_ROLE_KEY to bypass RLS (line 77-80). Only protection is IP-based rate limiting (20 req/min).
**Impact:** Any attacker can enumerate booking pages by slug and retrieve teacher availability, names, and booking configuration without authentication.
**Fix:** Add authentication check, or ensure only public-safe data is exposed. Rate limiting alone is insufficient against determined attackers.

### [CAT-8] [LOW] — calendar-ical-feed uses token-based auth (acceptable)
**File:** `supabase/functions/calendar-ical-feed/index.ts`
**Issue:** No user authentication — uses iCal token-based access with expiry validation.
**Impact:** Low — token acts as shared secret; expiry provides time-limited access. This is the standard pattern for iCal feed subscriptions.

### [CAT-8] [LOW] — waitlist-respond uses JWT token auth (acceptable)
**File:** `supabase/functions/waitlist-respond/index.ts`
**Issue:** No user authentication — uses cryptographic JWT signature verification.
**Impact:** Low — JWT in URL is cryptographically signed; payload validated against database records. Standard pattern for email-link workflows.

---

## Category 9: Orphan Features / Dead Code

### [CAT-9] [LOW] — 2 unused hooks (dead code)
**Files:**
- `src/hooks/useNativeFeatures.ts` — Native device haptics, status bar, keyboard APIs. 0 imports anywhere.
- `src/hooks/useNativeNetwork.ts` — Enhanced network status detection via Capacitor. 0 imports anywhere.

**Issue:** These hooks are defined but never imported or used.
**Impact:** Code bloat; maintenance burden; confusion for developers.
**Fix:** Delete both files.

### [CAT-9] [LOW] — 20+ unused marketing components (dead code)
**Files:**
- `src/components/marketing/UseCaseHero.tsx`
- `src/components/marketing/UseCasePainPoints.tsx`
- `src/components/marketing/UseCaseTestimonial.tsx`
- `src/components/marketing/UseCaseFeatures.tsx`
- `src/components/marketing/FeaturesSection.tsx`
- `src/components/marketing/CredibilityStrip.tsx`
- `src/components/marketing/BentoFeatures.tsx`
- `src/components/marketing/LogoMarquee.tsx`
- `src/components/marketing/StatsCounter.tsx`
- `src/components/marketing/LogoCloud.tsx`
- `src/components/marketing/FeaturePageHowItWorks.tsx`
- `src/components/marketing/FeaturePageCTA.tsx`
- `src/components/marketing/FeaturePageProblem.tsx`
- `src/components/marketing/FeaturePageRelated.tsx`
- `src/components/marketing/FeaturePageHero.tsx`
- `src/components/marketing/FeaturePageSolution.tsx`
- `src/components/marketing/AudiencePaths.tsx`

**Issue:** Exported but never imported anywhere. Likely remnants from a marketing site refactor.
**Impact:** ~17 files of dead code increasing bundle size (if not tree-shaken) and maintenance burden.
**Fix:** Delete all unused marketing components.

### [CAT-9] [LOW] — 2 unused filter wrapper components
**Files:**
- `src/components/invoices/InvoiceFiltersBarWithHelp.tsx`
- `src/components/calendar/CalendarFiltersBarWithHelp.tsx`

**Issue:** Wrapper components that combine filters with help tooltips. The base filter components are used instead throughout the app.
**Impact:** Abandoned refactoring attempts; confusion for developers.
**Fix:** Delete both files.

---

## Category 10: Accessibility Gaps

### [CAT-10] [LOW] — onClick on non-interactive div/span elements (3 instances)
**Files:**
- `src/components/invoices/InvoiceList.tsx:216` — `<div onClick={(e) => e.stopPropagation()}>`
- `src/components/invoices/InvoiceList.tsx:409` — Same pattern
- `src/components/messages/ThreadCard.tsx:152` — `<span onClick={(e) => e.stopPropagation()}>`

**Issue:** onClick handlers on div/span without `role="button"` or `tabIndex`. However, these are event delegation wrappers (stopPropagation) inside interactive parent containers — they don't handle user interactions directly.
**Impact:** Minor accessibility concern; not user-facing interaction targets.
**Fix:** Move stopPropagation to the parent event handler or use event delegation.

### [CAT-10] [LOW] — No critical accessibility gaps found
- All images have proper `alt` text or `aria-hidden="true"` for decorative images
- All buttons have accessible labels via `aria-label` or visible text
- All form inputs have associated `<Label>` elements with `htmlFor`
- Password fields have proper toggle with `aria-label`

---

## Category 11: Security — Missing Input Validation

### [CAT-11] [HIGH] — Open redirect vulnerability in Zoom OAuth callback
**File:** `src/pages/ZoomOAuthCallback.tsx:22-23`
**Issue:** `stateData.redirect_uri` is decoded from a base64 state parameter and used directly in `window.location.href` without URL validation or domain whitelist.
**Impact:** An attacker can craft a malicious state parameter with `redirect_uri: 'https://attacker.com'`, encode it as base64, and redirect the user to an arbitrary domain after the OAuth flow.
**Fix:** Validate that `redirect_uri` hostname matches an allowlist (`['lessonloop.net', 'app.lessonloop.net']`) before redirecting. Fall back to `/settings` for unrecognized domains.

### [CAT-11] [MEDIUM] — Stripe customer search query interpolation
**File:** `supabase/functions/stripe-create-checkout/index.ts:203`
**Issue:** `payerEmail` is interpolated directly into a Stripe search query string: `email:"${payerEmail}"`. While Stripe's query parser is strict, this is a risky pattern.
**Impact:** Low — Stripe's API is not SQL, but the pattern could allow query manipulation.
**Fix:** Use `stripe.customers.list({ email: payerEmail })` instead of `.search()`. (Already done correctly in `stripe-create-payment-intent/index.ts:193`.)

### [CAT-11] [LOW] — All dangerouslySetInnerHTML usages are properly sanitized
All 32 instances of `dangerouslySetInnerHTML` in `src/` use `DOMPurify.sanitize()` with restrictive tag/attribute whitelists defined in `src/lib/sanitize.ts`. No XSS vulnerability found.

### [CAT-11] [LOW] — All RPC calls use parameterized queries
All `.rpc()` calls pass structured parameters, not interpolated strings. No SQL injection risk found.

### [CAT-11] [LOW] — AI input sanitization is robust
`supabase/functions/_shared/sanitise-ai-input.ts` implements comprehensive prompt injection detection with regex patterns, 2000-character limit, Unicode normalization, and control character stripping.

---

## Category 12: Stripe Integration

### [CAT-12] [LOW] — Stripe checkout error messages may leak implementation details
**File:** `supabase/functions/stripe-create-checkout/index.ts:315-324`
**Issue:** The catch block returns `error.message` directly to the client. Messages like "Invoice not found" or "No org ID" could help attackers enumerate valid resources.
**Impact:** Minor information disclosure.
**Fix:** Return generic error messages for auth/validation failures; log details server-side only.

### [CAT-12] [LOW] — Stripe integration is well-implemented (no critical issues)
Verified secure patterns:
- **Webhook signature verification**: `stripe.webhooks.constructEvent()` with proper error handling
- **Webhook deduplication**: `stripe_webhook_events` table with unique constraint on `event_id`
- **Payment amount protection**: Amounts come from database (not user input), capped at remaining balance
- **Double-payment prevention**: Application-level check + database unique constraint on `provider_reference`
- **Subscription status atomicity**: Single atomic update to `organisations` table
- **Plan limits**: Mapped through `CANONICAL_KEY` whitelist
- **Refund idempotency**: Deduplicated by `stripe_refund_id`
- **Connected account security**: Proper `transfer_data.destination` with application fee from database

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 12 |
| MEDIUM | 14 |
| LOW | 18 |

### CRITICAL Issues (fix immediately)
1. **[CAT-5]** Lesson deletion ignores query error — may delete entire recurring series (`LessonDetailPanel.tsx:415`)
2. **[CAT-7]** `teachers_with_pay` view has no RLS policy — sensitive payroll data exposed (`usePayroll.ts:113`)

### HIGH Issues (fix this sprint)
1. **[CAT-1]** Hardcoded fallback URL uses wrong domain `.com` instead of `.net` (`BookingPageTab.tsx:108`)
2. **[CAT-1]** Hardcoded marketing base URL (`routes.ts:80`)
3. **[CAT-2]** 4 components with hardcoded `£` symbol breaking multi-currency (`WaitlistEntryDetail.tsx:199`, `TeachingDefaultsCard.tsx:190`, `TeacherQuickView.tsx:200`, `BillingTab.tsx:124`)
4. **[CAT-2]** 3 components with ad-hoc currency ternaries missing currencies (`CreateInvoiceModal.tsx:345`, `RefundDialog.tsx:204`, `IssueCreditModal.tsx:37`)
5. **[CAT-3]** TeacherAvailabilityTab double timezone bug — wrong filtering AND wrong time extraction (`TeacherAvailabilityTab.tsx:130-137`)
6. **[CAT-3]** Teachers.tsx browser timezone for future lesson filtering (`Teachers.tsx:339,374,388`)
7. **[CAT-3]** Locations.tsx browser timezone for usage stats (`Locations.tsx:191,502`)
8. **[CAT-3]** PortalHome greeting uses browser time not org timezone (`PortalHome.tsx:309-314`)
9. **[CAT-3]** UrgentActions uses browser timezone (`useUrgentActions.ts:41`)
10. **[CAT-4]** Set constructor crashes on null query result (`Students.tsx:447`)
11. **[CAT-5]** Bulk message recipient queries silently fail — 5 unguarded queries (`useBulkMessage.ts:97-145`)
12. **[CAT-11]** Open redirect in Zoom OAuth callback (`ZoomOAuthCallback.tsx:22-23`)

### MEDIUM Issues (fix next sprint)
1. **[CAT-1]** 5 performance TODOs for unbounded real-time listeners (PERF-M5)
2. **[CAT-2]** 3 duplicate currency formatting functions
3. **[CAT-2]** 2 missing currency parameters in formatCurrency calls
4. **[CAT-2]** 6 files with manual `/100` division instead of `formatCurrencyMinor()`
5. **[CAT-3]** 21 instances of `.toLocaleDateString()` using browser locale
6. **[CAT-3]** PortalHome expiry checks may cross day boundaries incorrectly
7. **[CAT-4]** CalendarPage teachers.map() without defensive chaining
8. **[CAT-4]** CalendarPage destructuring assumes all hook values exist
9. **[CAT-5]** ~16 unguarded Supabase queries across 4 hooks
10. **[CAT-6]** Invoice list dropdown actions lack double-click protection
11. **[CAT-6]** Various mutation onClick calls without button disable
12. **[CAT-8]** booking-get-slots has no user authentication
13. **[CAT-11]** Stripe customer search query interpolation
14. **[CAT-2]** Inconsistent Intl.NumberFormat locale (`'en'` vs `'en-GB'`)

### LOW Issues (backlog)
1. **[CAT-1]** 8 console statements in production code
2. **[CAT-3]** 209 `new Date()` instances vs 83 timezone conversions (systematic gap)
3. **[CAT-4]** Invoices page filter chains (safe but brittle)
4. **[CAT-6]** Bulk lesson actions lack idempotency guard
5. **[CAT-8]** calendar-ical-feed token-based auth (acceptable by design)
6. **[CAT-8]** waitlist-respond JWT token auth (acceptable by design)
7. **[CAT-9]** 2 unused hooks (dead code)
8. **[CAT-9]** 20+ unused marketing components (dead code)
9. **[CAT-9]** 2 unused filter wrapper components
10. **[CAT-10]** 3 onClick on non-interactive elements (stopPropagation wrappers)
11. **[CAT-10]** No critical accessibility gaps found
12. **[CAT-11]** All dangerouslySetInnerHTML properly sanitized
13. **[CAT-11]** All RPC calls use parameterized queries
14. **[CAT-11]** AI input sanitization is robust
15. **[CAT-12]** Stripe checkout error messages may leak implementation details
16. **[CAT-12]** Stripe integration is well-implemented overall
17. **[CAT-4]** Dashboard stats uses proper nullish coalescing (no issue)
18. **[CAT-6]** SendInvoiceModal, RecordPaymentModal, LessonDetailPanel well-protected

---

*End of audit report. No fixes applied.*
