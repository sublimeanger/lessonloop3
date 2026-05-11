# LessonLoop v2 — comprehensive plan

> **Status:** planning document. Not for execution until Jamie approves the scope cuts in §3.
> **Author:** drafted by Claude after deep codebase entrenchment 2026-05-09.
> **Operating reality:** Jamie is non-technical. All execution is via AI assistants (Claude Code primary, Lovable being retired). Plans must be self-contained enough that an AI agent can execute them without further architectural decisions.
> **Source of truth grounding:** every claim in this doc was verified against the live codebase (`/home/claude/lessonloop3-main`) and live Supabase project `xmrhmxizpslhtkibqyfy`. Nothing was assumed. Where I made a judgement call I've flagged it explicitly.

---

## 0. Read this first

This is not a rewrite plan. It is a **structured, in-place v2 plan** that:

1. Preserves the existing audit infrastructure (`audit/MASTER.md`, `/sweep`, `audit/findings/`) — those represent real verification work that would be insane to throw away.
2. Preserves the mature foundation (RLS helpers, audit-log triggers, idempotency patterns, `_shared/` edge modules, feature-flag matrix) that has been hardened over a year.
3. Aggressively cuts the surface area the user sees at v1 launch — by feature-flagging, hiding, or removing — without doing destructive deletion until they're proven dead.
4. Consolidates the worst conflations (the 21 send-* edge functions, the leads ↔ enrolment_waitlist duplication, the role-check sprawl) on a deliberate sequence, with each step shippable.
5. Targets a launch where the system **runs Lauren's 250-pupil school cleanly** and presents a coherent surface to the waiting list.

Why not a rewrite: 424 migrations of accumulated correctness, ~3000 lines of factored `_shared/` modules, a working RLS helper layer with 21 functions, 28 audit findings already triaged — none of that is replicable in 8-12 weeks of greenfield. A rewrite throws all of it away and re-discovers the bugs the hard way. A disciplined refactor in place keeps the assets and pays down the debt.

Why not "just ship": the cohesion problems are real and *visible* to first users — they'll see two ways to do prospect tracking, 24 settings tabs, half-built features, inconsistent naming. UK music teaching is a small connected market; first impressions compound. The launch needs to be coherent.

The plan splits into five tracks running in parallel (mostly), with a single forcing function: the **v1 launch criterion** (§4) which Lauren and one beta teacher have to be able to run their schools on without workarounds.

---

## 1. What's actually in the codebase (verified)

These are facts, not opinions. Every number was checked against the live repo and DB.

### 1.1 Surface area
- **35 staff/portal pages** + **booking page** + **15 marketing pages** in repo (most marketing pages are client-side redirects to `lessonloop.net` static site — not part of the app surface).
- **17,993 lines** in `src/pages/`. Largest: `Locations.tsx` (1058), `Teachers.tsx` (1010), `BookingPage.tsx` (1068), `LessonDetailPanel.tsx` (940), `PortalHome.tsx` (934), `InvoiceDetail.tsx` (871), `Continuation.tsx` (769), `PortalSchedule.tsx` (726).
- **382 components** in `src/components/`.
- **123 hooks** in `src/hooks/`.
- **103 edge functions** in `supabase/functions/` (one shared module dir + 102 functions).
- **86 tables** in `public` schema.
- **~140 RPCs** (functions returning data, excluding triggers).
- **24 enum types**.
- **424 migrations** from project start to 2026-05-16. Distribution: heavy clusters of 11–15 migrations/day during fix-batches in late April; tapering to 1–5/day in May.

### 1.2 Stack
- React 18 + TypeScript + Vite 5 + Tailwind 3 + shadcn-ui (Radix primitives).
- Supabase (PostgreSQL 17 + Auth + Storage + Realtime + Edge Functions on Deno).
- Stripe (Subscriptions for SaaS tier + Connect for studio receivables).
- Capacitor 8 for iOS/Android; published to App Store (v1.2 in review per `audit/MASTER.md`).
- TanStack Query 5 for client state.
- React Router 6.
- Sentry 10 (browser instrumented; edge-fn instrumentation NOT done, marked 🔴 in audit).
- Resend for email.
- React Hook Form + Zod for validation.
- Framer Motion, dnd-kit, recharts, jsPDF, vaul (drawer), cmdk (command palette).
- Build tools: SWC plugin, vite-plugin-pwa, Sentry vite plugin (added 2026-05-08).

### 1.3 Existing operational infrastructure (do not replace)
- **`audit/MASTER.md`** — 180-row launch readiness tracker. P0/P1/P2/P3 + ✅/🟡/🔴/❓/⏸ states. Reset 2026-05-08 when prior structural validation deemed insufficient. 14 🟢 / 150 🟡 / 6 🔴 / 10 ⏸ as of last update.
- **`audit/00-launch-readiness.md`** — explicit launch blockers (Google OAuth verification, Sentry source maps, source Supabase decommission, Apple OAuth, Cloudflare WAF/CSP, cookie consent, Anthropic sub-processor disclosure, Stripe Checkout branding).
- **`audit/findings/`** — 28 files of triaged bugs, each named `YYYY-MM-DD-<slug>.md`. Several are post-fix (e.g. `2026-05-08-authcontext-onauthstatechange-async-hang.md`).
- **`/sweep` slash command** (`.claude/commands/sweep.md`) — existing per-feature audit walker, picks next P0 ❓ row and runs smoke / functional / edge / RLS / mobile / Sentry template.
- **`/sentry-digest` slash command** — weekly Sentry digest into `audit/reports/<date>.md`.
- **`.claude/agents/`** — `playwright-test-generator.md`, `playwright-test-healer.md`, `playwright-test-planner.md`. Browser MCP wired.
- **`docs/PLAYWRIGHT_MASTER_PLAN.md`** (690 lines) — earlier-generation test plan. Mostly aligned with what I produced last week but partially outdated.
- **`docs/HANDOVER_2026-05-02.md`** — canonical project orientation; identifies "Areas 0-16" production-hardening framework, reads `STATUS.md` first, halt-early protocol, "never invent fixes — trace to a finding" rule, scope-drift warning.
- **`docs/RECURRING_BILLING_DESIGN.md`** (706 lines), `docs/INVOICE_PDF.md` (389), `docs/CRON_HEALTH.md`, `docs/AUDIT_TEST_CHECKLIST.md`, etc. — domain-specific design docs.
- **`tests/e2e/`** — 40+ Playwright spec files; some shallow ("page loads"), some deep (`workflow-helpers.ts` with mature factories like `createLessonViaCalendar` with conflict-retry fallback loop).
- **`tests/e2e/auth.setup.ts`** — curl-based per-role login with collision-safe tmp files. Keep verbatim.
- **`tests/e2e/.auth/`** storage state for 6 roles (owner, admin, teacher, finance, parent, parent2).

### 1.4 Mature foundations (lift directly into v2)
These are the parts that work and shouldn't be rewritten. They get **kept**, not ported, not redesigned. Some get clean-up but the design is sound.

| Asset | Where | Why it's good |
|---|---|---|
| RLS helper functions | DB: `is_org_admin/owner/finance/member/parent/scheduler/staff/active/write_allowed`, `has_org_role`, `has_role`, `is_assigned_teacher`, `is_lesson_teacher`, `is_invoice_payer`, `is_parent_of_student`, `teacher_has_thread_access`, `get_user_roles`, `get_user_org_ids`, `get_org_role`, `get_teacher_id_for_user`, `get_guardian_ids_for_user`, `get_student_ids_for_parent` | Comprehensive, consistent shape, used across 86 tables' RLS policies. The model is right. |
| State-mutating RPC pattern | e.g. `convert_lead`, `convert_waitlist_to_student`, `void_invoice`, `record_manual_payment`, `respond_to_makeup_offer` — all SECURITY DEFINER, auth check at top, FOR UPDATE locks where appropriate, transactional, audit-log entry on success | Mature. Use as template for every new mutation in v2. |
| Audit log trigger pattern | `log_audit_event_singular` trigger function | Singular trigger that handles INSERT/UPDATE/DELETE via TG_OP. Right shape. |
| `_shared/` edge fn modules | `cors.ts`, `rate-limit.ts`, `cron-auth.ts`, `escape-html.ts`, `sanitise-ai-input.ts`, `recalc-with-retry.ts`, `check-notification-pref.ts`, `invoice-pdf.ts`, `invoice-pdf-attachment.ts`, `invoice-amount-due.ts`, `send-invoice-email-core.ts`, `auto-pay-reminder-core.ts`, `xero-auth.ts`, `csv-field-aliases.ts`, `plan-config.ts`, `log.ts` (~3000 LoC) | Already factored. Lift as-is. |
| Idempotency patterns | `stripe_webhook_events` dedup table, `profile-ensure` race-safe (handles 23505 unique violation), invite-accept email-match check | Each represents a class of bug already fixed. Keep verbatim. |
| Feature flag matrix | `src/hooks/useFeatureGate.ts` — `Feature` type with 17 features mapped to plans; `FEATURE_MIN_PLAN` for upgrade prompts | Already exists. Use as the launch-vs-post-launch toggle mechanism (§3). |
| Storage policies | 5 buckets verified in audit: `avatars`, `org-logos`, `invoice-pdfs`, `migration-dump`, `teaching-resources`. All RLS-policied, mime/size capped. | Keep. Don't rewrite. |
| Cron infrastructure | 26 cron jobs registered in pg_cron, cron-auth via `validateCronAuth` shared module, `cron-health-watchdog` monitors classes A & B | Working. The 8-cron-not-registered finding from 2026-05-08 was the gap; now closed. |
| Auth hardening | SEC-AUTH-03 enumeration normalisation, SEC-AUTH-07 global signout, password HIBP enabled, security-update-password reauth required, 6 security-event notification emails enabled | Lifted from real attack surface. Keep. |
| Test setup | `auth.setup.ts` curl-based login, `helpers.ts` (waitForPageReady, expectToast, safeGoTo, fillField, selectOption, trackConsoleErrors with extensive benign-error allowlist), `workflow-helpers.ts` (createLessonViaCalendar with conflict-retry, createStudentViaWizard with duplicate handling, etc.) | Keep verbatim. |
| Capacitor wiring | `src/lib/native/init.ts`, `src/lib/native/deepLinks.ts` (path-traversal protection, route allowlisting), `src/lib/native/browser.ts` (in-app browser for OAuth), push notifications service | Mature. Keep. |
| Plan recommendation engine | `src/lib/plan-recommendation.ts`, `src/lib/pricing-config.ts` (235 lines, three plans, GBP, storage limits, marketing copy) | Keep. The DB-enum-vs-display-key duality is debt but we accept it (§5.4). |

