# Batch 15 — Calendar sync, Zoom, Xero

## §1 Summary

Phase B batch 15 of 21, closed at s54 (2026-05-16). Audits the calendar-sync surface (Google Calendar OAuth + Apple iCal subscription) and the Xero accounting integration. Zoom sub-surface deferred per sole-Phase-B-sub-deferral rule (V2_PLAN.md §3.2 L246 verbatim: "Zoom integration | **HIDDEN at v1** | **No full Zoom approval yet per Jamie** — pending Zoom verification review. ... The 3 Zoom edge fns (zoom-oauth-start, zoom-oauth-callback, zoom-sync-lesson) stay 🟡 in audit/MASTER.md").

### V2_PLAN.md scope authority (drift #37 verbatim cites)

- **Xero LAUNCH DAY-ONE** per `LESSONLOOP_V2_PLAN.md:234`: "**Xero integration (LAUNCH DAY-ONE)** | **Lauren confirmed 'built and functional'; 4 of 5 bugs fixed in production code; 1 cosmetic LL-LL prefix bug** | s24 recalibration: un-deferred from CONDITIONAL → DAY-ONE. 4 active fixes verified holding (NOT NULL drift x2, FK name, unique constraint). LL-LL prefix code-fix in s24; historical Xero references stay LL-LL- (acceptable cosmetic for v1). 2 active xero_connections in production with auto_sync_invoices/payments=true."
- **Zoom HIDDEN at v1** per `LESSONLOOP_V2_PLAN.md:246` (cite above).
- **Apple OAuth decision-pending** per `LESSONLOOP_V2_PLAN.md:310`: "1. ☐ Apple OAuth: configure (a) / strip from iOS (b) / web-only launch (c). Recommend (b)."
- Editorial-only supersession: `LESSONLOOP_V2_PLAN.md:303` "✅ Xero conditional on shadow-term verification" is chronologically superseded by §3.1 L234 s24 recalibration (2026-05-10 over 2026-05-09 logged decision). Defer to post-Phase-B per closed-batch editorial convention.

AUDIT SCOPE COMPLETENESS per PLAN.md §3 rule 3: Apple sub-surface IS audited regardless of v1 visibility decision.

### Findings delta

**12 fresh F-15-NNN findings** (1 CRITICAL + 4 HIGH + 0 MEDIUM + 7 LOW):

