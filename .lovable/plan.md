

# Additional Audit Phases Plan

Based on thorough codebase review, here are 6 additional phases covering the gaps you identified. Each phase lists the exact files to audit and the specific concerns to investigate.

---

## Phase 12: Subscription Enforcement & Feature Gating

**Files to audit:**
- `src/hooks/useSubscription.ts` — client-side plan derivation
- `src/hooks/useFeatureGate.ts` — feature matrix and access checks
- `src/hooks/useUsageCounts.ts` — student/teacher limit checks
- `src/components/subscription/FeatureGate.tsx` — UI gating components
- `supabase/functions/stripe-webhook/index.ts` — plan sync from Stripe
- `supabase/functions/_shared/plan-config.ts` — server-side limits
- DB functions: `check_teacher_limit()`, `check_subscription_active()`, `is_org_active()`, `is_org_write_allowed()`, `protect_subscription_fields()`
- `src/test/subscription/PlanGating.test.ts`

**Concerns:**
- SUB-H1 (from Phase 10): No server-side student limit trigger — is it still missing?
- Can a cancelled/expired org bypass `check_subscription_active` for any table?
- Do `CANCELLED_LIMITS` actually get applied on the DB rows, or only client-side?
- Is `protect_subscription_fields()` trigger attached to the right table with the right timing?
- Feature matrix gaps: are there features accessible without proper gating?
- Grace period logic: is `PAST_DUE_GRACE_DAYS` consistent between frontend and backend?
- Can a user downgrade and retain access to higher-plan features until cache expires?

---

## Phase 13: Term Management & Practice/Resources

**Files to audit:**
- `src/hooks/useTerms.ts` — CRUD operations
- `src/components/settings/TermManagementCard.tsx` — overlap validation
- `supabase/functions/process-term-adjustment/index.ts` — term adjustment wizard
- `src/hooks/usePractice.ts` — practice log mutations
- `src/hooks/useResources.ts` — resource upload/share/delete
- DB function: `update_practice_streak()` trigger
- `supabase/functions/streak-notification/index.ts`
- `supabase/functions/credit-expiry/index.ts`, `credit-expiry-warning/index.ts`

**Concerns:**
- Term overlap validation: is it server-side or client-only?
- `process-term-adjustment`: does it validate term ownership, lesson counts, and credit note amounts atomically?
- Practice streak trigger: edge cases with backdated logs, timezone boundaries, same-day duplicates
- Resource uploads: is file type validated server-side or just client-side? Can you upload a `.exe` disguised as `.pdf`?
- Storage quota: enforced at DB/storage level or just client-side check?
- Streak notifications: authenticated? Rate limited?

---

## Phase 14: LoopAssist AI (Staff Chat + Execute)

**Files to audit:**
- `supabase/functions/looopassist-chat/index.ts` (1907 lines) — full review
- `supabase/functions/looopassist-execute/index.ts` (1391 lines) — full review
- `src/hooks/useLoopAssist.ts` (552 lines) — client-side hook
- `src/components/loopassist/ActionCard.tsx` — proposal parsing
- `src/lib/action-registry.ts` — valid action types
- `supabase/functions/parent-loopassist-chat/index.ts` — parent variant
- `src/hooks/useParentLoopAssist.ts` — parent client hook
- `supabase/functions/_shared/rate-limit.ts` — LoopAssist daily cap

**Concerns:**
- **Prompt injection**: sanitisation covers known patterns, but does the regex miss Unicode homoglyphs, RTL overrides, or base64-encoded payloads?
- **Tool call security**: `executeToolCall` returns raw `error.message` from DB queries — internal schema leakage
- **IDOR via tools**: `search_students`, `get_student_detail`, etc. pass `orgId` but is it always the verified org from the membership check, or could a crafted tool input override it?
- **Action execution scope**: `bulk_complete_lessons` has a `.limit(100)` but no org_id check on the update itself (relies on select filter) — is the update safe if IDs leak?
- **Billing run via AI**: `executeGenerateBillingRun` creates invoices with `org_id` but bypasses `create_invoice_with_items` RPC — does it skip any validations?
- **Dead code**: line 992-993 in execute has `(lessons || []).length > 0 ? null : null` — dead reference
- **Parent chat**: uses Anthropic directly with `ANTHROPIC_API_KEY` — leaks `e.message` on error (line 351), no message sanitisation of user input
- **Model selection**: Pro orgs get Sonnet, others Haiku — is there a cost ceiling?
- **Context hash**: SHA-256 truncated to 16 hex chars — collision risk acceptable?
- **Tool result size**: no cap on tool result string length — could a 10K result blow the context window
- **Concurrent proposals**: can a user confirm the same proposal twice in a race condition? (line 378 uses `eq("status", "proposed")` but no `FOR UPDATE`)