### 1.5 The actual problems (in priority order, all verified)

**P0 — affects launch directly**

1. **Lead ↔ enrolment_waitlist duplication.** Verified: both have `contact_name/email/phone`, both have child fields (`leads` via `lead_students` join; `enrolment_waitlist` inline `child_first_name/last_name`), both have `converted_student_id`, both have a stage/status flow ending in "enrolled", both have nearly identical `convert_*` RPCs. `enrolment_waitlist.lead_id` exists, suggesting they were meant to be linked — but the user-facing model treats them as separate features (Leads page, Waitlist page). This forces every workflow to ask "is this prospect a lead or a waitlist entry?" — there's no clean answer. **Decision needed before launch.**

2. **Make-up vs enrolment vs leads conflation in user mental model.** This is different from #1 — make-up waitlist is genuinely a separate entity (it's about existing students who missed a lesson, with `missed_lesson_id`, `absence_reason`, optional `credit_id`). My earlier critique conflated all three; deeper read shows make-up is correctly a separate concept. The conflation is only between leads and enrolment_waitlist.

3. **24 settings tabs.** Verified by file count in `src/components/settings/` and explicit `tabs` array in `Settings.tsx`. 10,596 lines across the tab files; `BillingTab.tsx` alone is 1,292 lines. No search, no grouping. A user looking for a specific setting has 24 doors to try.

4. **Role check sprawl.** Verified: 155 occurrences of `currentRole === '...'` or `isOrgAdmin`/`isOrgOwner` in the frontend. Same boolean recomputed dozens of times. Adding a permission would require touching dozens of files. v2 needs a permissions hook (`useCan('delete_invoice')`) layered on top of roles.

5. **21 send-* edge functions.** Verified by directory listing. Each is a mostly-bespoke email sender. `_shared/send-invoice-email-core.ts` shows the pattern is already known — but only `send-invoice-email` and `send-invoice-email-internal` use it. The other 19 are still bespoke. Cost: any change to From-header logic, sanitisation, or template structure is 19 places to edit.

**P1 — drag on velocity, not launch-blocking**

6. **Lesson UI surface count.** 6 components for "interact with a lesson" (`LessonModal`, `QuickCreatePopover`, `MobileLessonSheet`, `LessonDetailPanel`, `LessonDetailSidePanel`, `LessonCard`). `LessonDetailPanel` alone is 940 lines.

7. **Calendar view sprawl.** 6 view components (`DayTimelineView`, `WeekTimeGrid`, `StackedWeekView`, `AgendaView`, `MobileDayView`, `MobileWeekView`). Most calendar libraries do this with 1-2 responsive views. Combined: 1,950 lines.

8. **Plan name DB-vs-display debt.** `solo_teacher`/`academy`/`agency` (DB) vs `teacher`/`studio`/`agency` (display). Comment in code: "DB enum values are historical and should NOT be changed." Living with it is fine; just accept it.

9. **`teachers` ↔ `org_memberships` parallel structure.** A teacher who's also a member exists in both tables. `protect_teacher_user_link` trigger exists to keep them in sync. The right shape is one membership record with a teaching extension; the current shape is debt.

10. **Six audit-log-shaped tables.** `audit_log`, `platform_audit_log`, `_spotcheck_log`, `enrolment_waitlist_activity`, `lead_activities`, `grade_change_history`. Each fills a slightly different need but they overlap. Polymorphic single log (with discriminator) would be cleaner.

11. **PDF rev triggers.** Verified: 11 triggers (`bump_invoice_pdf_rev` + `_from_installments` + `_from_installments_del/ins/upd` + `_from_items` + `_from_items_del/ins/upd` + `_from_payments` + `_from_payments_del/ins/upd`). Could be one trigger using TG_OP, or a generated column hashing relevant fields.

12. **Four seed functions.** 2,896 LoC across `seed-demo-solo`, `seed-demo-agency`, `seed-demo-data`, `seed-e2e-data`. Should be one parameterised function.

13. **LoopAssist is 7,000+ lines.** ~2,830 frontend + ~4,154 backend. Currently surfaced as a header sparkle button. Either it's a hero feature (then it shouldn't be tucked behind a button) or it's a side-feature (then it shouldn't be 7k lines). Decision deferred to §3.

14. **Edge function Sentry instrumentation = 0%.** Confirmed in audit row. Edge fn errors only surface in Supabase logs. P1 risk for launch.

**P2 — accept and document**

15. **`looopassist-chat` typo.** Permanent now. Not worth the migration risk to fix.
16. **Settings-tab overlap with main app sections.** "Recurring billing" lives in both Settings and Invoices. Pick one.
17. **`continuation` vs `term continuation` naming inconsistency.** Both terms used.

### 1.6 Existing launch blockers (from `audit/00-launch-readiness.md`, verified)
1. Google OAuth consent screen verification (2-6 wk lead time)
2. Sentry source maps upload (now configured 2026-05-08; awaiting next deploy)
3. Source Supabase project `ximxgnkpcswbvfrkkmjq` decommission (data still there as backup)
4. Apple OAuth provider config (currently flag-hidden)
5. Cloudflare WAF/CSP for `app.lessonloop.net` (not currently proxied through CF)
6. Cookie consent banner
7. Anthropic sub-processor disclosure (since LoopAssist uses Claude)
8. Stripe Checkout branding
9. Edge-fn Sentry instrumentation (0/103 functions instrumented)
10. App Store iOS submission (v1.2 in review)

**Important: these are the *external* blockers, separate from the architectural debt above. They must all close before launch regardless of the v2 architecture work.**

---

## 2. Strategy

### 2.1 The core decision

There are three viable paths:

**Path A — refactor in place over 2-3 months, no rewrite.** Keep the existing repo. Ship the architectural cleanup (P0 items 1-5 above) as a series of bounded migrations, each green and shippable. P1 items happen post-launch. Cost: ~10 weeks of engineering. Risk: scope drift; debt that doesn't get cleaned up still feels messy at launch.

**Path B — clean port to a fresh repo, lifting matured pieces.** Start a new repo. Lift the RLS helpers, `_shared/` modules, RPC patterns, test infrastructure verbatim. Rebuild the application layer with the conflations resolved upfront. Cost: ~12-16 weeks. Risk: re-discover bugs the existing code has fixed; lose the audit/MASTER.md context; possibly never finish.

**Path C — hybrid: bounded refactor in place for the most visible debt, defer the rest.** Refactor P0 items 1-5 in place. Feature-flag everything not in launch scope. Defer P1 items to post-launch. Use the existing audit infrastructure as the launch readiness gate.

**Recommendation: Path C.** Reasoning:

- Path A loses the forcing function. With no deadline, "one more refactor" extends indefinitely. The current Master tracker shows this pattern already (180 rows, 150 still 🟡 awaiting browser test as of 2026-05-08).
- Path B throws away `audit/MASTER.md`, the 28 findings, the migration history, the test infrastructure. The user (Jamie) is non-technical and currently delegates to multiple AI assistants per the handover doc — a fresh repo loses all the context those agents currently have.
- Path C uses the existing infrastructure (the audit, the slash commands, the test factories) as the engine. Each P0 cleanup is a single bounded PR. P1 debt is documented but not blocking. Launch happens when the audit goes green, not on a date.

The rest of this doc is Path C in detail.

### 2.2 Five concurrent tracks

Each track has a single owner-equivalent (an AI agent assignment), an exit criterion, and a budget. They run in parallel but coordinate at weekly checkpoints.

| Track | Goal | Owner | Budget | Exit |
|---|---|---|---|---|
| **A — Architecture cleanup** | Resolve P0 items 1-5 (lead/waitlist merge, settings IA, permissions hook, send-fn consolidation, role checks) | Claude Code primary agent | 6 weeks | All five P0 items closed; audit/MASTER.md rows for affected features go ✅ |
| **B — Launch readiness sweep** | Drive every audit/MASTER.md row from 🟡 → ✅ via `/sweep` | `/sweep` agent + Jamie's manual confirmation | runs in parallel with A | All P0 rows ✅, P1 ✅ or ⏸ documented, P2 ✅ or accepted |
| **C — External blockers** | Close 10 launch blockers from `audit/00-launch-readiness.md` | Mix: Jamie does product/legal items; agents do code items | Lead time: 6 weeks worst-case (Google OAuth) | All 10 ✅ or ⏸ with mitigation |
| **D — Lauren shadow migration** | Migrate Lauren's 250-pupil school onto LL in shadow mode for one full term | Jamie + Lauren manually; agents fix bugs found | 1 full term (likely 12 weeks) starting after Track A week 4 | One term run end-to-end with zero data discrepancies |
| **E — Beta cohort prep** | Identify, contact, onboard 3-5 hand-picked teachers from waiting list | Jamie | starts after Track D mid-term | 3+ teachers onboarded, billing in real money |