| ID | Severity | Title |
|---|---|---|
| F-15-001 | **CRITICAL** | xero OAuth flow Pattern #41 state-poisoning + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection composition chain (event #15 NEW s54) |
| F-15-002 | HIGH | Cross-tenant child-PII via PERMISSIVE-OR-INSERT-gap on `calendar_connections` + calendar-ical-feed parent-feed render (Pattern #41 RLS-policy substrate sub-class introduction NEW s54) |
| F-15-003 | HIGH | calendar OAuth flow Pattern #41 state-poisoning (calendar-oauth-start org_id no-membership-check + calendar-oauth-callback state-trust no-HMAC) |
| F-15-004 | HIGH | PI-15-A calendar-side OAuth-token at-rest plaintext + RLS-readable SELECT (information-disclosure intra-tenant) |
| F-15-005 | HIGH | PI-15-A xero-side OAuth-token at-rest plaintext (composition BLOCKED by zero-policies RLS posture; POSITIVE architectural counter-example) |
| F-15-006 | LOW | CC-19 #1 helper-fn EXECUTE-grant hygiene cohort enrichment (`get_org_calendar_health` + `get_org_sync_error_count` body-guarded) |
| F-15-007 | LOW | CC-19 #15 dead-code orphan SECDEF (`generate_ical_token`) + FE direct-mint absorb (Pattern #43 sub-shape candidate DROPPED) |
| F-15-008 | LOW | F-01-017 UPDATE-no-WITH-CHECK cohort enrichment (`calendar_connections` Users + Parent UPDATE policies) |
| F-15-009 | LOW | CC-19 #11 column-CHECK-absent cohort enrichment (`xero_connections.sync_status` + `xero_entity_mappings.entity_type` + `sync_status`) |
| F-15-010 | LOW | CC-19 #13 PERMISSIVE-as-RESTRICTIVE-intent cohort enrichment (`calendar_connections` bifurcated + `calendar_event_mappings` INERT redundancy) |
| F-15-011 | LOW | CC-19 #10 Sentry edge-fn instrumentation NEGATIVE (`ical-expiry-reminder` bare `Deno.serve`) |
| F-15-012 | LOW | CC-19 #3 audit_log INSERT integrity gap cohort enrichment (2 TRUE GAP + 4 APP-LAYER POSITIVE + 1 PARTIAL + 2 N/A) |

**Closed-batch citations** (no F-15-NNN allocation per closed-batch immutability):
- §3.13 F-02-002 + F-08-002 closed-batch-02/08 CRITICAL child-PII anchors (Phase C prioritization signal for F-15-002)
- §3.14 F-02-005 + F-05-001 + F-02-004 closed-batch-02/05 CRITICAL financial-falsification composition chain anchors (F-15-001)

**Cross-batch observations** (no F-15-NNN allocation):
- §3.15 `lessons` → `calendar_event_mappings` ON DELETE CASCADE silent Google-event orphan (batch-03 closed)
- §3.16 `20260315 fix_lessons_calendar_audit_findings` migration substrate (batch-03 + batch-05 closed)
- §3.17 `notify_makeup_match_webhook` trigger fn (batch-08 closed; 19-cross-cutting substrate)
- §3.18 `cleanup_webhook_retention` SECDEF (19-cross-cutting + batch-06 closed substrate)
- §3.19 `calendar-oauth-start getUser()` no-args cross-batch finding cohort
- §3.20 xero-disconnect / `xero_entity_mappings` CASCADE re-creation operational concern
- §3.21 `guardians` → `calendar_connections` ON DELETE CASCADE (batch-02 closed)

### Cumulative tally projection

| Bracket | Pre-s54 | Δ | Post-s54 |
|---|---|---|---|
| Critical | 20 | +1 (F-15-001) | **21** |
| High | 47 | +4 (F-15-002 through F-15-005) | **51** |
| Medium | 26 | +0 | **26** |
| Low | 71 | +7 (F-15-006 through F-15-012) | **78** |
| **TOTAL** | 164 | +12 | **176** |

PI cohort 5 unchanged (PI-10 partial-handover; Zoom sub-surface still active until batch-18 closes). PI math: 5 − 0 + 0 = 5 ✓. Per-batch row sum: 5+36+36+5+5+11+8+7+10+10+8+4+8+4+7+**12** = 176 ✓.

### Pattern catalog deltas

- Pattern #41 anchor enrichment: 2 PLACED (F-12-003 + F-14-001) → **4 PLACED per-flow** (+F-15-001 + F-15-003) — slot invariant per s47+ placement-precedent.
- **Sub-class introduction #8 NEW s54**: Pattern #41 RLS-policy substrate sub-class (single-anchor PLACED F-15-002). Cumulative sub-class introductions 7 → 8.
- Pattern #43 sub-shape candidate DROPPED per Phase 4 §4.A.1 dispositive evidence (FE token-mint functionally-equivalent to SECDEF; Option B CC-19 #15 absorb).

### Severity-adjustment event

- **Event #15 NEW s54** (F-15-001): xero OAuth flow Pattern #41 + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection composition chain. HIGH baseline (Pattern #41 anchor) ↑ CRITICAL via composition with F-02-005 + F-05-001 + F-02-004 closed-batch-02/05 CRITICAL financial-falsification anchors per event #14 PI-52-P precedent framework. Driver type: composition-discovery escalation.

Cumulative events 14 → **15**.

### Methodology drift

- **Drift #38 RATIFIED Cat 3 co-origin NEW s54** (two sub-instances under single broader entry): CC-origin batch-ID inversion + reviewing-Claude-origin severity-misattribution. Both caught at Phase 5 §5.A.1 verbatim verification before doc-write; mitigation operated as designed per drift #31 expanded scope + drift #35.B class-shape feature verification.

Cumulative methodology entries 38 → **39** (34 Cat 1 + 2 Cat 2 + **3 Cat 3**).

### Drift #30.A 5th cumulative operational manifestation

Phase 5 §5.A.1 unrestricted `findings/*.md` grep caught the F-02-008 mis-cite from Phase 3 §3.B.X. Mitigation rule operated correctly; no fresh drift #30.A number — manifestation count update only (3 → 4 → 5).

---

## §2 Surface inventory

### §2.1 Tables (4 in-scope; implicit-attribution per PLAN.md L117 convention)

PLAN.md L117 verbatim: "Implicit-attribution-via-owning-feature-surface convention codified s51 Phase 7 ... CENSUS attributes tables implicitly via owning-feature-surface (the page/route/hook/edge fn that reads/writes the table). Primary-write-surface governs attribution".

| Table | RLS enabled | RLS forced | Scope verdict |
|---|---|---|---|
| `calendar_connections` | true | false | IN (rows WHERE `provider IN ('google','apple')` OR `provider IS NULL` per Phase 1 §1.3 distribution check returning 0 zoom rows; Zoom-sub-deferred analyst-discipline rule §6.11) |
| `calendar_event_mappings` | true | false | IN |
| `xero_connections` | true | false | IN |
| `xero_entity_mappings` | true | false | IN |
| `zoom_meeting_mappings` | true | false | **OUT** (Zoom sub-deferred per V2_PLAN §3.2 L246; full table) |
| `stripe_webhook_events` | true | false | **OUT** (batch-06 closed-immutable; implicit-attribution via stripe-webhook edge fn primary write surface) |

### §2.2 SECDEF RPCs (3 in-scope per CENSUS verbatim)

CENSUS L639-641 verbatim:
```
| `get_org_calendar_health` | yes | TABLE | 15-calendar-sync-zoom-xero |
| `get_org_sync_error_count` | yes | integer | 15-calendar-sync-zoom-xero |
| `generate_ical_token` | yes | text | 15-calendar-sync-zoom-xero |
```

### §2.3 Edge functions (13 IN-scope + 3 Zoom-sub-deferred)

CENSUS L282-288 verbatim (calendar-* fns):
```
| `calendar-disconnect` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-fetch-busy` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-ical-feed` | integration | public (token-scoped) | 15-calendar-sync-zoom-xero |
| `calendar-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `calendar-refresh-busy` | cron | cron-only | 15-calendar-sync-zoom-xero |
| `calendar-sync-lesson` | integration | auth-required | 15-calendar-sync-zoom-xero |
```

CENSUS L418 verbatim (ical):
```
| `ical-expiry-reminder` | cron | cron-only | 15-calendar-sync-zoom-xero |
```

CENSUS L456-460 verbatim (xero-* fns):
```
| `xero-disconnect` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-sync-invoice` | integration | auth-required | 15-calendar-sync-zoom-xero |
| `xero-sync-payment` | integration | auth-required | 15-calendar-sync-zoom-xero |
```

CENSUS L468-470 verbatim (Zoom sub-deferred):
```
| `zoom-oauth-callback` | integration | auth-required | 15-calendar-sync-zoom-xero (Zoom-deferred) |
| `zoom-oauth-start` | integration | auth-required | 15-calendar-sync-zoom-xero (Zoom-deferred) |
| `zoom-sync-lesson` | integration | service-role | 15-calendar-sync-zoom-xero (Zoom-deferred) |
```

Filesystem-CENSUS parity (Phase 1 §1.4): 16/16 directories matched exactly; zero orphan / phantom flags.

### §2.4 Hooks (3 per CENSUS L1027-1029 verbatim)

```
| `useCalendarConnections.ts` | OAuth connection list | 15-calendar-sync-zoom-xero |
| `useCalendarSync.ts` | Sync state per provider | 15-calendar-sync-zoom-xero |
| `useExternalBusyBlocks.ts` | External calendar busy state | 15-calendar-sync-zoom-xero |
```

### §2.5 Cron jobs (2 per CENSUS L914 + L926 verbatim)

```
| 100 | calendar-refresh-busy | `*/15 * * * *` | `calendar-refresh-busy` | 15-calendar-sync-zoom-xero |
| 112 | ical-expiry-reminder-daily | `15 7 * * *` | `ical-expiry-reminder` | 15-calendar-sync-zoom-xero |
```

### §2.6 Migration trail (10 entries per Phase 1 §1.1 Q1.1.D)

```
20260223100000 calsync_cron_guardian_health
20260224200000 zoom_integration                          [Zoom sub-deferral substrate]
20260303180000 streak_milestone_webhook                  [cross-batch 13 closed]
20260315220012 fix_lessons_calendar_audit_findings       [cross-batch 03 + 05 closed substrate; §3.16]
20260331170000 webhook_events_ttl_guidance               [cross-batch 06 closed]
20260417180000 xero_connections_schema_sync
20260421100000 xero_entity_mappings_unique_constraint
20260502100000 webhook_dedup_two_phase                   [cross-batch 06 closed]
20260503100000 webhook_event_ttl                         [cross-batch 06 closed]
20260503100100 webhook_retention_cron                    [19-cross-cutting]
```

Plus filesystem-grep at Phase 2 §2.A.2: `generate_ical_token` defined at `20260129134347_63a01f5c.sql:113`; `get_org_calendar_health` defined at `20260223100000_calsync_cron_guardian_health.sql:64` + redefined at `20260223114640_5ae4da09.sql:3`; `get_org_sync_error_count` defined at `20260223114640_5ae4da09.sql:47`.

---

## §3 Findings detail

### §3.1 F-15-001 CRITICAL — xero OAuth flow Pattern #41 state-poisoning + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection composition chain (event #15 NEW s54)

| Field | Value |
|---|---|
| **ID** | F-15-001 |
| **Severity** | **CRITICAL** (event #15 composition-discovery escalation per event #14 PI-52-P framework; HIGH baseline per Pattern #41 anchor F-12-003 ↑ CRITICAL via composition with F-02-005 + F-05-001 + F-02-004 closed-batch-02/05 CRITICAL financial-falsification anchors) |
| **Area** | edge fn body / cross-tenant action via unvalidated state-poisoning / UNIQUE(org_id) permanent-hijack amplifier / downstream xero-sync-* financial-routing-redirection chain |
| **Phase surfaced** | Phase 2 §2.C (edge fn body audit) + Phase 5 §5.C.2 composition adjudication |
| **Class anchor — substrate** (drift #31 cite) | F-12-003 HIGH (`findings/12-messages-notifications.md:155`) Pattern #41 PLACED s51 anchor — verbatim class-shape: "edge fn has auth-required gate (verify_jwt=true OR body-level Authorization+getUser(token)); body accepts caller-supplied identity parameter (userId, targetUserId, recipient_user_id, etc.); body performs action on that identity with NO body-level validation that caller is authorized over the identity" |
| **Class anchor — composition** (drift #31 cite) | F-02-005 CRITICAL (`findings/02-org-management.md:383-438`) record_stripe_payment financial-falsification (PI-08 → CRITICAL event #1); F-05-001 CRITICAL (`findings/05-billing-invoicing.md:68-149`) PERMISSIVE-policy anon-cross-tenant INSERT on invoices (3-layer no-auth composition); F-02-004 CRITICAL (`findings/02-org-management.md:310-380`) record_installment_payment financial-falsification |
| **Pattern slot** | Pattern #41 anchor enrichment (per-flow framing); 2 PLACED → 4 PLACED (placement-precedent invariance per s47+ rule preserves slot) |
| **CENSUS cite** (drift #30.B) | CENSUS L457 — `\| xero-oauth-callback \| integration \| auth-required \| 15-calendar-sync-zoom-xero \|`; CENSUS L458 — `\| xero-oauth-start \| integration \| auth-required \| 15-calendar-sync-zoom-xero \|` |

#### §3.1.1 Body evidence — per-flow chain (xero-oauth-start + xero-oauth-callback)

**File**: `supabase/functions/xero-oauth-start/index.ts` (144 lines). `verify_jwt = false` per `supabase/config.toml`. Body-level Authorization gate present.

| Line | Code | Significance |
|---|---|---|
| L42-48 | `const authHeader = req.headers.get('Authorization'); if (!authHeader) return 401` | Authorization header REQUIRED at entry |
| L58-59 | `const token = authHeader.replace(/^Bearer\s+/i, ''); const { data: { user }, error: authError } = await supabase.auth.getUser(token)` | JWT verification via `getUser(token)` (local JWKS); rejects anon |
| **L77** | `const { org_id, redirect_uri } = __body` | **Caller-supplied `org_id`** — no membership check before encoding into state |
| L101-105 | `const stateData = { user_id: user.id, org_id, redirect_uri: validateRedirectUri(redirect_uri), nonce: crypto.randomUUID() }; const state = btoa(JSON.stringify(stateData))` | State = base64-encoded JSON; **NO HMAC/signature**; `nonce` never stored/verified on callback (decorative only) |

**File**: `supabase/functions/xero-oauth-callback/index.ts` (135 lines). `verify_jwt = false` per `supabase/config.toml` (intentional for OAuth redirect URL).

| Line | Code | Significance |
|---|---|---|
| L14 | `stateData = JSON.parse(atob(state \|\| ''))` | **State decoded; NO signature verification — anyone can construct arbitrary state** |
| L35 | `const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` | Service-role for downstream write |
| L91 | `const supabase = createClient(supabaseUrl, supabaseKey)` | Service-role client bypasses RLS (necessary since xero_connections has zero policies) |
| **L94-109** | `await supabase.from('xero_connections').upsert({ org_id: stateData.org_id, connected_by: stateData.user_id, tenant_id, tenant_name, access_token, refresh_token, token_expires_at, sync_status: 'active', ... }, { onConflict: 'org_id' })` | **Upsert with `onConflict: 'org_id'`** + UNIQUE(`org_id`) DB constraint per Phase 1 §1.5 → **PERMANENT REPLACEMENT** of victim's legitimate xero_connections row |
| **L102-103** | `access_token, refresh_token` from `tokens.json()` Xero OAuth response stored as **PLAINTEXT text** | No encryption; UNIQUE(org_id) makes hijack persistent |
| L117-126 | `await supabase.from('audit_log').insert({ org_id: stateData.org_id, actor_user_id: stateData.user_id, action: 'connect', entity_type: 'xero_connection', ... })` | POSITIVE app-layer audit_log INSERT (CC-19 #3 counter-example) |

**Cross-batch downstream chain** (`xero-sync-invoice` + `xero-sync-payment`):

`xero-sync-invoice/index.ts:111-118` reads `xero_connections` via `org_id` lookup; uses `connection.access_token` + `connection.tenant_id` to POST invoices to Xero API at `https://api.xero.com/api.xro/2.0/Invoices`. After state-poisoning hijack, all victim org's future invoices (synced via this fn) route to attacker's Xero tenant.

`xero-sync-payment/index.ts:94-100` reads `xero_connections` same way; same tenant_id substrate; POSTs payments to `https://api.xero.com/api.xro/2.0/Payments`. Same routing-redirection consequence.

#### §3.1.2 6-dim rubric — F-15-001 vs F-02-005 CRITICAL anchor (composition adjudication)

| Dimension | F-02-005 (`record_stripe_payment` CRITICAL) | F-15-001 (xero OAuth chain) | Comparison |
|---|---|---|---|
| D1 substrate | SECDEF body | edge-fn body (callback) + UNIQUE(org_id) DB constraint amplifier + downstream xero-sync-* edge fns | **DISTINCT (substrate-chain vs single-SECDEF)** |
| D2 caller-identity | `_user_id` body param | state.user_id + state.org_id (base64 JSON, no signature) | MATCH |
| D3 trust | no body auth | no state HMAC/signature verification | MATCH |
| D4 reachability | anon-callable | verify_jwt=false callback + crafted-state path → effective-anon | MATCH |
| D5 mutation+downstream | direct financial-falsification (mark payments paid) | permanent xero_connections.tenant_id hijack → downstream xero-sync-invoice/payment financial-data-routing-redirection (all victim org's invoices + payments visible to attacker tenant) | MATCH (financial-falsification + financial-data-exposure class) |
| D6 grant | anon EXECUTE | SERVICE_ROLE upsert (bypasses RLS) | **DISTINCT** |

**4/6 MATCH** vs F-02-005. Plus 4/6 MATCH vs F-05-001 (3-layer anon-cross-tenant INSERT class) per §5.A.3 verbatim cite.

#### §3.1.3 Composition chain (event #14 framework)

Attack steps:
1. Attacker authenticates with their own credentials → valid JWT for own user.id.
2. Attacker POSTs to `/functions/v1/xero-oauth-start` with body `{ org_id: <victim_org>, redirect_uri: <valid-allow-list> }`. Server's `getUser(token)` accepts attacker's JWT; **NO membership check** that attacker is org_memberships member of victim_org. Server builds state with `{ user_id: attacker, org_id: victim_org, ... }`. Returns auth_url + state.
3. Attacker completes Xero OAuth in attacker's own Xero account → Xero returns code + state to callback.
4. `xero-oauth-callback`: `stateData = JSON.parse(atob(state))` — trusts state without signature verification.
5. Callback exchanges code → receives attacker's Xero access_token + refresh_token + attacker's tenant_id.
6. Callback upserts xero_connections row: `{ org_id: victim_org, connected_by: attacker, tenant_id: <attacker_tenant>, access_token: <attacker_token>, ... }` with `onConflict: 'org_id'`. UNIQUE(org_id) constraint → REPLACES legitimate victim_org Xero connection.
7. **Downstream amplification**: Any victim-org admin invoking `xero-sync-invoice(invoice_id)` or `xero-sync-payment(payment_id)` thereafter routes financial data to attacker's Xero tenant. Attacker's Xero account receives all victim's future invoices + payments.

**Composition with closed-CRITICAL anchors**:
- F-02-005 (`record_stripe_payment` cross-tenant financial-falsification CRITICAL): same class — attacker manipulates financial state via cross-tenant unvalidated identity parameter
- F-05-001 (PERMISSIVE-policy anon-cross-tenant INSERT on invoices CRITICAL): same class — cross-tenant financial-write
- F-02-004 (`record_installment_payment` financial-falsification CRITICAL): financial-falsification class chain

Per event #14 PI-52-P framework (`audit/sweep/PLAN.md §4.1`): "HIGH standalone ↑ CRITICAL via composition with F-02-005 + F-07-003 + F-08-002 closed-CRITICAL anchors per F-06-001/F-06-003 event #9 precedent (composition-discovery escalation)". F-15-001 fits this framework: HIGH baseline per Pattern #41 anchor F-12-003 same-bracket → CRITICAL via composition with closed-CRITICAL financial-falsification anchor chain.

#### §3.1.4 Pre-launch impact framing

Pre-launch: zero customers in production. Per Phase 1 §1.3 query: 0 rows in `xero_connections` with `auto_sync_invoices/payments=true` at HEAD on `xmrhmxizpslhtkibqyfy` (dest project; differs from V2_PLAN §3.1 L234 reference to "2 active xero_connections in production" which applies to source project `ximxgnkpcswbvfrkkmjq`).

Post-launch: every org connecting Xero is exposed. UK regulatory dimension: financial data routing to attacker's Xero tenant constitutes GDPR Art-32 integrity-of-processing breach + UK FCA + HMRC MTD complications if attacker's tenant is used for synthetic invoicing.

#### §3.1.5 Remediation

Two-layer fix:
- **Layer 1 (state integrity)**: HMAC the state at `xero-oauth-start:L101-105` with a server-side secret (e.g. SHA256-HMAC keyed on `STATE_SIGNING_KEY` env var). Verify HMAC at `xero-oauth-callback:L14` before trusting `stateData`. Reject mismatched HMAC.
- **Layer 2 (membership check)**: at `xero-oauth-start` after `getUser(token)` validation, check `org_memberships WHERE user_id=user.id AND org_id=__body.org_id AND status='active'`; require role='admin' or equivalent before issuing state. Closes pre-OAuth membership-check gap.
- **Layer 3 (defense in depth)**: at `xero-oauth-callback`, before upsert, re-check `org_memberships` for `state.user_id` vs `state.org_id`. Defensive.

**Decision needed**: No.
**Target sprint**: Phase C — **`S-XX-pattern-41-cohort-body-gate-hardening`** (bundle with F-12-003 + F-14-001 + F-15-003 + F-15-002).
**Closure**: (empty)

---

### §3.2 F-15-002 HIGH — Cross-tenant child-PII via PERMISSIVE-OR-INSERT-gap on `calendar_connections` + calendar-ical-feed parent-feed render (Pattern #41 RLS-policy substrate sub-class introduction NEW s54)

| Field | Value |
|---|---|
| **ID** | F-15-002 |
| **Severity** | HIGH (same-bracket pre-tag confirmation per F-12-003 anchor 5/6 MATCH; NOT a severity-adjustment event per §18 principle) |
| **Area** | RLS policy semantics / PERMISSIVE OR-redundancy at INSERT WITH_CHECK / cross-tenant child-PII information disclosure via calendar-ical-feed parent-feed render |
| **Phase surfaced** | Phase 3 §3.B fresh discovery (CC discipline catch beyond intent-verification scope) + Phase 4 §4.A.2 + §4.H FE-trace confirmation + Phase 5 §5.B.2 placement adjudication |
| **Class anchor — substrate** (drift #31 cite) | F-12-003 HIGH (`findings/12-messages-notifications.md:155`) Pattern #41 PLACED s51 anchor — verbatim class-shape: "edge fn has auth-required gate (verify_jwt=true OR body-level Authorization+getUser(token)); body accepts caller-supplied identity parameter (userId, targetUserId, recipient_user_id, etc.); body performs action on that identity with NO body-level validation that caller is authorized over the identity" + F-14-001 HIGH (`findings/14-bookings-leads-enrolment.md:135`) Pattern #41 SECOND ANCHOR s53 — dual-anchor PLACED |
| **Class anchor — consequence** (drift #31 cite) | F-02-002 CRITICAL (`findings/02-org-management.md:51 + :167`) — "`get_students_for_org` anonymous cross-tenant child-PII exfiltration **(HEADLINE)**" + F-08-002 CRITICAL (`findings/08-attendance-credits-waitlists.md:16 + :201`) — "`public.find_waitlist_matches` SECDEF + zero body auth + anon EXECUTE — returns child + guardian PII ... F-02-002 closed batch-02 CRITICAL anchor (cross-tenant child-PII exfiltration; GDPR Art 9 + Art 33 ICO-notifiable under Lauren shadow volume)" |
| **Pattern slot** | **Sub-class introduction #8 NEW s54** — Pattern #41 RLS-policy substrate sub-class (single-anchor PLACED); class-shape "Authenticated cross-tenant action via PERMISSIVE-OR-RLS-INSERT-policy bypass of intended RESTRICTIVE-intent gate, with downstream consumer rendering victim data". Placement precedent: Pattern #41 itself was placed at s51 by ADDING edge-fn-body substrate vs F-02-002 anchor; §3.B.X adds RLS-policy substrate as symmetric extension |
| **CENSUS cite** (drift #30.B) | Implicit attribution per CENSUS L1027 `useCalendarConnections.ts`; CENSUS L284 `calendar-ical-feed` |

#### §3.2.1 RLS policy evidence (Phase 1 §1.6 verbatim from `pg_policies`)

```
calendar_connections (7 PERMISSIVE policies):
DELETE: "Users can delete their own calendar connections" USING (auth.uid() = user_id) WITH_CHECK null
INSERT: "Parent can create own calendar connection" WITH_CHECK ((auth.uid() = user_id) AND
        (guardian_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM guardians g
        WHERE ((g.id = calendar_connections.guardian_id) AND (g.user_id = auth.uid())
        AND (g.org_id = calendar_connections.org_id)))))
INSERT: "Users can create their own calendar connections" WITH_CHECK (auth.uid() = user_id)
SELECT: "Parent can view own calendar connections" USING ((auth.uid() = user_id) AND
        (guardian_id IS NOT NULL) AND (EXISTS guardians)) WITH_CHECK null
SELECT: "Users can view their own calendar connections" USING (auth.uid() = user_id)
UPDATE: "Parent can update own calendar connection" USING (...) WITH_CHECK null
UPDATE: "Users can update their own calendar connections" USING (auth.uid() = user_id)
        WITH_CHECK null
```

**The OR-gap**: Users INSERT WITH_CHECK `auth.uid() = user_id` is broader than Parent INSERT WITH_CHECK (which requires `guardian_id IS NOT NULL AND EXISTS guardians WHERE g.user_id = auth.uid()`). PERMISSIVE OR semantics: at least one WITH_CHECK passes → INSERT allowed. Caller-supplied `guardian_id` is NOT validated against guardian-ownership when caller's user_id matches their own auth.uid().

#### §3.2.2 calendar-ical-feed parent-path body evidence (`supabase/functions/calendar-ical-feed/index.ts`)

```
L216-220: const { data: connection } = await supabase.from('calendar_connections')
            .select('id, user_id, org_id, sync_enabled, ical_token_expires_at, guardian_id')
            .eq('ical_token', token).eq('provider', 'apple').single()
L266:     if (connection.guardian_id) {  // Parent feed path
L268-272:   const { data: studentLinks } = await supabase
              .from('student_guardians')
              .select('student_id, student:students(first_name)')
              .eq('guardian_id', connection.guardian_id)
              .eq('org_id', connection.org_id)
L282-307:   // ... query lessons via lesson_participants
            await supabase.from('lessons').select(`
              id, title, start_at, end_at, status, notes_shared, updated_at,
              location:locations(name, address_line_1, city, postcode),
              room:rooms(name),
              participants:lesson_participants(student:students(first_name, last_name))
            `).in('id', lessonIds).eq('org_id', connection.org_id)
```

The parent-feed branch returns child names + lesson schedules + locations + notes — keyed on `connection.guardian_id` from the calendar_connections row. Whoever owns `connection.guardian_id` row dictates whose children appear in the feed.

#### §3.2.3 FE legitimate-path trace (`src/hooks/useCalendarConnections.ts` Phase 4 §4.A.2)

```
L296-308: .insert({
            user_id: user.id,
            org_id: currentOrg.id,
            provider: 'apple',
            guardian_id: guardianId,
            ical_token: icalToken,
            ical_token_expires_at: expiresAt,
            sync_enabled: true,
            sync_status: 'active'
          })
```

`generateParentICalUrl(guardianId)` accepts `guardianId` as caller parameter; sets `guardian_id` directly in INSERT. **The hook does NOT verify that `guardianId` is owned by `user.id` before INSERT** — relies on DB RLS Parent WITH_CHECK gate. PERMISSIVE OR gap defeats that intent.

FE-design RESTRICTIVE intent confirmed (hook differentiates teacher vs parent flow via `guardian_id`); DB-side gap means RESTRICTIVE intent isn't enforced.

#### §3.2.4 6-dim rubric — F-15-002 vs F-12-003 anchor (substrate adjudication)

| Dimension | F-12-003 anchor (Pattern #41 HIGH) | F-15-002 (§3.B.X) | Comparison |
|---|---|---|---|
| D1 substrate | edge-fn body | **RLS-policy INSERT (PERMISSIVE OR-redundancy)** | **DISTINCT (substrate axis variation)** |
| D2 caller-identity | `userId` body param | `guardian_id` INSERT field | MATCH |
| D3 trust | no membership check | no membership check (Parent INSERT WITH_CHECK bypassed via OR) | MATCH |
| D4 reachability | authenticated-only via JWT | authenticated-only via RLS | MATCH |
| D5 mutation+downstream | cross-tenant action (push to caller-supplied user) | cross-tenant action (INSERT enables calendar-ical-feed parent-path render of victim's children's data) | MATCH |
| D6 grant | authenticated edge-fn invoke | authenticated INSERT via PERMISSIVE policy | MATCH |

**5/6 MATCH with D1 substrate distinct (RLS-policy vs edge-fn body)**.

#### §3.2.5 6-dim rubric — F-15-002 vs F-02-002 closed-batch-02 CRITICAL anchor (composition probe)

| Dimension | F-02-002 (CRITICAL anon child-PII) | F-15-002 | Comparison |
|---|---|---|---|
| D1 substrate | SECDEF body | RLS-policy INSERT chain | DISTINCT |
| D2 caller-identity | `_org_id` param | `guardian_id` field | MATCH |
| D3 trust | no body auth | no membership check | MATCH |
| D4 reachability | **anon-callable** | **authenticated-only** | **DISTINCT (reachability-shift)** |
| D5 mutation+downstream | cross-tenant child-PII via SELECT | cross-tenant child-PII via INSERT-enabling-render | MATCH (subject) |
| D6 grant | anon EXECUTE | authenticated INSERT (PERMISSIVE) | DISTINCT |

**3/6 MATCH** vs F-02-002. Per §5.C.1 framework: 5/6 or 6/6 MATCH required for direct CRITICAL class-shape MATCH; 3/6 falls below threshold. Composition probe with F-02-002 + F-08-002 documented as Phase C remediation prioritization signal (heightened concern due to child-PII subject + UK GDPR Art 9 / Art 33 ICO-notifiable threshold under Lauren shadow term volume).

**Bracket verdict**: HIGH per F-12-003 + F-14-001 Pattern #41 same-bracket confirmation (D1 substrate axis-variation per Pattern #41 placement-reasoning precedent; reachability-axis shift is magnitude factor not bracket-shift factor). NOT a severity-adjustment event.

#### §3.2.6 Attack chain (Phase 3 §3.B.X verbatim)

```
1. Attacker authenticates → holds valid JWT for own user.id
2. Attacker enumerates victim_guardian.id (via known org membership lookup
   OR brute-force UUID — bounded by row count)
3. Attacker: supabase.from('calendar_connections').insert({
     user_id: attacker.id,
     guardian_id: victim_guardian.id,
     org_id: <valid org>,
     provider: 'apple',
     ical_token: <attacker-mints crypto.randomUUID()×2>,
     ical_token_expires_at: <future>
   })
4. Users INSERT WITH_CHECK passes (auth.uid()=user_id);
   Parent INSERT WITH_CHECK fails (g.user_id ≠ attacker);
   PERMISSIVE OR → INSERT ALLOWED
5. FK guardian_id REFERENCES guardians(id) → PASSES (victim guardian exists)
6. Row written: {user_id: attacker, guardian_id: victim_guardian, ical_token: attacker}
7. Attacker GET /functions/v1/calendar-ical-feed?token=<attacker-ical-token>
8. calendar-ical-feed:
   - L216-220 lookup matches attacker's row
   - L266 enters Parent feed path (guardian_id IS NOT NULL)
   - L268-272 query student_guardians for connection.guardian_id (VICTIM)
   - L289-307 query lessons + students(first_name, last_name) + locations + notes_shared
9. Attacker receives iCal feed with VICTIM children's:
   first+last names, lesson schedules, locations, private notes
```

**Attack does NOT require FE cooperation**: direct supabase-js client invocation via devtools / curl with auth token is sufficient. The RLS-policy gap is the operative defect.

#### §3.2.7 Remediation

Two options:
- **Option A (RLS hardening)**: convert Users INSERT policy to RESTRICTIVE (explicit `AS RESTRICTIVE`) OR strengthen Users WITH_CHECK to include `(guardian_id IS NULL OR EXISTS guardians WHERE g.id = guardian_id AND g.user_id = auth.uid())`. Closes PERMISSIVE OR gap by requiring guardian-ownership at the broader policy too.
- **Option B (Atomic SECDEF mediator)**: route ALL calendar_connections INSERTs through a `create_calendar_connection(provider, guardian_id?, ical_token, ...)` SECDEF that validates guardian-ownership at body level. FE hook calls SECDEF instead of direct INSERT. Stronger pattern; aligns with Pattern #43 anchor F-14-002 useConvertLead — "FE direct-write bypass of available atomic SECDEF" remediation.

**Decision needed**: No.
**Target sprint**: Phase C — bundle with Pattern #41 cohort + RLS-policy substrate sub-class (F-15-001 + F-15-003 + F-12-003 + F-14-001).
**Closure**: (empty)

---

### §3.3 F-15-003 HIGH — calendar OAuth flow Pattern #41 state-poisoning (calendar-oauth-start + calendar-oauth-callback)

| Field | Value |
|---|---|
| **ID** | F-15-003 |
| **Severity** | HIGH (same-bracket pre-tag confirmation per F-12-003 + F-14-001 anchors 6/6 MATCH; NOT a severity-adjustment event) |
| **Area** | edge fn body / cross-tenant action via state-poisoning / Pattern #41 anchor enrichment (per-flow framing) |
| **Phase surfaced** | Phase 2 §2.B edge fn body audit |
| **Class anchor** (drift #31 cite) | F-12-003 HIGH (`findings/12-messages-notifications.md:155`) Pattern #41 PLACED s51 + F-14-001 HIGH (`findings/14-bookings-leads-enrolment.md:135`) Pattern #41 SECOND ANCHOR s53 |
| **Pattern slot** | Pattern #41 anchor enrichment per-flow framing; 2 PLACED → 4 PLACED (placement-precedent invariance) |
| **CENSUS cite** | CENSUS L285 + L286 |

#### §3.3.1 Body evidence

**`supabase/functions/calendar-oauth-start/index.ts`** (139 lines; verify_jwt=true platform default — not in config.toml):

| Line | Code | Significance |
|---|---|---|
| L43-49 | `const authHeader = req.headers.get('Authorization'); if (!authHeader) return 401` | authHeader presence check |
| L57 | `const { data: { user }, error: authError } = await supabase.auth.getUser()` | **getUser() NO-ARGS variant** (cross-batch finding cohort `audit/findings/2026-05-10-getuser-noargs-sweep.md`); xero-oauth-start uses local-JWKS `getUser(token)` for contrast — see §3.19 |
| **L75-82** | `const { org_id, redirect_uri } = __body; if (!org_id) return 400` | **Caller-supplied `org_id`** — no membership check |
| L99-105 | `const stateData = { user_id: user.id, org_id, redirect_uri: validateRedirectUri(redirect_uri), nonce: crypto.randomUUID() }; const state = btoa(JSON.stringify(stateData))` | State = base64 JSON; **NO HMAC**; nonce never stored/verified |

**`supabase/functions/calendar-oauth-callback/index.ts`** (163 lines; verify_jwt=false per config.toml):

| Line | Code | Significance |
|---|---|---|
| L14 | `stateData = JSON.parse(atob(state \|\| ''))` | State decoded without signature verification |
| L35 | `const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` | Service-role for INSERT (calendar_connections has client-readable RLS; service-role write bypasses) |
| L91 | `const supabase = createClient(supabaseUrl, supabaseKey)` | Service-role client |
| L93-99 | Existing-connection check WHERE user_id=stateData.user_id AND org_id=stateData.org_id AND provider='google' | Lookup keyed on state-supplied values |
| **L106-107** + **L129-130** | `access_token, refresh_token` from `tokens.json()` Google OAuth response stored **PLAINTEXT** | See §3.4 PI-15-A calendar-side |

#### §3.3.2 6-dim rubric — F-15-003 vs F-12-003 + F-14-001 anchors (per-flow framing)

| Dimension | F-12-003 (Pattern #41) | F-14-001 (Pattern #41 SECOND) | F-15-003 calendar OAuth | Comparison |
|---|---|---|---|---|
| D1 substrate | edge-fn body | edge-fn body | edge-fn body (start + callback chain) | MATCH |
| D2 caller-identity | `userId` | `waitlist_id` + `org_id` | `org_id` (start) + state.user_id + state.org_id (callback) | MATCH |
| D3 trust | no membership | no membership | no membership (start) + no HMAC (callback) | MATCH |
| D4 reachability | authenticated-only | authenticated-only | authenticated (start) + verify_jwt=false-but-Google-OAuth-gates (callback) | MATCH |
| D5 mutation+downstream | cross-tenant push | message_log + enrolment_waitlist_activity | calendar_connections cross-tenant write | MATCH |
| D6 grant | authenticated | authenticated | mixed (start auth + callback effective-anon-via-Google) | MATCH-equivalent |

**6/6 MATCH** with F-12-003 + F-14-001. Same-bracket pre-tag confirmation per §18. **NOT a severity-adjustment event**.

#### §3.3.3 Attack chain (calendar variant)

Analogous to F-15-001 chain (steps 1-7) but without UNIQUE(org_id) permanent-hijack amplifier. Attacker writes a `calendar_connections` row with `{user_id: attacker, org_id: victim, provider: 'google', access_token: attacker's-Google-token}`. Downstream `calendar-fetch-busy` cron and `calendar-sync-lesson` would use this token to fetch/write events. The token belongs to attacker's Google account, so `external_busy_blocks` for the victim org would be populated from attacker's Google calendar (information disclosure of attacker's events into victim's busy-block view) — limited blast radius vs xero case where downstream consequences include financial-routing-redirection.

Pre-launch: zero customers; zero exploit surface NOW.

#### §3.3.4 Remediation

Same as F-15-001 (HMAC state + membership check at start). Bundle in Phase C with F-15-001 + F-15-002 + F-12-003 + F-14-001 cohort body-gate hardening.

**Decision needed**: No.
**Target sprint**: Phase C — `S-XX-pattern-41-cohort-body-gate-hardening`.
**Closure**: (empty)

---

### §3.4 F-15-004 HIGH — PI-15-A calendar-side OAuth-token at-rest plaintext + RLS-readable SELECT

| Field | Value |
|---|---|
| **ID** | F-15-004 |
| **Severity** | HIGH (within-bracket per PI-10 baseline; F-05-007 information-disclosure precedent applied with one-axis-lower modulation for intra-tenant; NOT a severity event) |
| **Area** | credential-at-rest plaintext + PERMISSIVE-RLS-readable-SELECT exposing OAuth bearer tokens to authenticated session |
| **Phase surfaced** | Phase 1 §1.6 RLS posture + Phase 2 §2.B.4 plaintext INSERT path enumeration + Phase 5 §5.C.3 |
| **Class anchor** (drift #31 cite) | F-05-007 HIGH (`findings/05-billing-invoicing.md:48`) — "`list_invoice_pdf_objects` SECDEF no-auth + anon EXECUTE enables cross-tenant `(org_id, invoice_id)` storage-path enumeration schema-wide" — information-disclosure class anchor (one-axis-lower for PI-15-A: intra-tenant strips cross-tenant axis but stays in information-disclosure class) |
| **PI bracket** | PI-10 HIGH baseline (s38 cohort 5; co-owned 15+18); partial-handover-to-batch-18 (Zoom sub-deferred); PI-10 NOT closed at s54 |

#### §3.4.1 Evidence — plaintext INSERT path

4 sites confirmed at Phase 2 §2.B.4:

| Site | Code | Plaintext field |
|---|---|---|
| `calendar-oauth-callback/index.ts:106-107` | UPDATE branch | `access_token, refresh_token` from `tokens.json()` |
| `calendar-oauth-callback/index.ts:129-130` | INSERT branch | `access_token, refresh_token` raw |
| `calendar-refresh-busy/index.ts:38` | cron token-refresh UPDATE | `access_token` PLAINTEXT |
| `calendar-sync-lesson/index.ts:50` | on-demand token-refresh UPDATE | `access_token` PLAINTEXT |

NO `pgsodium` / `vault` / Web Crypto API / Deno crypto wrapping at any site.

#### §3.4.2 Evidence — client-readable SELECT path

Phase 1 §1.6 RLS policy enumeration (verbatim from §3.2.1 above): `calendar_connections` has 2 PERMISSIVE SELECT policies allowing authenticated user to read full row including `access_token` + `refresh_token` subject to `auth.uid() = user_id`.

Practical exposure path: any authenticated user → `supabase.from('calendar_connections').select('*').eq('user_id', user.id)` returns full row including raw Google OAuth bearer tokens. XSS / dev-tools / scripted-client extraction is technically feasible.

#### §3.4.3 6-dim rubric — F-15-004 vs F-05-007 anchor

| Dimension | F-05-007 (cross-tenant info-disclosure HIGH) | F-15-004 PI-15-A calendar-side | Comparison |
|---|---|---|---|
| D1 substrate | SECDEF cross-tenant enumeration | token-at-rest plaintext + RLS-readable SELECT | DISTINCT (substrate) |
| D2 caller-identity | caller-supplied (org_id, invoice_id) | NA (intra-tenant readback by row owner) | DISTINCT (no identity param) |
| D3 trust | no body auth | relies on intra-tenant RLS posture for credential-exposure intent | DISTINCT |
| D4 reachability | anon-callable | authenticated client-side readback (intra-tenant only) | DISTINCT (cross→intra) |
| D5 mutation+downstream | cross-tenant info enumeration | read-only token exposure (no cross-tenant axis) | MATCH (information-disclosure class subject) |
| D6 grant | anon EXECUTE | authenticated SELECT via PERMISSIVE policy | DISTINCT |

**1/6 MATCH** (D5 subject only). Class-precedent reassessment: cross-tenant axis stripped (intra-tenant only) → one-axis-lower from F-05-007 cross-tenant HIGH. Lands at HIGH per PI-10 baseline + information-disclosure CAPS-at-HIGH per F-05-007 precedent chain. NOT a severity-adjustment event.

#### §3.4.4 Remediation

- **Layer 1 (RLS hardening)**: column-level grant restriction — `REVOKE SELECT ON calendar_connections.access_token, calendar_connections.refresh_token FROM authenticated`. Client SELECT returns rows but with NULL token columns; service-role bypass still works for edge fns that legitimately need the tokens.
- **Layer 2 (encryption at rest)**: route INSERT/UPDATE through `pgsodium`-secret-encrypted column wrappers OR Supabase Vault. Defense-in-depth.
- **Layer 3 (architectural realignment)**: convert `calendar_connections` to xero-side server-side-only zero-policies posture (force all reads through edge-fn service-role mediation). Highest assurance but most refactor.

**Decision needed**: Phase C decision on Layer 1 vs Layer 3 (vs both).
**Target sprint**: Phase C — credential-at-rest hardening + RLS posture alignment.
**Closure**: (empty)

---

### §3.5 F-15-005 HIGH — PI-15-A xero-side OAuth-token at-rest plaintext (composition BLOCKED by zero-policies RLS posture; POSITIVE architectural counter-example)

| Field | Value |
|---|---|
| **ID** | F-15-005 |
| **Severity** | HIGH (PI-10 baseline retained; composition path BLOCKED by zero-policies RLS posture; NOT a severity event) |
| **Area** | credential-at-rest plaintext on xero_connections; RLS posture BLOCKS client-readable exposure (POSITIVE counter-example) |
| **Phase surfaced** | Phase 1 §1.6 + Phase 2 §2.C.4 |
| **Class anchor** | PI-10 baseline (s38 cohort 5) |

#### §3.5.1 Evidence

Plaintext INSERT path confirmed at:
- `xero-oauth-callback/index.ts:102-103` (upsert; raw Xero `tokens.json()` plaintext)
- `_shared/xero-auth.ts:47-48` (`refreshXeroToken` UPDATE; PLAINTEXT; Xero rotates refresh_token — both tokens re-stored plaintext per refresh)

Client-readable SELECT path: **BLOCKED** per Phase 1 §1.6 — `xero_connections` has RLS enabled + ZERO policies → server-side-only via service_role.

#### §3.5.2 POSITIVE architectural counter-example formalization (§5 RLS posture)

xero-side posture is the canonical credential-table design pattern:
- RLS enabled (defense-in-depth at PG layer)
- Zero policies (no authenticated-role SELECT path)
- All reads/writes via service-role (edge-fn mediation)

Contrast with calendar-side (§3.4 F-15-004) which exposes equivalent tokens via 7 PERMISSIVE policies. Phase C remediation candidate: align calendar_connections to xero_connections posture.

#### §3.5.3 Remediation

Defense-in-depth Layer 2 (encryption at rest) per F-15-004 §3.4.4 still applicable to xero-side — eliminate plaintext-at-rest concern even though RLS BLOCKS client reach. Lower priority than F-15-004 calendar side since composition path closed.

**Target sprint**: Phase C — credential-at-rest encryption (lower priority).

---

### §3.6 F-15-006 LOW — CC-19 #1 helper-fn EXECUTE-grant hygiene cohort enrichment (2 body-guarded SECDEFs)

| Field | Value |
|---|---|
| **ID** | F-15-006 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-14-003 + F-11-002 + F-10-008 + F-09-002 precedent chain) |
| **Area** | SECDEF anon-EXECUTE retention with body-guard intact / defense-in-depth gap |
| **Phase surfaced** | Phase 2 §2.A drift #36 standard procedure first operational application |
| **Class anchor** (drift #31 cite) | F-14-003 LOW (`findings/14-bookings-leads-enrolment.md:335-348`) "SECDEF CC-19 #1 anon-EXECUTE hygiene cohort enrichment (4 body-guarded anchors)" — verbatim cohort class-shape match |
| **Cohort** | CC-19 #1 helper-fn EXECUTE-grant hygiene; pre-s54 ~13 → post-s54 ~15 (+2 batch-15 anchors) |

#### §3.6.1 Anchors

DB-verified via `has_function_privilege()` (drift #29 operational mandate per Phase 2 §2.A.3):

| Fn | anon EXEC | auth EXEC | svc EXEC | Body-guard | Pattern #40 NULL-3VL |
|---|---|---|---|---|---|
| `get_org_calendar_health(p_org_id uuid)` | true | true | true | `is_org_admin(auth.uid(), p_org_id)` in WHERE ✓ | NO MATCH per F-14-003 precedent |
| `get_org_sync_error_count(p_org_id uuid)` | true | true | true | `is_org_admin(auth.uid(), p_org_id)` in WHERE ✓ | NO MATCH |

Both retain anon=X/postgres EXECUTE. Body-guards intact via `is_org_admin` SELECT EXISTS pattern (returns boolean false for NULL `auth.uid()` per PG 3VL; gate fires correctly; anon BLOCKED).

#### §3.6.2 Remediation

Layer 1: `REVOKE EXECUTE ON FUNCTION public.get_org_calendar_health(uuid) FROM anon` + `REVOKE EXECUTE ON FUNCTION public.get_org_sync_error_count(uuid) FROM anon`. Mechanical migration.

**Target sprint**: Phase C — `S-XX-secdef-revoke-from-anon` (cohort bundle with all CC-19 #1 cohort anchors).

---

### §3.7 F-15-007 LOW — CC-19 #15 dead-code orphan SECDEF (`generate_ical_token`) + FE direct-mint absorb (Pattern #43 sub-shape candidate DROPPED)

| Field | Value |
|---|---|
| **ID** | F-15-007 |
| **Severity** | LOW (CC-19 #15 dead-code SECDEF cohort enrichment; Pattern #43 sub-shape candidate DROPPED per Phase 4 §4.A.1 dispositive evidence) |
| **Area** | dead-code SECDEF + FE direct-mint absorb |
| **Phase surfaced** | Phase 2 §2.A.1 consumer enumeration + Phase 4 §4.A.1 token-mint quality verification |
| **Class anchor** (drift #31 cite) | F-14-004 LOW (`findings/14-bookings-leads-enrolment.md` §3.4) "CC-19 #15 dead-code orphan SECDEF (`convert_lead`)" |
| **Cohort** | CC-19 #15 dead-code SECDEF + orphan trigger fns; pre-s54 5 → post-s54 6 (+1 batch-15) |

#### §3.7.1 Evidence — dead-code SECDEF

`generate_ical_token` body (Phase 2 §2.A.1 live-DB `SELECT prosrc`):
```sql
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
```
- prosecdef=true; proconfig=['search_path=public']; args=''; returns text
- EXECUTE: anon=true / auth=true / svc=true
- Consumer enumeration: `grep -rn "generate_ical_token" src/ supabase/functions/` returned **ONLY** `src/integrations/supabase/types.ts:6912` (auto-generated type declaration). **ZERO actual `supabase.rpc('generate_ical_token')` calls in src/ or supabase/functions/`. ORPHAN.

#### §3.7.2 Evidence — FE direct-mint absorb (Pattern #43 sub-shape candidate DROPPED)

`src/hooks/useCalendarConnections.ts` mints token directly at 3 sites:

| Line | Code | Entropy |
|---|---|---|
| L68 (`generateICalUrl`) | `const icalToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')` | 2× UUID v4 = 244 bits effective entropy (122 per UUID; 6 bits version+variant fixed); 64 hex chars |
| L112 (`regenerateICalToken.mutationFn`) | (same) | (same) |
| L293 (`generateParentICalUrl`) | (same) | (same) |

Per W3C Web Crypto API spec, `crypto.randomUUID()` is cryptographically secure (OS CSPRNG). **Functionally equivalent to SECDEF's `encode(gen_random_bytes(32), 'hex')` 256-bit output**. Both above 128-bit cryptographic security threshold.

#### §3.7.3 Pattern #43 sub-shape adjudication (DROPPED)

Class-shape vs F-14-002 Pattern #43 anchor:
- bypass-of-available-atomic-SECDEF ✓ MATCH
- multi-table writes ✗ NO MATCH (single-table here)
- cross-batch closed-immutable ✗ NO MATCH (intra-batch)
- partial-success-without-rollback partial (single-write)
- → 1/4 class-shape dimensions match

**Phase 5 adjudication: Option B — CC-19 #15 absorb**. FE mint functionally-equivalent to SECDEF; no security degradation; bypass is hygiene-only. No Pattern #43 sub-shape introduction. Cohort enrichment under CC-19 #15 alone.

#### §3.7.4 Remediation

Two options:
- **Option A (DROP SECDEF)**: `DROP FUNCTION public.generate_ical_token()`. Codify FE-as-source-of-truth for ical_token mint.
- **Option B (Adopt SECDEF)**: refactor FE useCalendarConnections.ts to call `supabase.rpc('generate_ical_token')` instead of inline `crypto.randomUUID()`. Centralize mint at DB; preserves token-format-evolution flexibility.

Either acceptable; CC-19 #15 cohort precedent suggests Option A (remove dead-code).

**Target sprint**: Phase C — CC-19 #15 cohort cleanup.

---

### §3.8 F-15-008 LOW — F-01-017 UPDATE-no-WITH-CHECK cohort enrichment (calendar_connections Users + Parent UPDATE)

| Field | Value |
|---|---|
| **ID** | F-15-008 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-14-005 + F-13-002 + F-12-004 precedent; F-01-017 anchor itself is MEDIUM cluster header) |
| **Area** | RLS UPDATE policy missing explicit WITH_CHECK |
| **Phase surfaced** | Phase 1 §1.6 + Phase 3 §3.B intent verification |
| **Class anchor** (drift #31 cite) | F-01-017 MEDIUM (`findings/01-auth-sessions-rls.md:413`) — "UPDATE/ALL policies on ~50 tables lack explicit `WITH CHECK` clause" + F-14-005 LOW cohort precedent (`findings/14-bookings-leads-enrolment.md` §3.5) |
| **Cohort** | F-01-017 UPDATE-no-WITH-CHECK; pre-s54 ≥33 → post-s54 ≥35 main + 1 editorial-candidate B1 deferred |

#### §3.8.1 Anchors

Phase 1 §1.6 RLS enumeration:
- `calendar_connections` "Users can update their own calendar connections" UPDATE USING `auth.uid() = user_id` WITH_CHECK null
- `calendar_connections` "Parent can update own calendar connection" UPDATE USING (...) WITH_CHECK null

`calendar_event_mappings` "Users can manage their own event mappings" polcmd=`ALL` USING-only WITH_CHECK null — **excluded from F-15-008 main count per editorial-candidate B1 carry** (FOR-ALL polcmd=`*` cohort-counting scope per batch-12/13/14 UPDATE-only-scope precedent; re-scoping would force retrospective rebase across batches 01-13).

xero_connections + xero_entity_mappings: zero policies → no UPDATE-no-WITH-CHECK anchors (POSITIVE counter-example for cohort tracking).

#### §3.8.2 Remediation

Add explicit `WITH CHECK (auth.uid() = user_id)` to both Users + Parent UPDATE policies. Prevents FK-column tampering (e.g. UPDATE changing `user_id` post-INSERT).

**Target sprint**: Phase C — F-01-017 cohort sprint.

---

### §3.9 F-15-009 LOW — CC-19 #11 column-CHECK-absent cohort enrichment (3 xero_* columns)

| Field | Value |
|---|---|
| **ID** | F-15-009 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-14-006 + F-13-004 + F-10-004 + F-09-012 precedent) |
| **Area** | Column-CHECK constraint absent on enum-shaped columns |
| **Phase surfaced** | Phase 1 §1.5 + Phase 3 §3.A xero_* column-schema verification |
| **Class anchor** (drift #31 cite) | F-09-012 LOW (`findings/09-term-continuation.md` §F-09-012 "4-column CHECK cohort") + F-14-006 LOW (`findings/14-bookings-leads-enrolment.md` §3.6 "CC-19 #11 column-CHECK-absent cohort enrichment (9 batch-14 anchors)") |
| **Cohort** | CC-19 #11; pre-s54 28 → post-s54 31 (+3 batch-15) |

#### §3.9.1 Anchors (Phase 3 §3.A verbatim)

| Table | Column | Type | NULL | Default | CHECK present |
|---|---|---|---|---|---|
| `xero_connections` | `sync_status` | text | NO | `'active'::text` | **NO** |
| `xero_entity_mappings` | `entity_type` | text | NO | (none) | **NO** |
| `xero_entity_mappings` | `sync_status` | text | NO | `'pending'::text` | **NO** |

POSITIVE counter-examples within batch-15: `calendar_connections.provider` + `calendar_connections.sync_status` + `calendar_event_mappings.sync_status` all have CHECK constraints (Phase 1 §1.5).

Asymmetry observation: calendar-side has CHECK constraints on enum-shaped columns; xero-side has zero CHECK constraints. Same author-asymmetry pattern as RLS posture (§5).

0 NOT-VALID variants (`convalidated=true` on all batch-15 constraints; matches F-13-004 + F-14-006 precedent of clean NOT-VALID baseline).

#### §3.9.2 Remediation

Three CHECK migrations:
```sql
ALTER TABLE xero_connections ADD CONSTRAINT xero_connections_sync_status_check
  CHECK (sync_status = ANY (ARRAY['active'::text, 'error'::text, 'disconnected'::text]));
ALTER TABLE xero_entity_mappings ADD CONSTRAINT xero_entity_mappings_entity_type_check
  CHECK (entity_type = ANY (ARRAY['contact'::text, 'invoice'::text, 'payment'::text]));
ALTER TABLE xero_entity_mappings ADD CONSTRAINT xero_entity_mappings_sync_status_check
  CHECK (sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text]));
```

**Target sprint**: Phase C — CC-19 #11 cohort sprint.

---

### §3.10 F-15-010 LOW — CC-19 #13 PERMISSIVE-as-RESTRICTIVE-intent cohort enrichment (bifurcated + INERT)

| Field | Value |
|---|---|
| **ID** | F-15-010 |
| **Severity** | LOW (cohort-enrichment per CC-19 #13 cluster entering s54: 5 bifurcated + INERT sub-shape 3) |
| **Area** | RLS PERMISSIVE OR-redundancy (bifurcated) + INERT redundancy |
| **Phase surfaced** | Phase 1 §1.6 + Phase 3 §3.B + §3.F + Phase 5 §5.B.2 sub-class introduction |
| **Class anchor** | CC-19 #13 cluster (F-12-005 bifurcated sub-shape s51 + INERT sub-shape s52) |
| **Cohort** | CC-19 #13; pre-s54 5 bifurcated + INERT 3 → post-s54 6 bifurcated + INERT 4 (+1 each) |

#### §3.10.1 Anchors

**Bifurcated** (calendar_connections Users + Parent policy pair-set): 3 policy-pair manifestations (INSERT/SELECT/UPDATE) where Users PERMISSIVE policy's bare `auth.uid() = user_id` subsumes Parent PERMISSIVE policy's `guardian_id IS NOT NULL AND EXISTS guardians` predicate. Subsumes RESTRICTIVE intent. **THIS IS THE SUBSTRATE FOR F-15-002 cross-tenant attack** — bifurcated is not always inert.

**INERT** (calendar_event_mappings ALL + SELECT redundancy): ALL policy fully covers SELECT; SELECT policy is fully subsumed (no security consequence; cleanup-class hygiene).

#### §3.10.2 Remediation

For bifurcated: addressed by F-15-002 remediation Option A (RESTRICTIVE conversion OR Users WITH_CHECK strengthening).

For INERT: drop the redundant SELECT policy.

**Target sprint**: Phase C — CC-19 #13 cohort cleanup (bundle with F-15-002).

---

### §3.11 F-15-011 LOW — CC-19 #10 Sentry edge-fn instrumentation NEGATIVE (`ical-expiry-reminder` bare `Deno.serve`)

| Field | Value |
|---|---|
| **ID** | F-15-011 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per CC-19 #10 cohort precedent: F-08-007 + F-13-005 instances) |
| **Area** | Sentry edge-fn instrumentation gap |
| **Phase surfaced** | Phase 2 §2.G + §2.H.5 wrap verification |
| **Class anchor** | CC-19 #10 Sentry edge-fn instrumentation gap (F-08-007 anchor `notify-makeup-match` bare `Deno.serve` per `findings/08-attendance-credits-waitlists.md` §F-08-007) |
| **Cohort** | CC-19 #10; pre-s54 ~11 → post-s54 ~12 (+1 batch-15) |

#### §3.11.1 Evidence

`supabase/functions/ical-expiry-reminder/index.ts:8`:
```ts
Deno.serve(async (req) => {
  // Only allow scheduled/internal calls
  const authError = validateCronAuth(req);
  ...
```

**NO `wrapEdgeFn` import; NO `wrapEdgeFn` invocation**. File top imports: `createClient`, `validateCronAuth`, `escapeHtml`, `transformEmailForShadow`. Absent: `wrapEdgeFn` from `_shared/sentry.ts`.

Contrast: 12/13 batch-15 edge fns wrap via `wrapEdgeFn(...)`. Only `ical-expiry-reminder` is bare.

#### §3.11.2 Remediation

Add `import { wrapEdgeFn } from "../_shared/sentry.ts"`; change `Deno.serve(async (req) => {` to `Deno.serve(wrapEdgeFn("ical-expiry-reminder", async (req) => {`.

**Target sprint**: Phase C — CC-19 #10 cohort cleanup.

---

### §3.12 F-15-012 LOW — CC-19 #3 audit_log INSERT integrity gap cohort enrichment (ACTIVE-mixed)

| Field | Value |
|---|---|
| **ID** | F-15-012 |
| **Severity** | LOW (cohort-enrichment ACTIVE-mixed entering s54 per F-14-007 precedent format) |
| **Area** | audit_log INSERT integrity gap on sync-event tables; APP-LAYER COVERAGE POSITIVE for user-action edge fns |
| **Phase surfaced** | Phase 2 §2.H + Phase 3 §3.C full enumeration |
| **Class anchor** (drift #31 cite) | F-02-010 class header (audit_log INSERT integrity gap; 70.1% historical NULL-actor) + F-14-007 cohort precedent (`findings/14-bookings-leads-enrolment.md` §3.7 "CC-19 #3 audit_log INSERT integrity gap cohort enrichment (4 TRUE GAP anchors + 2 APP-LAYER COVERAGE POSITIVE)") |
| **Cohort** | CC-19 #3 ACTIVE-mixed enriched |

#### §3.12.1 Enumeration (Phase 3 §3.C)

| Owning-table write | Edge fn | audit_log | Verdict |
|---|---|---|---|
| calendar_connections INSERT (new) | calendar-oauth-callback:144-154 | ✓ | POSITIVE APP-LAYER |
| calendar_connections UPDATE (sync metadata) | calendar-refresh-busy + calendar-sync-lesson + calendar-fetch-busy + calendar-ical-feed | NO | N/A (sync-event; not user action) |
| calendar_connections UPDATE (ical_token rotation FE) | useCalendarConnections.ts:115-124 + 297-308 + 315-327 | NO | **PARTIAL** (FE-gap; user action without audit_log) |
| calendar_connections DELETE | calendar-disconnect:197-206 | ✓ | POSITIVE APP-LAYER |
| **calendar_event_mappings INSERT/UPDATE/DELETE** | calendar-sync-lesson + calendar-disconnect | **NO** | **TRUE GAP** (sync-event) |
| xero_connections INSERT (upsert) | xero-oauth-callback:117-126 | ✓ | POSITIVE APP-LAYER |
| xero_connections UPDATE (sync_status='error' + refresh) | xero-auth.ts:44-51 + xero-oauth-callback | mixed | N/A per refresh convention |
| xero_connections DELETE | xero-disconnect:93-102 | ✓ | POSITIVE APP-LAYER |
| **xero_entity_mappings INSERT** | xero-sync-invoice:186-196 + :282-292 + xero-sync-payment:189-200 | **NO** | **TRUE GAP** (sync-event) |
| xero_entity_mappings DELETE | xero-disconnect (cascade) | transitive POSITIVE | (via parent) |

**Final cohort delta**: **2 TRUE GAP + 4 APP-LAYER COVERAGE POSITIVE + 1 PARTIAL + 2 N/A**. ACTIVE-mixed enriched cohort entering Phase 5.

#### §3.12.2 Remediation

For TRUE GAP (calendar_event_mappings + xero_entity_mappings sync-events): add AFTER INSERT/UPDATE triggers calling `log_audit_event_singular` per 28-table POSITIVE baseline pattern.

For PARTIAL (calendar_connections FE direct-write): route ical_token rotation through edge fn that includes audit_log INSERT.

**Target sprint**: Phase C — CC-19 #3 cohort cleanup.

---

### §3.13 Closed-batch citation — F-02-002 + F-08-002 closed-CRITICAL child-PII anchors (Phase C remediation prioritization signal for F-15-002)

Per closed-batch immutability rule (PLAN.md §6); no fresh F-15-NNN allocation.

**F-02-002** at `findings/02-org-management.md:51 + :167-245` — verbatim CRITICAL HEADLINE: "`get_students_for_org` anonymous cross-tenant child-PII exfiltration **(HEADLINE)**" + "**This is not a 'PII leak' framing — it is a child-safeguarding incident at scale.**" + "GDPR Article 33 — breach notification to the supervisory authority (ICO in the UK) within 72 hours of becoming aware. Special-category data triggers the obligation at a lower threshold; presence of children's data elevates further." + "Under Lauren shadow-term volume (Phase E target: 12-week shadow with real-studio scale), a single anonymous exploit call against the shadow studio extracts that studio's full pupil roster. **This is a notifiable incident.**"

**F-08-002** at `findings/08-attendance-credits-waitlists.md:16 + :201` — verbatim CRITICAL: "`public.find_waitlist_matches` SECDEF + zero body auth + anon EXECUTE — returns child + guardian PII (student_name + guardian_name + guardian_email + missed_lesson_title + missed_lesson_date) for any `(_lesson_id, _absent_student_id, _org_id)` triple" + class anchor "F-02-002 closed batch-02 CRITICAL anchor (cross-tenant child-PII exfiltration; GDPR Art 9 + Art 33 ICO-notifiable under Lauren shadow volume)".

**Composition probe for F-15-002 documented in §11.F**: 3/6 MATCH falls below CRITICAL direct-class-shape threshold; F-02-002 + F-08-002 closed-CRITICAL anchors function as Phase C remediation prioritization signal for F-15-002 (child-PII subject + UK GDPR Art 9 / Art 33 ICO-notifiable threshold under Lauren shadow term volume). F-15-002 bracket lands at HIGH per F-12-003 + F-14-001 same-bracket Pattern #41 confirmation.

---

### §3.14 Closed-batch citation — F-02-005 + F-05-001 + F-02-004 closed-CRITICAL financial-falsification composition chain (F-15-001 event #15)

Per closed-batch immutability rule; no fresh F-15-NNN allocation.

**F-02-005** at `findings/02-org-management.md:383-438` — verbatim CRITICAL: "`record_stripe_payment` anonymous cross-tenant payment falsification (PI-08 elevation HIGH → CRITICAL)" + "Severity elevated HIGH → CRITICAL on class consistency with F-02-004 and the broader parameter-spoofing class" + "Net effect: **attacker-forged payment recorded in victim's ledger; invoice flipped to paid in victim org without any actual money having moved.**" + "Severity-adjustment event #1 (s41; PI-08 ↑ CRITICAL)".

**F-05-001** at `findings/05-billing-invoicing.md:68-149` — verbatim CRITICAL: "PERMISSIVE-policy anon-cross-tenant INSERT on invoices via `block_expired_trial_invoice_insert` + `is_org_active` + `generate_invoice_number` (3-layer no-auth composition)" + "victim org's ledger contains an attacker-controlled invoice row with attacker-controlled total_minor, payer linkage, due date".

**F-02-004** at `findings/02-org-management.md:310-380` — verbatim CRITICAL: "`record_installment_payment` anonymous cross-tenant installment-as-paid falsification + vestigial parameter".

**Composition chain for F-15-001** (per event #14 PI-52-P framework): HIGH baseline (Pattern #41 anchor F-12-003 same-bracket per §3.1.2 4/6 MATCH) ↑ CRITICAL via composition with F-02-005 + F-05-001 + F-02-004 closed-CRITICAL financial-falsification anchors + UNIQUE(org_id) permanent-hijack amplifier + downstream xero-sync-* financial-routing-redirection. Driver type: composition-discovery escalation per F-06-001/F-06-003 event #9 precedent + F-07-003 event #10 precedent + PI-52-P event #14 precedent.

**Event #15 NEW s54** ratified candidate.

---

### §3.15 Cross-batch observation — `lessons` → `calendar_event_mappings` ON DELETE CASCADE silent Google-event orphan (batch-03 closed)

Per Phase 3 §3.D FK enumeration: `calendar_event_mappings.lesson_id → lessons (batch-03 closed) ON DELETE CASCADE`.

Deleting a `lessons` row silently removes the `calendar_event_mappings` mapping row — which holds Google Calendar's `external_event_id`. The Google-side event is NOT auto-deleted (orphan in Google Calendar without LessonLoop knowledge).

Cross-batch reach observation only; no F-15-NNN allocation per closed-batch immutability. Phase C consideration: should lesson DELETE trigger calendar-sync-lesson(action='delete') BEFORE the row delete? Out of batch-15 audit scope (batch-03 closed-immutable).

---

### §3.16 Cross-batch observation — `20260315 fix_lessons_calendar_audit_findings` migration (batch-03 + batch-05 closed substrate)

Per Phase 1 §1.1 Q1.1.D + Phase 2 filesystem grep: migration `20260315220012_fix_lessons_calendar_audit_findings.sql` touches:
- L11 `shift_recurring_lesson_times` fn (batch-03 closed; not in CENSUS RPC list — orphan-by-design OR batch-03 implicit attribution)
- L68 `ALTER TABLE public.lessons` (batch-03 closed-immutable)
- L79 `prevent_invoiced_lesson_delete` redefinition (CENSUS:680 batch-05 closed)
- L96 trigger recreation

Cross-batch observation only. No regression on batch-15 calendar surfaces verified (calendar_event_mappings.lesson_id CASCADE behavior unaffected; per §3.15).

---

### §3.17 Cross-batch observation — `notify_makeup_match_webhook` trigger fn (batch-08 closed; 19-cross-cutting substrate)

CENSUS L823 verbatim: `| trg_notify_makeup_match | make_up_waitlist | notify_makeup_match_webhook | AFTER UPDATE | 08-attendance-credits-waitlists |`.

Phase 1 §1.1 Q1.1.B SECDEF inventory returned `notify_makeup_match_webhook` (trigger return type). Cross-listed against batch-15 because the regex match included `webhook` keyword. Attribution is batch-08 closed (and CC-19 #1 closed-batch-08 hygiene observation s52 precedent). Out of batch-15 audit scope.

---

### §3.18 Cross-batch observation — `cleanup_webhook_retention` SECDEF (19-cross-cutting + batch-06 closed substrate)

CENSUS L654 verbatim: `| cleanup_webhook_retention | yes | jsonb | 19-cross-cutting |`. Body deletes from `stripe_webhook_events` (batch-06 closed) + `platform_audit_log` (19-cross-cutting). Out of batch-15 audit scope.

---

### §3.19 Cross-batch observation — `calendar-oauth-start getUser()` no-args vs `xero-oauth-start getUser(token)` (pre-existing cross-batch finding cohort)

`calendar-oauth-start/index.ts:57` uses `supabase.auth.getUser()` no-args (network round-trip verification); `xero-oauth-start/index.ts:59` uses `supabase.auth.getUser(token)` (local JWKS verification). Per inline reference comment at xero-side L56-58: "getUser(token) — local JWKS verification accepts legacy HS256 JWTs. See: audit/findings/2026-05-10-getuser-noargs-sweep.md".

Pre-existing cross-batch finding cohort outside batch-15 scope; observation only.

---

### §3.20 Cross-batch observation — xero-disconnect / xero_entity_mappings CASCADE re-creation operational concern (intra-batch)

Per Phase 3 §3.D CASCADE map: xero-disconnect at L73-83 deletes `xero_entity_mappings` then `xero_connections`. ON DELETE CASCADE from `xero_connections.id → xero_entity_mappings.connection_id` handles auto-cleanup of any rows missed.

On Xero re-connect with same Xero tenant after disconnect: `xero-sync-invoice/index.ts:147-153` looks up `xero_entity_mappings WHERE local_id=guardian.id AND entity_type='contact'`. With prior mappings deleted, the lookup misses → branch at L155-201 creates a fresh Xero Contact (POSTs to Xero Contacts API). Result: **Xero-side duplicate Contact records** when same guardian is re-mapped after disconnect/reconnect cycle.

Operational data-integrity observation; intra-batch. Phase C consideration: should xero-disconnect preserve `xero_entity_mappings` (soft-delete via flag) OR should xero-sync-invoice query Xero by `EmailAddress` first to find existing Contact before creating? Out of audit scope (observation only).

---

### §3.21 Cross-batch observation — `guardians` → `calendar_connections` ON DELETE CASCADE (batch-02 closed; parent-portal cleanup intent)

Per Phase 3 §3.D: `calendar_connections.guardian_id REFERENCES guardians(id) ON DELETE CASCADE`. Deleting a guardian (parent-side per batch-02 GDPR delete flow) cascade-deletes their parent-iCal calendar_connection. Cleanup intent ✓ — parent-portal-scope cleanup. Observation only.

---

## §4 Cross-batch reach map

Consolidated from §3.13-§3.21 + Phase 2 §2.A.5 consumer enumeration + Phase 4 §4.D hook consumer enumeration:

### §4.1 Substrate reach (batch-15 in-scope → closed-immutable)

| Source (batch-15 in-scope) | Target | Attribution | Class |
|---|---|---|---|
| calendar_event_mappings.lesson_id FK | lessons | **batch-03 closed** | substrate reach (ON DELETE CASCADE; Google-event orphan §3.15) |
| calendar_connections.guardian_id FK | guardians | **batch-02 closed** | substrate reach (ON DELETE CASCADE; parent-portal cleanup §3.21) |
| calendar_connections.org_id FK + xero_connections.org_id FK + xero_entity_mappings.org_id FK | organisations | **batch-02 closed** | substrate reach (ON DELETE CASCADE; org-tenant cleanup) |
| update_calendar_connections_updated_at trigger | calendar_connections → `update_updated_at_column` | **19-cross-cutting** | substrate reach (trigger fn) |
| xero-sync-invoice → invoices + invoice_items + guardians | invoices/items batch-05; guardians batch-02 | **batch-02 + batch-05 closed** | data-flow reach |
| xero-sync-payment → payments + invoices | **batch-05 closed** | data-flow reach |
| calendar-ical-feed → lessons + locations + lesson_participants + students + organisations | batch-02 + 03 + 04 closed | data-flow reach (parent-feed + teacher-feed paths) |
| calendar-sync-lesson → lessons + lesson_participants + students + locations + rooms | batch-02 + 03 + 04 closed | data-flow reach |
| ical-expiry-reminder → message_log INSERT | **batch-12 closed** | data-flow reach (POSITIVE app-layer log) |
| 20260315 migration substrate | lessons (batch-03) + prevent_invoiced_lesson_delete (batch-05) | **batch-03 + 05 closed** | migration-substrate reach (§3.16) |

### §4.2 Consumer reach (batch-15 hooks consumed by other batches)

Per Phase 4 §4.D 21-consumer enumeration:
- batch-18 settings-tabs (upcoming): CalendarIntegrationsTab + ZoomIntegrationTab + CalendarSyncHealth + AccountingTab + ZoomOAuthCallback
- batch-03 calendar-core (closed): Dashboard (CalendarSyncBanner) + 8 calendar/* components + useCalendarActions + useLessonForm + CalendarPage
- batch-08 attendance-credits-waitlists (closed): useRegisterData
- batch-11 parent-portal (closed): PortalSchedule
- batch-12 messages-notifications (closed): useAdminMessageRequests

Settings UI lives at batch-18 (upcoming); no consumer-attribution migration candidate flagged (CENSUS attribution clean for hooks at batch-15 + consumers at their owning batches).

### §4.3 Out-of-scope cross-batch citations enumerated (3.17 + 3.18)

- `notify_makeup_match_webhook` trigger fn — batch-08 closed observation
- `cleanup_webhook_retention` SECDEF — 19-cross-cutting + batch-06 closed substrate

---

## §5 RLS posture — architectural asymmetry

| Table | RLS enabled | Policy count | Posture | Credentials exposed to client? |
|---|---|---|---|---|
| `calendar_connections` | true | **7 PERMISSIVE** (DELETE 1 + INSERT 2 + SELECT 2 + UPDATE 2) | authenticated-client-readable (subject to `auth.uid()=user_id`) | **YES — access_token + refresh_token + ical_token readable** (F-15-004) |
| `calendar_event_mappings` | true | **2 PERMISSIVE** (ALL + SELECT redundant) | authenticated-client-readable via EXISTS-join on calendar_connections | sync state readable; no credentials |
| `xero_connections` | true | **0** | **server-side-only via service_role** | **NO — credentials never client-readable** (F-15-005 POSITIVE counter-example) |
| `xero_entity_mappings` | true | **0** | **server-side-only via service_role** | **NO** (POSITIVE counter-example) |

**Architectural asymmetry**: calendar-side PERMISSIVE-client-readable (defense-in-depth gap) vs xero-side zero-policies-server-side-only (correct credential-table posture). Same provider-class (third-party OAuth bearer-token storage), opposite RLS design choices.

**Phase C remediation track candidate**: align `calendar_connections` to `xero_connections` posture — remove client-readable RLS policies; force OAuth-token reads through edge-fn service-role mediation. Closes F-15-004 + F-15-002 + F-15-008 + F-15-010 in one architectural sprint.

**Editorial-candidate B1 carry**: calendar_event_mappings polcmd=`ALL` USING-only WITH_CHECK null excluded from F-15-008 main count per FOR-ALL polcmd=`*` cohort-counting scope (batch-12/13/14 UPDATE-only-scope precedent; re-scoping would force retrospective rebase across batches 01-13). Defer to post-Phase-B editorial sweep per s53 precedent.

---

## §6 SECDEF body verification (drift #36 standard procedure first operational application)

Per drift #36 standard procedure (PLAN.md §4.1 promotion s53): every Phase 2 SECDEF body claim uses live-DB `SELECT prosrc FROM pg_proc` + `supabase_migrations.schema_migrations` regex cross-reference.

### §6.1 `generate_ical_token`

Live-DB body (Phase 2 §2.A.1):
```sql
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
```
prosecdef=true; proconfig=['search_path=public']; args=''; returns text.

Migration trail (1 cumulative touch): `20260129134347_63a01f5c.sql:113` initial define.

EXECUTE: anon=true / authenticated=true / service_role=true.

6-dim class-fit: D1=N / D2=N / D3=N / D4=N / D5=N (stateless mint) / D6=anon+auth+svc → **harmless oracle** sub-shape. Pattern #40 NULL-3VL NO MATCH.

Consumer enumeration: ZERO `supabase.rpc('generate_ical_token')` calls in src/ + supabase/functions/; only `types.ts:6912` auto-generated type. **ORPHAN** (F-15-007).

### §6.2 `get_org_calendar_health(p_org_id uuid)`

Live-DB body (Phase 2 §2.A.2):
```sql
SELECT
    cc.id as connection_id, cc.user_id,
    COALESCE(t.display_name, p.full_name, 'Unknown') as teacher_name,
    cc.provider, cc.sync_enabled, cc.sync_status, cc.last_sync_at,
    cc.calendar_name, cc.token_expires_at,
    COALESCE(em.event_count, 0) as events_synced
FROM calendar_connections cc
LEFT JOIN teachers t ON t.user_id = cc.user_id AND t.org_id = cc.org_id
LEFT JOIN profiles p ON p.id = cc.user_id
LEFT JOIN LATERAL (
    SELECT COUNT(*) as event_count
    FROM calendar_event_mappings cem
    WHERE cem.connection_id = cc.id AND cem.sync_status = 'synced'
) em ON true
WHERE cc.org_id = p_org_id
  AND cc.guardian_id IS NULL
  AND is_org_admin(auth.uid(), p_org_id)
ORDER BY teacher_name, cc.provider;
```
prosecdef=true; proconfig=['search_path=public']; returns TABLE(...).

Migration trail (2 cumulative touches): `20260223100000_calsync_cron_guardian_health.sql:64` (initial) + `20260223114640_5ae4da09.sql:3` (redefine next day).

EXECUTE: anon=true / auth=true / svc=true.

6-dim class-fit: D1=Y (`auth.uid()` in `is_org_admin`) / D2=Y (`p_org_id`) / D3=Y / D4=N / D5=N / D6=anon+auth+svc → **body-guarded** sub-shape. Pattern #40 NULL-3VL NO MATCH.

Consumer: `src/components/settings/CalendarSyncHealth.tsx:50` (1 site; batch-18 settings-tabs attribution).

### §6.3 `get_org_sync_error_count(p_org_id uuid)`

Live-DB body (Phase 2 §2.A.3):
```sql
SELECT COUNT(*)::integer
FROM calendar_connections cc
WHERE cc.org_id = p_org_id
  AND cc.guardian_id IS NULL
  AND is_org_admin(auth.uid(), p_org_id)
  AND (
    cc.sync_status = 'error'
    OR (cc.sync_enabled AND cc.last_sync_at < now() - interval '6 hours')
    OR (cc.token_expires_at IS NOT NULL AND cc.token_expires_at < now())
  );
```
prosecdef=true; proconfig=['search_path=public']; returns integer.

Migration trail (1 cumulative touch): `20260223114640_5ae4da09.sql:47` initial define.

EXECUTE: anon=true / auth=true / svc=true.

6-dim class-fit: D1=Y / D2=Y / D3=Y / D4=N / D5=N / D6=anon+auth+svc → body-guarded (same shape as §6.2).

Consumer: `src/components/dashboard/CalendarSyncBanner.tsx:15` (1 site; batch-03 calendar-core closed-immutable attribution).

---

## §7 Frontend sweep

Per Phase 4 §4.A-§4.D:

### §7.1 CC-19 #4 useCan ARCHITECTURAL N/A sub-shape extension to batch-15 FE

Per s53 sub-class introduction #7 (`audit/sweep/PLAN.md §4.1`): "CC-19 #4 ARCHITECTURAL N/A sub-shape — entire batch-14 frontend surface anchor; class-shape 'Permissions enforced via routing-layer gate + RLS-as-single-source-of-truth; no UI-layer affordance gating; class-DISTINCT from useCan-anchored CC-19 #4 main class' ... drift #35.A class-specific exemption rule".

Batch-15 FE per CENSUS L1027-1029 = 3 hooks only (`useCalendarConnections`, `useCalendarSync`, `useExternalBusyBlocks`). Zero non-Zoom pages/routes/components in CENSUS attribution.

Hooks have ZERO useCan calls + ZERO inline role-checks. Consumer components in other batches (03 closed, 08 closed, 11 closed, 12 closed, 18 upcoming) apply role-gates per their own batch ownership.

**CC-19 #4 verdict**: **ARCHITECTURAL N/A sub-shape extension to batch-15 FE** per s53 drift #35.A precedent. Cumulative ≥218 → ≥218 (+0 batch-15; ARCHITECTURAL N/A exemption).

### §7.2 CC-19 #7 TS-bypass-cast sweep (batch-15 hooks)

| Sub-class | useCalendarConnections | useCalendarSync | useExternalBusyBlocks | Total |
|---|---|---|---|---|
| Sub-A literal `as any` | 0 | 0 | 0 | **0** |
| Sub-D2 callback `: any` | 0 | 0 | 0 | **0** |
| Sub-E catch-block `: any` | 2 (L161 `catch (error: any)` connectGoogle + L206 `catch (error: any)` connectZoom) | 0 | 0 | **2** |

Cumulative cohort enrichment:
- Sub-A: +0 (~416 unchanged)
- Sub-D2: +0 (~25 unchanged)
- Sub-E: +2 (41 → 43)

### §7.3 Pattern #43 candidate (FE direct-write bypass)

Phase 4 §4.A.1 dispositive: FE `crypto.randomUUID() × 2 = 244 bits effective entropy` functionally equivalent to SECDEF `gen_random_bytes(32) = 256 bits`. Pattern #43 sub-shape candidate DROPPED; CC-19 #15 absorbs (F-15-007).

### §7.4 Consumer attribution

21 consumers across 5 batches (Phase 4 §4.D). Settings UI = batch-18 upcoming (CalendarIntegrationsTab + AccountingTab + ZoomIntegrationTab + CalendarSyncHealth). No consumer-attribution migration candidates surface.

---

## §8 Cron auth

### §8.1 cron-secret gate POSITIVE (2/2 batch-15 cron fns)

`supabase/functions/_shared/cron-auth.ts:5-18` body:
```ts
export function validateCronAuth(req: Request): Response | null {
  const expectedSecret = Deno.env.get("INTERNAL_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.error("Unauthorized cron call attempt");
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, ... });
  }
  return null;
}
```

Both batch-15 cron fns invoke at top of body:
- `calendar-refresh-busy/index.ts:56` ✓ POSITIVE
- `ical-expiry-reminder/index.ts:9-11` ✓ POSITIVE

Internal-trust observation NEGATIVE for batch-15 (s52 streak-notification sole anchor preserved; no new cohort instances). Fails-closed on missing/wrong secret (401).

### §8.2 Sentry CC-19 #10 wrap status

12/13 batch-15 edge fns wrap via `wrapEdgeFn(...)`. 1/13 NEGATIVE: **ical-expiry-reminder bare `Deno.serve` at L8** (F-15-011).

---

## §9 OAuth flow

### §9.1 Calendar OAuth (Google)

`calendar-oauth-start` (verify_jwt=true platform default) + `calendar-oauth-callback` (verify_jwt=false per config.toml). Body-level Authorization gate at start; state via base64 JSON without HMAC. State decoded on callback without signature verification. F-15-003 Pattern #41 anchor.

PI-15-A calendar-side: plaintext INSERT path at 4 sites + PERMISSIVE-client-readable RLS posture exposes OAuth bearer tokens to authenticated session (F-15-004 HIGH; intra-tenant readback).

### §9.2 Xero OAuth

`xero-oauth-start` (verify_jwt=false + body-level Authorization + `getUser(token)` local JWKS) + `xero-oauth-callback` (verify_jwt=false). State same shape. UNIQUE(org_id) on xero_connections + upsert `onConflict: 'org_id'` amplifies state-poisoning to permanent-hijack. Downstream xero-sync-invoice/payment financial-routing-redirection composition chain. F-15-001 CRITICAL event #15.

PI-15-A xero-side: plaintext INSERT path at xero-oauth-callback:102-103 + xero-auth.ts:47-48 refresh path; client-readable SELECT BLOCKED by zero-policies RLS posture (F-15-005 HIGH; composition closed; POSITIVE counter-example).

### §9.3 Apple sub-surface (decision-pending per V2_PLAN §3.7 L310)

V2_PLAN.md §3.7 L310 verbatim: "1. ☐ Apple OAuth: configure (a) / strip from iOS (b) / web-only launch (c). Recommend (b)." — decision pending.

**Apple sub-surface in batch-15 = iCal subscription model (not Apple Sign-in OAuth)**. Implementation: `calendar-ical-feed/index.ts` reads `calendar_connections WHERE ical_token=$1 AND provider='apple'`. Token-scoped public auth class. No Apple OAuth bearer-token storage at batch-15 layer (the "Apple OAuth" of V2_PLAN §3.7 likely refers to Sign-in-with-Apple which is batch-01-auth-sessions-rls closed-immutable territory, separate from this calendar batch).

AUDIT SCOPE COMPLETENESS per PLAN.md §3 rule 3: Apple iCal sub-surface IS audited regardless of v1 visibility decision. Calendar-ical-feed body inspection complete per Phase 2 §2.F; F-15-002 attack chain operates against parent-feed branch via guardian_id-scoped read.

### §9.4 Zoom sub-deferral

Per V2_PLAN §3.2 L246 + reviewing-Claude composed scope rule §6.11: `zoom_meeting_mappings` table + 3 zoom-* edge fns + `/auth/zoom/callback` route + `ZoomOAuthCallback.tsx` page + `calendar_connections WHERE provider='zoom'` rows all OUT-OF-SCOPE at s54.

calendar-disconnect:101-130 Zoom-revoke branch NOT audited per §6.11 sub-deferral scope rule.

---

## §10 Pattern catalog deltas

### §10.1 Pattern #41 anchor enrichment (per-flow framing)

| Anchor | Severity | Substrate axis | Reachability axis |
|---|---|---|---|
| F-12-003 send-push (s51) | HIGH | edge-fn body | authenticated-only via JWT |
| F-14-001 send-enrolment-offer (s53) | HIGH | edge-fn body | verify_jwt=false + body Auth+getUser(token) |
| **F-15-003 calendar OAuth flow (s54)** | HIGH | edge-fn body (start+callback chain) | mixed (start auth + callback effective-anon-via-Google) |
| **F-15-001 xero OAuth flow (s54)** | **CRITICAL via composition** | edge-fn body + UNIQUE(org_id) amplifier + downstream financial chain | mixed |

2 PLACED entering s54 → **4 PLACED per-flow exiting s54**. Placement-precedent invariance preserves slot per s47+ rule. Per-flow framing per §5.B.1 adjudication (state-poisoning chain is inherently paired; per-fn would inflate findings with overlapping evidence).

### §10.2 Sub-class introduction #8 NEW s54 (Pattern #41 RLS-policy substrate)

**Class-shape**: "Authenticated cross-tenant action via PERMISSIVE-OR-RLS-INSERT-policy bypass of intended RESTRICTIVE-intent gate, with downstream consumer rendering victim data".

**Substrate axis**: RLS-policy substrate (DISTINCT from edge-fn-body substrate of Pattern #41 main anchors). Symmetric extension to Pattern #41 placement at s51 (which added edge-fn-body substrate vs F-02-002 anchor SECDEF-body substrate).

**Anchor**: F-15-002 single-anchor PLACED.

**Placement precedent**: Pattern #40 single-anchor placement at s50 (F-11-004 anchor) + Pattern #41 single-anchor placement at s51 (F-12-003 anchor) + Pattern #43 single-anchor placement at s53 (F-14-002 anchor; subsequently DROPPED at s54 §4.A.1).

Cumulative sub-class introductions: 7 entering s54 → **8 exiting s54**.

### §10.3 Pattern #43 sub-shape candidate DROPPED

Per Phase 4 §4.A.1 dispositive: FE token-mint `crypto.randomUUID() × 2` produces 244 bits effective entropy via OS CSPRNG (Web Crypto API). SECDEF `gen_random_bytes(32) = 256 bits` (pgcrypto OS CSPRNG). Functionally equivalent within rounding; no security degradation from FE bypass.

Phase 5 §5.B.2 Option B verdict: CC-19 #15 absorbs `generate_ical_token` orphan; FE direct-mint is symptom, not class-distinct pattern. No sub-shape introduction. Cohort enrichment under CC-19 #15 alone (F-15-007).

### §10.4 Pattern catalog cumulative state (post-s54)

- **37 PLACED** unchanged
- **6 candidates** unchanged
- **1 NEGATIVE-instance flag** unchanged
- **8 sub-class introductions** (+1 NEW s54 Pattern #41 RLS-policy substrate)
- Pattern #41 anchor enrichment: 2 → 4 per-flow PLACED instances

---

## §11 Audit-method appendix

### §11.A Drift #36 standard procedure first operational application

Per PLAN.md §4.1 promotion s53: "drift #36 promotes from 'NEW s52 mandate' to 'standard Phase 2 procedure entering batch 15+'. Reviewing-Claude includes drift #36 live-DB-body-verification task line in every Phase 2 dispatch s54+ as standard procedure."

Phase 2 §2.A executed cleanly on all 3 batch-15 SECDEFs:
- Live-DB `SELECT prosrc FROM pg_proc` verbatim body capture per RPC
- `supabase_migrations.schema_migrations` regex cross-reference + filesystem `grep -rn "CREATE OR REPLACE FUNCTION.*<fn>" supabase/migrations/` verification
- EXECUTE grants re-confirmed via `has_function_privilege()` per drift #29

No drift surfaced at standard-procedure application. Clean pass.

### §11.B Drift #37 first operational application

Per PLAN.md §4.1 drift #37 NEW s53: "every launching-prompt section citing LESSONLOOP_V2_PLAN.md scope claims MUST include verbatim line cite from V2_PLAN.md (not paraphrase or memory citation)."

Verbatim cites embedded throughout this doc at §1 + §7 + §9: V2_PLAN.md §3.1 L234 (Xero LAUNCH DAY-ONE) + §3.2 L246 (Zoom HIDDEN) + §3.6 L303 (Xero conditional supersession editorial) + §3.7 L310 (Apple OAuth decision-pending). All verifiable against working-tree HEAD `3214745d34ed880de41669255743fef223f305f2`.

### §11.C Drift #30.A 5th cumulative operational manifestation

Phase 5 §5.A.1 unrestricted `audit/sweep/findings/*.md` grep caught F-02-008 mis-cite from Phase 3 §3.B.X (CC drafted "child-PII class anchor F-02-008 `find_waitlist_matches`" but verbatim verification shows F-02-008 = `_notify_streak_milestone` HIGH parameter-spoofing; correct anchors F-02-002 + F-08-002 child-PII CRITICAL). Mitigation rule operated correctly; same class as prior 4 manifestations (s50 #1-#2 + s52 #3 + s53 #4 F-02-015 anticipated-citation-list gap).

Manifestation count update: 3 → 4 → **5** cumulative.

### §11.D Drift #38 RATIFIED Cat 3 co-origin NEW s54

Single broader Cat 3 CC-origin drift entry with two co-instances caught at Phase 5 §5.A verification before Phase 6 doc-write:

**Sub-instance A (CC origin)**: F-02-008 batch-ID inversion at Phase 3 §3.B.X. CC drafted "child-PII class anchor F-02-008 `find_waitlist_matches` (closed-batch-08 CRITICAL anchor for child-PII anon-callable)". Errors:
- F-02-008 is at batch-02 (finding-number-batch inversion: batch-prefix is 02, named batch-08)
- F-02-008 actually = `_notify_streak_milestone` cross-tenant audit-log injection HIGH (parameter-spoofing class; NOT child-PII)
- Correct child-PII anchors: F-02-002 (batch-02 CRITICAL HEADLINE) + F-08-002 (batch-08 CRITICAL same class)

**Sub-instance B (reviewing-Claude origin)**: Phase 3 dispatch framing "F-05-001/F-05-007/F-05-008 closed-batch-05 financial-information CRITICAL anchor chain". Errors:
- F-05-007 is HIGH not CRITICAL (`findings/05-billing-invoicing.md:48`)
- F-05-008 is MEDIUM not CRITICAL + not financial-falsification class (`findings/05-billing-invoicing.md:49`)
- Correct CRITICAL chain: F-05-001 + F-02-005 + F-02-004 (financial-falsification CRITICAL class)

**Mitigation reinforcement**: anchor citations require **finding-ID + verbatim severity + verbatim class-shape one-liner + verbatim batch attribution** per drift #31 expanded scope + drift #35.B class-shape feature verification. ID-only or severity-inferred cites are forbidden.

**Class shape**: kin to drift #28 (s49 Cat 3 CC-origin "useFeatureGate presumed without verbatim cite") — over-confidence in citation without verbatim verification.

**Severity-of-impact**: ZERO (both sub-instances caught at Phase 5 §5.A.1 before doc-write; mitigation operated as designed).

Cumulative methodology entries: 38 → **39** (34 Cat 1 + 2 Cat 2 + 3 Cat 3).

### §11.E POS-5 _activity-sibling NEGATIVE on batch-15

Per Phase 1 §6.14 (reviewing-Claude pre-investigation): zero `calendar_*_activity`, `xero_*_activity`, `zoom_*_activity`, `*_sync_log`, `*_event_log` tables on batch-15 surface. Calendar surfaces use generic `platform_audit_log` (via audit_log INSERT in 4 user-action edge fns) instead of domain-specific `_activity` siblings.

Class-discipline observation: POS-5 _activity-sibling sub-class introduction #6 NEW s53 (PLACED two-anchor pair leads/lead_activities + enrolment_waitlist/enrolment_waitlist_activity per findings/14 §3.7) sweep continues with ONE NEGATIVE batch-15 counter-example. No POS-5 anchor enrichment from batch-15.

### §11.F PI-15-A bracket adjudication framework + RLS posture architectural-asymmetry formalization

Per reviewing-Claude Phase 3 dispatch framing rule:
- Calendar-side PI-15-A: HIGH per F-05-007 closed-batch-05 information-disclosure precedent (no cross-tenant axis on intra-tenant client-readback)
- Xero-side PI-15-A: HIGH per PI-10 baseline (composition BLOCKED zero-policies)

The Phase 2 §2.B.4 "CRITICAL composition path candidate" framing was reframed at Phase 3 dispatch — calendar-side intra-tenant readback does NOT meet 5/6 or 6/6 6-dim threshold for CRITICAL via composition with F-02-002 (3/6 MATCH; reachability + substrate + grant axes distinct). Lands at HIGH per Pattern #41 reachability-axis-shift precedent.

The defensible CRITICAL composition is at xero-side (F-15-001 §3.1) via state-poisoning + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection chain composition with F-02-005 + F-05-001 + F-02-004 closed-CRITICAL financial-falsification anchors per event #14 PI-52-P precedent.

### §11.G Pattern #41 sub-class introduction #8 placement reasoning

Symmetric to s51 Pattern #41 placement reasoning. At s51, Pattern #41 was placed by ADDING edge-fn-body substrate axis vs F-02-002 anchor SECDEF-body substrate. At s54, sub-class is introduced by ADDING RLS-policy substrate axis vs Pattern #41 main edge-fn-body substrate.

Class-shape (verbatim from §3.2 above): "Authenticated cross-tenant action via PERMISSIVE-OR-RLS-INSERT-policy bypass of intended RESTRICTIVE-intent gate, with downstream consumer rendering victim data".

Sub-class status: single-anchor PLACED (F-15-002). Placement precedent: Pattern #40 single-anchor placement at s50 + Pattern #41 single-anchor placement at s51.

### §11.H Per-flow vs per-fn Pattern #41 allocation rationale (§5.B.1)

Per-flow framing adopted for F-15-001 (xero OAuth) and F-15-003 (calendar OAuth):
- State-poisoning chain is inherently paired (start GENERATES state → callback CONSUMES state)
- Remediation requires both (HMAC state at start + verify HMAC at callback)
- 6-dim rubric same for start + callback within flow (shared substrate + caller-identity + trust + reachability dimensions)
- Per-fn framing would inflate to 4 findings with substantially overlapping evidence chains

Per-fn convention precedent at F-12-003 (single fn) + F-14-001 (single fn) is for single-fn defects; OAuth start/callback chains are class-different. No precedent violation.

### §11.I Event #15 composition framework (event #14 PI-52-P precedent applied)

Per PLAN.md §4.1 event #14 framework: "PI-52-P META (s52) (HIGH standalone) ↑ CRITICAL via composition with F-02-005 + F-07-003 + F-08-002 closed-CRITICAL anchors per F-06-001/F-06-003 event #9 precedent (composition-discovery escalation). AUTH-H5 mass REVOKE migration ... omission of `REVOKE EXECUTE ... FROM anon` is the discrete syntactic defect; cohort retains anon EXECUTE at HEAD on 13 fns including 3 closed-CRITICAL anchors."

**F-15-001 fits this framework**:
- Standalone HIGH per Pattern #41 anchor F-12-003 same-bracket
- ↑ CRITICAL via composition with F-02-005 (record_stripe_payment cross-tenant financial-falsification CRITICAL) + F-05-001 (PERMISSIVE-policy anon-cross-tenant INSERT on invoices CRITICAL) + F-02-004 (record_installment_payment CRITICAL) closed-batch-02/05 financial-falsification anchors
- + UNIQUE(org_id) permanent-hijack amplifier
- + downstream xero-sync-invoice/payment financial-routing-redirection chain
- Driver type: composition-discovery escalation per F-06-001/F-06-003 event #9 + F-07-003 event #10 + PI-52-P event #14 precedent

Event #15 RATIFIED candidate. Cumulative events: 14 → 15.

### §11.J Pattern #43 sub-shape candidate DROPPED narrative

Phase 4 §4.A.1 dispositive evidence: `crypto.randomUUID()` per Web Crypto API spec returns RFC 4122 UUID v4. 128 bits, of which 6 bits are version+variant fixed → 122 bits effective entropy per UUID. Two concatenated UUIDs (hyphens stripped) = **244 bits effective entropy**, 64 hex chars. Backed by OS CSPRNG (cryptographically secure across all browsers + Node + Deno).

SECDEF `generate_ical_token` body: `encode(gen_random_bytes(32), 'hex')` = 256 bits hex, OS CSPRNG (pgcrypto). 

**Verdict**: FE mint functionally equivalent to SECDEF (244 vs 256 bits, both >> 128-bit security threshold). No security degradation from FE bypass.

Phase 5 §5.B.2 Option B: CC-19 #15 absorbs `generate_ical_token` orphan as standard dead-code SECDEF cohort enrichment (F-15-007 LOW per F-14-004 precedent). FE direct-mint is symptom, not class-distinct pattern. Pattern #43 sub-shape introduction NOT justified — class-shape MATCH only at bypass-of-available-SECDEF axis (1/4 dims).

### §11.K CC-19 #4 ARCHITECTURAL N/A sub-shape extension to batch-15 FE

Per s53 sub-class introduction #7 (PLAN.md §4.1): "CC-19 #4 ARCHITECTURAL N/A sub-shape NEW s53 ... routing-layer gate + RLS-as-single-source-of-truth design; class-DISTINCT from useCan-anchored CC-19 #4 main class oversight ... drift #35.A class-specific exemption rule precedent — cohort instances matching ARCHITECTURAL N/A sub-shape are exempted from oversight-class cumulative counting".

Batch-15 FE = 3 hooks per CENSUS L1027-1029; zero non-Zoom pages/routes/components. Hooks expose data + mutations; consumer components in batches 03/08/11/12/18 apply role-gates per their own batch ownership.

Verdict: ARCHITECTURAL N/A sub-shape extension to batch-15 FE. +0 main-class enrichment.

### §11.L Closed-batch citation + cross-batch observation enumeration framework

Per s53 precedent (`findings/14-bookings-leads-enrolment.md` §3.8/§3.9/§3.10 + Phase 6 doc-write): closed-batch finding citations and cross-batch observations do NOT consume F-NN-NNN finding IDs. Allocation rules:

- **Fresh F-15-NNN**: 12 findings (1C + 4H + 0M + 7L). Contiguous IDs F-15-001 through F-15-012.
- **Closed-batch citations** (§3.13 + §3.14): cite closed-batch anchors verbatim with line numbers; no F-15-NNN. Purpose: composition-chain documentation + Phase C remediation prioritization signals.
- **Cross-batch observations** (§3.15 through §3.21): substrate/data-flow reach observations; no F-15-NNN. Purpose: cross-batch reach map documentation; Phase C consideration flags.

Net allocation discipline: total fresh F-NN-NNN per batch reflects ONLY batch-owned findings; substrate reach + closed-batch citations are documentation-only (no tally inflation; no closed-batch immutability violation).

---

**End of findings/15-calendar-sync-zoom-xero.md**

Batch 15 closed at s54 (2026-05-16). Tally exit: 176 / 21C / 51H / 26M / 78L. PI cohort 5 unchanged (PI-10 partial-handover to batch-18). Events 14 → 15. Methodology drift entries 38 → 39. Pattern catalog 37 placed + 6 candidates + 1 NEGATIVE + **8 sub-class introductions**. Pattern #41 anchor 2 → 4 per-flow PLACED. Pattern #43 sub-shape candidate DROPPED.
