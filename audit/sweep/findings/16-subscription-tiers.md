# findings/16-subscription-tiers.md

## §1 Summary

**Batch**: 16-subscription-tiers
**Session**: s55 (2026-05-17)
**Banner**: AUDIT IN PROGRESS — DO NOT FIX YET
**Mode**: audit-only (no code touched outside `audit/sweep/` and `HANDOVER.md`)

### V2_PLAN.md scope authority (drift #37 verbatim cites)

Per drift #37 OPERATIONAL CARRY mandate, every V2_PLAN.md scope claim in this finding doc includes verbatim line cite from V2_PLAN.md. CC Phase 0 prep detected drift #37 violation in s55 launching prompt (cited §3.6 L302-303 for "Plan tiers: Teacher + Studio visible at launch; Agency hidden (Contact us)" but verbatim verification places that content at L306). Drift #40 sub-instance A PATCH 1 applied at Phase 1.2.

Verbatim L301-L311 (5-line context centered on L306):
- L301: ✅ LoopAssist scoped at launch (read-only enabled, destructive deferred)
- L302: ✅ Internal messages org-gated, default off
- L303: ✅ Xero conditional on shadow-term verification
- L304: ✅ Multi-org switching kept (auto-hides for single-org)
- L305: ✅ Demo seeds kept (already env-gated)
- **L306: ✅ Plan tiers: Teacher + Studio visible at launch; Agency hidden ("Contact us")**
- L307: (blank)
- L308: ### 3.7 Decisions still needed
- L309: (blank)
- L310: 1. ☐ Apple OAuth: configure (a) / strip from iOS (b) / web-only launch (c). Recommend (b).
- L311: 2. ☐ Cloudflare proxy decision for `app.lessonloop.net` (orange-cloud or Netlify-only).

### Findings delta

**8 fresh F-16-NNN findings** (0C / 0H / 2M / 6L); F-16-001 through F-16-008 CONTIGUOUS.