Tracks A and B account for ~80% of the "engineering" work. Tracks C, D, E are the "operational" wrappers that turn engineering completeness into launch readiness.

### 2.3 What changes vs my earlier advice

In earlier messages I oscillated between "refactor in place" and "rewrite cleanly with Claude Code" depending on which constraint you'd just mentioned. Now that I've done the recon I'm settled:

- **Refactor in place.** No rewrite. The existing code is too valuable, too instrumented, too audited to throw away.
- **The cohesion problems are real but smaller than my first critique implied.** Specifically: leads/enrolment_waitlist *is* a real conflation (they share half their columns and have duplicate convert RPCs); make-up waitlist is genuinely separate. So the "merge three things into one" framing was wrong; "merge two things into one, leave the third alone" is correct.
- **The settings tab count is the most visible external symptom.** 24 tabs is what a new user sees first. This needs an IA pass before launch regardless of what else happens.
- **The permissions hook (`useCan`) is the highest-leverage internal refactor.** 155 role-check sites is a lot of mechanical change but it makes every future feature easier and removes a whole class of bug.
- **LoopAssist defer to v1.1.** It's a product-within-a-product. Launching with it makes the v1 surface harder to make coherent. Hide behind feature flag for launch; bring back in v1.1.
- **Several "P1" items I flagged earlier are now P2 or P3.** Specifically: the 11 PDF triggers (real but contained — leave them), the audit-log table proliferation (cosmetic), the seed function consolidation (dev-only, no user impact), the `teachers`/`org_memberships` duality (mature trigger keeps them sync; not worth migration risk pre-launch).

---

## 3. Launch scope decisions (REVISED 2026-05-09 after review with Jamie + Lauren)

These decisions drive everything else. They were finalised after a feature-by-feature review against the live codebase and Lauren's input.

For each feature, the question is one of three:

- **Launch** — must work cleanly for v1.0 launch. In-scope for Tracks A/B.
- **Hide** — present in code but feature-flagged off; lights up in v1.1+ when ready.
- **Cut** — actively removed from the launch surface; may return as v1.1+ feature or never.

### 3.1 Core operating loop — must launch
| Feature | Why launch | Notes |
|---|---|---|
| Auth (login, signup, forgot, reset, verify, accept-invite) | Existential | Already mature; Tracks B+C close blockers |
| Onboarding wizard | Existential | 5 steps work |
| Multi-tenant orgs (solo_teacher / studio modes) | Lauren's school is multi-teacher multi-location | Already works |
| Calendar (day + week views, mobile responsive) | Core | Mature; surface-count refactor (6 → 2 views) deferred to v1.1 |
| Lesson CRUD (single + recurring + group) | Core | LessonModal mature; conflict detection works |
| Daily register + batch attendance | Core | Both work |
| Students (list, wizard, detail, CSV import) | Core | Mature |
| Teachers (CRUD, invite, archive with reassignment) | Core | Mature |
| Locations + rooms | Core | Mature |
| Invoices (manual + from lessons + billing runs) | Core | Mature |
| Send invoice (with PDF) | Core | Uses `send-invoice-email-core.ts` (already shared) |
| Record payment (manual + Stripe) | Core | Mature |
| Parent portal (home, schedule, invoices, messages, practice, resources) | Core | Mature; all sub-pages launch |
| Stripe payment (parent pay invoice) | Core | Embedded drawer + native fallback both work |
| **Stripe Connect (per-org payment routing)** | **Critical** | **Architecturally essential — without it studios can't take payments to their own bank. `transfer_data.destination` already wired in `stripe-create-payment-intent`. Add to onboarding flow** |
| Messages (single, bulk, parent-side) | Core | Mature |
| Internal messages | Core (org-gated) | Default OFF per org; admin enables; gate is `organisations.enable_internal_messaging` |
| Term + closure date management | Core for academic billing | Mature |
| Rate cards | Core (drives invoice line items) | Mature |
| Audit log (read-only view) | Core (Lauren needs to investigate issues) | Mature |
| GDPR export + delete | Compliance | Mature |
| Push notifications (mobile) | Mobile launch needs them | Already wired |
| **Make-up dashboard + credits + waitlist** | **Lauren-paramount per her review — "the one feature absolutely paramount"** | Mature; ~1660 LoC; full RPC suite; cron `waitlist-expiry`; in audit P1 🟡 |
| **Term continuation runs** | **Lauren-flagged "very important"; P0 in audit; term-end critical** | ~2350 LoC; mature; tokenised public-respond URL; promote from "v1.1" to launch |
| **Term adjustments** | **Lauren-requested after a recent problem** | ~1817 LoC (frontend + backend); mature; wired into Student detail + LessonDetailPanel |
| **Practice tracking + streaks** | **Mature; P2 in audit; no real reason to defer** | ~1860 LoC; RLS verified |
| **Resources library** | **Mature; P2 in audit; no real reason to defer** | ~2200 LoC; storage bucket verified `public=false`, 50MB cap, RLS scoped |
| **All 8 reports** (Revenue, Outstanding, Payroll, Lessons Delivered, Cancellations, Utilisation, Attendance, Teacher Performance) | **All mature, all small (~300 LoC each), all in Track B sweep anyway** | RPCs / RLS-scoped queries; all ~300 LoC each |
| **LoopAssist (scoped)** | **Lauren-noted "intended differentiator"; no competitor has this** | Read-only / explanatory tools enabled at launch; destructive tools (create invoice, send message) v1.1; passes 50-question hallucination test before launch |
| **Multi-org switching** | **Auto-hidden for single-org users (verified `Header.tsx:40`)** | No cost; serves real cases (peripatetic teacher, school transitions, sister schools) |
| **Xero integration (LAUNCH DAY-ONE)** | **Lauren confirmed "built and functional"; 4 of 5 bugs fixed in production code; 1 cosmetic LL-LL prefix bug** | s24 recalibration: un-deferred from CONDITIONAL → DAY-ONE. 4 active fixes verified holding (NOT NULL drift x2, FK name, unique constraint). LL-LL prefix code-fix in s24; historical Xero references stay LL-LL- (acceptable cosmetic for v1). 2 active xero_connections in production with auto_sync_invoices/payments=true. |
| **Demo seed accounts** | **Already env-gated (`ALLOW_SEED`)**; needed for sales/E2E/marketing | No security exposure in production |

### 3.2 Hide behind feature flag — code stays, lights up v1.1+

**REVISED 2026-05-10 (s24 stance recalibration):** Jamie un-deferred all
features that are fully-built. Defensive deferral was unnecessary; ship
the coverage and the features per the world-class stance. Only Zoom
remains hidden (genuine external block).

| Feature | Status | Notes |
|---|---|---|
| Zoom integration | **HIDDEN at v1** | **No full Zoom approval yet per Jamie** — pending Zoom verification review. Lights up once Zoom approval lands. The 3 Zoom edge fns (zoom-oauth-start, zoom-oauth-callback, zoom-sync-lesson) stay 🟡 in audit/MASTER.md. |

**SEPARATE TRACK — dedicated audit run s25-s26+:**
| Feature | Why separate track |
|---|---|
| Mobile (Capacitor) — iOS/Android native builds, in-app browser OAuth, deep link handling | Mobile-specific testing surface (mobile-safari project + device E2E once iOS App Store review clears). Web launch first, mobile audit dedicated run. |

**UN-DEFERRED in s24 (now LAUNCH IN-SCOPE per §3.1):**
- ~~Leads pipeline~~ — un-deferred; full launch coverage in s24.
- ~~Enrolment waitlist~~ — un-deferred; full launch coverage in s24.
- ~~Lead funnel chart~~ — un-deferred; full launch coverage in s24.
- ~~Recurring billing templates~~ — un-deferred; full launch coverage in s24.
- ~~Booking page~~ — un-deferred; full launch coverage in s24 (with rate-limit + honeypot contracts).
- ~~Parent reschedule self-service~~ — un-deferred; full launch coverage in s24. Default `parent_reschedule_policy = admin_locked` per org choice — orgs can switch to request_only/self_service.
- ~~Parent LoopAssist~~ — un-deferred; full launch coverage in s24 (already covered by §27 multi-area auth-gate per s23 12240c4).
- ~~Agency plan tier~~ — un-deferred; visible at launch alongside Teacher + Studio. (See §3.4 — note pricing config will need update.)

### 3.3 Cut — actively remove from app deploy
| Feature | Why cut | What to do |
|---|---|---|
| `migration-dump` edge fn | One-off cutover tool, no longer needed in production | Remove from production deploy (keep in repo for archive) |
| `marketing-chat` edge fn | Marketing-site chat, separate concern | Verify not invoked by app, remove from app deploy if so |

### 3.4 Plan tier structure (revised after review)