---

## Phase 15: Public Pages & Marketing Security

**Files to audit:**
- `supabase/functions/marketing-chat/index.ts` — public AI endpoint
- `supabase/functions/booking-submit/index.ts` — public booking form
- `supabase/functions/booking-get-slots/index.ts` — public slot query
- `supabase/functions/send-contact-message/index.ts` — contact form
- `supabase/functions/send-parent-enquiry/index.ts` — parent enquiry
- `supabase/functions/invite-get/index.ts` — public invite retrieval
- `src/components/marketing/MarketingChatWidget.tsx` — client-side chat

**Concerns:**
- All unauthenticated — are rate limits correctly configured and fail-closed?
- `marketing-chat`: message array not sanitised — can inject system/assistant messages?
- `booking-submit`: HTML injection in email templates (EF-L1 from Phase 11 — still open?)
- `booking-get-slots`: does it leak teacher names, room details, or org internals?
- `invite-get`: does it expose membership details or org info to unauthenticated users?
- `send-contact-message` / `send-parent-enquiry`: email injection via headers? SMTP injection?
- CORS configuration on public endpoints: wildcard or restricted?

---

## Phase 16: Performance at Scale

**Files to audit:**
- All hooks with unbounded queries (no `.limit()` or pagination)
- `src/hooks/useReports.ts` (734 lines) — multiple aggregation queries
- `src/hooks/useDataExport.ts` — export truncation (RPT-M5)
- `supabase/functions/looopassist-chat/index.ts` — 9 parallel aggregate queries on every message
- `supabase/functions/create-billing-run/index.ts` — batch processing
- `supabase/functions/gdpr-export/index.ts` — 5 unbounded SELECTs
- DB indexes: verify critical queries have covering indexes
- Realtime subscriptions: are any too broad?

**Concerns:**
- 1000-row default limit: which queries will silently lose data?
- N+1 patterns: execute functions loop with individual updates (`bulk_complete_lessons`, `send_bulk_reminders`)
- LoopAssist context building: 9 parallel queries per message — acceptable for 100+ concurrent users?
- `useTeacherPerformance`: waterfall sequential queries (RPT-M6)
- Calendar queries: do they have date-windowed indexes?
- Realtime: `useRealtimePortalPayments` subscribes to all org payments — too broad for large orgs?
- Billing run: no batch insert for invoice items — creates them one-by-one per payer
- Missing indexes on `attendance_records`, `practice_logs`, `message_log` for common query patterns

---

## Phase 17: Mobile & Capacitor

**Files to audit:**
- `src/lib/platform.ts` — platform detection
- `src/lib/native/init.ts` — native initialisation
- `src/lib/native/statusBar.ts`, `keyboard.ts`, `deepLinks.ts`
- `capacitor.config.ts` — app configuration
- `src/App.tsx` — `NativeInitializer` component
- `src/components/layout/PortalLayout.tsx` — mobile layout
- `src/components/layout/PortalBottomNav.tsx` — bottom navigation
- `src/hooks/use-mobile.ts` — responsive breakpoint detection
- PWA config in `vite.config.ts`

**Concerns:**
- Deep link handling: does `initDeepLinks` validate URLs before navigating? Could a malicious deep link navigate to an admin route?
- Push notifications: is the token registration endpoint authenticated? Can tokens be registered for another user?
- `capacitor.config.ts` — is `cleartext: true` safe for production? (allows HTTP)
- Status bar configuration: does it handle notch/safe area on all devices?
- Keyboard handling: does it prevent content from being hidden behind the keyboard?
- Offline behaviour: what happens when Supabase queries fail on mobile? Is there any caching or queue?
- Back button: does Android back button handle navigation correctly across all routes?
- Session persistence: does the auth session survive app backgrounding/killing?
- PWA service worker: does `navigateFallbackDenylist` include `/~oauth`?

---

## Execution Order (recommended)

1. **Phase 14 (LoopAssist AI)** — largest attack surface, 3300+ lines of edge function code, tool execution with write access
2. **Phase 12 (Subscription)** — revenue protection, known open issue (SUB-H1)
3. **Phase 15 (Public Pages)** — unauthenticated endpoints, highest external exposure
4. **Phase 16 (Performance)** — data loss risks from silent truncation
5. **Phase 13 (Terms/Practice/Resources)** — moderate risk, some issues already flagged
6. **Phase 17 (Mobile)** — lowest immediate risk but needed before app store submission

Each phase follows the same pattern as Phases 1-11: read the files, run the test suite, log findings by severity, and list what passed.