| ID | Severity | Class one-liner |
|---|---|---|
| F-16-001 | LOW | `complete_onboarding` early-RETURN information disclosure (Path A; bool+uuid only via idempotency check + recovery check) |
| F-16-002 | LOW | `protect_subscription_fields` silent-revert anti-pattern (no `RAISE EXCEPTION` on non-service-role; caller has no failure signal) |
| F-16-003 | LOW | `_max_students` DEFAULT -1 + `_trial_days` DEFAULT 14 DEAD-CODE LATENT in `complete_onboarding` RPC (FE always overrides) |
| F-16-004 | LOW | Trigger coverage-gap cohort (4 high-confidence ungated tables) + UPDATE/DELETE coverage gap on 8 currently-gated tables (consolidated) |
| F-16-005 | LOW | `is_org_active` vs `is_org_write_allowed` 3-layer past_due grace inconsistency (FE useFeatureGate 7d / DB trigger 7d / RLS strict no-grace) |
| F-16-006 | MEDIUM | Missing UI for `cancelled`+`paused` subscription_status states (UpgradeBanner + TrialExpiredModal don't surface; BillingTab provides partial recovery) |
| F-16-007 | MEDIUM | Agency tier visibility V2_PLAN-FE divergence (V2_PLAN §3.6 L306 hidden + FE renders self-serve £79/mo) |
| F-16-008 | LOW | CC-19 #11 column-CHECK-absent cohort enrichment (7 organisations subscription-cohort columns; cross-batch audit-lens at batch-16) |

**Plus 9 closed-batch citations + cross-batch observations** (§3.9 through §3.17); no fresh F-16-NNN IDs allocated against these surfaces per closed-batch immutability (PLAN.md §6).

### Cumulative tally projection

Pre s55: **176** / 21C / 51H / 26M / 78L
Batch-16 delta: +8 (0C + 0H + 2M + 6L)
Post s55: **184** / 21C / 51H / 28M / 84L

Triple-cross-verify per drift #27 mitigation at Phase 9.1:
- Bracket sum: 21 + 51 + 28 + 84 = **184** ✓
- Per-batch-row sum: 5 + 36 + 36 + 5 + 5 + 11 + 8 + 7 + 10 + 10 + 8 + 4 + 8 + 4 + 7 + 12 + **8** = **184** ✓
- Header total: 176 + 8 = **184** ✓

PI cohort 5 unchanged: 1C / 3H / 1M / 0L (no PI-12 / PI-16 cross-batch reach surfaced at batch-16; PI-10 PARTIAL-HANDOVER from s54 unchanged — calendar-sync portion already addressed; Zoom sub-surface still owned by batch-18 upcoming).

### Pattern catalog deltas

**UNCHANGED COUNTS**: 37 placed + 6 candidates + 8 sub-class introductions + 1 NEGATIVE-instance flag.

Cohort-evidence enrichments (documentation-only; no slot count change):
- **Pattern #41 RLS-policy substrate sub-class cohort-evidence 1 → 2** via F-05-001 retrofit framing (F-05-001 closed-batch-05 CRITICAL anchor PRE-DATES the Pattern #41 framework s51 + RLS-policy substrate sub-class s54 introduction; placement-slot invariance preserved per s47+ rule). See §11.F.

CC-19 carries: **16 unchanged in count**; cohort enrichments at batch-16 per §10 matrix.

### Severity-adjustment event

**Zero events at s55**. Cumulative events: **15 unchanged**.

Composition-discovery escalation framework probe at Phase 5.2 walked all 8 candidates vs closed-batch CRITICAL anchors (F-02-001 + F-02-002 + F-02-005 + F-02-008 + F-05-001 + F-06-001/003 + F-07-003 + F-13-001 + F-15-001): zero composition paths surface. See §11.D.

### Methodology drift

**+2 entries at s55**: drift #40 (Cat 1 reviewing-Claude origin) + drift #41 (Cat 3 CC-origin). See §11.E + §11.M.

Cumulative methodology entries: 40 → **42** (36 Cat 1 + 2 Cat 2 + 4 Cat 3).

### Drift #30.A cumulative operational manifestations

5 → **7** (+2 at s55): Manifestation #6 (Phase 3.1 F-02-001 catch) + Manifestation #7 (Phase 3.4 F-05-001 catch). See §11.C.

---

## §2 Surface inventory

### §2.1 SECDEF RPCs (7 in-scope per launching prompt §6.F + Phase 1.5 live re-verification)

Live `pg_proc` query at Phase 1.5 confirmed 7 SECDEFs at HEAD with zero divergence vs launching prompt §6.F:

| proname | prosecdef | pronargs | args | rettype |
|---|---|---|---|---|
| `check_student_limit` | true | 0 | (none) | trigger |
| `check_subscription_active` | true | 0 | (none) | trigger |
| `check_teacher_limit` | true | 0 | (none) | trigger |
| `complete_onboarding` | true | 15 | `_user_id uuid, _user_email text, _full_name text, _phone text, _org_name text, _org_type text, _country_code text, _currency_code text, _timezone text, _subscription_plan text, _max_students integer, _max_teachers integer, _parent_reschedule_policy text, _trial_days integer, _also_teaches boolean` | jsonb |
| `is_org_active` | true | 1 | `_org_id uuid` | bool |
| `is_org_write_allowed` | true | 1 | `_org_id uuid` | bool |
| `protect_subscription_fields` | true | 0 | (none) | trigger |

### §2.2 EXECUTE grants (7×3 grid per drift #29 OPERATIONAL CARRY)

| proname | anon | authenticated | service_role |
|---|---|---|---|
| `check_student_limit` | TRUE | TRUE | TRUE |
| `check_subscription_active` | TRUE | TRUE | TRUE |
| `check_teacher_limit` | TRUE | TRUE | TRUE |
| `complete_onboarding` | **TRUE** | TRUE | TRUE |
| `is_org_active` | TRUE | TRUE | TRUE |
| `is_org_write_allowed` | TRUE | TRUE | TRUE |
| `protect_subscription_fields` | TRUE | TRUE | TRUE |

`complete_onboarding` anon EXECUTE at HEAD ≠ migration intent. Substrate migrations `20260403000000_complete_onboarding_rpc.sql:96-97` AND `20260508110000_fix_complete_onboarding_enum_casts.sql:146-147` BOTH explicitly contain `REVOKE EXECUTE ON FUNCTION public.complete_onboarding FROM authenticated, anon;`. Live HEAD shows anon=TRUE + authenticated=TRUE. Mechanism-class match with F-13-001 META cohort (see §3.12).

### §2.3 Triggers (11 bindings across 9 tables; 4 ROW SECDEF triggers)

Live `information_schema.triggers` at Phase 1.5:

`check_subscription_active` — 8 BEFORE INSERT ROW bindings:
| trigger_name | table | cross-batch attribution |
|---|---|---|
| `enforce_subscription_active_attendance_records` | attendance_records | batch-08 closed |
| `enforce_subscription_active_guardians` | guardians | batch-02/11 closed |
| `enforce_subscription_active_invoices` | invoices | batch-05 closed |
| `enforce_subscription_active_lessons` | lessons | batch-03/04 closed |
| `enforce_subscription_active_practice_logs` | practice_logs | batch-13 closed |
| `check_subscription_resource_categories` | resource_categories | batch-13 closed |
| `check_subscription_resource_category_assignments` | resource_category_assignments | batch-13 closed |
| `enforce_subscription_active_students` | students | batch-02 closed |

`protect_subscription_fields` — 1 BEFORE UPDATE ROW binding:
| `protect_org_subscription_fields` | organisations | batch-02 closed |

`check_student_limit` — 1 BEFORE INSERT ROW binding:
| `enforce_student_limit` | students | batch-02 closed |

`check_teacher_limit` — 2 ROW bindings (BEFORE INSERT + BEFORE UPDATE):
| `enforce_teacher_limit` | teachers | batch-02 closed (both events same trigger name) |

### §2.4 RLS policies (3 PERMISSIVE INSERT policies)

Live `pg_policies` at Phase 1.5:

| tablename | policyname | permissive | cmd | qual | with_check | roles |
|---|---|---|---|---|---|---|
| invoices | `block_expired_trial_invoice_insert` | PERMISSIVE | INSERT | NULL | `is_org_active(org_id)` | {public} |
| lessons | `block_expired_trial_lesson_insert` | PERMISSIVE | INSERT | NULL | `is_org_active(org_id)` | {public} |
| students | `block_expired_trial_student_insert` | PERMISSIVE | INSERT | NULL | `is_org_active(org_id)` | {public} |

All 3 anchored at F-05-001 CRITICAL closed-batch-05 (see §3.11).

### §2.5 organisations subscription-field cohort (11 columns — batch-16-feature-owned on batch-02 closed-immutable table per implicit-attribution-via-owning-feature-surface convention)

| column | type | nullable | default | CHECK |
|---|---|---|---|---|
| `subscription_plan` | enum subscription_plan | NOT NULL | 'trial' | (enum-bounded) |
| `subscription_status` | enum subscription_status | NOT NULL | 'trialing' | (enum-bounded) |
| `trial_ends_at` | timestamptz | NULL | `(now() + '30 days'::interval)` | none |
| `max_students` | integer | NOT NULL | 50 | none |
| `max_teachers` | integer | NOT NULL | 1 | none |
| `stripe_customer_id` | text | NULL | none | none |
| `stripe_subscription_id` | text | NULL | none | none |
| `past_due_since` | timestamptz | NULL | none | none |
| `cancels_at` | timestamptz | NULL | none | none |
| `stripe_test_mode` | boolean | NOT NULL | false | (bool-bounded) |
| `teacher_limit_exceeded` | boolean | NOT NULL | false | (bool-bounded; added via `20260315100400_fix_teacher_limit_exceeded_column.sql`) |

Reviewing-Claude §6.B launching prompt enumerated 10 columns; Phase 1.7 surfaced the 11th (`teacher_limit_exceeded` via substrate migration `20260315100400`). All 11 are batch-16-feature-owned per implicit-attribution-via-owning-feature-surface convention; organisations table itself batch-02 closed-immutable.

### §2.6 Enum types (2 enums per launching prompt §6.C live-verified)

`subscription_plan`: trial / solo_teacher / academy / agency / custom (5 labels)
`subscription_status`: trialing / active / past_due / cancelled / paused (5 labels)

### §2.7 Edge functions (6 in-scope per CENSUS verbatim + Phase 1.3 filesystem enumeration)

| File path | verify_jwt | Lines | Purpose |
|---|---|---|---|
| `supabase/functions/stripe-subscription-checkout/index.ts` | true (platform default; NOT in config.toml) | 264 | Stripe SaaS Checkout session creation for org plan upgrade |
| `supabase/functions/trial-expired/index.ts` | false ([functions.trial-expired]) | 150 | Cron: detect orgs whose trial_ends_at has elapsed; flip subscription_status='cancelled'; downgrade limits; email org owner |
| `supabase/functions/trial-reminder-1day/index.ts` | false | 140 | Cron: email orgs 1 day before trial_ends_at |
| `supabase/functions/trial-reminder-3day/index.ts` | false | 138 | Cron: email orgs 3 days before trial_ends_at |
| `supabase/functions/trial-reminder-7day/index.ts` | false | 138 | Cron: email orgs 7 days before trial_ends_at |
| `supabase/functions/trial-winback/index.ts` | false | 155 | Cron weekly Monday 10:00: re-engagement email to expired orgs |

**Phase 1.3 observation**: NO subscription state-transition edge fn matching `subscription-create / subscription-update / subscription-cancel / tier-change / tier-validate` (reviewing-Claude §6 + handover §20 anticipated list). Subscription state mutations route through (a) stripe-webhook subscription.* event handlers (batch-06 closed cross-batch reach; see §3.13), (b) trial-expired cron, (c) `complete_onboarding` RPC at initial state setting, (d) BillingTab tier-display polling (SELECT-only POSITIVE per Phase 2.9).

**`onboarding-setup` edge fn surfaced at Phase 3.5 + audited at Phase 4.7** as the FE → `complete_onboarding` bridge. Phase 1.3 regex `subscription|tier|trial|plan|seat|expire` MISSED this fn. Audit verdict at §3.15 cross-batch observation (2nd Pattern #41 NEGATIVE counter-example POSITIVE).

### §2.8 Cron jobs (5 per CENSUS L921-925 verbatim)

| jobid | jobname | schedule | command | batch |
|---|---|---|---|---|
| 107 | `trial-reminder-7day-daily` | `15 8 * * *` | `trial-reminder-7day` | 16-subscription-tiers |
| 108 | `trial-reminder-3day-daily` | `20 8 * * *` | `trial-reminder-3day` | 16-subscription-tiers |
| 109 | `trial-reminder-1day-daily` | `25 8 * * *` | `trial-reminder-1day` | 16-subscription-tiers |
| 110 | `trial-expired-daily` | `0 7 * * *` | `trial-expired` | 16-subscription-tiers |
| 111 | `trial-winback-weekly` | `0 10 * * 1` | `trial-winback` | 16-subscription-tiers |

### §2.9 Hooks (4 per CENSUS L1105-1108 verbatim)

| File | Purpose |
|---|---|
| `src/hooks/useSubscription.ts` (140 lines) | Current org subscription state — exposes 15+ fields incl. plan / status / isTrialing / trialDaysRemaining / isPastDue / canUpgrade / limits |
| `src/hooks/useSubscriptionCheckout.ts` | Stripe Checkout for SaaS plan |
| `src/hooks/useFeatureGate.ts` (165 lines) | Plan-feature flag matrix — 16 Feature types × 5 SubscriptionPlan labels |
| `src/hooks/useUsageCounts.ts` | Students/teachers count vs limit |

### §2.10 Migration trail (4 filesystem files; 5 DB schema_migrations records — drift #40 sub-instance B PATCH 2)

Filesystem (4 files):
1. `supabase/migrations/20260303120000_subscription_grace_period_and_triggers.sql` (42 lines) — SUB-M4 `is_org_write_allowed` 7-day past_due grace + SUB-M5 3 INSERT triggers (guardians + attendance_records + practice_logs)
2. `supabase/migrations/20260315100400_fix_teacher_limit_exceeded_column.sql` (4 lines) — `ALTER TABLE organisations ADD COLUMN teacher_limit_exceeded BOOLEAN NOT NULL DEFAULT false`
3. `supabase/migrations/20260403000000_complete_onboarding_rpc.sql` (97 lines) — `CREATE OR REPLACE FUNCTION complete_onboarding`; GRANT EXECUTE TO service_role; REVOKE EXECUTE FROM authenticated, anon
4. `supabase/migrations/20260508110000_fix_complete_onboarding_enum_casts.sql` (148 lines) — Consolidated Bug 1 (enum casts) + Bug 2 (`seed_make_up_policies` service_role bypass) + Bug 3 (catch WHEN OTHERS); GRANT/REVOKE replayed

DB `supabase_migrations.schema_migrations` (5 records):
| version | name |
|---|---|
| 20260303120000 | subscription_grace_period_and_triggers |
| 20260315100400 | fix_teacher_limit_exceeded_column |
| 20260403000000 | complete_onboarding_rpc |
| **20260508111657** | **fix_complete_onboarding_enum_casts** (DB-only; filesystem timestamp differs at 110000) |
| **20260508111856** | **fix_onboarding_seed_make_up_policies_service_role** (DB-only; consolidated into filesystem 110000) |

DB-vs-filesystem divergence observation: drift #40 sub-instance B (substrate migration filename drift). Editorial-only at s55-close; no audit-content corruption.

---

## §3 Findings detail

### §3.1 F-16-001 LOW — `complete_onboarding` early-RETURN information disclosure (Path A)

| Field | Value |
|---|---|
| **ID** | F-16-001 |
| **Severity** | LOW (same-bracket per F-02-034 class-precedent confirmation; NOT a severity-adjustment event per §18 principle) |
| **Area** | SECDEF RPC body / information-disclosure / cross-tenant boolean+UUID probe |
| **Phase surfaced** | Phase 2 §2.7 + Phase 3 §3.1 F-02-001 closed-batch coverage refinement |
| **Class anchor (drift #38 4-part)** | F-02-034 LOW closed-batch-02 — finding-ID: F-02-034; severity verbatim "**Severity:** Low (class, 2 fns)" (findings/02:1286); class-shape one-liner: "`is_org_active` + `is_org_write_allowed` class — cross-tenant subscription-state boolean probing" (findings/02:1284); batch attribution: batch-02 closed-immutable |
| **Class-precedent reasoning** | F-02-034 anchor class shape: anon-callable SECDEF returning scalar/small dataset enumeration probe of cross-tenant state. F-16-001 fits: anon-callable `complete_onboarding` early-RETURN at body L33-37 + L41-48 returns `jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', '...')` for ANY caller-supplied `_user_id` matching idempotency or recovery conditions. No PII content; just boolean + uuid leak. Same class shape per F-02-034. |
| **Surface NOT covered by F-02-001** | F-02-001 CRITICAL closed-batch-02 anchor (findings/02:91) covers `complete_onboarding` body attack paths via parameter-spoofing class — paths B/C/D (profile-rewrite + org-creation + role-injection) are blocked by `trg_block_owner_insert` single-trigger-deep DiD per L144 "In current production, the exploit chain does NOT complete: attacker gets nothing". The early-RETURN at body L33-37 + L41-48 happens BEFORE any INSERT, so `trg_block_owner_insert` DiD does NOT apply. F-02-001 scope narrative does not enumerate this surface explicitly. **Fresh F-16-001 finding-vector**. |
| **Evidence — body verbatim (Phase 2.1 live `pg_get_functiondef`)** | ```sql\nBEGIN\n  SELECT current_org_id INTO _existing_org_id\n  FROM profiles WHERE id = _user_id AND has_completed_onboarding = true;\n  IF _existing_org_id IS NOT NULL THEN\n    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Already onboarded');\n  END IF;\n\n  SELECT om.org_id INTO _existing_org_id\n  FROM org_memberships om\n  WHERE om.user_id = _user_id AND om.role = 'owner'::app_role AND om.status = 'active'::membership_status\n  LIMIT 1;\n  IF _existing_org_id IS NOT NULL THEN\n    UPDATE profiles SET current_org_id = _existing_org_id, has_completed_onboarding = true WHERE id = _user_id;\n    RETURN jsonb_build_object('success', true, 'org_id', _existing_org_id, 'message', 'Recovered from partial setup');\n  END IF;\n  ...\n  ``` |
| **Evidence — EXECUTE grant** | anon=TRUE at HEAD per Phase 1.6 live `has_function_privilege()` (despite migration `20260403000000:96-97` + `20260508110000:146-147` REVOKE EXECUTE FROM authenticated, anon). F-13-001 META cohort enrichment mechanism per §3.12. |
| **Attack shape** | Anon attacker invokes via direct `supabase.rpc('complete_onboarding', {_user_id: <victim_uuid>, _user_email: ..., _full_name: ..., _org_name: ..., _org_type: ..., ...})`. Bypasses `onboarding-setup` edge fn (which would authenticate); calls RPC directly with public anon key. Early-RETURN logic returns `{success: true, org_id: <victim's current_org_id>}` if victim has `has_completed_onboarding=true` OR `{success: true, org_id: <victim's owner-role org_id>}` if victim has owner-role active membership. Side-effect: idempotency-path UPDATE profiles SET `current_org_id=_existing_org_id, has_completed_onboarding=true` at L46 in the recovery branch — only fires if the recovery branch matches (victim has owner role but profile has_completed_onboarding=false). Otherwise the early-RETURNs are read-only side-effect-free. |
| **Information leaked** | (a) Whether arbitrary `_user_id` has completed onboarding (boolean inferable from response); (b) The `org_id` UUID of victim's current_org_id OR victim's owner-role active org_membership; (c) None of profile.full_name / email / phone / SEN notes — just uuid + boolean. |
| **Severity rationale** | LOW per PLAN.md §4 "code-hygiene drift / minor docstring/API inconsistency"; class-precedent F-02-034 LOW for analogous cross-tenant subscription-state boolean probe. Information disclosure class CAPS-at-LOW for boolean+UUID-only-payload sub-shape (compare F-02-002 CRITICAL HEADLINE which exposes child-PII full names + DOB + medical notes; F-02-034 LOW exposes subscription-state boolean only). No PII content leaked. |
| **Anchor fix** | Add `auth.uid()` check at body L9 (before idempotency check): ```sql\nIF auth.uid() IS NULL THEN\n  IF current_setting('role', true) <> 'service_role' THEN\n    RAISE EXCEPTION 'Not authorised';\n  END IF;\nELSIF _user_id != auth.uid() THEN\n  RAISE EXCEPTION 'Cannot complete onboarding for another user';\nEND IF;\n``` (Identical to F-02-001 anchor fix at findings/02:152-161; addresses both early-RETURN info-leak AND body INSERT attack paths.) |
| **Target sprint** | Phase C — parameter-spoofing-class remediation (with F-02-001 + F-02-005 + F-01-003) |

### §3.2 F-16-002 LOW — `protect_subscription_fields` silent-revert anti-pattern (no `RAISE EXCEPTION` on non-service-role caller)

| Field | Value |
|---|---|
| **ID** | F-16-002 |
| **Severity** | LOW (security boundary intact; UX-only impact; class-DISTINCT from F-05-005 silent-swallow which involved operational data loss in cron path) |
| **Area** | SECDEF trigger body / silent-revert anti-pattern / operational-correctness UX class |
| **Phase surfaced** | Phase 2 §2.2 CC-19 #14 disambiguation (REAL gate verdict) + secondary anti-pattern observation |
| **Class anchor (drift #38 4-part)** | F-05-005 HIGH closed-batch-05 — finding-ID: F-05-005; severity verbatim "**Severity:** High (severity-adjustment event #7; was Critical pre-tag → HIGH final per silent-failure-modes class with banner-surface partial mitigation)" (findings/05:366); class-shape one-liner: "`recalculate_invoice_paid` draft→paid blocked by trigger; cron callers silently swallow EXCEPTION (PI-04 closure)" (findings/05:364); batch attribution: batch-05 closed-immutable. **Class-DISTINGUISHED below**. |
| **Class disambiguation vs F-05-005 HIGH** | F-05-005 involves SILENT-SWALLOW in cron caller path where `recalculate_invoice_paid` RAISEs a draft→paid exception that cron callers (invoice-overdue-check + installment-overdue-check) catch + log + discard. Net effect: operational data loss (overdue checks fail; invoices stuck in draft status; downstream workflow broken). F-16-002 is INVERSE shape: `protect_subscription_fields` does NOT raise on non-service-role caller; instead SILENTLY REVERTS NEW fields to OLD (9 fields enumerated below). Security boundary IS PRESERVED (unauthorized UPDATE has no effect). Only the FAILURE-SIGNAL is silent — caller sees UPDATE succeed but fields aren't changed. Class-distinct from F-05-005: protection IS effective; UX feedback is the only loss. |
| **Body evidence (Phase 2.1 live `pg_get_functiondef`)** | ```sql\nCREATE OR REPLACE FUNCTION public.protect_subscription_fields()\n RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'\nAS $function$\nDECLARE _role text;\nBEGIN\n  _role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');\n  IF _role != 'service_role' THEN\n    NEW.subscription_plan      := OLD.subscription_plan;\n    NEW.subscription_status    := OLD.subscription_status;\n    NEW.max_students           := OLD.max_students;\n    NEW.max_teachers           := OLD.max_teachers;\n    NEW.stripe_customer_id     := OLD.stripe_customer_id;\n    NEW.stripe_subscription_id := OLD.stripe_subscription_id;\n    NEW.trial_ends_at          := OLD.trial_ends_at;\n    NEW.past_due_since         := OLD.past_due_since;\n    NEW.cancels_at             := OLD.cancels_at;\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n``` |
| **Role-claim gate verdict (Phase 2.2 disambiguation)** | REAL gate (NOT CC-19 #14 misnamed). `request.jwt.claims` GUC is populated by PostgREST middleware AFTER signature verification of the Bearer JWT (using JWT_SECRET / JWT_PUBLIC_KEY per Supabase config). Header-injection of arbitrary `Authorization: Bearer <forged>` fails JWT verification → request rejected at PostgREST layer before reaching SQL execution. Service_role JWT requires possession of SUPABASE_SERVICE_ROLE_KEY (server-side secret) — not spoofable client-side. CC-19 #14 anchor cohort UNCHANGED at 2 entries. |
| **9 fields protected** | subscription_plan + subscription_status + max_students + max_teachers + stripe_customer_id + stripe_subscription_id + trial_ends_at + past_due_since + cancels_at |
| **Anti-pattern shape** | No `RAISE EXCEPTION` on non-service-role caller. Trigger silently overwrites NEW with OLD; UPDATE statement returns success (no rows-affected discrepancy because UPDATE syntactically succeeds; only field-level changes are reverted via BEFORE-UPDATE trigger). Caller has NO failure signal. Admin user attempting prohibited tier downgrade via direct UPDATE sees UPDATE succeed; tier doesn't change; no error log. |
| **Operational impact** | Bounded. Stripe-mediated tier changes flow through stripe-webhook subscription.* handlers (service-role; bypass trigger). Admin direct-UPDATE on organisations is rare (not a common operator flow). UX-only impact when it does occur. |
| **Anchor fix** | Add `RAISE EXCEPTION` instead of silent-revert: ```sql\nIF _role != 'service_role' THEN\n  RAISE EXCEPTION 'Subscription fields can only be modified via service_role (Stripe webhook or admin tools)';\nEND IF;\n``` |
| **Target sprint** | Phase C — operational-correctness UX hygiene |

### §3.3 F-16-003 LOW — `_max_students` DEFAULT -1 + `_trial_days` DEFAULT 14 DEAD-CODE LATENT in `complete_onboarding` RPC

| Field | Value |
|---|---|
| **ID** | F-16-003 |
| **Severity** | LOW (dead-code hygiene; brittleness flag — if a future caller relies on the defaults, the bug becomes reproducible) |
| **Area** | SECDEF RPC parameter defaults / dead-code latent / divergence-from-production-reality |
| **Phase surfaced** | Phase 3.5 + 3.7 (DISPOSITIVE via live query) |
| **Class anchor (drift #38 4-part)** | Dead-code hygiene class (closed-batch precedent chain: F-06-008 `cancel_template_run` LOW + F-09-NN dead-code anchors). |
| **Issue 1: `_max_students DEFAULT -1`** | Body L of `complete_onboarding`: `_max_students integer DEFAULT '-1'::integer`. `check_student_limit` body: `IF _current_count >= _max_students THEN RAISE EXCEPTION 'Student limit reached for this plan. Please upgrade.';`. With `_max_students = -1` and any `_current_count >= 0`, condition is TRUE → RAISES on EVERY student INSERT. If FE were to invoke `complete_onboarding` WITHOUT specifying `_max_students`, every trial org could not add ANY students. |
| **Issue 2: `_trial_days DEFAULT 14`** | Body L: `_trial_days integer DEFAULT 14`. Body L: `_trial_ends_at := NOW() + (_trial_days || ' days')::interval;`. INSERT to organisations explicitly sets `trial_ends_at = _trial_ends_at`. With default `_trial_days = 14`, trial_ends_at = now() + 14 days. But organisations column DEFAULT is `(now() + '30 days'::interval)` and trial-expired email copy at trial-expired/index.ts:82 reads "Your 30-day LessonLoop trial has ended" — 3-way divergence. |
| **Phase 3.5 + 3.7 dispositive evidence** | Live query against `xmrhmxizpslhtkibqyfy`: ```sql\nSELECT count(*) FILTER (WHERE max_students = -1) AS m_s_neg,\n       count(*) FILTER (WHERE max_teachers = -1) AS m_t_neg,\n       count(*) FILTER (WHERE max_students IS NULL) AS m_s_null,\n       count(*) FILTER (WHERE max_teachers IS NULL) AS m_t_null,\n       count(*) AS total_orgs FROM public.organisations;\n``` Result: 0 / 0 / 0 / 0 / 119. ALL 24 sampled trial orgs have max_students=50 + max_teachers=1 + trial_days_set=30 (computed from `trial_ends_at - created_at`). Email copy 30-day matches production reality. RPC defaults NEVER exercised in practice. |
| **FE call-site verification (Phase 4.4 + 4.7)** | `supabase/functions/onboarding-setup/index.ts:177-194` (the ONLY legitimate caller): `_max_students: limits.max_students` (positive integer from `_shared/plan-config.ts` PLAN_LIMITS) + `_trial_days: TRIAL_DAYS` (= 30 per plan-config). FE never relies on defaults. |
| **Dead-code latency framing** | Defaults remain in body but never exercised. Brittleness: if a future caller invokes RPC without specifying `_max_students` (e.g., during database refactor, programmatic seeding, or downstream API integration), the -1 sentinel bug becomes reproducible. HIGH "marketed feature fundamentally broken" if reproduced ("brand-new trial users completely blocked"); LOW dead-code while latent. |
| **Severity rationale** | LOW per dead-code hygiene class; latent only at HEAD. Class-precedent for dead-code: F-06-008 LOW (`update_payment_plan` dead 0 callers; cancel_template_run LOW). |
| **Anchor fix** | Change defaults to safe values: `_max_students integer DEFAULT 50, _trial_days integer DEFAULT 30`. Aligns RPC defaults with organisations column DEFAULT + email copy. Removes brittleness flag. |
| **Target sprint** | Phase C — code-hygiene batch |

### §3.4 F-16-004 LOW — Trigger coverage-gap cohort + UPDATE/DELETE coverage gap on 8 currently-gated tables (consolidated)

| Field | Value |
|---|---|
| **ID** | F-16-004 |
| **Severity** | LOW (operational-correctness hygiene; intent-mixed; expired-trial coverage gaps on forward-looking tables only) |
| **Area** | DB trigger coverage / subscription-active enforcement scope / append-only vs full-write prohibition |
| **Phase surfaced** | Phase 3.2 (trigger coverage-gap audit) + Phase 3.3 (UPDATE/DELETE coverage adjudication) |
| **Class anchor (drift #38 4-part)** | Operational-correctness hygiene class (CC-19 #11 / #3 cohort precedent for systematic gap-cohorts). |
| **Currently gated by `check_subscription_active` BEFORE INSERT** | 8 tables: attendance_records, guardians, invoices, lessons, practice_logs, resource_categories, resource_category_assignments, students. |
| **Ungated cohort (82 of 90 public BASE TABLEs)** | Phase 3.2 high-value gap candidates per launching prompt §3.2 + intent adjudication: |
| **Adjudication per high-value candidate** | payments — NO gating intent (closing financial loop on existing invoices); billing_runs — **POTENTIAL GAP** (forward-looking billing automation); lesson_notes — child of lessons (indirect coverage via parent); lesson_participants — same; calendar_event_mappings — NO gating intent (integration cleanup); internal_messages — NO gating intent (existing thread continuation); message_log — NO gating intent (trial-expired cron itself writes here at L120-130); ai_messages — NO gating intent (tier-gated via useFeatureGate separately); leads — **POTENTIAL GAP** (forward-looking sales); enrolment_waitlist — **POTENTIAL GAP** (forward-looking waitlist); terms — NO gating intent (term planning); term_continuation_runs — NO gating intent (already-paid period continuation); recurring_invoice_templates — **POTENTIAL GAP** (billing automation). |
| **High-confidence gaps** | 4 tables: billing_runs + leads + enrolment_waitlist + recurring_invoice_templates. Expired-trial orgs can INSERT into forward-looking tables despite intent-block on 8 currently-gated tables. |
| **UPDATE/DELETE coverage on 8 currently-gated tables (Phase 3.3)** | `check_subscription_active` trigger scope: INSERT ONLY for all 8 tables (verified live via `information_schema.triggers`). Expired-trial orgs CAN UPDATE existing rows + DELETE rows on all 8 currently-gated tables. Intent ambiguous: |
| **UPDATE/DELETE adjudication** | UPDATE student name/status by post-expiry org: likely OK (read-only-ish post-expiry intent); UPDATE invoice amount/status: financial-mutation potential gap (silent admin can alter past invoices); DELETE student: GDPR Art 17 right-to-erasure requires this post-expiry (intentional ungating); DELETE invoice: financial-record audit-trail concern; DELETE lesson by expired org: cascade to attendance_records / lesson_participants / lesson_notes (financial-impact if invoiced lesson). |
| **Decision shape** | APPEND-ONLY-PROHIBITION intent (current implementation) vs FULL-WRITE-PROHIBITION intent (potential ideal). Cosmetic operational-correctness gap; intent-ambiguous; hygiene class. |
| **Severity rationale** | LOW per operational-correctness hygiene class precedent. Not sufficient evidence of HIGH financial-mutation gap concrete; intent-mixed framing. |
| **Anchor fix** | (a) Add `check_subscription_active` BEFORE INSERT trigger to 4 high-confidence gap tables (billing_runs, leads, enrolment_waitlist, recurring_invoice_templates); (b) If full-write-prohibition intent desired: extend `check_subscription_active` to also fire BEFORE UPDATE on the 8 currently-gated tables (excluding intentional GDPR Art 17 DELETE paths). Phase C scope decision. |
| **Target sprint** | Phase C — DB trigger coverage hardening |

### §3.5 F-16-005 LOW — `is_org_active` vs `is_org_write_allowed` 3-layer past_due grace inconsistency

| Field | Value |
|---|---|
| **ID** | F-16-005 |
| **Severity** | LOW (operational-correctness layer-divergence; 3 strict-gated tables + 5 grace-gated tables + FE grace = inconsistent past_due UX) |
| **Area** | FE / DB trigger / RLS policy semantic divergence on past_due grace period |
| **Phase surfaced** | Phase 3.6 + Phase 4.5 enrichment (FE layer added) |
| **Class anchor (drift #38 4-part)** | Operational-correctness hygiene class (silent-divergence sub-shape). |
| **Helper bodies verified at Phase 2.1** | `is_org_active(_org_id uuid)` LANGUAGE sql STABLE SECURITY DEFINER: `SELECT CASE WHEN subscription_status='active' THEN true WHEN subscription_status='trialing' AND trial_ends_at > NOW() THEN true ELSE false END FROM organisations WHERE id = _org_id;` — STRICT (no past_due grace). `is_org_write_allowed(_org_id uuid)` LANGUAGE sql STABLE SECURITY DEFINER: `SELECT EXISTS (SELECT 1 FROM public.organisations WHERE id = _org_id AND (subscription_status IN ('active', 'trialing') OR (subscription_status = 'past_due' AND past_due_since IS NOT NULL AND past_due_since > NOW() - INTERVAL '7 days')))` — 7-day past_due grace. |
| **3 layers** | Layer 1 FE: `src/hooks/useFeatureGate.ts:L109-111` `PAST_DUE_GRACE_DAYS = 7`; `isWithinGracePeriod = status === 'past_due' && pastDueSince ? differenceInDays(new Date(), pastDueSince) <= PAST_DUE_GRACE_DAYS : false;` 7-day grace. Layer 2 DB trigger `check_subscription_active` body calls `is_org_write_allowed` 7-day grace. Layer 3 RLS PERMISSIVE `block_expired_trial_*_insert` policies on invoices+lessons+students use `is_org_active` strict (no past_due grace). |
| **Net effect per table cohort** | **invoices/lessons/students (3 tables)**: RLS strict + trigger 7-day-grace → RLS strict wins; past_due orgs CANNOT insert even within 7-day window. **attendance_records/guardians/practice_logs/resource_categories/resource_category_assignments (5 tables)**: NO RLS strict policy; only trigger applies → 7-day past_due grace works; past_due orgs CAN insert these for 7 days. |
| **FE UX impact** | For past_due orgs within 7-day window: `useFeatureGate` returns `hasAccess=true` (features visible) BUT `.from('invoices').insert(...)` REJECTED by RLS. User sees "feature available" but action fails. |
| **Intent adjudication** | DESIGN: financial-impact tables (invoices) treated strict; operational tables (attendance) get grace. Lessons/students = gray area. ACCIDENT: the 3 RLS policies were added during early design (per F-05-001 substrate); the 7-day-grace was added later (per migration `20260303120000`); the dual-gate inconsistency may be vestigial. |
| **Severity rationale** | LOW per operational-correctness hygiene class; user-facing UX confusion when past_due. Not security defect. |
| **Anchor fix** | (a) Decide on canonical past_due grace policy (strict OR 7-day OR per-table); (b) Align all 3 layers to the chosen policy. Most likely intent: 7-day grace uniformly → swap `is_org_active` → `is_org_write_allowed` in the 3 PERMISSIVE policies' WITH CHECK expressions. |
| **Target sprint** | Phase C — past_due UX consolidation |

### §3.6 F-16-006 MEDIUM — Missing UI for `cancelled`+`paused` subscription_status states

| Field | Value |
|---|---|
| **ID** | F-16-006 |
| **Severity** | **MEDIUM** (partial UI coverage; class-precedent F-05-003 HIGH "dead-end at every layer" CAPS-at-HIGH BUT F-16-006 has partial recovery path via BillingTab tier-display; 4/6 dims MAGNITUDE-WEAKER per §5.1 6-dim adjudication) |
| **Area** | FE UI surface / missing-UI-for-tracked-DB-state class |
| **Phase surfaced** | Phase 4.2 (subscription_status case-coverage matrix) |
| **Class anchor (drift #38 4-part)** | F-05-003 HIGH closed-batch-05 — finding-ID: F-05-003; severity verbatim "**Severity:** High (severity-adjustment event #5; was Critical pre-tag → HIGH final per operational-correctness class CAPS-at-HIGH; s42 PI-11 precedent)" (findings/05:263); class-shape one-liner: "`invoice_status` enum 'outstanding' value unmodelled at every layer (PI-02 closure)" (findings/05:261); batch attribution: batch-05 closed-immutable. **Class-precedent disambiguated below**. |
| **Subscription_status enum** | 5 values per Phase 1.5 enum verification: trialing / active / past_due / cancelled / paused. |
| **UI coverage matrix (Phase 4.2)** | trialing-active: covered (UpgradeBanner L147-318 trial active variant); trialing-expired: covered (TrialExpiredModal L31-35 + UpgradeBanner L71-105 destructive); active: covered (BillingTab tier-display + Stripe Portal); past_due: covered (UpgradeBanner L109-143 warning); **cancelled: NOT EXPLICITLY HANDLED** (UpgradeBanner L54 condition only triggers on trialing/past_due/expired; cancelled silently no-shows banner); **paused: NOT EXPLICITLY HANDLED** (same as cancelled). |
| **Cancelled state flow** | trial-expired cron at `supabase/functions/trial-expired/index.ts:L43-51` flips `subscription_status: 'cancelled'` + applies CANCELLED_LIMITS {max_students: 5, max_teachers: 1}. After flip, FE `useFeatureGate.ts:L112` evaluates `isSubscriptionActive = active OR within-grace OR (trialing AND !expired)` → FALSE for cancelled → all features lock. User lands in degraded state. |
| **Partial recovery path** | BillingTab tier-selection IS rendered (PLAN_ORDER.map at L184) → user CAN navigate to Settings → Billing → select tier → Stripe Checkout → stripe-webhook flips status back to 'active'. NOT dead-end; just lacks orientation banner explaining the cancelled state. |
| **6-dim disambiguation vs F-05-003 HIGH** | D1 Layer-coverage: F-05-003 DEAD-END at every layer (enum + trigger + RPC + FE); F-16-006 PARTIAL coverage (BillingTab provides recovery). D3 User-recovery: F-05-003 NONE; F-16-006 PARTIAL. D6 Composition: F-05-003 YES (state-machine completeness gap); F-16-006 NO standalone. 4/6 dims MAGNITUDE-WEAKER. |
| **Severity rationale** | MEDIUM per PLAN.md §4 "cosmetic but visible inconsistency"; operational-correctness CAPS-at-HIGH NOT triggered because recovery path exists; class-precedent CAPS pulls down to MEDIUM via partial-coverage modulator. |
| **Anchor fix** | (a) Extend UpgradeBanner to handle cancelled+paused states (e.g., red-style banner "Your subscription is cancelled. Choose a plan to resume."); (b) TrialExpiredModal can be generalized to "SubscriptionInactiveModal" handling all 3 inactive states (trialing-expired + cancelled + paused). |
| **Target sprint** | Phase C — UI surface completion |

### §3.7 F-16-007 MEDIUM — Agency tier visibility V2_PLAN-FE divergence

| Field | Value |
|---|---|
| **ID** | F-16-007 |
| **Severity** | **MEDIUM** (V2_PLAN scope authority + functional impact at launch; not purely cosmetic) |
| **Area** | V2_PLAN-vs-implementation divergence / FE tier-pricing surface |
| **Phase surfaced** | Phase 4.3 |
| **Class anchor (drift #38 4-part)** | V2_PLAN scope authority + cosmetic-but-visible inconsistency class (PLAN.md §4 rubric). |
| **V2_PLAN.md §3.6 L306 verbatim** | "✅ Plan tiers: Teacher + Studio visible at launch; Agency hidden ("Contact us")" |
| **FE implementation evidence (Phase 4.3)** | (a) `src/lib/pricing-config.ts:207`: `export const PLAN_ORDER: PlanKey[] = ['teacher', 'studio', 'agency'];` (Agency in PLAN_ORDER); (b) `src/lib/pricing-config.ts:152-184`: Agency PRICING_CONFIG entry with `price: { monthly: 79, yearly: 790 }` + features + marketingFeatures (full self-serve tier definition); (c) `src/components/settings/BillingTab.tsx:184`: `PLAN_ORDER.map((key) => { ... <PlanCard ... /> })` — Agency tier RENDERED as self-serve £79/mo card; NO "Contact us" CTA replaces checkout; (d) `src/components/subscription/TrialExpiredModal.tsx:83`: `PLAN_ORDER.map((planKey) => { ... <button onClick={() => handlePlanClick(planKey)}>...£{plan.price.monthly}/mo` — Agency RENDERED as £79/mo self-serve checkout button; (e) `supabase/functions/stripe-subscription-checkout/index.ts:46-49`: STRIPE_PRICE_AGENCY_MONTHLY + STRIPE_PRICE_AGENCY_YEARLY env vars configured + L33 plan='agency' ACCEPTED by edge fn. |
| **Real impact** | At launch, a user CAN self-serve subscribe to Agency at £79/mo despite V2_PLAN intent. Not just cosmetic — functional subscription flow can complete. Stripe-side billing would activate Agency tier; user gets Agency plan limits + features. |
| **Severity rationale** | MEDIUM per "cosmetic but visible inconsistency" PLAN.md §4 rubric + V2_PLAN scope authority (Agency hidden = explicit launch decision) + functional financial impact. Not LOW because subscription flow can complete (not pure cosmetic). |
| **Anchor fix options** | (a) Hide Agency from PLAN_ORDER (e.g., filter to ['teacher', 'studio'] at launch + show separate "Contact us" CTA below); (b) Add gate condition in BillingTab + TrialExpiredModal renders to skip Agency tier or replace with Contact CTA; (c) V2_PLAN amendment: un-defer Agency to launch (if business decision changes). Phase C scope-decision. |
| **Editorial follow-up** | This finding documents the divergence at HEAD; Phase C resolution may include V2_PLAN amendment if business decision changes. |
| **Target sprint** | Phase C — V2_PLAN scope compliance |

### §3.8 F-16-008 LOW — CC-19 #11 column-CHECK-absent cohort enrichment (7 organisations subscription-cohort columns)

| Field | Value |
|---|---|
| **ID** | F-16-008 |
| **Severity** | LOW (cohort enrichment per F-15-009 + F-14-006 + F-13-004 + F-09-012 LOW precedent chain) |
| **Area** | Schema column constraint hygiene / CC-19 #11 cohort enrichment |
| **Phase surfaced** | Phase 5.1 self-catch (launching prompt §6.E enumerated as Phase 3 finding-vector; Phase 3 narrowly focused on NULL-max + -1-sentinel semantics and missed broader cohort enrichment — surfaced at Phase 5 via 6-dim checklist re-traversal; drift #41 candidate at §11.M) |
| **Class anchor (drift #38 4-part)** | F-15-009 LOW closed-batch-15 — finding-ID: F-15-009; severity verbatim "F-15-009 LOW" per s54 close handover; class-shape one-liner: "CC-19 #11 column-CHECK-absent cohort enrichment (3 xero_* columns)" (verbatim per findings/15 §3.9 + s54 close handover); batch attribution: batch-15 closed-immutable. Plus F-14-006 LOW (batch-14) + F-13-004 LOW (batch-13) + F-09-012 LOW (batch-09) cohort precedent chain. |
| **7 organisations subscription-cohort columns lacking CHECK constraints** | (per Phase 1.5 + launching prompt §6.E live verification) |
| | (a) `max_students integer NOT NULL DEFAULT 50` — no CHECK; accepts negative, zero, very large values |
| | (b) `max_teachers integer NOT NULL DEFAULT 1` — no CHECK; same |
| | (c) `stripe_customer_id text NULL` — no CHECK; accepts empty string vs NULL distinction |
| | (d) `stripe_subscription_id text NULL` — no CHECK; same |
| | (e) `past_due_since timestamptz NULL` — no CHECK; accepts future timestamps |
| | (f) `cancels_at timestamptz NULL` — no CHECK; accepts past timestamps inconsistent with subscription_status |
| | (g) `trial_ends_at timestamptz NULL DEFAULT (now() + '30 days'::interval)` — no CHECK; accepts past timestamps at row creation if default overridden |
| **Cross-batch audit-lens framing** | organisations table itself is batch-02 closed-immutable; subscription-cohort columns are batch-16-feature-owned per implicit-attribution-via-owning-feature-surface convention (s51 Phase 7 PLAN.md L117 codification). Per s52-s54 precedent (F-13-004 + F-14-006 + F-15-009 cohort allocations on tables owned by other batches when the feature-surface attribution carries the column), F-16-008 LOW allocates cohort enrichment at batch-16. |
| **0 NOT-VALID variants** | Per F-10-004 "Present-NOT-VALID variant" sub-shape under CC-19 #11; all 7 columns lack CHECK entirely (no convalidated=false variants). Cohort enrichment is on the "absent" sub-shape, not the NOT-VALID sub-shape. |
| **Severity rationale** | LOW per cohort enrichment precedent chain; hygiene-class CAPS-at-LOW. Cumulative CC-19 #11 cohort: 31 → 38 (+7). |
| **Anchor fix** | Add CHECK constraints: ```sql\nALTER TABLE organisations ADD CONSTRAINT chk_org_max_students_positive CHECK (max_students > 0);\nALTER TABLE organisations ADD CONSTRAINT chk_org_max_teachers_positive CHECK (max_teachers > 0);\nALTER TABLE organisations ADD CONSTRAINT chk_org_stripe_customer_id_nonempty CHECK (stripe_customer_id IS NULL OR length(stripe_customer_id) > 0);\nALTER TABLE organisations ADD CONSTRAINT chk_org_stripe_subscription_id_nonempty CHECK (stripe_subscription_id IS NULL OR length(stripe_subscription_id) > 0);\nALTER TABLE organisations ADD CONSTRAINT chk_org_past_due_since_not_future CHECK (past_due_since IS NULL OR past_due_since <= now());\nALTER TABLE organisations ADD CONSTRAINT chk_org_trial_ends_at_consistent CHECK (trial_ends_at IS NULL OR subscription_status != 'trialing' OR trial_ends_at > created_at);\n``` |
| **Target sprint** | Phase C — CC-19 #11 cohort batch (cross-batch) |

### §3.9 Closed-batch citation — F-02-001 CRITICAL closed-batch-02 (complete_onboarding body attack surface)

**4-part attestation (drift #38 OPERATIONAL CARRY)**:
- finding-ID: **F-02-001**
- severity: **Critical** (verbatim findings/02-org-management.md:93 "**Severity:** **Critical**")
- class-shape one-liner: "`complete_onboarding` SECDEF RPC accepts caller-supplied `_user_id`; anon-callable; single-trigger-deep DiD" (verbatim findings/02:91)
- batch attribution: batch-02 closed-immutable (findings/02-org-management.md ownership; closed at s41)

**Batch-16 audit-lens relevance**: complete_onboarding body attack paths B (profile-rewrite via ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name) + C (cross-tenant org-creation chain) + D (composition with F-02-005 financial-falsification indirect) are anchored at F-02-001 CRITICAL closed-batch-02. Production-impact framing per findings/02:144 verbatim: "When `complete_onboarding` runs under `authenticated` or `anon` PostgREST context, `current_setting('role', true)` returns that role — not `service_role`. The trigger RAISEs. PL/pgSQL transaction semantics roll back the entire fn body, including the preceding profile UPSERT and organisation INSERT. **In current production, the exploit chain does NOT complete: attacker gets nothing.**" Brittleness flag per L146-150: "Single-trigger-deep DiD on a Critical-class bypass. Architectural brittleness: removing or weakening `block_owner_insert` (e.g., adding role contexts that bypass the check) reopens the exploit instantly."

**NO fresh F-16-NNN allocation against this surface** per closed-batch immutability (PLAN.md §6). Drift #30.A 6th cumulative operational manifestation caught this at Phase 3.1 unrestricted findings/*.md grep, PRE-EMPTING CC Phase 2.7 provisional F-16-001 HIGH over-allocation.

### §3.10 Closed-batch citation — F-02-034 LOW closed-batch-02 (`is_org_active` + `is_org_write_allowed` PUBLIC EXECUTE info-leak class)

**4-part attestation**:
- finding-ID: **F-02-034**
- severity: **Low (class, 2 fns)** (verbatim findings/02-org-management.md:1286)
- class-shape one-liner: "`is_org_active` + `is_org_write_allowed` class — cross-tenant subscription-state boolean probing" (verbatim findings/02:1284)
- batch attribution: batch-02 closed-immutable

**Batch-16 audit-lens relevance**: anon EXECUTE on both helpers confirmed at Phase 1.6 live `has_function_privilege()`. F-02-034 anchor narrative at L1313: "Both fns are called by other server-side flows (`create_invoice_with_items` calls `is_org_active`; the `is_org_write_allowed` flag drives various server-side guards) which run under postgres ownership." Phase 1.4 confirms ZERO FE runtime call-sites (auto-generated types.ts only at L7185 + L7210). Helpers are server-side-only at runtime; anon EXECUTE info-leak class anchored-closed at LOW.

**NO fresh F-16-NNN allocation** per closed-batch immutability. PATCH 3 reviewing-Claude course-correction at Phase 1 dispatch (CC's Phase 0 §6.M framing as "POSITIVE counter-examples / CC-19 #1 POSITIVE pattern" was INCORRECT; helpers carry closed-batch F-02-034 LOW attribution).

### §3.11 Closed-batch citation — F-05-001 CRITICAL closed-batch-05 (3 PERMISSIVE block_expired_trial_*_insert RLS policies)

**4-part attestation**:
- finding-ID: **F-05-001**
- severity: **Critical** (verbatim findings/05-billing-invoicing.md:42 + L73 "**Severity:** Critical")
- class-shape one-liner: "PERMISSIVE-policy anon-cross-tenant INSERT on invoices via `block_expired_trial_invoice_insert` + `is_org_active` + `generate_invoice_number` (3-layer no-auth composition)" (verbatim findings/05:42 + L68)
- batch attribution: batch-05 closed-immutable

**Batch-16 audit-lens relevance**: 3 PERMISSIVE block_expired_trial_*_insert RLS policies (invoices + lessons + students) all anchored at F-05-001. Per F-05-001 L128 verbatim: "**All three** are PERMISSIVE with WITH CHECK `is_org_active(org_id)`. Same exploit shape applies; class anchor at F-05-001 because invoices is batch-05-owned and the financial-falsification dimension surfaces here." Cross-batch refs: lessons batch-03 closed + students batch-02 closed.

**Pattern #41 RLS-policy substrate sub-class cohort-evidence retrofit framing**: F-05-001 closed-batch-05 anchor PRE-DATES the Pattern #41 framework (s51) + RLS-policy substrate sub-class introduction (s54 with F-15-002 single-anchor PLACED). Cohort-evidence 1 → 2 enrichment (F-05-001 + F-15-002); placement-slot invariance preserved per s47+ rule (no new slot consumed). Editorial-only at §11.F.

**NO fresh F-16-NNN allocation** per closed-batch immutability. Drift #30.A 7th cumulative operational manifestation caught this at Phase 3.4 unrestricted findings/*.md grep, PRE-EMPTING provisional F-16-NNN RLS-policy substrate sub-class allocation.

### §3.12 Closed-batch citation — F-13-001 CRITICAL closed-batch-13 META (complete_onboarding as 14th cohort member)

**4-part attestation**:
- finding-ID: **F-13-001**
- severity: **Critical** (verbatim findings/13-practice-resources.md:97 + L7 "1 CRITICAL" + L18 table "+1 (F-13-001 META)")
- class-shape one-liner: "AUTH-H5 mass REVOKE migration partial-mitigation cohort (META; subsumes PI-52-A + PI-52-O)" (verbatim findings/13:97); full class-shape verbatim L111: "AUTH-H5 mass REVOKE migration `20260401000000:307-396` partial-mitigation — PG REVOKE FROM authenticated + FROM public statements do not strip explicit `anon=X/postgres` grant entry; Supabase platform default-grant on schema public (postgres-owner pg_default_acl) re-applies anon+auth+srv on CREATE OR REPLACE; omission of `REVOKE EXECUTE ... FROM anon` is the discrete syntactic defect"
- batch attribution: batch-13 closed-immutable (implicit-attribution-via-owning-feature-surface — discovery surface during batch-13 audit)

**Batch-16 audit-lens relevance**: F-13-001 META 13-fn cohort enumeration at findings/13:111-120: auto_issue_credit_on_absence + on_slot_released + auto_add_to_waitlist + notify_makeup_match_webhook + cleanup_attendance_on_cancel + cleanup_rate_limits + reset_stale_streaks + complete_expired_assignments + generate_invoice_number + set_invoice_number + find_waitlist_matches + record_stripe_payment + record_installment_payment.

Phase 3.8 cohort enrichment: **complete_onboarding adds as 14th cohort member**. Mechanism-class match confirmed:
- Substrate migrations `20260403000000:96-97` + `20260508110000:146-147` BOTH explicitly contain `REVOKE EXECUTE ON FUNCTION public.complete_onboarding FROM authenticated, anon;`
- Live HEAD (per Phase 1.6 + 3.8) shows anon=TRUE + authenticated=TRUE EXECUTE
- ZERO migrations after `20260508111856` touching complete_onboarding (per Phase 2.7 + 3.8 schema_migrations enumeration); no later GRANT-back migration
- Mechanism aligns with F-13-001 META class-shape: Supabase platform default-grant on schema public re-applies anon+auth+srv on CREATE OR REPLACE; the REVOKE in migration tail applies-at-time but subsequent CREATE OR REPLACE replays default-grant

**Cohort enrichment 13 → 14 documentation-only** per closed-batch immutability. F-13-001 severity preserved at CRITICAL closed-batch-13. NO fresh F-16-NNN allocation; F-16-001 (Path A info-leak) is class-DISTINCT (information-disclosure not REVOKE-mechanism per se).

### §3.13 Cross-batch observation — stripe-webhook subscription.* handlers (batch-06 closed; POSITIVE state-trust chain)

**Batch-06 closed-batch attribution**: `supabase/functions/stripe-webhook/index.ts` (1690 lines) anchored at F-06-001 / F-06-003 closed-batch-06 CRITICAL + F-06-005 HIGH + closed-batch coverage per s45.

**Subscription.* event handlers** (Phase 2.3a verbatim):
- L243-245: `if (session.mode === "subscription") await handleSubscriptionCheckoutCompleted(...)`
- L259-263: `case "customer.subscription.created" → handleSubscriptionCreated`
- L265-269: `case "customer.subscription.updated" → handleSubscriptionUpdated`
- L271-275: `case "customer.subscription.deleted" → handleSubscriptionDeleted`
- L277-289: invoice.payment_succeeded + invoice.payment_failed subscription branches
- L407-448: `handleSubscriptionCheckoutCompleted` body — orgId from `session.metadata.lessonloop_org_id` (set by stripe-subscription-checkout at L242 from authenticated org-owner request); service-role UPDATE on organisations at L429-440

**State-trust chain POSITIVE**: HMAC signature verified at webhook entry (closed-batch-06 anchor); session metadata orgId mediated by Stripe-side metadata-immutability + signature verification; no caller-supplied org_id at webhook layer. POSITIVE per cross-batch audit-lens; no fresh F-16-NNN.

### §3.14 Cross-batch observation — stripe-subscription-checkout Pattern #41 NEGATIVE counter-example (1st batch-16 POSITIVE)

**Pattern #41 4-anchor PLACED** (per s54 close): F-12-003 + F-14-001 + F-15-001 + F-15-003. Class-shape: "Authenticated cross-tenant action via caller-supplied identity parameter without org-membership validation".

**stripe-subscription-checkout body audit (Phase 2.4 + Phase 4.7)**:
- File: `supabase/functions/stripe-subscription-checkout/index.ts` (264 lines)
- L79-94: Authorization header + getUser(token) verifies JWT; rejects anon
- L106: `orgId` from request body (`__body.orgId`)
- **L124-134: org_membership owner-role check** — `await supabase.from('org_memberships').select('role').eq('org_id', orgId).eq('user_id', user.id).eq('status', 'active').single(); if (!membership || membership.role !== 'owner') throw new Error("Only the organisation owner can manage subscriptions");`
- Caller-supplied `orgId` IS validated against `org_memberships` with role='owner' gate

**Pattern #41 verdict: NEGATIVE counter-example**. Class-shape defining feature 2 (body-level validation that caller is authorized over the identity) PRESENT. Reinforces s51 Pattern #41 placement-reasoning (authenticated-but-not-authorized is the defect; body-level membership check is the POSITIVE pattern).

### §3.15 Cross-batch observation — onboarding-setup Pattern #41 NEGATIVE counter-example (2nd batch-16 POSITIVE)

**File**: `supabase/functions/onboarding-setup/index.ts` (217 lines)
**verify_jwt**: true (platform default; NOT in supabase/config.toml)

**Phase 4.7 dispositive body audit**:
- L29-35: Authorization header REQUIRED at body level (defensive double-gate)
- L43-45: userClient with Authorization header scope
- **L50-51**: `const token = authHeader.replace('Bearer ', ''); const { data: { user }, error: userError } = await userClient.auth.getUser(token);` — JWT verification via getUser(token) explicit-token-pass (POSITIVE per getuser-noargs-sweep cross-batch finding cohort)
- L52-57: 401 if invalid/expired token
- L60-65: 403 if email NOT verified (additional defense gate)
- L70-73: `checkRateLimit(user.id, "onboarding-setup")` — rate-limiting INVOKED (registry-extant entry at rate-limit.ts:51 `"onboarding-setup": { maxRequests: 3, windowMinutes: 60 }`)
- L177-193: **`adminClient.rpc('complete_onboarding', { _user_id: user.id, ... })`** — `_user_id` sourced from VERIFIED authenticated session (user.id from getUser(token) at L51), NOT from body payload

**Pattern #41 verdict: NEGATIVE counter-example**. 2nd batch-16 POSITIVE pattern alongside §3.14 stripe-subscription-checkout. F-02-001 closed-batch-02 CRITICAL anchor at `complete_onboarding` RPC layer is the ONLY attack path; onboarding-setup edge fn itself is closed-loop POSITIVE.

**Editorial correction**: Phase 2 §additional(a) "onboarding-setup orphan registry entry" claim was WRONG. Registry IS actively invoked at L70. Reverse the CC-19 #15 dead-code observation candidate.

### §3.16 Cross-batch observation — iOS Apple IAP avoidance POSITIVE pattern (subscription checkout web-redirect)

**21 files** with `platform.isNative` / Capacitor / `isNativePlatform` references per Phase 4.6 ripgrep. Subscription-related iOS-divergent files:

- `src/components/subscription/UpgradeBanner.tsx`: L91-105 + L129-141 + L169-180 + L186-235 + L294-318 — platform.isNative branches render "Visit lessonloop.net to upgrade" text instead of Stripe Checkout Link button
- `src/components/subscription/TrialExpiredModal.tsx`: L91-97 disables plan-card clicks on isNative + L134-144 renders NativePaymentNotice + "Continue in read-only mode" dismiss
- `src/components/subscription/FeatureGate.tsx`: L62-65 + L109-119 + L162-174 — platform.isNative branches render text-only upgrade prompt
- `src/components/settings/BillingTab.tsx`: imports platform + NativePaymentNotice at L51-52; iOS-specific handling in tier-selection
- `src/components/shared/NativePaymentNotice.tsx` — dedicated iOS payment-notice component

**Apple App Store guidelines §3.1.1 compliance**: digital-content subscriptions purchased outside Apple IAP are forbidden within iOS apps. LessonLoop's web-fallback pattern AVOIDS the IAP violation by NOT presenting Stripe Checkout flow inside the iOS app. Subscription purchase is redirected to web browser (lessonloop.net). Compliant.

**V2_PLAN §3.7 L310 Apple OAuth decision-pending** (Apple OAuth, NOT subscription IAP) is orthogonal; IAP-avoidance is INDEPENDENT decision already implemented. POSITIVE pattern observation.

### §3.17 Cross-batch observation — CANCELLED_LIMITS downgrade POSITIVE (trial-expired cron)

**File**: `supabase/functions/_shared/plan-config.ts` (Phase 4.7 read)

```typescript
export const CANCELLED_LIMITS = { max_students: 5, max_teachers: 1 };
```

**trial-expired cron** at `supabase/functions/trial-expired/index.ts:42-51` (Phase 2.3b):
```typescript
const { CANCELLED_LIMITS } = await import("../_shared/plan-config.ts");
const { error: updateError } = await supabase
  .from("organisations")
  .update({
    subscription_status: "cancelled",
    max_students: CANCELLED_LIMITS.max_students,
    max_teachers: CANCELLED_LIMITS.max_teachers,
  })
  .eq("id", org.id);
```

**POSITIVE**: validateCronAuth gated at L16-17 (POSITIVE per cron-secret pattern); service-role UPDATE; CANCELLED_LIMITS bounded downgrade (5 students + 1 teacher) prevents continued usage after trial expiry. Confirms trial-expired downgrade behavior is intentional + bounded.

---

## §4 Cross-batch reach map

### §4.1 Substrate reach (batch-16 in-scope → closed-immutable)

| Batch-16 surface | Closed-batch substrate | Reach type |
|---|---|---|
| `complete_onboarding` SECDEF body | F-02-001 CRITICAL closed-batch-02 + F-13-001 CRITICAL closed-batch-13 META | anchor + cohort enrichment |
| `is_org_active` + `is_org_write_allowed` helpers | F-02-034 LOW closed-batch-02 | anchor (PUBLIC EXECUTE class-closed) |
| 3 PERMISSIVE block_expired_trial_*_insert RLS policies | F-05-001 CRITICAL closed-batch-05 | anchor + Pattern #41 RLS-policy substrate sub-class cohort retrofit |
| `protect_org_subscription_fields` trigger on organisations | (batch-02 closed table; no direct closed-batch finding on this trigger) | substrate-only |
| `enforce_subscription_active_*` triggers (8 cross-batch tables) | Various closed-batch attributions per §2.3 table | trigger-binding substrate |
| Subscription-cohort columns on organisations | (batch-02 closed table; column-level feature-attribution at batch-16) | implicit-attribution-via-owning-feature-surface |
| stripe-webhook subscription.* handlers | F-06-001 + F-06-003 CRITICAL closed-batch-06 | substrate (audit-lens only) |
| `complete_onboarding` 14th cohort member | F-13-001 META CRITICAL closed-batch-13 | mechanism-class enrichment |

### §4.2 Consumer reach (batch-16 hooks consumed by other batches)

- `useFeatureGate.ts` consumed by 8 files across batches 03/10/13/17 (per Phase 1.4 verbatim cite enumeration)
- `useSubscription.ts` consumed by 6+ files across batches 13/16/17/18
- `useSubscriptionCheckout.ts` consumed by BillingTab + TrialExpiredModal only (2 consumers; batch-16 + batch-18)
- `useUsageCounts.ts` consumed by Students + Teachers + StudentsImport + BillingTab (batch-02 + batch-16 + batch-18)

---

## §5 PI-15-A status

NO PI-15-A cross-batch reach at batch-16 (calendar-side + xero-side token-at-rest closed at s54 via F-15-004 + F-15-005). PI-15-A remains active at PI-10 PARTIAL-HANDOVER status; Zoom sub-surface still owned by batch-18 upcoming.

---

## §6 PI-12 / PI-16 status

NO PI-12 / PI-16 cross-batch reach surfaced at batch-16. Both owned by batch-17 loopassist (upcoming s56). Subscription-tier-gating does interact with loopassist via `useFeatureGate('loop_assist')` consumer at `src/components/shared/LoopAssistPageBanner.tsx:17` (per Phase 1.4) — class shape: feature-flag matrix entry granting loop_assist to ['trial', 'solo_teacher', 'academy', 'agency', 'custom'] per `useFeatureGate.ts:33`. LoopAssist tier-gating consumer-side is batch-17 owned; batch-16 owns the data-layer gate.

---

## §7 Severity-adjustment events

**Cumulative through s55: 15 unchanged** (zero events at s55 per §11.D composition framework check).

No new events. Composition probe walked all 8 candidates vs closed-batch CRITICAL anchors (F-02-001 + F-02-002 + F-02-005 + F-02-008 + F-05-001 + F-06-001/003 + F-07-003 + F-13-001 + F-15-001); zero composition paths surface per §11.D.

---

## §8 Cross-batch helper-fn invocations

| Helper | Invoked by batch-16 surface? | Closed-batch ownership |
|---|---|---|
| `is_org_active` | YES — 3 RLS PERMISSIVE policies (invoices/lessons/students INSERT) | batch-02 closed (F-02-034) |
| `is_org_write_allowed` | YES — `check_subscription_active` trigger body | batch-02 closed (F-02-034) |
| `is_org_admin` | NO direct batch-16 invocation; cross-batch invocation by `seed_make_up_policies` body (which is invoked by `complete_onboarding`) | batch-02 closed |
| `is_org_member` / `is_org_finance_team` / `is_org_scheduler` | NO direct batch-16 invocation | batch-02 closed |

---

## §9 STATUS.md PI register cohort 5

**Unchanged at s55**: 1C / 3H / 1M / 0L. No PI-12/PI-16 cross-batch reach surfaced; PI-10 PARTIAL-HANDOVER carries forward from s54 (Zoom sub-surface still owned by batch-18 upcoming).

---

## §10 Pattern catalog matrix

**Pattern catalog status post-s55**: **37 placed + 6 candidates + 8 sub-class introductions + 1 NEGATIVE-instance flag** = UNCHANGED COUNTS.

### Pattern #41 RLS-policy substrate sub-class cohort-evidence retrofit

Pre-s55: single-anchor PLACED (F-15-002). Post-s55: cohort-evidence 1 → 2 via F-05-001 retrofit framing. **Placement-slot invariance preserved** per s47+ rule (no new slot consumed). See §11.F.

### CC-19 # carries (16 unchanged in count)

| CC-19 # | Pre s55 cumulative | s55 batch-16 contribution | Post s55 cumulative |
|---|---|---|---|
| #1 helper-fn EXECUTE-grant hygiene | ~15 | +0 fresh anchor (2 helpers F-02-034 closed; 4 trigger fns CC-19 #1 POSITIVE per §2.8) | ~15 (no count delta — closed-batch citation + trigger-fn POSITIVE) |
| #3 audit_log INSERT integrity gap | ACTIVE-mixed | +0 batch-16 enumeration (organisations batch-02 closed) | unchanged |
| #4 useCan unimplementation | ≥218 | +0 batch-16 (defense-in-depth POSITIVE pattern observation per §4.5; NOT ARCHITECTURAL N/A sub-shape extension because batch-16 HAS UI-layer affordance gating via useFeatureGate) | ≥218 unchanged |
| #6 org-context spoofing | ~49 | +0 | ~49 |
| #7 Sub-A literal `as any` cast | ~416 | NOT sweep'd | ~416 unchanged |
| #7 Sub-D2 callback `: any` parameter | ~25 | NOT sweep'd | ~25 unchanged |
| #7 Sub-E catch-block `: any` hygiene | 43 | NOT sweep'd | 43 unchanged |
| #8 E2E fixture hygiene | 471/5/30 baseline | unchanged | unchanged |
| #10 Sentry edge-fn instrumentation | ~12 | +0 (6/6 batch-16 edge fns wrapped via wrapEdgeFn per Phase 1.3 + 2.3 POSITIVE) | ~12 |
| **#11 column-CHECK-absent** | 31 | **+7 batch-16 anchors (F-16-008)** via cross-batch audit-lens; cumulative 31 → 38 | **38** |
| #13 PERMISSIVE-as-RESTRICTIVE | 6 bifurcated + 4 INERT | +0 (3 PERMISSIVE block_expired_trial_*_insert anchored at F-05-001 closed-batch-05 cross-batch observation; NOT fresh batch-16 cohort enrichment per closed-batch immutability) | unchanged |
| #14 claimed-service-role-gate misnaming | 2 anchors | +0 (protect_subscription_fields REAL gate per §3.2 + §11.D disambiguation) | 2 unchanged |
| #15 dead-code SECDEF + orphan triggers | 6 | +0 (Phase 2 §additional(a) registry-orphan claim REVERSED per §3.15) | 6 unchanged |
| #16 rate-limit-key-mismatch | 3 cohort | +0 (rate-limit ABSENT class-distinct observation per Phase 2.5; 6/6 NO MATCH for Pattern #42 registry-extant requirement) | 3 unchanged |
| F-01-017 UPDATE-no-WITH-CHECK | ≥35 main + 1 editorial | +0 batch-16 (organisations UPDATE policies cross-batch-02 closed) | ≥35 unchanged |
| Pattern #41 cross-tenant action | 4 per-flow PLACED | +0 anchor enrichment; +2 NEGATIVE counter-examples (stripe-subscription-checkout + onboarding-setup) | 4 unchanged |
| Pattern #41 RLS-policy substrate sub-class | 1 single-anchor PLACED (F-15-002) | +1 cohort-evidence retrofit (F-05-001); placement-slot invariance | 1 PLACED + 1 cohort-evidence retrofit |
| Pattern #42 candidate | 1 single-anchor candidate (F-12-008) | +0 (6/6 NO MATCH; rate-limit ABSENT class-distinct) | 1 unchanged |
| Internal-trust observation | 1 sole anchor (s52 streak-notification) | +0 (5/5 trial-* crons POSITIVE counter-examples per §2.6) | 1 unchanged |
| POS-5 _activity-sibling-table | 2-anchor pair | +0 (no batch-16 instances) | 2 unchanged |

---

## §11 Audit-method appendix

### §11.A Drift #36 standard procedure 2nd operational application

Per s52 ratification + s53 promotion to "standard Phase 2 procedure entering batch 15+" + s54 first operational application COMPLETE: every Phase 2 dispatch for batch 16+ includes explicit task line for live-DB body verification via `SELECT pg_get_functiondef(p.oid) FROM pg_proc p` on materially load-bearing SECDEF RPC body claims.

**s55 batch-16 2nd operational application**: Phase 2.1 fetched all 7 SECDEF bodies via live `pg_get_functiondef`:
- check_subscription_active body matches launching prompt §6.I.1 verbatim (zero divergence)
- protect_subscription_fields body matches §6.I.2 verbatim (zero divergence)
- is_org_write_allowed body matches §6.I.3 verbatim + substrate migration `20260303120000` SUB-M4 VERBATIM
- is_org_active body matches §6.I.4 verbatim (zero divergence)
- check_student_limit body matches §6.I.5 verbatim (zero divergence)
- check_teacher_limit body matches §6.I.6 verbatim (zero divergence)
- complete_onboarding body matches substrate migration `20260508110000` verbatim (full body fetched separately due to query size)

**7/7 PASS zero divergence**. Drift #36 standard procedure remains operational entering batch 17+.

### §11.B Drift #37 OPERATIONAL CARRY 3rd operational application + drift #40 sub-instance A V2_PLAN cite patch

Drift #37 OPERATIONAL CARRY (NEW s53 mandate): every launching-prompt section citing LESSONLOOP_V2_PLAN.md scope claims MUST include verbatim line cite from V2_PLAN.md.

**s55 3rd operational application — DEVIATION DETECTED at Phase 0**: reviewing-Claude s55 launching prompt cited "V2_PLAN.md §3.6 L302-303" for "Plan tiers: Teacher + Studio visible at launch; Agency hidden ('Contact us')" (4 separate locations: §5 item 8 + §6.D + §7 + §10b §9.8).

CC Phase 0 verbatim verification: L302 = "Internal messages org-gated, default off"; L303 = "Xero conditional on shadow-term verification"; the cited content actually appears at **L306** (see §1 V2_PLAN scope authority above).

**PATCH 1 applied at Phase 1.2**: transcribed L306 verbatim (not L302-303 as launching prompt instructed); cited L306 throughout this finding doc.

**Drift #40 sub-instance A** (Cat 1 reviewing-Claude origin): "V2_PLAN.md cite drift via memory-propagation from prior handover without verbatim filesystem cross-verification at composition time". Class-kin to drift #38 sub-instance B + drift #28. See §11.E full framing.

### §11.C Drift #30.A 6th + 7th cumulative operational manifestations

Drift #30.A OPERATIONAL CARRY (NEW s50 mandate; scope-refined s50 Phase 1 + s50 Phase 6): unrestricted findings/*.md grep applies at ANY phase where closed-batch coverage is relevant.

**Cumulative manifestations entering s55: 5** (s50 #1+#2 + s52 #3 + s53 #4 + s54 #5).

**s55 +2 cumulative manifestations**:

Manifestation #6 (Phase 3.1): F-02-001 CRITICAL closed-batch-02 anchor for complete_onboarding caught via unrestricted findings/*.md grep on 16 batch-16 terms (subscription_status, subscription_plan, max_students, max_teachers, trial_ends_at, is_org_active, is_org_write_allowed, check_subscription_active, protect_subscription_fields, check_student_limit, check_teacher_limit, complete_onboarding, stripe_subscription_id, past_due_since, cancels_at, stripe_test_mode). PRE-EMPTED CC Phase 2 §2.7 provisional F-16-001 HIGH over-allocation against complete_onboarding body attack surface (paths B/C/D anchored at F-02-001).

Manifestation #7 (Phase 3.4): F-05-001 CRITICAL closed-batch-05 anchor for 3 PERMISSIVE block_expired_trial_*_insert RLS policies caught via the same unrestricted grep. PRE-EMPTED provisional F-16-NNN RLS-policy substrate sub-class allocation against the 3 PERMISSIVE policies.

**Cumulative manifestations post-s55: 7**.

Both manifestations operate as designed: drift #30.A mitigation rule pre-emptively caught CC over-allocation BEFORE doc-write phase. Mitigation rule unchanged; manifestation count updated.

### §11.D Drift #38 5th-or-greater operational manifestation — Phase 5.3 16/16 PASS verification

Drift #38 OPERATIONAL CARRY (NEW s54 mandate): every class-anchor citation in ANY phase requires finding-ID + verbatim severity + verbatim class-shape one-liner + verbatim batch attribution from anchor doc.

**Phase 5.3 verification** ran UNRESTRICTED `audit/sweep/findings/*.md` grep for each of 16 anchor citations that appear in this finding doc:
- F-02-001 CRITICAL closed-batch-02 (PASS)
- F-02-002 CRITICAL closed-batch-02 HEADLINE (PASS)
- F-02-005 CRITICAL closed-batch-02 (PASS)
- F-02-008 HIGH closed-batch-02 (PASS)
- F-02-034 LOW closed-batch-02 (PASS)
- F-05-001 CRITICAL closed-batch-05 (PASS)
- F-05-003 HIGH closed-batch-05 (PASS)
- F-05-005 HIGH closed-batch-05 (PASS)
- F-12-003 HIGH closed-batch-12 (PASS)
- F-12-008 LOW closed-batch-12 (PASS)
- F-13-001 CRITICAL closed-batch-13 META (PASS)
- F-14-001 HIGH closed-batch-14 (PASS)
- F-15-001 CRITICAL closed-batch-15 (PASS)
- F-15-002 HIGH closed-batch-15 (PASS)
- F-15-003 HIGH closed-batch-15 (PASS)
- F-15-010 LOW closed-batch-15 (PASS)

**16/16 PASS**. Zero drift #38 cite failures at s55. Mitigation operated correctly (verification BEFORE doc-write per Phase 5 §5.A.1 precedent established s54).

### §11.E Drift #40 NEW s55 candidate ratification (Cat 1 reviewing-Claude origin)

Provisional framing for s55-close ratification at Phase 8:

**Drift #40 (Cat 1 reviewing-Claude origin)** — "Launching-prompt line/file cite drift via memory-propagation or DB-source assumption without verbatim filesystem cross-verification at composition time"

Two sub-instances under single broader entry:

**Sub-instance A** — V2_PLAN.md §3.6 cite drift L302-303 → L306. PATCH 1 applied at Phase 1.2 (see §11.B).

**Sub-instance B** — Substrate migration filename cite drift: launching prompt §5 item 10 cited filesystem paths `20260508111657_*` and `20260508111856_*` (which match DB schema_migrations.version records) but actual filesystem has `20260508110000_*` consolidated. Refined framing post-Phase 1.7: "DB schema_migrations.version vs filesystem-path source disambiguation — citation source materially affects accuracy" (see §2.10).

**Severity-of-impact**: ZERO (Phase 0 prep caught both before Phase 1 dispatch; mitigation operates as designed).

**Class-kin**: drift #28 (s49 Cat 3 CC-origin useFeatureGate-presumed-without-verbatim-cite) + drift #38 sub-instance B (reviewing-Claude origin citation hygiene without verbatim verification).

**Mitigation rule (provisional)**: every launching-prompt cite to V2_PLAN.md OR substrate migration filename requires verbatim filesystem verification at composition time, not memory-propagation from prior handover or DB-version inference.

**Final adjudication**: Phase 8 s55-close ratification.

### §11.F Pattern #41 RLS-policy substrate sub-class cohort-evidence retrofit framing

Sub-class status post-s54: single-anchor PLACED (F-15-002 §3.B.X). Class-shape verbatim: "Authenticated cross-tenant action via PERMISSIVE-OR-RLS-INSERT-policy bypass of intended RESTRICTIVE-intent gate, with downstream consumer rendering victim data".

**s55 retrofit framing**: F-05-001 closed-batch-05 CRITICAL anchor PRE-DATES the Pattern #41 framework (s51 placement at F-12-003) + RLS-policy substrate sub-class introduction (s54 at F-15-002). 6-dim class-shape adjudication vs F-15-002 anchor at Phase 3.4 returned **6/6 MATCH** with D2 magnitude-STRONGER (anon-reachable vs F-15-002 authenticated-only; doesn't shift bracket per s51 placement-reasoning precedent — magnitude factors modulate without crossing bracket).

**Cohort-evidence enrichment 1 → 2** (F-05-001 + F-15-002); **placement-slot invariance preserved** per s47+ rule (no new slot consumed; closed-batch anchor enrichment doesn't shift slot count).

Documentation-only retrofit framing per s52 batch-13 META precedent. F-05-001 severity preserved at CRITICAL closed-batch-05. Pattern #41 RLS-policy substrate sub-class slot remains single-anchor PLACED (F-15-002); cohort-evidence enriched to 2 instances.

### §11.G Defense-in-depth POSITIVE pattern observation (3-layer gating different axes)

Per Phase 4.5: three orthogonal gate layers gating three DIFFERENT axes at batch-16:
- Layer 1 — FE `useFeatureGate.ts` FEATURE_MATRIX: feature-visibility decision (UI rendering)
- Layer 2 — DB trigger `check_subscription_active`: subscription-active-write gate on 8 specific tables
- Layer 3 — RLS PERMISSIVE `block_expired_trial_*_insert`: table-write-permission gate on invoices+lessons+students

Layered defense; redundant in normal-case (active plan); divergent at edge cases (past_due — see F-16-005 finding).

**NOT a CC-19 #4 ARCHITECTURAL N/A sub-shape extension** (batch-16 HAS UI-layer affordance gating via useFeatureGate, class-DISTINGUISHED from ARCHITECTURAL N/A sub-shape requirement "no UI-layer affordance gating"). NOT a pattern catalog promotion. §11 audit-method appendix observation only.

### §11.H iOS Apple IAP avoidance POSITIVE pattern (subscription checkout web-redirect)

21 files with `platform.isNative` / Capacitor references at HEAD per Phase 4.6. Subscription-related FE components consistently branch on platform.isNative for Stripe Checkout path: web-fallback "Visit lessonloop.net to upgrade" instead of in-app Stripe Checkout. Compliant with Apple App Store guidelines §3.1.1 (digital-content subscriptions purchased outside Apple IAP are forbidden within iOS apps).

**Pre-launch state**: V2_PLAN §3.7 L310 Apple OAuth decision-pending is orthogonal (auth OAuth, NOT subscription IAP); IAP-avoidance is INDEPENDENT decision already implemented. POSITIVE pattern observation. NOT a pattern catalog promotion. §11 audit-method appendix material.

### §11.I Pattern #41 NEGATIVE counter-examples (stripe-subscription-checkout + onboarding-setup)

Two batch-16 edge fns sweep'd at Phase 2.4 + Phase 4.7 against Pattern #41 class-shape (4 per-flow PLACED anchors: F-12-003 + F-14-001 + F-15-001 + F-15-003): both NEGATIVE counter-examples.

**stripe-subscription-checkout**: L79-94 Authorization + getUser(token) auth gate + L106 caller-supplied orgId + **L124-134 org_membership owner-role check** (body-level validation that caller is authorized over identity = Pattern #41 NEGATIVE counter-example).

**onboarding-setup**: verify_jwt=true platform gate + L29-35 Authorization header double-check + L51 getUser(token) verification + L52-57 401 on invalid + L60-65 403 email-not-verified gate + L70-73 checkRateLimit invocation + L177-193 `adminClient.rpc('complete_onboarding', { _user_id: user.id, ... })` — `_user_id` sourced from VERIFIED authenticated session (NOT body payload). Pattern #41 class-shape defining feature 2 PRESENT — NEGATIVE counter-example.

Reinforces s51 Pattern #41 placement-reasoning at F-12-003 anchor. NOT a pattern catalog promotion. §11 audit-method appendix material.

### §11.J 3-layer past_due grace inconsistency operational impact (consolidated into F-16-005)

Phase 3.6 + Phase 4.5 enrichment identified semantic divergence between:
- FE `useFeatureGate` 7-day past_due grace
- DB trigger `check_subscription_active` via `is_org_write_allowed` 7-day past_due grace
- RLS PERMISSIVE `block_expired_trial_*_insert` via `is_org_active` NO past_due grace

Net effect per table cohort (Phase 3.6):
- invoices/lessons/students (3 tables): RLS strict + trigger 7-day-grace → RLS strict wins; past_due orgs CANNOT insert even within 7-day window
- attendance_records/guardians/practice_logs/resource_categories/resource_category_assignments (5 tables): only trigger applies → 7-day past_due grace works
- Other ~82 public tables: NEITHER gate → unlimited writes for past_due orgs

FE UX confusion (Phase 4.5): past_due orgs within 7-day window see features as "available" via Layer 1 (`hasAccess=true`) but actions fail at Layer 3 (RLS reject) for invoices/lessons/students. Consolidated into F-16-005 LOW finding.

### §11.K Phase 5 self-catch on F-16-008 CC-19 #11 cohort enrichment

Launching prompt §6.E explicitly listed CC-19 #11 cohort enrichment as Phase 3 finding-vector (7 organisations subscription-cohort columns lacking CHECK constraints). Phase 3.5 narrowly focused on NULL-max + -1-sentinel semantics; missed broader cohort enrichment finding allocation.

Phase 5.1 6-dim checklist re-traversal surfaced the gap. F-16-008 LOW allocation accepted at Phase 5 quality gate per s47+ "Pattern catalog promotions / sub-class introductions surface at Phase 5 EXIT BEFORE Phase 6 doc-write" precedent.

**Drift #41 candidate ratification**: see §11.M.

### §11.L Closed-batch citation + cross-batch observation enumeration framework

Per s53 precedent (`findings/14-bookings-leads-enrolment.md` §3.8-§3.10 + Phase 6 doc-write) + s54 precedent (`findings/15-calendar-sync-zoom-xero.md` §3.13-§3.21 + Phase 6 doc-write): closed-batch finding citations and cross-batch observations do NOT consume F-NN-NNN finding IDs.

Allocation rules:
- **Fresh F-16-NNN**: 8 findings (0C + 0H + 2M + 6L). Contiguous IDs F-16-001 through F-16-008.
- **Closed-batch citations** (§3.9 + §3.10 + §3.11 + §3.12): cite closed-batch anchors verbatim with drift #38 4-part attestation; no F-16-NNN. Purpose: composition-chain documentation + Phase C remediation prioritization signals.
- **Cross-batch observations** (§3.13 + §3.14 + §3.15 + §3.16 + §3.17): substrate/data-flow reach observations + POSITIVE pattern observations; no F-16-NNN. Purpose: cross-batch reach map documentation; Phase C consideration flags; POSITIVE pattern reinforcement.

Net allocation discipline: total fresh F-NN-NNN per batch reflects ONLY batch-owned findings; substrate reach + closed-batch citations + cross-batch observations are documentation-only (no tally inflation; no closed-batch immutability violation).

### §11.M Drift #41 NEW s55 candidate ratification (Cat 3 CC-origin)

Per reviewing-Claude override of CC's "no methodology entry needed" framing at Phase 5 self-catch:

**Drift #41 (Cat 3 CC-origin)** — "Launching-prompt-enumerated finding-vector missed at prescribed task phase; recovered at Phase 5 quality gate."

**Origin**: s55 Phase 3.5 narrowly focused on NULL-max + -1-sentinel semantics; missed broader CC-19 #11 column-CHECK-absent cohort enrichment per launching-prompt §6.E enumeration. Detection at Phase 5.1 via 6-dim checklist re-traversal.

**Class-kin**: drift #28 (s49 Cat 3 CC-origin useFeatureGate-presumed-without-verbatim-cite) + drift #38 sub-instance A (s54 Cat 3 CC-origin F-02-008 batch-ID inversion citation hygiene without verbatim verification). Root cause: "over-narrow focus at task phase without cross-checking launching-prompt enumeration for additional related vectors".

**Reviewing-Claude rationale for override**: s47+ Phase 5 quality gate precedent is specifically about pattern catalog promotions / sub-class introductions — Phase 5 is the designed gate for that class of decision because pattern catalog status is global (cohort matters; can't be decided in isolation per finding). Finding-vector additions belong at their scoped phase (Phase 3 for cohort enrichment vectors; Phase 1/2 for surface-discovery vectors). Recovery at Phase 5 worked here but only because CC noticed during 6-dim checklist re-traversal — not because Phase 5 is the gate.

**Mitigation rule**: every Phase 3 dispatch task must explicitly cross-check against launching-prompt §6 enumeration to verify all enumerated finding-vectors are addressed; CC produces explicit checklist in Phase 3 EXIT mapping each §6 enumerated vector to an audit decision (finding allocation / dispositive disposition / N/A).

**Severity-of-impact**: ZERO (caught at Phase 5 BEFORE Phase 6 doc-write; mitigation operated by designed cross-checklist behavior).

**Final adjudication**: Phase 8 s55-close ratification.

---