The DB has TWO related enums:
- `org_type` (4 values): `solo_teacher`, `studio`, `academy`, `agency` — what the org IS
- `subscription_plan` (5 values): `trial`, `solo_teacher`, `academy`, `agency`, `custom` — what they PAY FOR

`pricing-config.ts` exposes 3 commercial tiers: **Teacher** (£12/mo, mapped to `solo_teacher`), **Studio** (£29/mo, mapped to `academy`), **Agency** (£79/mo, mapped to `agency`).

The `solo_teacher` `org_type` gets a *different sidebar* (flatter, no Pipeline group) — verified in `AppSidebar.tsx:217`. This is a feature, not a label.

**Launch decision (REVISED 2026-05-10 in s24 recalibration):**
- **Teacher tier (£12/mo)** — visible at launch. Main market.
- **Studio tier (£29/mo)** — visible at launch. Lauren's school + similar.
- **Agency tier (£79/mo)** — visible at launch (was hidden; un-deferred in s24 stance recalibration). Full feature is built; agency-only features gated via useFeatureGate hook.
- DB enums **not changed**. Display name layer in `pricing-config.ts` already handles the rename (`solo_teacher` → "Teacher", `academy` → "Studio").

### 3.5 Internal messages (org-gated)

Lauren-flagged: "teachers use WhatsApp, comms breakdown, LessonLoop doesn't know what's happened — fight head-on later."

**Launch implementation:**
- Add `organisations.enable_internal_messaging` boolean (default `false`).
- Internal messages UI gated behind this flag.
- Lauren's org enables it; default-off orgs never see it.
- Bigger conversation about WhatsApp competition is v1.2+ (probably WhatsApp Business API integration, not competition).

### 3.6 Decisions Jamie has approved (logged 2026-05-09)

✅ Launch scope above approved per Lauren feature-by-feature review
✅ Stripe Connect promoted to launch-critical (was v1.1)
✅ Make-up dashboard, continuation, term adjustments promoted to launch (were v1.1)
✅ Practice, Resources, all 8 reports kept at launch (were proposed v1.1)
✅ LoopAssist scoped at launch (read-only enabled, destructive deferred)
✅ Internal messages org-gated, default off
✅ Xero conditional on shadow-term verification
✅ Multi-org switching kept (auto-hides for single-org)
✅ Demo seeds kept (already env-gated)
✅ Plan tiers: Teacher + Studio visible at launch; Agency hidden ("Contact us")

### 3.7 Decisions still needed

1. ☐ Apple OAuth: configure (a) / strip from iOS (b) / web-only launch (c). Recommend (b).
2. ☐ Cloudflare proxy decision for `app.lessonloop.net` (orange-cloud or Netlify-only).
3. ☐ Waiting list disclosure plan — what to tell them about timeline now that the v2 plan is real.
4. ☐ Beta cohort selection criteria final (recommend: UK-based, ≠ Lauren's operating model, patient temperament, free/£1 first term).
5. ☐ Lauren shadow term start date (recommend: 2 weeks after PR1 lands).

---

## 4. v1.0 launch criterion

**The single sentence that defines done:**

> A UK private music teacher can sign up, complete onboarding in under 5 minutes, add their students with at least one guardian each, schedule recurring weekly lessons across multiple teachers and locations, take attendance daily, generate invoices from delivered lessons (or fixed monthly amounts), send them, the parent receives them, pays via Stripe, and the teacher sees the payment land in their dashboard. They can do all of this on a phone.

**Operating definition: a UK studio with 50-300 students can run their week's admin on LL with no workarounds.**

The "no workarounds" clause is the rub. Lauren's school has surfaced specific pain points; each one was the reason a feature exists. The launch criterion isn't "every feature works" — it's "Lauren's week works." When something breaks, we either fix it or document the workaround Lauren will accept.

### 4.1 Launch readiness gates (all must be ✅)

1. **Audit gate.** Every P0 row in `audit/MASTER.md` is ✅ (currently 14 ✅ / 6 🔴 / various 🟡 — the 🟡 P0s become ✅ via Track B `/sweep`).
2. **Architecture gate.** All five P0 architecture items in §1.5 closed, with the affected features verified end-to-end.
3. **External gate.** All 10 launch blockers from `audit/00-launch-readiness.md` ✅ or ⏸ with documented mitigation.
4. **Lauren gate.** Lauren has run her school in shadow mode for one full term (12 weeks), with end-of-term reconciliation showing zero discrepancies between LL and her old system.
5. **Beta gate.** 3 hand-picked teachers from the waiting list have run at least 4 weeks on LL with billing in real money, and reported no P0 bugs.
6. **Test gate.** The Playwright catalog (the doc I produced last week, `PLAYWRIGHT_MASTER_CATALOG.md`) is implemented for all in-scope launch features. All tests passing in CI.
7. **Mobile gate.** iOS app submitted to App Store, version 1.0 approved. Android app on Play Store. Both go through full E2E test on real devices.
8. **Sentry gate.** Browser source maps uploading; edge function Sentry instrumented for the 20 most critical functions; one week of zero P0 errors in production-shadow.

When all 8 are ✅, launch is open to the waiting list. **No date.**

---

## 5. Track A: architecture cleanup, in detail

This is the engineering meat. Six PRs, each bounded, each shippable independently, each green.

### 5.1 PR1 — Permissions hook (`useCan`) — the highest-leverage refactor
**Goal:** replace 155 ad-hoc role checks with a permissions API.

**Verified problem:** see §1.5 item 4. Pattern in code today:

```ts
// scattered across many files
const isAdmin = currentRole === 'owner' || currentRole === 'admin';
const isFinance = currentRole === 'finance';
const canDelete = currentRole === 'owner' || currentRole === 'admin';
```



**Target shape:**

```ts
// src/hooks/useCan.ts
export type Permission =
  | 'students:read' | 'students:create' | 'students:update' | 'students:delete'
  | 'lessons:read' | 'lessons:create' | 'lessons:update' | 'lessons:delete' | 'lessons:bulk'
  | 'invoices:read' | 'invoices:create' | 'invoices:send' | 'invoices:void' | 'invoices:refund'
  | 'invoices:edit_after_send' | 'invoices:delete'
  | 'payments:record_manual' | 'payments:refund'
  | 'teachers:read' | 'teachers:create' | 'teachers:invite' | 'teachers:archive' | 'teachers:view_pay'
  | 'reports:revenue' | 'reports:payroll' | 'reports:teacher_performance' | 'reports:lessons' | 'reports:attendance'
  | 'settings:org' | 'settings:billing' | 'settings:rate_cards' | 'settings:members' | 'settings:branding'
  | 'audit:read'
  | 'leads:manage' | 'waitlist:manage' | 'makeups:manage'
  | 'continuation:manage' | 'recurring:manage'
  | 'practice:assign'
  | 'resources:upload' | 'resources:share'
  | 'messages:send_bulk' | 'messages:templates';

const PERMISSIONS_BY_ROLE: Record<AppRole, Permission[]> = {
  owner: [...] /* all */,
  admin: [...] /* all except settings:billing-cancel */,
  teacher: [...] /* read-mostly + own students */,
  finance: [...] /* invoices, payments, reports */,
  parent: [] /* uses different permission system */,
};

export function useCan(perm: Permission): boolean { ... }
export function useCanAny(...perms: Permission[]): boolean { ... }
```



**Migration mechanics:**
1. Add `useCan` hook with full permission table.
2. Create a codemod (or manual sweep, ~3 days) replacing all `currentRole === '...'` and `isOrgAdmin` / `isOrgOwner` references with the appropriate `useCan('...')`.
3. Keep `isOrgAdmin` / `isOrgOwner` as deprecated convenience aliases for now (mark with `@deprecated`).
4. Audit-log every permission denial (helps detect attempted privilege escalation).

**Why first:** this unblocks every subsequent refactor. Once permissions are abstract, role consolidation is just changing the table.

**Out of scope:** server-side RPC permission checks. RLS already handles it. `useCan` is purely UI gating.

**Definition of done:**
- Zero `currentRole === '...'` references in `src/components/` and `src/pages/` (greppable).
- All `isOrgAdmin` / `isOrgOwner` uses have a `useCan(...)` equivalent commented in.
- 30+ permission tests in `src/test/permissions/`.
- audit/MASTER.md row added: "Permission system migration" with state ✅.

**Budget:** 5 working days.

**Risk:** RBAC test (`tests/e2e/rbac.spec.ts`) regressions. Mitigate: run full RBAC suite after each batch of 20 file changes.

---

### 5.2 PR2 — Lead ↔ enrolment_waitlist merge
**Goal:** resolve §1.5 item 1.

**Verified problem:** these are the same entity at different stages. Both have contact details. Both have child records. Both have a stage/status workflow ending in "enrolled". Both have a `convert_*` RPC of nearly identical shape. `enrolment_waitlist.lead_id` already exists, suggesting they were meant to be linked.

**Target shape:**
- Single concept: **prospect** with a state machine.
- States: `enquiry → contacted → trial_booked → trial_completed → waitlist → offered → accepted → enrolled` (plus terminal: `lost`, `withdrawn`).
- Single table backing it (recommend keeping `leads` and migrating `enrolment_waitlist` data into it; `leads.stage` enum is already extensible).
- Single UI surface: a Pipeline page that defaults to a kanban with all stages visible. The "Waitlist" view is just a filter (`stage IN ('waitlist', 'offered', 'accepted')`).

**Migration plan:**
1. Add states to `lead_stage` enum: `waitlist`, `offered`, `accepted` (currently the enum is `enquiry, contacted, trial_booked, trial_completed, enrolled, lost`). Add migration.
2. Add columns to `leads` for the data only `enrolment_waitlist` had:
   - `preferred_days text[]`, `preferred_time_earliest time`, `preferred_time_latest time`
   - `preferred_teacher_id`, `preferred_location_id`
   - `instrument_id` (currently `leads.preferred_instrument` is just text — upgrade to FK)
   - `lesson_duration_mins int`
   - `position int` (for waitlist ordering)
   - `offered_slot_day text`, `offered_slot_time time`, `offered_teacher_id`, `offered_location_id`, `offered_rate_minor int`, `offered_at`, `offer_expires_at`, `offered_at`, `responded_at`, `offer_message_id`
   - `priority text`
3. Migrate `enrolment_waitlist` rows into `leads` rows (one-time data migration, idempotent — run, verify counts, run cleanup).
4. Update RPC: replace `convert_waitlist_to_student` and `convert_lead` with a single `convert_lead_to_student(lead_id, student_data)` that handles both cases (the difference is only data shape — same flow).
5. Update RPC: rename `add_to_enrolment_waitlist` → `move_lead_to_waitlist(lead_id)` (just a stage update with audit).
6. Update RPC: rename `withdraw_from_enrolment_waitlist` → `mark_lead_withdrawn(lead_id, reason)`.
7. Update RPC: rename `respond_to_enrolment_offer` → `respond_to_lead_offer(lead_id, response)`.
8. Update edge fn: rename `send-enrolment-offer` → `send-lead-offer`.
9. Update edge fn: `enrolment-offer-expiry` → `lead-offer-expiry`. Cron job entry updated.
10. Update edge fn: `waitlist-expiry` → `lead-waitlist-expiry`.
11. Frontend: merge `Leads.tsx` + `EnrolmentWaitlistPage.tsx` into single `Pipeline.tsx`. Two saved views (list/kanban). Filter by stage.
12. Frontend: merge `LeadDetail.tsx` + `WaitlistEntryDetail.tsx` into `LeadDetail.tsx`.
13. Drop `enrolment_waitlist`, `enrolment_waitlist_activity` tables (after data verified migrated).

**Important:** keep `make_up_waitlist` separate. It's a different concept (existing students who missed lessons). Only enrolment_waitlist is being merged.

**Definition of done:**
- Single Pipeline page replaces both old pages; same kanban + list + funnel chart + filters work.
- All RPCs renamed; old names removed (no aliases — clean break).
- Cron jobs updated.
- Test data: existing fixtures in `seed-e2e-data` migrate cleanly.
- audit/MASTER.md rows updated; `enrolment_waitlist` row removed; new "Pipeline" row added.

**Budget:** 8 working days.

**Risk:** real production data has both leads and enrolment_waitlist rows. Lauren's school may have entries in both. Migration must be tested against a Lauren-shaped fixture before applying. Also: existing emails-in-flight reference `enrolment-offer-expiry` cron name; the rename must coordinate with active offer rows.

---

### 5.3 PR3 — Settings IA pass
**Goal:** resolve §1.5 item 3.

**Verified problem:** 24 tabs, 10,596 LoC, no search, no grouping. `BillingTab.tsx` alone is 1,292 lines.

**Target shape:** 6 sections in a left rail, each with grouped sub-tabs. Sections:

1. **Account** (own profile) — Profile, Notifications, Help & Tours
2. **Organisation** — Org details, Branding, Members, Privacy, Audit log
3. **Teaching** — Schedule, Closure dates, Terms, Locations & rooms, Rate cards, Music settings (instruments, exam boards), Availability
4. **Billing** — Plan & subscription, Invoice settings, Payment methods, Auto-pay defaults
5. **Communications** — Messaging settings, Templates, Continuation defaults
6. **Integrations** — Calendar, Zoom, Accounting (Xero), Booking page, Data import

Search box at top (filters tabs by name + content).

**Mechanics:**
- New `SettingsLayout.tsx` with sectioned nav.
- URL changes from `?tab=billing` to `?section=billing&tab=plan`. Add a backwards-compat shim that redirects old URLs.
- Each tab component stays the same internally (reduce churn). Just regroup.
- Search uses a static index (tab title + 5-10 keywords per tab). Live filter.
- Tabs hidden behind feature flags don't show even when their section is open.

**Definition of done:**
- 24 tabs grouped into 6 sections.
- Search reduces visible tabs in <50ms.
- Mobile: section list → tab list → tab content (3-deep navigation, all back-button friendly).
- Old URLs (`?tab=billing`) still resolve via redirect.
- audit/MASTER.md "Settings (org config)" row updated to ✅ after manual sweep of every tab.

**Budget:** 4 working days.

**Risk:** mobile navigation regression. Test every section/tab on iPhone 14 viewport.

---

### 5.4 PR4 — Send-* edge function consolidation
**Goal:** resolve §1.5 item 5.

**Verified problem:** 21 send-* and notify-* edge functions. Most have bespoke implementations of: From-header construction, Resend API call, sanitisation, message_log insertion, rate limiting.

**Target shape:** one `send-notification` edge function + a typed dispatch table.


```ts
// supabase/functions/send-notification/index.ts
export type NotificationType =
  | 'invoice_send' | 'invoice_reminder' | 'invoice_paid_receipt' | 'invoice_void'
  | 'payment_failed' | 'payment_dispute' | 'refund_processed'
  | 'auto_pay_upcoming' | 'auto_pay_failed' | 'auto_pay_alert'
  | 'lesson_reminder' | 'lesson_cancelled'
  | 'makeup_match' | 'makeup_offer'
  | 'enrolment_offer' | 'continuation_request'
  | 'practice_streak_milestone'
  | 'invite_member' | 'invite_guardian'
  | 'message_internal' | 'message_parent'
  | 'parent_enquiry' | 'contact_form'
  | 'recurring_billing_alert'
  | 'notes_published';

interface NotificationContext {
  org_id: string;
  recipient: { user_id?: string; email: string; type: 'staff' | 'guardian' | 'public' };
  payload: Record<string, unknown>; // type-specific
  actor_user_id?: string;
}
```



A single `send-notification(type, context)` invocation replaces all 21 fns. Templates live in code (one per type), shared logic in `_shared/notification-core.ts`.

**Migration mechanics:**
1. Create `_shared/notification-core.ts` lifting the common logic from `_shared/send-invoice-email-core.ts` (already factored — generalise it).
2. Create `send-notification` edge fn dispatching by type.
3. For each of the 21 existing fns: keep as-is at first, but make them thin wrappers calling `send-notification` internally. This means 21 deploys of 5-line wrappers instead of 21 bespoke implementations.
4. Verify all 21 still work end-to-end.
5. Update each call site in `src/` (64 invoke calls) to use `send-notification` directly. Stop calling the old wrappers.
6. After ~2 weeks of zero usage, delete the 21 old fns.

This phased migration means we never break anything — the old fns work until they don't have callers.

**Definition of done:**
- `send-notification` exists; all 21 types implemented.
- All 64 call sites in `src/` migrated.
- 21 old fns marked deprecated; remove date set 30 days post-migration.
- 1 unified template registry; consistent From-header / sanitisation / rate-limit / message_log.
- New audit row: "Send notification system".

**Budget:** 6 working days.

**Risk:** template differences between old fns are subtle (e.g. `send-invoice-email` formats differently from `send-invoice-email-internal`). Test side-by-side via test harness that compares output.

---

### 5.5 PR5 — Hide everything not in launch scope behind feature flags
**Goal:** present a coherent surface for launch without deleting code.

**Verified mechanism:** `src/hooks/useFeatureGate.ts` already exists with 17 features mapped to plans. Extend with launch flags.

**Target shape (per revised launch scope §3):**

```ts
// src/hooks/useFeatureGate.ts (extended)
export type LaunchFlag =
  | 'leads_pipeline'           // Hide for v1.0 — Lauren confirmed not required
  | 'enrolment_waitlist'       // Hide for v1.0 — Lauren confirmed not required
  | 'lead_funnel_chart'        // Hide — predicated on leads
  | 'recurring_templates'      // Hide for v1.0 (use billing runs)
  | 'booking_page'             // Hide for v1.0 — Lauren confirmed can wait
  | 'zoom_integration'         // Hide for v1.0 — no full Zoom approval yet
  | 'parent_self_reschedule'   // Default off (admin_locked default policy)
  | 'parent_loopassist'        // Hide for v1.0 — light up after staff LoopAssist proven
  | 'agency_plan_visible';     // Hide tier visibility; show "Contact us" instead

const LAUNCH_FLAGS: Record<LaunchFlag, boolean> = {
  leads_pipeline: false,
  enrolment_waitlist: false,
  lead_funnel_chart: false,
  recurring_templates: false,
  booking_page: false,
  zoom_integration: false,
  parent_self_reschedule: false,
  parent_loopassist: false,
  agency_plan_visible: false,
};

export function useLaunchFlag(flag: LaunchFlag): boolean {
  // Allow staging override via env
  return LAUNCH_FLAGS[flag];
}
```



**LoopAssist scoped capability flag** (separate from launch flag — controls which tools the agent can use):

```ts
// src/lib/action-registry.ts (extended)
export const LAUNCH_LOOPASSIST_TOOLS_ENABLED = {
  // Read-only / explanatory — enabled at launch
  read_schedule: true,
  read_students: true,
  read_invoices: true,
  read_reports: true,
  navigate_to_page: true,
  summarise_data: true,
  answer_question: true,
  // Destructive — disabled at launch, light up v1.1
  create_invoice: false,
  send_message: false,
  modify_lesson: false,
  reschedule_lesson: false,
  process_refund: false,
  modify_student: false,
};
```



**Internal messages org-gate** (per §3.5):

```ts
// Already exists or add: organisations.enable_internal_messaging boolean DEFAULT false
// Settings UI: "Enable team messaging" toggle in Communications section
// Internal messages routes/components gated on currentOrg.enable_internal_messaging
```



**Mechanics:**
1. Sidebar (`AppSidebar.tsx`) checks each link against its launch flag; hides if off.
2. Routes: gate at `RouteGuard` level. Visiting hidden route redirects to `/dashboard` with toast "Coming soon".
3. Settings tabs gated to flag.
4. Dashboard widgets gated.
5. Per-environment override: `LAUNCH_FLAGS_OVERRIDE_*` env vars to flip in staging.
6. `agency_plan_visible` — `pricing-config.ts` filters PLAN_ORDER and PRICING_CONFIG when flag off; pricing page shows "Contact us for enterprise" tile in agency's slot.
7. LoopAssist destructive tools: `looopassist-execute` checks the launch flag before executing each tool type; refuses with friendly message if disabled.

**Definition of done:**
- Sidebar: only launch features visible by default.
- Routes: hidden features 404-equivalent (toast + redirect).
- Settings: only in-scope tabs visible.
- Pricing page: 2 tiers (Teacher + Studio) + Contact us CTA.
- LoopAssist destructive tools refuse at launch; read-only tools work.
- Internal messages hidden until org admin toggles on.
- E2E test: full app surface from sidebar → no orphan links to hidden features.
- Manual UX walk: a fresh user sees a coherent surface.

**Budget:** 3 working days.

**Risk:** hidden features may have hidden cross-dependencies (e.g. a Continuation flow might link to a Leads page for source). Walk every flow once with all flags off; fix any broken links.

---

### 5.6 PR6 — Edge fn Sentry instrumentation
**Goal:** close the 🔴 audit row "Sentry capture (edge functions)".

**Verified problem:** zero edge functions instrumented. Errors only surface in Supabase logs.

**Target shape:** `_shared/sentry.ts` module providing `wrapEdgeFn(handler)` that:
- Captures uncaught errors to Sentry with org_id / user_id / function_name tags
- Adds breadcrumbs for major operations
- Doesn't double-report errors that are already user-facing

**Migration mechanics:**
1. Create `_shared/sentry.ts`. Use `@sentry/deno` (or DSN-based fetch fallback if Deno SDK isn't ready).
2. Wrap the 20 highest-traffic / highest-criticality functions first:
   - `stripe-webhook`, `booking-submit`, `onboarding-setup`, `invite-accept`, `profile-ensure`, `looopassist-chat`, `looopassist-execute`, `send-invoice-email`, `stripe-create-payment-intent`, `stripe-process-refund`, `recurring-billing-scheduler`, `create-billing-run`, `csv-import-execute`, `gdpr-export`, `gdpr-delete`, `account-delete`, `continuation-respond`, `bulk-process-continuation`, `calendar-sync-lesson`, `process-term-adjustment`.
3. Subsequent batches in PR follow-ups: 30 more, then the long tail.

**Definition of done:**
- 20 priority fns instrumented.
- One week of staging logs show clean Sentry breadcrumbs.
- audit/MASTER.md "Sentry capture (edge functions)" row → 🟢.

**Budget:** 4 working days for first 20; remainder folds into Track B.

**Risk:** Deno + Sentry SDK compatibility issues. Fallback: HTTP fetch to Sentry ingestion API directly (5 lines).

---

### 5.7 Sequence summary

| Week | PR | Status |
|---|---|---|
| 1 | PR1 (useCan) | Track A starts |
| 2 | PR1 finishes; PR5 (launch flags) starts | |
| 3 | PR5 finishes; PR3 (settings IA) starts; PR2 (lead/waitlist merge) starts in parallel | Track D shadow migration starts here (Lauren's first week of double-entry) |
| 4 | PR3 finishes; PR4 (send-fn consolidation) starts | |
| 5 | PR2 finishes; PR4 continues | |
| 6 | PR4 finishes; PR6 (Sentry edge) | Track A done; Track B continues; Track D continuing |
| 7-12 | Track B audit sweep + Track D shadow term + Track C blocker close-out + Track E beta cohort onboarding | |
| 13+ | Beta in real money | |
| When all 8 launch gates ✅ | Public launch | |

Total Track A engineering: ~6 weeks. Track D Lauren shadow term: 12 weeks. Critical path: Track D, not Track A. So Track A finishes well before launch and the team can pivot to bug fixing during shadow term.

---

## 6. Track B: launch readiness sweep

**Goal:** drive every audit/MASTER.md row from 🟡 → ✅ via the existing `/sweep` slash command.

**Mechanism:** The slash command already exists. It picks the next P0 ❓ row and runs the standard template (smoke / functional / edge / RLS / mobile / Sentry). It updates state and files findings.

**v2 plan additions:**
1. **After Track A PR1**, re-run `/sweep` on every row affected by the permissions migration (`students`, `lessons`, `invoices`, `teachers`, `settings`).
2. **After Track A PR2**, re-run `/sweep` on `leads`, removed `enrolment_waitlist` row, new `pipeline` row.
3. **After Track A PR3**, re-run `/sweep` on `settings`.
4. **Daily during Track D**, run `/sweep` on the feature Lauren reports a friction with.

**Cadence:** the existing flow runs at Jamie's discretion. Recommend: 2 sweeps per day, 5 days per week. At ~30 min each, 150 sweeps in 4 weeks → covers all 180 rows.

**Definition of done:** all P0 ✅, all P1 ✅ or ⏸ documented, P2 ✅ or accepted with mitigation.

**Output:** continuously updated `audit/MASTER.md`; new findings filed in `audit/findings/` per existing convention.

---

## 7. Track C: external blockers close-out

10 blockers from `audit/00-launch-readiness.md`. Recommendations:

| # | Blocker | Action | Lead time | Owner |
|---|---|---|---|---|
| 1 | Google OAuth verification | Submit to Google verification this week | 2-6 weeks | Jamie + lawyer-equivalent |
| 2 | Sentry source maps | Already configured 2026-05-08; verify next deploy | 0 | Done; verify in Track B |
| 3 | Source Supabase decommission | 14-day pause minimum from cutover; confirmed at 2026-05-21 → pause; 2026-08-19 → delete | 90 days | Jamie |
| 4 | Apple OAuth | Decide: configure (a), strip from iOS (b), or web-only launch (c). Recommend (b) — magic-link + Google = privacy-preserving per Apple guideline 4.8 | 0 if (b), weeks if (a) | Jamie |
| 5 | Cloudflare WAF/CSP | Decide: flip orange-cloud or rely on Netlify alone. Recommend: orange-cloud for DDoS + WAF; takes 30 min config | 1 day | Agent |
| 6 | Cookie consent banner | Implement. Klaro or similar. Track GA, Sentry, Stripe consent | 2 days | Agent |
| 7 | Anthropic sub-processor disclosure | Update Privacy Policy to list Anthropic as sub-processor (since LoopAssist uses Claude) | 1 day | Jamie + agent |
| 8 | Stripe Checkout branding | Configure Stripe dashboard: logo, colours, return URL | 1 hour | Jamie |
| 9 | Edge fn Sentry | Track A PR6 covers first 20; rest in Track B | 4 days + ongoing | Agent |
| 10 | App Store iOS submission | v1.2 in review per audit; for v2 launch new build needed with feature-flag changes | 2 weeks Apple review | Jamie |

**Critical path: items 1, 4, 10.** Google OAuth verification can take 6 weeks. Apple App Store review can take 2 weeks. Plan launch around the longer of these two.

---

## 8. Track D: Lauren shadow migration

**Goal:** Lauren's school runs on LL in shadow mode for one full term. End of term reconciliation shows zero discrepancies.

### 8.1 Pre-shadow setup (week 1)
- Snapshot Lauren's current systems (her spreadsheets, current invoicing tool, calendar). Export everything.
- Migrate via CSV import into a fresh org in production. Verify counts: students × N, guardians × N, current term lessons × N.
- Set up payment methods on a parent or two (Lauren-friendly volunteers).
- Enable Lauren as owner; add her admin and teaching staff via invite.

### 8.2 Shadow term (weeks 2-13)
- **Every lesson** scheduled in both LL and Lauren's old system.
- **Every attendance** recorded in both.
- **Every invoice** generated in both, but only sent from Lauren's authoritative system at first. After 4 weeks if zero discrepancies, switch authoritative source to LL for billing.
- **Weekly reconciliation**: spreadsheet diff, every Sunday. Discrepancies → bug ticket → fix in Track A or Track B.

### 8.3 Bug capture
- Each issue Lauren reports → file in `audit/findings/` with `lauren-` prefix.
- Triage same day; fix within 48h for P0/P1; defer with notes for P2/P3.
- Weekly review: are bugs tapering? If not, extend shadow.

### 8.4 Exit criteria
- 12 weeks elapsed.
- Zero discrepancies in week 12.
- Last 2 weeks: zero new P0/P1 bugs.
- Lauren signs off: "I would be confident running this without my old system."

If exit criteria not met by week 12, extend by 2 weeks and reassess.

### 8.5 Risk
The biggest risk: Lauren stops doing double-entry because it's painful. Then we lose the discrepancy signal. Mitigation: weekly check-ins; reduce double-entry burden as confidence grows (e.g. start single-system on attendance after week 4 if attendance is clean).

---

## 9. Track E: beta cohort

**Goal:** 3-5 hand-picked teachers from the waiting list onboarded by week 8 of shadow term.

### 9.1 Selection criteria
- UK-based.
- Different operating models from Lauren (solo teacher, small studio, peripatetic, multi-school) to stress different paths.
- Patient temperament — willing to flag bugs without churning.
- Permanent discount or free first term in exchange for feedback commitment.
- Not the most influential people on the list. Save those for v1.0 launch when system is stable.

### 9.2 Onboarding cadence
- One per week starting week 8 of shadow term.
- 1-on-1 onboarding call with Jamie. Walk through their setup. Migrate their data via CSV.
- Slack channel or shared doc for ongoing feedback.

### 9.3 Exit criteria
- 3+ teachers onboarded.
- Each has run 4+ weeks on LL with real money flowing.
- No P0 bugs in last 2 weeks.
- Each says "I'd recommend this to another teacher".

---

## 10. What I'm explicitly NOT doing in v2

I'm calling these out so they don't sneak back in:

1. **Not collapsing roles to 3.** The 5-role model has scars (the comment in `Settings.tsx` about teacher/finance UX mismatch is one). The right fix is the permissions hook (PR1) + per-org permission flags. Don't change the role enum at the DB level.
2. **Not unifying audit-log tables.** Six tables exist. Each works. Migration risk too high pre-launch.
3. **Not consolidating PDF rev triggers.** 11 triggers, each correct. Cosmetic debt.
4. **Not consolidating seed functions.** Dev-only. Already env-gated. Deal with later.
5. **Not merging `teachers` and `org_memberships`.** `protect_teacher_user_link` keeps them in sync. The duality has scars (probably good ones). Defer.
6. **Not collapsing 6 lesson-UI components into 2.** Track A is full; this would cost 2-3 weeks. Defer to v1.1.
7. **Not collapsing 6 calendar view components into 2.** Same.
8. **Not building MCP server.** Tempting (it's a real differentiator, no competitor has it) but exact-wrong-time. Build at v1.2 once core is stable and Claude-using teachers exist as a real audience. Idea logged in `docs/POST_LAUNCH_OPPORTUNITIES.md`.
9. **Not redesigning the marketing site.** It's static HTML; not part of the app. Out of scope.
10. **Not redesigning the design system.** shadcn-ui + Tailwind works; consistency comes through linting, not from rebuilding.
11. **Not collapsing Daily Register and Batch Attendance.** Both work; merging into one page with a mode toggle is v1.1.
12. **Not changing the DB enum for plan/org_type names.** The display-layer rename in `pricing-config.ts` handles this. Migration risk too high.

---

## 11. Concrete next steps for Jamie

1. **Read this doc.** Not skim — read.
2. **Review the launch scope decisions in §3.** Approve or revise each row in §3.1, §3.2, §3.3. Answer the 10 questions in §3.4.
3. **Decide on Track C item 4** (Apple OAuth: configure, strip, or web-only launch).
4. **Check `audit/00-launch-readiness.md`** to confirm the 10 blockers are still the right list. Update if any have closed since 2026-05-08.
5. **Once approved**, invoke Claude Code with the prompt below to start Track A PR1. (See §12.)
6. **Schedule Track D start date** (Lauren shadow migration). Recommend: 2 weeks after Track A PR1 lands, so the system is stable enough not to thrash Lauren during her first shadow week.

---

## 12. Claude Code prompt template for executing the plan

When ready, give Claude Code this initial message along with this plan doc:


```
You're executing the LessonLoop v2 plan (LESSONLOOP_V2_PLAN.md).

Operating model:
- I (Jamie) am non-technical. You execute; I review at PR boundaries.
- Read audit/MASTER.md first. Read STATUS.md if it exists.
- Every change traces to either: (a) §5 of the plan, or (b) an audit/findings/ file.
- Never invent fixes. If you find something not in the plan or the audit,
  file a finding in audit/findings/ and halt for my decision.
- Halt early, halt often. If scope drifts beyond a single PR's stated bounds, halt.
- Each PR ships green: typecheck, lint, build, e2e tests against staging.

Phase 1 (this session): execute Track A PR1 (useCan permissions hook).

Step 1: read the plan section §5.1 in full.
Step 2: read src/contexts/AuthContext.tsx and src/contexts/OrgContext.tsx for current
  role/membership shape. Confirm against §5.1 design.
Step 3: produce a 1-page implementation outline including:
  - Full Permission enum (final list, not draft)
  - PERMISSIONS_BY_ROLE table (final, not draft)
  - useCan / useCanAny hook signatures
  - Migration script (codemod or manual sweep plan)
  - Test additions to src/test/permissions/
Step 4: STOP. Show me the outline. Wait for my approval.
Step 5 (after approval): implement, ship as a single PR.

Hard rules:
- Don't touch DB schema.
- Don't change RouteGuard logic.
- Don't change RLS policies.
- Don't merge any feature changes — pure refactor only.
- All existing tests must still pass.
- Add new tests for the hook itself.
```



For PR2 (lead/waitlist merge), PR3 (settings IA), PR4 (send-fn consolidation), PR5 (launch flags), PR6 (Sentry edge), use the same pattern. One PR per Claude Code session. One implementation outline approval before code. One PR review before merge.

---

## 13. Honest open questions

These are things I couldn't resolve from the codebase alone. Jamie owns the answers.

1. **Is Lauren's school actually using `enrolment_waitlist`, or only `leads`?** The DB has 11 leads and 5 enrolment_waitlist entries. If she only uses one, the merge is easier (no real data migration). Verify before PR2.

2. **Is Lauren currently on LessonLoop's parent portal at all, or just the staff side?** This affects how much portal hardening is needed before shadow migration.

3. **Does the waiting list expect a launch date?** If yes, communicate "early access starts later this year, no public launch date yet" to manage expectations. Don't commit to a date.

4. **Is there a scenario where v1 launch is web-only and iOS comes 2 weeks later?** This would unblock Track C item 4. Recommend: yes, web-first launch, iOS follows. Most B2B SaaS launches this way.

5. **Is `make_up_waitlist` actually used in Lauren's school?** Audit shows credits feature works (61 historical practice logs unrelated, but `make_up_credits` has 14 rows, `make_up_waitlist` has 15). If yes, makeup is a launch feature. If no, hide it.

6. **What's the messaging for the existing waiting list?** Pre-launch communication strategy. Out of scope for this plan, but needed before launch.

7. **Who handles legal — privacy policy update, ToS, sub-processor list?** Each blocker in Track C requires accuracy. If not Jamie, who?

8. **Stripe Connect or platform Stripe at launch?** Plan currently recommends platform Stripe (Lauren's payments go to LL's Stripe, LL transfers to her). This is simpler but may not be how she wants money flowing. Confirm.

9. **What's the actual revenue flow Lauren needs?** Does she want each invoice paid into her bank? Monthly payouts? This affects whether Stripe Connect is launch or v1.1.

10. **Cancellation policy for v1 customers?** Refund policy? Trial-to-paid conversion approach? These are product decisions that don't block engineering but block launch comms.

---

## 15. Operating model — how Claude Code actually executes this

The v2 work runs **inside the existing audit framework**, not alongside it. The audit/MASTER.md is the backlog. The `/sweep` agent is the default activity. Architecture PRs are inserted into the queue; each PR closes a specific cluster of audit rows when it lands.

This means: nothing pauses, nothing forks. The Playwright sweep continues. The `/sweep` cron of "next P0 🟡 row" continues. The architecture PRs interleave.

### 15.1 Three modes of work

Every Claude Code session is one of three things:

**Mode 1: "Continue the sweep."** Default. Claude Code runs `/sweep` on the next P0 🟡 row, files findings if it discovers bugs, updates the row's state, commits.

**Mode 2: "Execute PR N."** Architecture-cleanup mode. Claude Code reads the relevant §5 section of this plan, produces an outline, halts for Jamie's approval, then implements in batches. After landing, runs `/sweep` on every audit row affected by the PR.

**Mode 3: "Halt and explain."** When something is ambiguous, when scope is drifting, when a finding is irreversible. Claude Code halts, writes a halt message, updates STATUS.md, waits for Jamie. This follows the existing handover protocol (`docs/HANDOVER_2026-05-02.md`).

### 15.2 Jamie's role

- Read STATUS.md / V2_SEQUENCE.md to know what's next.
- Approve outlines before implementation.
- Review diffs after batches.
- Push back when scope drifts.
- Run `/sweep` between architecture PRs to mop up the audit backlog.
- Make the decisions in §3.7 when they come up.
- Onboard Lauren when shadow term starts.
- Recruit beta cohort when shadow term mid-point hits.

Estimated time: ~4-6 hours/week of Jamie review/approval; rest is Claude Code working alone with halts at decision points.

### 15.3 Phase 0 — integrate plan into audit (do this first)

Before any architecture PR, one Claude Code session that does NO code work but creates the queue document. The prompt is included separately as the kickoff input.

Output of Phase 0:
- 6 new rows added to `audit/MASTER.md` for the architecture PRs (all initially ❓)
- Annotations on existing audit rows showing which PR will unblock them
- Updated `audit/00-launch-readiness.md` reflecting revised scope (§3)
- New `audit/V2_SEQUENCE.md` — the work queue in execution order
- Updated `STATUS.md` `Next session handoff` block pointing at the queue
- New `docs/POST_LAUNCH_OPPORTUNITIES.md` with MCP server idea logged

### 15.4 Phase sequence with rough timing

| Week | Activity |
|---|---|
| 1 | Phase 0 (1 session, ~1 day). Then Phase 1: PR1 outline → approve → start batch 1 |
| 2 | PR1 batches 2-4. Audit re-sweep on role-affected rows |
| 3 | PR5 (launch flags). Lauren shadow term week 1 (data migration into staging) |
| 4 | PR3 (settings IA). Lauren shadow term week 2 (start parallel run; Xero connect) |
| 5-6 | PR4 (send-fn consolidation). Lauren shadow weeks 3-4. Xero verification milestone |
| 6-7 | PR2 (lead/waitlist merge — note: hidden at v1, but groundwork for v1.1) |
| 7 | PR6 (Sentry edge). Beta cohort: first teacher onboarded |
| 8-12 | Audit sweep continues. Lauren shadow weeks 5-9. Beta cohort grows to 3+ |
| 12 | Lauren shadow term complete. End-of-term reconciliation. Decision: launch-ready or extend |
| 12+ | When all 8 launch gates ✅ — public launch |

PR2 deliberately moved later: leads + enrolment_waitlist are HIDDEN at v1.0 launch (Lauren confirmed not required), so the merge is groundwork for v1.1 unlock, not a launch-blocker. Move to v1.1 phase if Track A is running tight.

### 15.5 Hard rules for every PR

These prevent scope drift and follow the existing handover protocol:

1. **Outline first.** No code until Jamie approves the outline.
2. **One PR = one purpose.** No "while I'm here" cleanups. File findings instead.
3. **Hard scope rules per PR** (e.g. PR1 has "no DB schema changes, no RLS changes, no RouteGuard logic changes, pure refactor only").
4. **Sandbox-test SQL** that uses non-trivial Postgres features. Use `Supabase:create_branch` for migrations before applying to dest.
5. **Each batch ships green.** Typecheck + lint + unit tests + relevant playwright. No batch lands red.
6. **Update audit/MASTER.md after the PR lands.** Affected rows go ✅ or get re-swept.
7. **Halt early, halt often.** When in doubt, halt and ask. Never invent fixes.

### 15.6 The Phase 0 kickoff prompt for Claude Code

This is the first thing Jamie pastes into Claude Code:


```
Read these files in order:
1. LESSONLOOP_V2_PLAN.md (this plan)
2. audit/MASTER.md
3. audit/00-launch-readiness.md
4. STATUS.md (if it exists; otherwise note absence)
5. docs/HANDOVER_2026-05-02.md
6. tests/e2e/PLAYWRIGHT_MASTER_CATALOG.md (if present)

Your task is Phase 0 of the v2 plan: integrate the v2 plan into the
existing audit framework. You're NOT writing application code; you're
updating planning docs.

Do NOT change DB schema, RLS, application code, or tests. This phase is
docs-only.

Specifically:

1. Add a new section to audit/MASTER.md titled "## v2 Architecture PRs"
   with 6 rows, one per PR. Format matches existing rows. Each row gets:
   - Feature name (e.g. "v2-PR1: useCan permissions hook")
   - Source (link to plan section, e.g. "LESSONLOOP_V2_PLAN.md §5.1")
   - Criticality: PR1, PR2, PR5 = P0; PR3, PR4, PR6 = P1
   - State: ❓ for all initially
   - Last audited: 2026-05-09 (today)
   - Notes: 1-line summary + dependencies (e.g. "PR3 depends on PR5")

2. For each existing P0/P1 audit row, scan the v2 plan §5 to see if
   it'll be affected by an architecture PR. If yes, append to the
   row's Notes column: "[blocked by PRn]" or "[unblocked by PRn]".
   Examples: any row mentioning role/permissions → blocked by PR1;
   "Settings (org config)" row → blocked by PR3 + PR5; any row that
   sends an email → potentially affected by PR4.

3. Update audit/00-launch-readiness.md:
   - Add a "## Revised launch scope (2026-05-09)" section pointing to
     LESSONLOOP_V2_PLAN.md §3
   - Mark Stripe Connect as launch-critical (was deferred)
   - Mark Make-up dashboard, Continuation, Term adjustments as launch
     (were "v1.1 candidate")
   - Mark Practice, Resources, all Reports as launch
   - Mark LoopAssist as scoped-launch (read-only at v1.0)
   - Mark Internal messages as org-gated launch
   - Mark Xero as conditional-on-shadow-term
   - Mark leads, enrolment_waitlist, recurring templates, booking
     page, Zoom as v1.1
   - Update the "Known launch blockers" list if any have closed since
     2026-05-08

4. Create a new file: audit/V2_SEQUENCE.md. Format: a queue of work
   items in execution order. Each item: a single Claude Code session
   prompt (what to do, what files to touch, definition of done, halt
   conditions). Phase 0 itself doesn't need to be in the queue
   (it's done by you, this session). Items in order:
   - Phase 1a: PR1 outline session
   - Phase 1b-1d: PR1 implementation batches 1-3
   - Phase 1e: post-PR1 audit re-sweep
   - Phase 2: PR5 outline + implementation
   - Phase 3: PR3 outline + implementation
   - Phase 4: PR4 outline + implementation
   - Phase 5: PR2 outline + sandbox migration test + implementation
     (NOTE: this is groundwork for v1.1 since leads are hidden at
     launch — can defer)
   - Phase 6: PR6 (Sentry edge) outline + implementation
   - Track B: ongoing /sweep cadence (runs in gaps between phases)

5. Update STATUS.md (or create if missing) with a "Next session
   handoff" block pointing at audit/V2_SEQUENCE.md Phase 1a.

6. Create docs/POST_LAUNCH_OPPORTUNITIES.md with at minimum:
   ## MCP Server (v1.2 candidate)
   Brief description: an MCP server exposing LessonLoop's tools to
   Claude / other MCP clients. Architecture sketch: per-user API
   tokens, scoped tool access, leverages existing action-registry.ts
   and looopassist-execute infrastructure. Build after v1.0 stable
   with 50+ paying customers. Target audience: Claude-using teachers
   who want LessonLoop callable from their AI assistant. Security
   surface needs review before build.

When done:
- Show me the diff (what files you changed and a summary of each)
- Halt; do not start Phase 1a yet
- Confirm next-session prompt for Phase 1a is in V2_SEQUENCE.md and
  ready to execute

Halt conditions for THIS session:
- If audit/MASTER.md row format is unclear → halt and ask
- If STATUS.md exists with conflicting info → halt and ask
- If existing findings disagree with the plan's scope decisions →
  halt and ask
- If any docs say something that contradicts what I've written here →
  surface the contradiction, halt
```


That's the kickoff. After Jamie approves Phase 0's output, Claude Code reads V2_SEQUENCE.md Phase 1a and starts PR1 outline.

---

## 16. Closing note

This plan exists because I went back into the code rather than working from memory. The differences from my earlier-message recommendations:

- I had under-counted the maturity of the existing infrastructure (the `_shared/` modules, the RLS helpers, the audit/MASTER.md tracker, the `/sweep` system).
- I had over-stated the conflations (make-up is genuinely separate from leads/waitlist; my earlier "merge three" framing was wrong).
- I had under-stated the operational reality (Jamie is non-technical, delegates to AI assistants, has a documented handover protocol — the plan must integrate with that, not replace it).
- I had over-stated the case for greenfield rewrite. With 424 migrations of accumulated correctness, 28 triaged findings, a working `/sweep` agent, and a documented launch readiness tracker, there is no version of "rewrite cleanly" that doesn't throw away weeks of real work.
- I had originally over-cut the launch scope. After Lauren's review: make-up, continuation, term adjustments, practice, resources, reports, Stripe Connect, scoped LoopAssist, Xero (conditional), multi-org switching, internal messages (org-gated), demo seeds — all in. The launch is heavier than my first cut, but every item in it is mature code that's already audit-tracked.

The plan is **refactor in place, ruthlessly bound by the launch criterion, with the existing audit infrastructure as the gating mechanism, and a 12-week shadow term with Lauren as the forcing function for "is this actually production-ready?".**

If executed, v1 launches with:
- A coherent surface (settings IA fixed, hidden features hidden, leads/waitlist deferred to v1.1)
- A clean permission model (`useCan` everywhere, no role-string sprawl)
- Consolidated edge functions (one notification system instead of 21)
- Full Sentry coverage (top 20 critical edge fns instrumented, browser source maps live)
- A real production user (Lauren) who has run a full term in shadow
- 3+ beta teachers running real money
- All `audit/MASTER.md` P0 rows ✅
- All 10 launch blockers ✅ or ⏸ with mitigation
- Stripe Connect actually enabling studios to take money to their own bank
- A scoped LoopAssist as the differentiator, not a half-built feature

Total elapsed: 12-16 weeks from Track A start. No fixed date — gates, not deadlines.

---

*Plan drafted 2026-05-09 by Claude after deep recon of `lessonloop3-main` and live verification against Supabase project `xmrhmxizpslhtkibqyfy`. Revised same day after Lauren feature-by-feature review. All numbers and claims grounded in code or DB queries. Where I made a recommendation rather than a fact, I marked it as such.*
