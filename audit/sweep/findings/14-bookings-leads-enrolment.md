# Batch 14 — Bookings + Leads + Enrolment

**Session**: s53
**Date**: 2026-05-16
**HEAD pin**: `c80c664afe595abed5b39646925b2263ab4799e2` (s52 close pin; pushed to origin/main at s53 Phase 1 §A push-hygiene normalization per PLAN.md §3 rule 7 third application)
**Status**: CLOSED
**Findings allocated**: 7 (0C / 2H / 0M / 5L); F-14-001 through F-14-007 contiguous

---

## §1 Batch context

### 1.1 Pre/post tally

| | Pre-s53 (s52 close) | Post-s53 | Delta |
|---|---|---|---|
| Total active | 157 | **164** | +7 |
| Critical | 20 | 20 | 0 |
| High | 45 | **47** | +2 (F-14-001 + F-14-002) |
| Medium | 26 | 26 | 0 |
| Low | 66 | **71** | +5 (F-14-003 through F-14-007) |

Plus 2 closed-batch citations (no fresh F-14-NNN IDs): F-02-015 HIGH respond_to_enrolment_offer + F-02-020 cohort observation (5 RLS-consumer helpers + 4 batch-14 helper-consumer SECDEFs).

Plus 1 cross-batch observation: invites UPDATE-no-WITH-CHECK matches F-01-017 class-shape; closed-batch-02 immutable.

Plus 0 severity-adjustment events at s53 (cumulative 14 unchanged); all 7 F-14-NNN pre-tags are within-bracket class-precedent applications per §18 principle.

### 1.2 Path Y phase

Phase B — Systematic Audit; **14 of 21 batches complete after s53**.

### 1.3 Session phase summary

| Phase | Output highlight |
|---|---|
| 0 | HEAD `c80c664a` verified == s52 close; tally 157/20C/45H/26M/66L confirmed; banner intact; ★ push hygiene FAILURE detected (HEAD 1 commit AHEAD of origin/main `f1e8cf41`; s52 close commit unpushed); baseline 471/5/30 delta 0; READ-FIRST list ingested; drift #37 V2_PLAN.md framing mismatch surfaced (launching prompt §6.10 hidden-scope claim vs V2_PLAN.md §3.2 L253-258 un-deferral verbatim) |
| 1 §A | Push hygiene normalization (reviewing-Claude authorized; PLAN.md §3 rule 7 third application). HEAD pushed to origin/main; post-push HEAD == origin/main == `c80c664a`. §B drift #37 framing correction acknowledged as Cat 1 candidate for Phase 5 ratification |
| 1.1 | CENSUS owning-batch verbatim cites (17-row table); 4 surface attributions REMOVED from §7.1 IN-scope via adjudication: `cleanup_expired_invites` (CENSUS:657 batch-01 + CC-19 #15 dead-code orphan; zero consumers) + `invites` (batch-02 primary-write per Teachers.tsx + invite-* edge fns) + `kickstarter_signups` (batch-21 marketing per 3 MarketingFooter+ components) + `validate_waitlist_credit_ownership` trigger (CENSUS:824 batch-08 trg_validate_waitlist_credit closed-immutable) |
| 1.2 | Filesystem edge fn enumeration (5 batch-14 edge fns); verify_jwt config: 3 explicit false (waitlist-respond + enrolment-offer-expiry + send-enrolment-offer) + 2 implicit-true (booking-get-slots + booking-submit; no config.toml entry; anon-key bearer JWT satisfies platform gate); 5/5 Sentry-wrapped (CC-19 #10 POSITIVE counter-example) |
| 1.3 | Frontend surface: 4 pages + 5 hooks + 15 components (5 waitlist/ + 3 booking/ + 7 leads/); public/BookingPage.tsx 39,722 bytes largest |
| 1.4 | Cross-batch reach map (Phase 2 corrected booking-submit lessons-INSERT claim to SELECT-only); useConvertLead direct-write FE pattern flagged (5+ sequential `.from().insert()` writes without atomic wrap; bypass of available convert_lead SECDEF); convert_lead SECDEF orphan candidate (ZERO consumers; types.ts:6859 only) |
| 2 | **★ DRIFT #36 FIRST OPERATIONAL APPLICATION ★** — 5 batch-14 SECDEF bodies fetched via live-DB `SELECT prosrc FROM pg_proc`; migration touch chain enumerated (4 migrations; AUTH-H5 `20260401000000` ABSENT from all 5; convert_lead at `20260401000001` one migration after AUTH-H5 but not in REVOKE sweep); Pattern #40 NULL-3VL bypass NO MATCH (helper-body `SELECT EXISTS(WHERE user_id=NULL)` returns boolean false, not NULL); F-02-015 prosrc unchanged at HEAD (drift #36 cross-verification of closed-batch-02 finding) |
| 3 | RLS sweep: booking_pages 17-column inventory POSITIVE (no PII); 4 batch-14 UPDATE-no-WITH-CHECK anchors confirmed (F-14-005); 9 batch-14 column-CHECK-absent anchors enumerated (F-14-006; financial sub-class flag on offered_rate_minor); CC-19 #3 audit_log integrity: 4 TRUE GAP + 2 APP-LAYER COVERAGE POSITIVE counter-examples + 1 PARTIAL + 2 N/A; 0 RESTRICTIVE policies; Pack C Pattern #42 0 batch-14 matches |
| 4 | Frontend sweep: CC-19 #4 ARCHITECTURAL N/A POSITIVE (zero useCan + zero inline role-check; routing-gate + RLS-as-SoT design); tier-gating ZERO (Phase 4.2 negative-evidence sweep per drift #28); CC-19 #7 Sub-A +22 / Sub-E +0 POSITIVE / Sub-D2 +23 substantial enrichment; teachers RLS verification ZERO anon SELECT confirms booking_page_teachers Phase 3.1 NOT-A-FINDING |
| 5 | **★ DRIFT #30.A 4th OPERATIONAL MANIFESTATION ★** — canonical unrestricted-grep at Phase 5.2 caught F-02-015 closed-batch-02 anticipated-citation-list gap; F-14-001 pre-tag (respond_to_enrolment_offer) reclassified to §3.8 closed-batch citation per closed-batch immutability convention; allocation revised 8 → 7 fresh F-14-NNN; tally projection 165 → 164 triple-cross-verified |
| 6 | This findings doc + Phase 6.x deliverables |

---

## §2 Surface enumeration

### 2.1 CENSUS verbatim cites (drift #30 + #30.B operational application)

| Surface | CENSUS line | Verbatim |
|---|---|---|
| Route `/leads` | CENSUS:83 | `\| /leads \| Leads \| owner/admin \| 14-bookings-leads-enrolment \|` |
| Route `/leads/:id` | CENSUS:84 | `\| /leads/:id \| LeadDetail \| owner/admin \| 14-bookings-leads-enrolment \|` |
| Route `/waitlist` | CENSUS:85 | `\| /waitlist \| EnrolmentWaitlistPage \| owner/admin \| 14-bookings-leads-enrolment \|` |
| Route `/book/:slug` | CENSUS:98 | `\| /book/:slug \| BookingPage \| 14-bookings-leads-enrolment \|` (public anon) |
| Page `Leads.tsx` | CENSUS:162 | `\| Leads.tsx \| 14-bookings-leads-enrolment \|` (11,359 bytes) |
| Page `LeadDetail.tsx` | CENSUS:163 | `\| LeadDetail.tsx \| 14-bookings-leads-enrolment \|` (17,422 bytes) |
| Page `EnrolmentWaitlistPage.tsx` | CENSUS:164 | `\| EnrolmentWaitlistPage.tsx \| 14-bookings-leads-enrolment \|` (17,444 bytes) |
| Page `public/BookingPage.tsx` | CENSUS:207 | `\| public/BookingPage.tsx \| 14-bookings-leads-enrolment \|` (39,722 bytes; largest batch-14 file) |
| Edge fn `booking-get-slots` | CENSUS:296 | `\| booking-get-slots \| booking \| public \| 14-bookings-leads-enrolment \|` (264 lines) |
| Edge fn `booking-submit` | CENSUS:297 | `\| booking-submit \| booking \| public \| 14-bookings-leads-enrolment \|` (386 lines) |
| Edge fn `waitlist-respond` | CENSUS:370 | `\| waitlist-respond \| enrolment-response \| public (token) \| 14-bookings-leads-enrolment \|` (168 lines) |
| Edge fn `enrolment-offer-expiry` | CENSUS:385 | `\| enrolment-offer-expiry \| cron \| cron-only \| 14-bookings-leads-enrolment \|` (86 lines) |
| Edge fn `send-enrolment-offer` | CENSUS:386 | `\| send-enrolment-offer \| notification \| service-role \| 14-bookings-leads-enrolment \|` (328 lines) |
| SECDEF `add_to_enrolment_waitlist` | CENSUS:596 | `\| add_to_enrolment_waitlist \| yes \| json \| 14-bookings-leads-enrolment \|` |
| SECDEF `convert_waitlist_to_student` | CENSUS:597 | `\| convert_waitlist_to_student \| yes \| json \| 14-bookings-leads-enrolment \|` |
| SECDEF `withdraw_from_enrolment_waitlist` | CENSUS:598 | `\| withdraw_from_enrolment_waitlist \| yes \| json \| 14-bookings-leads-enrolment \|` |
| SECDEF `respond_to_enrolment_offer` | CENSUS:599 | `\| respond_to_enrolment_offer \| yes \| json \| 14-bookings-leads-enrolment \|` |
| SECDEF `convert_lead` | CENSUS:600 | `\| convert_lead \| yes \| json \| 14-bookings-leads-enrolment \|` |
| Cron 114 enrolment-offer-expiry-hourly | CENSUS:928 | `\| 114 \| enrolment-offer-expiry-hourly \| 5 * * * * \| enrolment-offer-expiry \| 14-bookings-leads-enrolment \|` |
| Hook `useLeads.ts` | CENSUS:1114 | `\| useLeads.ts \| Lead list \| 14-bookings-leads-enrolment \|` (542 LoC) |
| Hook `useLeadActivities.ts` | CENSUS:1115 | `\| useLeadActivities.ts \| Lead activity log \| 14-bookings-leads-enrolment \|` |
| Hook `useLeadAnalytics.ts` | CENSUS:1116 | `\| useLeadAnalytics.ts \| Lead funnel chart data \| 14-bookings-leads-enrolment \|` |
| Hook `useEnrolmentWaitlist.ts` | CENSUS:1117 | `\| useEnrolmentWaitlist.ts \| Enrolment waitlist CRUD \| 14-bookings-leads-enrolment \|` |
| Hook `useBookingPage.ts` | CENSUS:1118 | `\| useBookingPage.ts \| Public booking page logic \| 14-bookings-leads-enrolment \|` |

### 2.2 Tables (implicit-attribution per s51 Phase 7 PLAN.md codification)

9 batch-14-implicit tables (owning surfaces = batch-14 hooks + edge fns + SECDEF RPCs):
1. `leads`
2. `lead_activities`
3. `lead_follow_ups`
4. `lead_students`
5. `enrolment_waitlist`
6. `enrolment_waitlist_activity`
7. `booking_pages`
8. `booking_page_instruments`
9. `booking_page_teachers`

### 2.3 Components (15 batch-14-owned)

- `src/components/waitlist/` (5): AddToWaitlistDialog + OfferSlotDialog + WaitlistActivityTimeline + WaitlistDashboardWidget + WaitlistEntryDetail
- `src/components/booking/` (3): BookingConfirmation + BookingStepIndicator + SlotGrid
- `src/components/leads/` (7): BookTrialModal + ConvertLeadWizard + CreateLeadModal + LeadCard + LeadFunnelChart + LeadKanbanBoard + LeadTimeline

### 2.4 Surface scope-removal table (Phase 1.1 attribution refinement)

4 surfaces removed from §7.1 IN-scope via drift #30 + #30.B attribution verification:

| Surface | CENSUS line | Original §7.1 framing | Phase 1.1 verdict | Carry |
|---|---|---|---|---|
| `cleanup_expired_invites` | CENSUS:657 | Batch-14 SECDEF candidate (launching prompt §6.2) | **batch-01 closed-immutable** + **CC-19 #15 dead-code orphan** (zero consumers per `rg -n 'cleanup_expired_invites' src/ supabase/functions/`; not in pg_cron schedule per CENSUS:904-935 enumeration) | Closed-batch-01 citation IF class-shape match surfaces; CC-19 #15 cohort observation (cumulative 4 entering s53 — convert_lead F-14-004 is the s53 enrichment) |
| `invites` table | (no CENSUS line; implicit via Teachers.tsx + invite-* edge fns) | Batch-14 candidate (launching prompt §6.1) | **batch-02 closed-immutable primary-write** (Teachers.tsx:305 + useStudentDetailPage:228+532+536 + InviteMemberDialog + PendingInvitesList + 4 invite-* edge fns) | §3.10 cross-batch observation: invites UPDATE-no-WITH-CHECK matches F-01-017 class-shape; closed-batch-02 immutable |
| `kickstarter_signups` table | (no CENSUS line; implicit via 3 marketing components) | Batch-14 candidate (launching prompt §6.1) | **batch-21 marketing primary-write** (KickstarterHero.tsx:45 + FinalCTA.tsx:29 + MarketingFooter.tsx:91) | No batch-14 action; batch-21 marketing surface owns |
| `validate_waitlist_credit_ownership` trigger | CENSUS:824 | DB-confirmed trigger on `public.make_up_waitlist` (Phase 0 §6.2) | **batch-08 closed-immutable** (trg_validate_waitlist_credit attached to make_up_waitlist; F-08 §8.2 anchors PASS POSITIVE Pattern #25-adjacent value-integrity validation) | No batch-14 action; closed-batch-08 immutable |

### 2.5 Cross-batch reach overview (per §8 detailed matrix)

Notable cross-batch interactions:
- **booking-submit** writes `message_log` (batch-12 closed); reads `lessons` + `availability_blocks` + `closure_dates` + `time_off_blocks` (batch-03 closed) + `teachers` (batch-02 closed); booking-submit:156 confirmed SELECT (NOT INSERT per Phase 2.5b correction)
- **send-enrolment-offer** writes `message_log` (batch-12 closed; F-14-001 Pattern #41 attack-surface part); reads organisations/teachers/locations/terms (batch-02/03/09 closed)
- **useConvertLead** (F-14-002 finding) writes `guardians` + `students` + `student_guardians` (batch-02 closed) + lead_students UPDATE + leads UPDATE + lead_activities INSERT (batch-14 own)
- 5 batch-14 RPCs consume closed-batch-02 helpers `is_org_admin` + `is_org_staff` + `is_org_member` + `has_org_role` + `is_parent_of_student` via RLS USING expressions (F-02-020 cohort observation per §3.9; s52 batch-13 §3.6 precedent)
- `respond_to_enrolment_offer` is batch-14-owned per CENSUS:599 but its security analysis is anchored at closed-batch-02 F-02-015 HIGH (canonical finding per drift #30.A 4th operational manifestation at Phase 5.2); §3.8 citation
- `waitlist-respond` invokes `respond_to_enrolment_offer` RPC via JWT-claim-bound (entry_id, org_id) parameters; legitimate entry point; defense-in-depth gap at the RPC body stands per F-02-015

---

## §3 Findings detail

### 3.1 F-14-001 HIGH — `send-enrolment-offer` Pattern #41 SECOND ANCHOR (cross-tenant action via unvalidated identity parameter)

| Field | Value |
|---|---|
| **ID** | F-14-001 |
| **Severity** | HIGH (same-bracket pre-tag confirmation per F-12-003 anchor; NOT a severity-adjustment event per §18 principle) |
| **Area** | edge fn body / cross-tenant action / authenticated-not-authorized / Pattern #41 SECOND ANCHOR |
| **Phase surfaced** | 2.5e (body audit) + Phase 4.6 Pack B 6-dim adjudication |
| **Class anchor** (drift #31 cite) | F-12-003 HIGH (`findings/12-messages-notifications.md` §3.3 + §11.E PLACED s51) Pattern #41 anchor verbatim class-shape: "edge fn has auth-required gate (verify_jwt=true OR body-level Authorization+getUser(token)); body accepts caller-supplied identity parameter (userId, targetUserId, recipient_user_id, etc.); body performs action on that identity with NO body-level validation that caller is authorized over the identity" |
| **Pattern slot** | **Pattern #41 SECOND ANCHOR (s53)**; F-12-003 (s51) single-anchor PLACED → s53 dual-anchor PLACED. Status reinforced via dual-anchor evidence; not a re-promotion event per s47+ refinement (placement-precedent invariance) |
| **CENSUS cite** (drift #30.B) | CENSUS:386 — `\| send-enrolment-offer \| notification \| service-role \| 14-bookings-leads-enrolment \|` |

#### 3.1.1 Body evidence (drift #36 live-DB body verification cross-reference)

File: `supabase/functions/send-enrolment-offer/index.ts` (328 lines).
verify_jwt: `false` explicit per `supabase/config.toml:45`.

| Line | Code | Significance |
|---|---|---|
| L48-54 | `const authHeader = req.headers.get("Authorization"); if (!authHeader) { return 401 }` | Authorization header REQUIRED at entry |
| L56-58 | `const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })` | Anon-key client scoped to caller's Authorization |
| L62-66 | `const token = authHeader.replace(/^Bearer\s+/i, ""); const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);` | JWT verification via getUser(token); rejects anon (anon-key JWT has no user.id) |
| L67-72 | `if (userError \|\| !user) { return 401 }` | Strong auth gate at edge-fn body |
| **L83** | `const { waitlist_id, org_id } = body;` | **Caller-supplied identity parameters** (Pattern #41 defining feature) |
| **L93** | `const supabaseService = createClient(supabaseUrl, supabaseServiceKey);` | Service-role client; bypasses RLS for all downstream queries |
| L96-101 | `await supabaseService.from("enrolment_waitlist").select("*").eq("id", waitlist_id).eq("org_id", org_id).single()` | Fetches victim's waitlist entry via service-role client; NO body-level check that user.id is org_memberships member for the supplied org_id |
| L248 | `await supabaseService.from("message_log").insert({ ..., sender_user_id: user.id, ... })` | **Cross-batch WRITE to message_log (batch-12 closed) with attacker-supplied sender_user_id** — Pattern #41 attack-surface |
| L288-297 | `await supabaseService.from("message_log").update({ status, sent_at, error_message }).eq("related_id", waitlist_id)...` | Update message_log status after Resend dispatch |
| L301-313 | `await supabaseService.from("enrolment_waitlist_activity").insert({ org_id, waitlist_id, activity_type: "offer_sent", ..., created_by: user.id })` | Activity log INSERT (batch-14 own) |

#### 3.1.2 6-dim matrix vs F-12-003 anchor (Phase 2.5e adjudication)

| Dimension | F-12-003 send-push (HIGH; Pattern #41 anchor) | F-14-001 send-enrolment-offer | Comparison |
|---|---|---|---|
| D1 cross-tenant | YES — user_id parameter spoofing | YES — waitlist_id+org_id parameter spoofing | MATCH |
| D2 anon-reachable | NO (verify_jwt=true platform gate) | NO (verify_jwt=false + body Authorization+getUser rejects anon) | MATCH-equivalent |
| D3 payload sensitivity | MEDIUM — push notification impersonation | MEDIUM — email impersonation of org's brand for enrolment offers | MATCH |
| D4 regulatory scope | PARTIAL — parental-trust channel for child events | PARTIAL — guardian-trust channel; GDPR Art-32 integrity | MATCH |
| D5 trust erosion | HIGH — first-encounter trust erosion + phishing + spam | HIGH — org-brand misuse for attacker-triggered offer emails; spam | MATCH |
| D6 composition | YES — within-org via message_log.sender_user_id + cross-org via F-02-020 helpers | YES — waitlist_id+org_id enumeration via F-02-002/F-02-009/F-02-020 closed-batch helpers | MATCH |

**6/6 MATCH.** Bracket verdict: HIGH per F-12-003 class-precedent same-bracket confirmation (placement-precedent invariance).

#### 3.1.3 Exploit shape

Authenticated user (any role; e.g. parent in their own org) → crafts HTTP POST:
- `Authorization: Bearer <valid-JWT>`
- Body: `{ waitlist_id: <victim-entry-id>, org_id: <victim-org-id> }`

Edge fn passes JWT-decode at L62-66 (caller is authenticated; not anon). Service-role client at L93 bypasses RLS. Fetches victim's enrolment_waitlist entry (NO check user has access to it). Sends Resend email to entry.contact_email (victim's prospective student/guardian) with attacker-triggered enrolment offer. INSERTs message_log with `sender_user_id=attacker.id` + activity log with `created_by=attacker.id`.

Effects:
1. Spam-trigger of enrolment offer emails to ANY guardian whose enrolment_waitlist entry identifier the attacker can discover
2. Org-brand-misuse phishing (email signed from org's "from" line per L276)
3. message_log + enrolment_waitlist_activity audit-trail records attacker as sender — forensically integrity-positive but consequential

#### 3.1.4 Magnitude factor — rate-limit ABSENT (Phase 3.2 Pack C closing)

`send-enrolment-offer` has NO `checkRateLimit` body invocation (Phase 1.2 helper-grep) AND NO registry entry in `supabase/functions/_shared/rate-limit.ts:10-58` (28-entry registry enumerated; send-enrolment-offer absent). NOT a Pattern #42 cohort enrichment (registry-absent → NO MATCH); compounds Pattern #41 attack-surface as magnitude factor.

Effect: authenticated attacker can spam-trigger offer emails rate-bounded only by Resend tier + Supabase Edge platform limits.

#### 3.1.5 Impact

Anchor-class attack-surface for cross-tenant org-brand impersonation via parent-facing email channel. Pre-launch: zero customers → zero entries → zero exploit surface NOW. Post-launch: waitlist_id + org_id enumeration via F-02-002 (cross-tenant child-PII fn — anchor for cross-tenant enumeration), F-02-009 (cross-user student-set enumeration), F-02-020 (5-helper-class cohort) closed-batch helpers gives attacker the (waitlist_id, org_id) pair without authentication; once obtained, F-14-001 enables attacker-controlled email-content dispatch to victim guardian.

#### 3.1.6 Severity reasoning (PLAN.md §4)

HIGH per F-12-003 class-precedent. D2 NO is magnitude-equivalent factor not bracket-shift factor per s51 batch-12 §3.3 6-dim adjudication. D5+D6 MATCH; D1+D3+D4 MATCH; same-bracket pre-tag confirmation per F-10-001 / F-11-004 / F-12-003 precedent — NOT a severity-adjustment event.

#### 3.1.7 Remediation

Body-level org-membership check after `getUser(token)` and BEFORE the `.from("enrolment_waitlist")` fetch:

```typescript
const { data: membership } = await supabaseService
  .from("org_memberships")
  .select("role")
  .eq("user_id", user.id)
  .eq("org_id", org_id)
  .eq("status", "active")
  .in("role", ["owner", "admin", "teacher", "finance"])
  .maybeSingle();
if (!membership) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
}
```

Alternative: replace `org_id` body parameter with derived-from-token (look up org_memberships for `user.id` and verify entry.org_id matches; reject if not). Removes the spoofable parameter entirely.

Co-fix: add rate-limit registry entry + `checkRateLimit` invocation to remove magnitude-factor compounding.

#### 3.1.8 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — Pattern #41 cohort body-gate hardening (bundle with F-12-003 send-push class-precedent fix)
- Closure: (empty)

---

### 3.2 F-14-002 HIGH — `useConvertLead` FE direct-write bypass of available atomic SECDEF (Pattern #43 NEW s53)

| Field | Value |
|---|---|
| **ID** | F-14-002 |
| **Severity** | HIGH (same-bracket pre-tag confirmation per F-11-003 operational-correctness CAPS chain; NOT a severity-adjustment event per §18 principle) |
| **Area** | FE hook / FE direct-write bypass of available atomic SECDEF / operational-correctness CAPS-at-HIGH / Pattern #43 NEW s53 anchor |
| **Phase surfaced** | 1.4 (cross-batch reach grep) + Phase 2.3 Axis 2 (joint analysis with §3.4 F-14-004 dead-code SECDEF) + Phase 4.6 Pack E 6-dim adjudication |
| **Class anchor** (drift #31 cite) | F-11-003 HIGH (`findings/11-parent-portal.md` §3.3 L134-155 verbatim: "useParentLessonNotes RPC named-parameter mismatch always-errors at PG layer ... Silent-failure-mode + missing-UI-for-tracked-DB-state; operational-correctness CAPS-at-HIGH") + F-05-005 (`findings/05-billing-invoicing.md` §3.4) class-shape distinguishability per Phase 4.6 Pack E 6-dim D2 mechanism-axis divergence |
| **Pattern slot** | **Pattern #43 NEW s53 PLACED single-anchor** per Pattern #40 (s50 F-11-004 anchor) + Pattern #41 (s51 F-12-003 anchor) single-anchor placement precedent |
| **CENSUS cite** (drift #30.B) | CENSUS:1114 `\| useLeads.ts \| Lead list \| 14-bookings-leads-enrolment \|` (542 LoC; `useConvertLead` is named export at L579-727) + CENSUS:600 `\| convert_lead \| yes \| json \| 14-bookings-leads-enrolment \|` (the available atomic SECDEF that FE bypasses) |

#### 3.2.1 Mechanism (Pattern #43 defining feature)

**FE direct-write bypass of available atomic SECDEF.**

The `convert_lead` SECDEF RPC (CENSUS:600; Phase 2.1 live-DB body fetched per drift #36) is the canonical atomic conversion path — single PL/pgSQL function = single Postgres transaction = implicit atomic rollback-on-error semantics. body verbatim L308-L367 of `pg_get_functiondef(convert_lead)`:

```
DECLARE _lead RECORD; _guardian_id UUID; _new_student_id UUID; ...
BEGIN
  IF NOT is_org_admin(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO _lead FROM leads WHERE id = _lead_id AND org_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF _lead.stage = 'enrolled' THEN RAISE EXCEPTION 'Lead already enrolled'; END IF;
  -- Find or create guardian, create students, link student_guardians, UPDATE lead_students,
  -- UPDATE leads stage='enrolled', INSERT lead_activities — all within atomic PL/pgSQL block
  RETURN json_build_object('lead_id', _lead_id, 'guardian_id', _guardian_id, ...);
END;
```

**The FE hook `useConvertLead` (src/hooks/useLeads.ts:579-727) does NOT invoke this RPC.** Verbatim grep evidence: `rg -n 'convert_lead' src/` returns ONLY `src/integrations/supabase/types.ts:6859` (TypeScript Args declaration). Zero `.rpc('convert_lead', ...)` callers in src/.

Instead, useConvertLead implements the conversion via sequential `.from(table).insert()` REST calls (no atomic wrap):

| Line | Operation | Target table | Batch |
|---|---|---|---|
| L591-596 | SELECT leads (FOR-no-UPDATE read) | leads | batch-14 own |
| L604-609 | SELECT guardians (existence check) | guardians | batch-02 closed |
| L614-625 | INSERT guardians (branch 1: contact_email exists) | guardians | batch-02 closed |
| L628-639 | INSERT guardians (branch 2: no email) | guardians | batch-02 closed |
| L644-654 (loop per student) | INSERT students | students | batch-02 closed |
| L659-667 (loop per student) | INSERT student_guardians | student_guardians | batch-02 closed |
| L672-678 (loop per student) | UPDATE lead_students | lead_students | batch-14 own |
| L682-691 | UPDATE leads (stage='enrolled', converted_at=now) | leads | batch-14 own |
| L694-705 | INSERT lead_activities | lead_activities | batch-14 own |

Each `.from()` call is a SEPARATE HTTP request → SEPARATE Postgres transaction → SEPARATE auto-commit. NO `BEGIN/COMMIT/ROLLBACK` wrapper. NO compensating-DELETE on catch.

#### 3.2.2 Failure-mode enumeration (4 distinct partial-state scenarios)

| Failure point | Partial state | Recovery surface |
|---|---|---|
| INSERT guardians succeeds (L625) but Loop INSERT students fails (L656) | Orphan guardian in closed-batch-02 `guardians` table with no children attached | toast.error at L724 only; admin must manually DELETE orphan guardian |
| INSERT students succeeds but INSERT student_guardians fails (L669) | Orphan student in closed-batch-02 `students` table with no guardian link → RLS `is_parent_of_student` returns false → parent portal shows no children | toast.error at L724 only; admin must manually link or DELETE orphan student |
| UPDATE leads.stage='enrolled' succeeds (L691) but INSERT lead_activities fails (L705) | Lead state changed but no activity audit-trail entry | toast.error at L724 only; lost audit visibility on conversion event |
| Loop succeeds but UPDATE leads fails (L691) | Real students + guardians exist but `lead.stage` still 'new'/'contacted' → UI shows non-converted lead with hidden converted-students attached | toast.error at L724 only; admin sees inconsistent state |

#### 3.2.3 6-dim matrix Pack E adjudication (Phase 4.6 evidence)

| Dim | useConvertLead | F-11-003 (named-param-mismatch) | F-05-005 (silent-fail-with-banner) | Adjudication |
|---|---|---|---|---|
| D1 substrate | FE hook sequential `.from().insert()` REST calls; no `.rpc()` despite available SECDEF | FE `.rpc(name, mismatched_params)` PG-side always-error | FE error path swallows + shows banner | DISTINCT — bypass-of-SECDEF mechanism unique |
| D2 mechanism axis | FE bypasses available atomic SECDEF; multi-table cross-batch writes auto-commit independently | FE→RPC dispatch with mismatched signature → PG SQLSTATE 42883 always-errors | FE catches + banner displays | DISTINCT — convert_lead SECDEF exists + is atomic; FE chose not to use it |
| D3 action class | Multi-table writes spanning batch-02 closed + batch-14 own; partial-state-corruption risk on intermediate failure | RPC-call error (loud) | Silent failure path | DISTINCT — partial-success-without-rollback action class |
| D4 evidence shape | 5+ sequential `.from(table).insert(...)` within single async fn body; NO `BEGIN/COMMIT/ROLLBACK`; NO compensating-DELETE on catch | RPC-dispatch + param-list line; PG-side error visible | banner+toast.error pattern | DISTINCT |
| D5 trust erosion | Orphan guardian / orphan student / hidden-converted-student / missing-audit-trail | Always-error → no production reachability | Silent failure → undetected data drift | MEDIUM — operationally-recoverable but admin-visible |
| D6 composition | Composes with closed-batch-02 immutability (orphan rows in immutable closed tables) + convert_lead SECDEF dead-code (CC-19 #15 cohort entry F-14-004) | Standalone | Standalone | UNIQUE — composes via bypass-available-atomic |

DISTINCT on 5/6 dimensions; D5 MEDIUM is only weak axis.

#### 3.2.4 Pattern #43 NEW s53 PLACED single-anchor

Class-shape sketch (ratified Phase 5.3b): "FE direct-write bypass of available atomic SECDEF; multi-table cross-batch writes without explicit transaction; partial-success-without-rollback action class".

**Class-distinct from**:
- F-11-003 (FE-RPC named-param-mismatch always-errors at PG)
- F-05-005 (silent-failure-with-banner mitigation)
- Other multi-table-FE-write patterns where no SECDEF exists (e.g. batch-12 send-message orchestration; no atomic alternative)

**Defining feature axis**: FE-bypasses-available-atomic-SECDEF. The convert_lead SECDEF EXISTS at CENSUS:600 as the atomic alternative; FE chose not to use it. Distinct from "multi-table FE write where no SECDEF alternative exists".

**Placement precedent**: Pattern #40 single-anchor placement at s50 (F-11-004 anchor) + Pattern #41 single-anchor placement at s51 (F-12-003 anchor). Single-anchor placement sufficient when class-shape is well-defined and clearly distinct from existing catalog.

**Future-anchor probability HIGH**: SECDEF abstractions exist for other multi-table operations across the codebase (record_payment_and_update_status batch-05 closed, record_stripe_payment batch-02 closed, record_installment_payment batch-07 closed, convert_waitlist_to_student batch-14, add_to_enrolment_waitlist batch-14). Batch-19 sweep target for additional anchors.

#### 3.2.5 Severity reasoning (PLAN.md §4)

HIGH per "silent failure modes" + "broken edge cases" anchors + operational-correctness CAPS-at-HIGH per class-consistency chain (F-08-003 event #11 + F-09-007 event #12 + F-10-002 event #13 + F-11-003 cohort precedent). Strictly less mitigated than F-05-005 (no banner surface; toast.error only at L724; admin must manually inspect for orphan state).

Pre-launch: zero customers → zero conversion attempts → bounded.
Post-launch: any admin clicking "Convert Lead" risks partial-state corruption on intermediate failure (network blip, RLS rejection mid-sequence, transient PG error).

#### 3.2.6 Remediation

Replace useConvertLead L585-727 sequential `.from().insert()` with single `.rpc('convert_lead', { _lead_id, _org_id, _students })` invocation. The atomic SECDEF already exists; FE just needs to call it instead of duplicating the logic.

Note: CENSUS:600 `convert_lead` returns `json` with `{ lead_id, guardian_id, students_created }`. FE adjusts to consume the RPC response instead of post-write state assembly.

Co-fix: per F-14-004 (CC-19 #15 dead-code), once useConvertLead invokes the SECDEF, convert_lead is no longer orphan; CC-19 #15 cohort enrichment count for s53 reduces from +1 to +0.

#### 3.2.7 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — operational-correctness CAPS chain (bundle with F-11-003 + Pattern #43 batch-19 watchlist cohort)
- Closure: (empty)

---

### 3.3 F-14-003 LOW — SECDEF CC-19 #1 anon-EXECUTE hygiene cohort enrichment (4 body-guarded anchors)

| Field | Value |
|---|---|
| **ID** | F-14-003 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-09-002 + F-10-008 + F-11-002 precedent chain) |
| **Area** | SECDEF anon-EXECUTE retention with body-guard intact / defense-in-depth gap |
| **Phase surfaced** | 2.2 (drift #29 EXECUTE grant enumeration) + Phase 2.2 helper-body NULL-semantics verification (Pattern #40 NULL-3VL bypass NO MATCH) |
| **Class anchor** (drift #31 cite) | F-09-002 LOW (`findings/09-term-continuation.md` §F-09-002 verbatim: "recalc_continuation_summary anon-EXECUTE-grant-with-body-gate (CC-19 #1 hygiene)") + F-10-008 LOW (`findings/10-reports-analytics-payroll.md` §F-10-008 "SECDEF RPC anon-EXECUTE-grant cohort despite body-gate") + F-11-002 LOW (`findings/11-parent-portal.md` §3.2 L116-132 "CC-19 #1 helper-fn EXECUTE-grant hygiene cohort (3 anchors)") |
| **Cohort** | CC-19 #1 helper-fn EXECUTE-grant hygiene; pre-s53 ~9 → post-s53 ~13 (+4 batch-14 anchors) |

#### 3.3.1 Anchors (Phase 2.2 drift #29 EXECUTE grant re-verification table)

DB-verified via `has_function_privilege()` (drift #29 operational mandate):

| # | Function (with signature) | anon EXECUTE | auth EXECUTE | srv EXECUTE | proacl pattern | Body-guard |
|---|---|---|---|---|---|---|
| 1 | `add_to_enrolment_waitlist(_org_id uuid, _contact_name text, ...)` (21 args; 1814 bytes) | TRUE | TRUE | TRUE | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` | `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied: ...'` |
| 2 | `convert_lead(_lead_id uuid, _org_id uuid, _students jsonb)` (3 args; 2191 bytes) | TRUE | TRUE | TRUE | same | `IF NOT is_org_admin(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'` |
| 3 | `convert_waitlist_to_student(p_entry_id uuid, p_org_id uuid, p_teacher_id uuid)` (3 args; 2312 bytes) | TRUE | TRUE | TRUE | same | `IF NOT is_org_admin(auth.uid(), p_org_id) THEN RAISE EXCEPTION 'Access denied: ...'` |
| 4 | `withdraw_from_enrolment_waitlist(_entry_id uuid, _org_id uuid)` (2 args; 1434 bytes) | TRUE | TRUE | TRUE | same | `IF NOT is_org_staff(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Access denied: ...'` |

**(`respond_to_enrolment_offer` is EXCLUDED from this cohort: body-guard ABSENT; class-shape diverges to F-02-015 closed-batch-02 HIGH per §3.8 citation.)**

#### 3.3.2 Pattern #40 NULL-3VL bypass NO MATCH (drift #35.B class-shape feature verification)

Helper body NULL-semantics verification (Phase 2.2 DB-verified):

`is_org_admin(NULL, _org_id)` body:
```sql
SELECT EXISTS (
  SELECT 1 FROM public.org_memberships
  WHERE user_id = NULL AND org_id = _org_id
    AND role IN ('owner', 'admin') AND status = 'active'
)
```

PG three-valued logic: `user_id = NULL` evaluates to NULL → WHERE clause evaluates NULL on every row → `SELECT EXISTS(...)` returns boolean **false** (NOT NULL — EXISTS always returns boolean per PG docs).

Therefore `IF NOT is_org_admin(NULL, _org_id) THEN RAISE EXCEPTION`:
- `is_org_admin(NULL, _org_id)` = false
- `NOT false` = true
- `IF true THEN RAISE EXCEPTION` → exception fires
- anon BLOCKED ✓

Same NULL-safe verdict for `is_org_staff` (4-role IN list) + `is_org_member` (status='active' only).

**Pattern #40 NULL-3VL bypass NO MATCH for all 4 helper-guarded batch-14 SECDEFs.** F-11-004 anchor mechanism (direct `_user_id != auth.uid()` comparison; NULL != x = NULL → IF NULL THEN treated as FALSE → bypass) does NOT apply — helper-based checks via SELECT EXISTS are NULL-safe by design.

#### 3.3.3 AUTH-H5 cohort cross-check (Phase 2.6 Pack A REJECTED)

NONE of the 4 batch-14 helper-guarded SECDEFs are in F-13-001 META AUTH-H5 cohort:
- Phase 2.1 migration touch chain enumeration confirmed `20260401000000_auth_rls_hardening` ABSENT from all 4 fns' touch history
- `convert_lead` created at `20260401000001` (one migration AFTER AUTH-H5) but NOT in REVOKE sweep
- Class-shape divergent: F-13-001 META requires REVOKE artifact with partial-mitigation defect; batch-14 fns retain anon=X via standard default-grant ACL only (no REVOKE attempted)

Pack A REJECTED with D1 substrate dispositive. F-14-003 stands as fresh CC-19 #1 cohort enrichment per F-09-002/F-10-008/F-11-002 precedent.

#### 3.3.4 Impact

Defense-in-depth gap: anon EXECUTE retained on 4 admin/staff-level SECDEFs. Body-guards intact (`is_org_admin`/`is_org_staff` reject NULL caller via SELECT EXISTS semantics), so practical anon-callable exploit is BLOCKED. Anon EXECUTE grant is excess privilege; cleanup-class hygiene.

#### 3.3.5 Severity reasoning (PLAN.md §4)

LOW per "code-hygiene drift" + "legacy artefacts" anchors. Class-consistency with F-09-002 + F-10-008 + F-11-002 (9th-12th hygiene-class reinforcement on this carry; batch-09 + 10 + 11 anchored at LOW).

#### 3.3.6 Remediation

Apply Track 1 REVOKE EXECUTE migration per F-02-020 closed-batch-02 anchor fix template:

```sql
REVOKE EXECUTE ON FUNCTION public.add_to_enrolment_waitlist(...) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.convert_lead(uuid, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.convert_waitlist_to_student(uuid, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_from_enrolment_waitlist(uuid, uuid) FROM anon, authenticated;
-- preserve postgres + service_role grants
```

Co-fix: F-13-001 META AUTH-H5 layer-1 supplement `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;` prevents re-application on future CREATE OR REPLACE.

#### 3.3.7 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — CC-19 #1 batch-19 cohort sweep (bundle with F-09-002 + F-10-008 + F-11-002 chain + F-02-020 Track 1)
- Closure: (empty)

---

### 3.4 F-14-004 LOW — CC-19 #15 dead-code orphan SECDEF (`convert_lead`)

| Field | Value |
|---|---|
| **ID** | F-14-004 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-06-006 + F-07-005 CC-19 #15 cohort precedent) |
| **Area** | DB SECDEF / dead-code / orphan-fn |
| **Phase surfaced** | 1.4 (cross-batch reach grep) + Phase 2.3 Axis 1 (joint analysis with F-14-002) |
| **Class anchor** (drift #31 cite) | F-06-006 + F-07-005 (CC-19 #15 cohort precedent; "Dead-code SECDEF RPCs + orphan trigger functions" carry class) |
| **Cohort** | CC-19 #15 dead-code SECDEF + orphan trigger fns; pre-s53 4 + 2 sub-shapes → post-s53 5 + 2 sub-shapes (+1 batch-14 anchor `convert_lead`) |

#### 3.4.1 Evidence

`convert_lead(_lead_id uuid, _org_id uuid, _students jsonb)` SECDEF RPC:
- CENSUS:600 attributes to batch-14 (owning surface)
- Created at migration `20260401000001_add_convert_lead_rpc.sql` (Phase 2.1 migration touch chain enumeration)
- Body-guarded via `is_org_admin(auth.uid(), _org_id)` (per F-14-003 cohort entry)
- 2191-byte body implementing atomic multi-table conversion (per F-14-002 §3.2.1 evidence)

**ZERO consumers in production code:**

`rg -n 'convert_lead' src/` returns ONLY:
```
src/integrations/supabase/types.ts:6859:      convert_lead: { Args: ...; Returns: Json }
```

This is the TypeScript Args declaration only — generated from PG schema, not a caller. ZERO `.rpc('convert_lead', ...)` invocations across src/ + supabase/functions/.

`useConvertLead` (the FE hook intended to call convert_lead, per its name) IMPLEMENTS the conversion via direct-write pattern instead (per F-14-002 finding). This is the bypass.

#### 3.4.2 cleanup_expired_invites cross-batch observation (Phase 1.1 attribution adjudication)

`cleanup_expired_invites()` (CENSUS:657 batch-01 closed-immutable) is also dead-code orphan:
- ZERO consumers in src/ + supabase/functions/
- NOT in pg_cron schedule (CENSUS:904-935 26-cron enumeration)
- Defined at migration `20260315220010_fix_teacher_audit_findings.sql:214`
- Class-shape MATCH for CC-19 #15

NOT a fresh F-14-NNN allocation; closed-batch-01 immutable per PLAN.md §6. CC-19 #15 cohort observation. The post-s53 cohort cumulative count `~5` reflects convert_lead only (batch-14 enrichment); cleanup_expired_invites is closed-batch-01 cohort entry (deferred per closed-batch immutability).

#### 3.4.3 Impact

Defense-in-depth gap: dead-code SECDEF retains attack-surface (anon=X EXECUTE per F-14-003 cohort entry; body-guarded so anon-exploit BLOCKED). Maintenance hazard: future developer reading the fn might assume it's in use and modify in ways that affect the dormant call path. Dependency tracking gap: convert_lead is referenced in types.ts but not exercised in production.

#### 3.4.4 Severity reasoning (PLAN.md §4)

LOW per "code-hygiene drift" + "legacy artefacts" anchors. Class-consistency with F-06-006 + F-07-005 CC-19 #15 cohort.

#### 3.4.5 Remediation

Two options:
- (a) **Reactivate**: replace useConvertLead direct-write pattern (F-14-002 fix surface) with `.rpc('convert_lead', { _lead_id, _org_id, _students })`. convert_lead becomes the canonical conversion path; not orphan.
- (b) **Deprecate**: drop the SECDEF via DROP FUNCTION migration if useConvertLead's direct-write pattern is preferred (e.g. for granular error handling per-step).

Recommend (a) — atomic SECDEF is the cleaner architectural choice + closes F-14-002 partial-state-corruption finding.

#### 3.4.6 Decision / Sprint / Closure

- Decision needed: No (recommend (a) reactivate per F-14-002 fix surface)
- Target sprint: Phase C — co-fix with F-14-002 (operational-correctness CAPS chain)
- Closure: (empty)

---

### 3.5 F-14-005 LOW — F-01-017 UPDATE-no-WITH-CHECK cohort enrichment (4 batch-14 anchors)

| Field | Value |
|---|---|
| **ID** | F-14-005 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-12-004 + F-13-002 selective-regression precedent) |
| **Area** | RLS policy / UPDATE-policy-missing-WITH-CHECK |
| **Phase surfaced** | 3.3 (DB-verified pg_policy + filesystem migration source) |
| **Class anchor** (drift #31 cite) | F-01-017 (`findings/01-auth-sessions-rls.md:413-431`) MEDIUM cluster header verbatim: "UPDATE/ALL policies on ~50 tables lack explicit WITH CHECK clause" + F-13-002 most-recent cohort precedent (`findings/13-practice-resources.md` §3.2; "F-01-017 cohort 4 batch-13 anchors UPDATE-no-WITH-CHECK") + F-12-004 (subsumed; `findings/12-messages-notifications.md` §3.4) |
| **Cohort** | F-01-017 cohort; pre-s53 ≥29 → post-s53 ≥33 |

#### 3.5.1 Anchors (Phase 3.3 verbatim DB-verified)

| # | Table | Policy | USING (qual) | WITH CHECK |
|---|---|---|---|---|
| 1 | leads | "Admins can update leads" | `is_org_admin(auth.uid(), org_id)` | **NULL** |
| 2 | lead_follow_ups | "Admins can update lead follow-ups" | `is_org_admin(auth.uid(), org_id)` | **NULL** |
| 3 | lead_students | "Admins can update lead students" | `is_org_admin(auth.uid(), org_id)` | **NULL** |
| 4 | enrolment_waitlist | "Staff can update waitlist entries" | `is_org_staff(auth.uid(), org_id)` | **NULL** |

#### 3.5.2 Drift #35.B class-shape feature verification

All 4 anchors verified against F-01-017 defining features:
- Defining feature 1: UPDATE policy polcmd='w' ✓ all 4
- Defining feature 2: USING-only polqual present ✓ all 4
- Defining feature 3: WITH-CHECK-null polwithcheck IS NULL ✓ all 4
- Defining feature 4: admit cross-tenant row-mutation via FK-other-column tampering not caught by USING-fallback ✓ all 4 have FK columns beyond org_id:
  - leads: assigned_to_user_id + source-related FKs
  - lead_follow_ups: assigned_to_user_id
  - lead_students: converted_student_id
  - enrolment_waitlist: guardian_id + lead_id + preferred_teacher_id + offered_teacher_id + converted_student_id

#### 3.5.3 POSITIVE counter-examples in batch-14 (selective regression framing per F-13-002 §240 precedent)

6 INSERT policies with explicit WITH CHECK:
- `leads "Admins can create leads"` INSERT WITH CHECK=`is_org_admin(auth.uid(), org_id)` ✓
- `lead_activities "Admins can create lead activities"` INSERT WITH CHECK=`is_org_admin(auth.uid(), org_id)` ✓
- `lead_follow_ups "Admins can create lead follow-ups"` INSERT WITH CHECK=`is_org_admin(auth.uid(), org_id)` ✓
- `lead_students "Admins can create lead students"` INSERT WITH CHECK=`is_org_admin(auth.uid(), org_id)` ✓
- `enrolment_waitlist "Staff can insert waitlist entries"` INSERT WITH CHECK=`is_org_staff(auth.uid(), org_id)` ✓
- `enrolment_waitlist_activity "Org admins can manage waitlist activity"` INSERT WITH CHECK=`is_org_admin(auth.uid(), org_id)` ✓

**Selective regression POSITIVE:** correct WITH CHECK pattern available in batch-14; 4 UPDATE policies selectively miss adoption. Admin-only attack surface; bounded.

#### 3.5.4 FOR-ALL polcmd=`*` adjacent observation (NOT counted per UPDATE-only scope precedent)

4 FOR-ALL polcmd=`*` policies on batch-14 tables have WITH-CHECK NULL:
- booking_pages "Admins can manage booking pages" — is_org_admin / NULL
- booking_page_instruments "Admins can manage booking page instruments" — is_org_admin / NULL
- booking_page_teachers "Admins can manage booking page teachers" — is_org_admin / NULL
- enrolment_waitlist "Org admins can manage enrolment waitlist" — is_org_admin / NULL

PG semantics: WITH CHECK NULL falls back to USING for both INSERT and UPDATE. F-01-017 cluster header literal text "UPDATE/ALL policies" technically covers these.

Per s52/s51 batch-13/12 precedent (UPDATE-only cohort-counting scope), these are NOT counted in F-14-005 main count (would force retrospective rebase across batches 01-13). Editorial cohort-counting-scope adjudication candidate for post-Phase-B (see §11.J).

#### 3.5.5 Cross-batch observation: invites (closed-batch-02 immutable)

`invites "Org admins can update invites"` UPDATE-no-WITH-CHECK matches F-01-017 class-shape. invites is batch-02 primary-write per Phase 1.1 attribution. Closed-batch-02 immutable per PLAN.md §6. Citation only in §3.10 below; no fresh F-14-NNN allocation.

#### 3.5.6 Impact

Reliance on PG implicit default (USING reused for new-row check). Catches gross org_id-tampering. Does NOT catch FK-other-column tampering (per F-01-017 §424 analysis). Admin-only attack surface; bounded.

#### 3.5.7 Remediation

Add explicit `WITH CHECK (...)` matching `USING (...)` clause to each of the 4 policies; bundle with F-01-017 batch-19 sweep target #16 systematic cohort closure.

#### 3.5.8 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — RLS hardening (bundle with F-01-017 batch-19 cohort sweep)
- Closure: (empty)

---

### 3.6 F-14-006 LOW — CC-19 #11 column-CHECK-absent cohort enrichment (9 batch-14 anchors)

| Field | Value |
|---|---|
| **ID** | F-14-006 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-07-006/007 + F-09-012 + F-10-004 + F-13-004 chain) |
| **Area** | DB schema / column CHECK constraint absence |
| **Phase surfaced** | 3.4 (DB-verified pg_constraint + information_schema.columns) |
| **Class anchor** (drift #31 cite) | F-07-006 + F-07-007 (`findings/07-payment-plans-installments.md` §F-07-006 / §F-07-007 verbatim: "no positive CHECK on amount_minor columns") + F-09-012 (`findings/09-term-continuation.md` §F-09-012 4-column financial-amount CHECK cohort) + F-10-004 (`findings/10-reports-analytics-payroll.md` §F-10-004 Present-NOT-VALID variant sub-class introduction) + F-13-004 most-recent cohort precedent (`findings/13-practice-resources.md` §3.4) |
| **Cohort** | CC-19 #11 column-CHECK-absent; pre-s53 19 → post-s53 28 |

#### 3.6.1 Anchors (Phase 3.4 DB-verified)

| # | Column | Type | NOT NULL | Default | Plausible CHECK |
|---|---|---|---|---|---|
| 1 | `booking_pages.lesson_duration_mins` | integer | YES | — | `> 0` (zero/negative minutes nonsensical) |
| 2 | `booking_pages.advance_booking_days` | integer | YES | — | `> 0` |
| 3 | `booking_pages.min_notice_hours` | integer | YES | — | `>= 0` |
| 4 | `booking_pages.buffer_minutes` | integer | YES | — | `>= 0` |
| 5 | `enrolment_waitlist.child_age` | integer | NO | NULL | `BETWEEN 0 AND 18` (sane age range) |
| 6 | `enrolment_waitlist.lesson_duration_mins` | integer | NO | 30 | `> 0` |
| 7 | `enrolment_waitlist.position` | integer | YES | 0 | `>= 0` |
| 8 | **`enrolment_waitlist.offered_rate_minor`** | integer | NO | NULL | `> 0` (**financial-amount class** per F-09-012 sub-class flag) |
| 9 | `lead_students.age` | integer | NO | NULL | `BETWEEN 0 AND 18` |

#### 3.6.2 Confirmed validated CHECK constraints (POSITIVE baseline; ENUM-like)

6 ENUM-like CHECK constraints on batch-14 tables (all `convalidated=true`):
- `enrolment_waitlist_priority_check` (normal/high/urgent)
- `enrolment_waitlist_source_check` (5-value enum)
- `enrolment_waitlist_status_check` (8-value enum)
- `chk_ewl_activity_type` (12-value enum)
- `lead_activities_activity_type_check` (12-value enum)
- `lead_students_experience_level_check` (3-value enum)

**0 NOT-VALID variants in batch-14** (matches F-13-004 batch-13 precedent).

#### 3.6.3 Financial sub-class flag — `enrolment_waitlist.offered_rate_minor`

`offered_rate_minor` is a financial column (rate per lesson in minor units; set via send-enrolment-offer admin flow). Class-precedent F-09-012 batch-09 closed-immutable (4-column financial-amount CHECK cohort). Per CC-19 #11 cohort CAPS-at-LOW precedent chain, financial-amount sub-class does NOT bracket-shift up. LOW.

#### 3.6.4 Application-layer enforcement adjudication (Phase 4.6 evidence)

AddToWaitlistDialog.tsx validation evidence:
- L262-263: HTML5 `min={3} max={99}` on child_age input (client-side; bypassable via direct API call)
- L161: `child_age: childAge ? parseInt(childAge, 10) : null`
- L170: `lesson_duration_mins: parseInt(durationMins, 10)` — NO bounds check (parseInt only)

Per-column CC-19 #11 application-layer enforcement verdict:
- `child_age`: client-side HTML5 min/max ✓ → CC-19 #11 sub-class A (LOW; bounded for UI flow; bypassable for direct API)
- `lesson_duration_mins` (enrolment_waitlist): NO bounds check (parseInt only) → CC-19 #11 main class (LOW; gross-input-vulnerable)
- `position`: server-side enforcement only (RPC SELECT MAX+1 + lock; no client-side write surface)
- `offered_rate_minor`: admin-UI write surface via send-enrolment-offer flow; deferred
- `lead_students.age` + `enrolment_waitlist.child_age`: matching pair on different write paths

#### 3.6.5 Impact

Code-hygiene gap; gross-input vulnerability for 5/9 anchors (booking-page configs + lesson_duration_mins + position + offered_rate_minor + lead_students.age). Application-layer validation is partial (child_age via HTML5 only; lesson_duration_mins unbounded). Defense-in-depth missing at DB layer.

#### 3.6.6 Remediation

Add explicit `CHECK` constraints to each of 9 columns:

```sql
ALTER TABLE public.booking_pages
  ADD CONSTRAINT booking_pages_lesson_duration_mins_check CHECK (lesson_duration_mins > 0) NOT VALID;
-- (...8 more similar)
```

Use NOT VALID for safer phased rollout (existing rows preserved; new rows enforced); follow up with VALIDATE CONSTRAINT after backfill confirmation.

Bundle with batch-19 sweep target #11.

#### 3.6.7 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — schema-hardening cohort
- Closure: (empty)

---

### 3.7 F-14-007 LOW — CC-19 #3 audit_log INSERT integrity gap cohort enrichment (4 TRUE GAP anchors + 2 APP-LAYER COVERAGE POSITIVE)

| Field | Value |
|---|---|
| **ID** | F-14-007 |
| **Severity** | LOW (cohort-enrichment CAPS-at-LOW per F-13-003 + F-12-006 selective-regression precedent) |
| **Area** | DB schema / audit-trigger coverage gap / forensic-integrity |
| **Phase surfaced** | 3.5 (DB-verified pg_trigger empty result + per-table app-layer audit-trail adjudication) |
| **Class anchor** (drift #31 dual citation per Adjudication 23) | (a) **Class header**: F-02-010 (`findings/02-org-management.md`; batch-02 closed-immutable; verbatim: "`audit_log` table has no INSERT-time integrity trigger; 70.1% historical NULL-actor") — original CC-19 #3 class-defining finding; (b) **Most recent cohort precedent**: F-13-003 (`findings/13-practice-resources.md` §3.3 batch-13 closed-immutable; 7-anchor cohort with 28-table POSITIVE baseline) |
| **Cohort** | CC-19 #3 audit_log INSERT integrity gap; batch-14 +4 TRUE GAP anchors + 2 APP-LAYER COVERAGE POSITIVE counter-examples + 1 PARTIAL + 2 N/A |

#### 3.7.1 Per-table adjudication (Phase 3.5 evidence)

DB-verified pg_trigger enumeration on 9 batch-14 tables returns **EMPTY RESULT** (confirms Phase 0 §6.8 prediction). Adjudication framework: TRUE GAP / APP-LAYER COVERAGE / PARTIAL / N/A:

| # | Batch-14 table | DB trigger | App-layer audit-trail | Verdict |
|---|----------------|------------|----------------------|---------|
| 1 | leads | NONE | `lead_activities` (purpose-built; useLeads + booking-submit + convert_lead INSERT on every state change) | **APP-LAYER COVERAGE** (POSITIVE design) |
| 2 | lead_activities | NONE | (this IS the audit-trail sibling for leads) | **N/A** (architectural exception sub-class adjacent) |
| 3 | lead_follow_ups | NONE | (no _activity sibling; only updated_at column) | **TRUE GAP** (STRONG candidacy; follow-up scheduling state) |
| 4 | lead_students | NONE | `lead_activities` partial (activity_type='converted' captures key state) | **PARTIAL COVERAGE** (orphan-conversion edge case uncovered) |
| 5 | enrolment_waitlist | NONE | `enrolment_waitlist_activity` (purpose-built; 5 batch-14 RPCs + send-enrolment-offer + enrolment-offer-expiry + waitlist-respond INSERT on every state change) | **APP-LAYER COVERAGE** (POSITIVE design) |
| 6 | enrolment_waitlist_activity | NONE | (this IS the audit-trail sibling for enrolment_waitlist) | **N/A** |
| 7 | booking_pages | NONE | (no audit table; only updated_at column) | **TRUE GAP** (STRONG candidacy; admin-config table) |
| 8 | booking_page_instruments | NONE | (no audit table) | **TRUE GAP** (WEAK candidacy; junction table) |
| 9 | booking_page_teachers | NONE | (no audit table) | **TRUE GAP** (WEAK candidacy; junction table) |

**Summary**: 4 TRUE GAP + 2 APP-LAYER COVERAGE + 1 PARTIAL + 2 N/A.

#### 3.7.2 _activity-sibling-table architectural pattern observation (POS-5 NEW s53 PLACED two-anchor)

The purpose-built `_activity` sibling table pattern (lead_activities for leads + enrolment_waitlist_activity for enrolment_waitlist) is **architectural design distinct from log_audit_event_singular trigger pattern**.

Class-shape (ratified Phase 5.3b): "Purpose-built _activity sibling table pattern as application-layer audit-trail alternative to audit_log trigger pattern; captures domain-semantic state transitions with structured metadata".

The `_activity` tables capture domain-semantic state transitions (e.g. activity_type='converted', 'offered', 'declined', 'offer_sent', 'enrolled') with structured metadata (jsonb), while the audit_log infrastructure captures generic table-DML-events. Both achieve forensic-integrity; the `_activity` pattern is **POSITIVE design choice** for batch-14.

**Anchor pair at s53**: leads/lead_activities + enrolment_waitlist/enrolment_waitlist_activity. Two-anchor placement is STRONGER than POS-3 IMPLICIT (s52 single-anchor-pair precedent allowed). PLACED at s53.

Pattern slot: POS-5 (next available POS-numbering slot after POS-4 "Divide-by-zero auth gate" s49). See §11.I.

#### 3.7.3 Class header vs cohort precedent dual citation (drift #35.B scope refinement)

Per Adjudication 23 + drift #35.B scope refinement (s51 Phase 4):
- **Class header anchor**: F-02-010 (batch-02 closed-immutable; original CC-19 #3 class-defining finding; "audit_log table has no INSERT-time integrity trigger; 70.1% historical NULL-actor")
- **Most recent cohort precedent**: F-13-003 (batch-13 closed-immutable; 7-anchor cohort with 28-table POSITIVE baseline + STRONG/WEAK candidacy framing)

Dual citation per drift #35.B distinguishes class header anchor (original class-defining finding) from cohort precedent (most recent instance).

#### 3.7.4 Impact

Forensic-integrity gap on 4 TRUE GAP tables (lead_follow_ups + booking_pages + booking_page_instruments + booking_page_teachers). INSERT/UPDATE/DELETE on these 4 tables produces no audit-trail entry. Pre-launch: no real data → no real exposure. Post-launch: GDPR Art-32 "integrity and confidentiality" obligation pressure for the 4 admin-config tables.

#### 3.7.5 Remediation

Two options:
- (a) **Audit-trigger pattern**: apply `audit_<table>` AFTER INSERT trigger calling `log_audit_event_singular()` to 4 TRUE GAP tables — matches 28-table POSITIVE baseline (e.g. audit_internal_messages per F-12-006 §3.6 counter-example)
- (b) **_activity-sibling-table pattern**: create `_activity` sibling tables for booking_pages + lead_follow_ups; application-layer writes on every state change — matches batch-14's own POS-5 architectural choice

Recommend (a) for 4 TRUE GAP tables (less complex than introducing new _activity siblings); reserve (b) for new feature surfaces.

Bundle with batch-19 sweep target #3.

#### 3.7.6 Decision / Sprint / Closure

- Decision needed: No
- Target sprint: Phase C — audit-trigger coverage sweep (bundle with batch-19 cohort target)
- Closure: (empty)

---

### 3.8 F-02-015 closed-batch-02 HIGH citation — `respond_to_enrolment_offer` defense-in-depth gap (drift #30.A 4th operational manifestation)

**F-02-015 closed-batch-02 HIGH class** (`findings/02-org-management.md:894-959`; batch-02 closed-immutable; "respond_to_enrolment_offer anonymous cross-tenant accept/decline (child-safeguarding adjacency; sibling-asymmetry vs respond_to_makeup_offer)") continues to apply at HEAD pin `c80c664a`.

#### 3.8.1 Discovery (drift #30.A 4th operational manifestation)

Phase 5.2 canonical unrestricted-grep at s53 surfaced F-02-015 as the canonical respond_to_enrolment_offer finding. F-02-015 was NOT in the launching-prompt §B Phase 5.2 anticipated-citation list at dispatch (which enumerated F-02-005 + F-02-008 + F-02-010 + F-02-020 + F-02-021 + other closed-batch-02 references). CC's canonical grep at Phase 5.2 caught the citation; reviewing-Claude's anticipated list missed it.

Same class as drift #30.A manifestations #1-#3 (s50 batch-11 PI-50-E → F-01-005; F-11-001 → F-01-036; F-02-009 + F-02-020 helpers Phase 1). Operational scope mitigation: unrestricted findings/*.md grep at any phase — operated correctly at Phase 5.2.

No fresh drift number; editorial manifestation note within drift #30.A scope. See §11.C.

#### 3.8.2 Drift #36 live-DB body re-verification

Phase 2.1 fetched `respond_to_enrolment_offer` body verbatim via `SELECT prosrc FROM pg_proc`. Body text matches F-02-015 verbatim block at `findings/02-org-management.md:902-928`. **Class-shape unchanged at HEAD per drift #36 cross-verification.**

Body verbatim (Phase 2.1 fetch; matches F-02-015):
```sql
DECLARE _entry RECORD;
BEGIN
  IF _action NOT IN ('accept', 'decline') THEN RAISE EXCEPTION 'Invalid action: %', _action;
  SELECT * INTO _entry FROM enrolment_waitlist
    WHERE id = _entry_id AND org_id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found';
  IF _entry.status != 'offered' THEN RAISE EXCEPTION 'This offer is no longer available...';
  IF _entry.offer_expires_at IS NOT NULL AND _entry.offer_expires_at < NOW() THEN
    UPDATE enrolment_waitlist SET status = 'expired', updated_at = NOW() WHERE id = _entry_id;
    RAISE EXCEPTION 'This offer has expired';
  IF _action = 'accept' THEN UPDATE ... status='accepted', responded_at=NOW() WHERE id=_entry_id;
    INSERT INTO enrolment_waitlist_activity (..., created_by) VALUES (..., auth.uid());
    RETURN json_build_object('status', 'accepted', 'id', _entry_id);
  ELSE UPDATE ... status='declined'; INSERT activity; RETURN ...;
```

**Auth gate analysis: ZERO authentication validation.** The only barriers are (1) entry (id, org_id) pair must match a real DB row + (2) entry.status must be 'offered' + (3) entry.offer_expires_at must not have passed. `auth.uid()` is referenced ONLY as `created_by` log column — never as authorisation gate.

**EXECUTE grants per drift #29 re-verification (Phase 2.2)**: anon=X + auth=X + service_role=X. anon-callable.

#### 3.8.3 Class-shape continues to apply (closed-batch-02 immutable)

F-02-015 exploit shape, sibling-asymmetry framing, defence-in-depth analysis, and remediation pattern continue to apply at HEAD per drift #36 cross-verification:
- Exploit shape per F-02-015 L933-935: anon → POST `/rest/v1/rpc/respond_to_enrolment_offer` with (entry_id, org_id, action) → state-flip succeeds if pair matches real 'offered' entry
- Sibling-asymmetry per F-02-020 §1747 sub-pattern #5: respond_to_enrolment_offer (F-02-015) lacks guardian-of-entry scoped resolution that respond_to_makeup_offer correctly implements
- Defense-in-depth analysis per F-02-015 L942: **None.** enrolment_waitlist table has only `set_enrolment_waitlist_updated_at` (BEFORE UPDATE, no raise); no protective trigger; enrolment_waitlist_activity has no triggers at all
- Remediation per F-02-015 L944-956: apply respond_to_makeup_offer pattern (resolve guardian for current user scoped to entry's org; RAISE if mismatch)

**Closure: empty.** Phase C parameter-spoofing-class remediation Track 2 (body-level fix; parent-portal subset).

#### 3.8.4 Cross-batch reach (Phase 5.1 evidence)

`respond_to_enrolment_offer` is invoked from `waitlist-respond` edge fn at `supabase/functions/waitlist-respond/index.ts:115-122` with JWT-claim-bound (entry_id, org_id) parameters. waitlist-respond verifies a signed JWT (HS256 + `WAITLIST_JWT_SECRET`) cryptographically at L62-71 BEFORE extracting (entry_id, org_id) from the token claim — this is the legitimate entry point.

However, the underlying SECDEF `respond_to_enrolment_offer` has anon=X EXECUTE; direct PostgREST `POST /rest/v1/rpc/respond_to_enrolment_offer` bypasses the waitlist-respond cryptographic gate entirely. This is the defense-in-depth gap F-02-015 captures.

#### 3.8.5 PI cohort tagging

No PI seeds for s53 cohort 5. F-02-015 closed-batch-02 finding continues at HEAD.

---

### 3.9 F-02-020 closed-batch-02 cohort observation — 5 RLS-consumer helpers + 4 batch-14 helper-consumer SECDEFs

**F-02-020 closed-batch-02 MEDIUM class** (`findings/02-org-management.md` §F-02-020; batch-02 closed-immutable; "Helper-fn information-disclosure class (19 fns) — cross-tenant enumeration via SECDEF helpers") continues to apply at HEAD pin `c80c664a`.

#### 3.9.1 5 RLS-consumer helpers re-verified at HEAD (Phase 2.2 DB-verified)

| Helper | rettype | secdef | anon=X | auth=X | srv=X | NULL-3VL safe (SELECT EXISTS pattern) |
|---|---|---|---|---|---|---|
| `is_org_admin(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE | YES (returns boolean false; not NULL) |
| `is_org_staff(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE | YES |
| `is_org_member(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE | YES |
| `has_org_role(uuid, uuid, app_role)` | boolean | TRUE | TRUE | TRUE | TRUE | YES |
| `is_parent_of_student(uuid, uuid)` | boolean | TRUE | TRUE | TRUE | TRUE | YES |

All 5 retain anon+auth+srv EXECUTE grants matching F-02-020 cohort intent. Track 1 fix list at `findings/02-org-management.md:1051-1068` (17-helper REVOKE list) not yet applied; consistent with s52 close.

#### 3.9.2 4 batch-14 helper-consumer SECDEFs enumerated at F-02-020 §1731-1732

Per `findings/02-org-management.md:1731-1732` verbatim:
- L1731: `is_org_admin(auth.uid(), v_org_id)` — used by anonymise_guardian, anonymise_student, set_primary_location, **convert_lead**, **convert_waitlist_to_student**, delete_billing_run, reassign_teacher_conversations_to_owner
- L1732: `is_org_staff(auth.uid(), _org_id)` — used by **add_to_enrolment_waitlist**, confirm_makeup_booking, dismiss_makeup_match, issue_make_up_credit, offer_makeup_slot, recalc_continuation_summary, redeem_make_up_credit, **withdraw_from_enrolment_waitlist**

4 batch-14 SECDEFs enumerated as helper-consumers at F-02-020 §1731-1732 (bolded). These are the same 4 body-guarded SECDEFs surfaced in F-14-003 LOW cohort enrichment.

#### 3.9.3 F-02-020 §1747 sub-pattern #5 framing applies to respond_to_enrolment_offer

Per `findings/02-org-management.md` §1747 sub-pattern #5: "Newer parent-portal fns with sibling-asymmetry. respond_to_enrolment_offer (F-02-015) lacks the guardian-of-entry scoped resolution that respond_to_makeup_offer correctly implements. Same family, divergent posture. **High class.**"

Sub-pattern #5 of 5 in F-02-020 cohort analysis framing. respond_to_enrolment_offer F-02-015 fits this sub-pattern; carries to §3.8 citation.

#### 3.9.4 Per s52 findings/13 §3.6 precedent

Same closed-batch-02 citation pattern as s52 batch-13 §3.6 PI-52-C (5 batch-13-RLS-consumer helpers re-verified at HEAD). No fresh F-14-NNN allocation; closed-batch-02 immutable per PLAN.md §6.

---

### 3.10 Cross-batch observation — `invites` UPDATE-no-WITH-CHECK (closed-batch-02 immutable)

`invites "Org admins can update invites"` UPDATE policy with USING=`is_org_admin(auth.uid(), org_id)` + WITH-CHECK=NULL.

Class-shape MATCH for F-01-017 cluster (per drift #35.B 4-feature verification):
- UPDATE policy ✓
- USING-only ✓
- WITH-CHECK-null ✓
- FK-other-column tampering admit (invites has email + token + role + invited_by + organisation_id beyond org_id) ✓

invites is batch-02 primary-write per Phase 1.1 attribution (Teachers.tsx:305 + useStudentDetailPage:228+532+536 + InviteMemberDialog + PendingInvitesList + 4 invite-* edge fns). **Closed-batch-02 immutable per PLAN.md §6.** Citation only; no fresh F-14-NNN allocation.

Bundle with F-01-017 batch-19 sweep target #16 if Phase C addresses cross-batch-02 instances. F-02-017 + F-02-018 + F-02-019 invite-flow status-fidelity sprint scope (per `findings/02-org-management.md` §1765 S-07 sprint recommendation) covers separate invite-flow defects not class-shape match.

---

## §4 Pre-tag adjudication summary

| Finding | Pre-tag | Final | Class-precedent application | Severity-event? |
|---|---|---|---|---|
| F-14-001 (send-enrolment-offer Pattern #41) | HIGH | HIGH | F-12-003 same-bracket pre-tag confirmation (6/6 MATCH) | NOT-AN-EVENT per §18 |
| F-14-002 (useConvertLead FE direct-write) | HIGH | HIGH | F-11-003 operational-correctness CAPS chain + F-05-005 distinguishability | NOT-AN-EVENT |
| F-14-003 (SECDEF CC-19 #1 cohort) | LOW | LOW | F-09-002 + F-10-008 + F-11-002 CC-19 #1 hygiene chain | NOT-AN-EVENT |
| F-14-004 (convert_lead CC-19 #15 dead-code) | LOW | LOW | F-06-006 + F-07-005 CC-19 #15 cohort | NOT-AN-EVENT |
| F-14-005 (F-01-017 cohort) | LOW | LOW | F-01-017 cluster header + F-13-002 most-recent cohort precedent | NOT-AN-EVENT |
| F-14-006 (CC-19 #11 cohort) | LOW | LOW | F-07-006/007 + F-09-012 + F-10-004 + F-13-004 chain | NOT-AN-EVENT |
| F-14-007 (CC-19 #3 cohort) | LOW | LOW | F-02-010 class header + F-13-003 cohort precedent | NOT-AN-EVENT |

**0 severity-adjustment events at s53.** Cumulative events: **14 unchanged**.

---

## §5 RLS audit

### 5.1 booking_pages public-surface column-exposure (Phase 3.1)

DB-verified pg_attribute enumeration on 3 booking_* tables (24 columns total). All columns either necessary for public booking flow OR public by design. **NO PII columns; NO contact emails; NO internal-config JSON; NO stripe_connect_account_id; NO billing_account_id.**

booking_page_teachers exposes raw teacher_id UUID via anon SELECT; teachers table has ZERO anon SELECT policy (Phase 4.6 verification: 6 RLS policies on teachers; SELECT requires is_org_staff or is_org_parent or self). Knowing teacher_id alone yields no PII.

**POSITIVE observations**; no findings on booking_pages public-surface column exposure. Phase 3.1 NOT-A-FINDING verdict CONFIRMED.

### 5.2 F-14-005 F-01-017 cohort (4 batch-14 UPDATE anchors)

See §3.5.

### 5.3 6 INSERT WITH CHECK POSITIVE counter-examples (selective regression framing)

See §3.5.3.

### 5.4 0 RESTRICTIVE policies on 9 batch-14 tables (Phase 3.6)

pg_policy WHERE polpermissive=false on 9 batch-14 tables: EMPTY. CC-19 #13 batch-14 contribution: 0. Cohort unchanged at 5 bifurcated + INERT 3 entering Phase 5.

### 5.5 4 FOR-ALL polcmd=`*` adjacent observation (editorial post-Phase-B)

See §3.5.4. Editorial cohort-counting-scope adjudication candidate per Phase 5.3c.

### 5.6 Parent-portal cross-batch read policy observation

`enrolment_waitlist "Parents can view their own waitlist entries"` polcmd='r' USING=`(guardian_id IN (SELECT guardians.id FROM guardians WHERE (guardians.user_id = auth.uid())))`. Parent-portal (batch-11 closed) reads batch-14 enrolment_waitlist via this RLS. Architectural observation; not a finding.

---

## §6 SECDEF RPC audit

### 6.1 Phase 2.1 drift #36 first operational application — 5 SECDEFs

DB-verified via `SELECT prosrc FROM pg_proc JOIN pg_namespace n ON n.oid=p.pronamespace`:

| RPC | body bytes | secdef | volatility | rettype | proconfig |
|---|---|---|---|---|---|
| add_to_enrolment_waitlist | 1814 | true | v | json | search_path=public |
| convert_lead | 2191 | true | v | json | search_path=public |
| convert_waitlist_to_student | 2312 | true | v | json | search_path=public |
| respond_to_enrolment_offer | 1711 | true | v | json | search_path=public |
| withdraw_from_enrolment_waitlist | 1434 | true | v | json | search_path=public |

Migration touch chain enumerated via `supabase_migrations.schema_migrations` regex:
- `20260227120000:enrolment_waitlist` (initial CREATE)
- `20260315200400:fix_atomic_waitlist_conversion` (convert_waitlist_to_student WL-L5 fix)
- `20260316270000:fix_waitlist_audit_findings` (add_to_enrolment_waitlist WL-M4 position FOR UPDATE)
- `20260401000001:add_convert_lead_rpc` (convert_lead CREATE; one migration AFTER AUTH-H5)

**NONE of the 5 batch-14 fns are in AUTH-H5 cohort** (migration `20260401000000` ABSENT from touch history; F-13-001 META cohort enrichment via batch-14 REJECTED per Phase 2.6 Pack A).

### 6.2 Phase 2.2 drift #29 EXECUTE grant re-verification

| RPC | anon | auth | srv | proacl pattern |
|---|---|---|---|---|
| add_to_enrolment_waitlist | TRUE | TRUE | TRUE | default-grant pattern |
| convert_lead | TRUE | TRUE | TRUE | same |
| convert_waitlist_to_student | TRUE | TRUE | TRUE | same |
| respond_to_enrolment_offer | TRUE | TRUE | TRUE | same |
| withdraw_from_enrolment_waitlist | TRUE | TRUE | TRUE | same |

All 5 anon-callable per default-grant pattern. 4 body-guarded (F-14-003); 1 no-gate (F-02-015 closed-batch-02 citation per §3.8).

### 6.3 SECDEF checklist table

| Fn | Body-level auth.uid() | Body-level org-helper | Role-check | Reachability path | Verdict |
|---|---|---|---|---|---|
| add_to_enrolment_waitlist | yes (created_by) | `is_org_staff(auth.uid(), _org_id)` RAISE | staff+ | anon → REST → SECDEF → is_org_staff(NULL,...)=false → RAISE blocks | F-14-003 LOW cohort |
| convert_lead | yes (created_by) | `is_org_admin(auth.uid(), _org_id)` RAISE | admin+ | anon → REST → SECDEF → is_org_admin(NULL,...)=false → RAISE blocks | F-14-003 LOW cohort + F-14-004 LOW dead-code |
| convert_waitlist_to_student | yes (created_by) | `is_org_admin(auth.uid(), p_org_id)` RAISE | admin+ | anon → REST → SECDEF → is_org_admin(NULL,...)=false → RAISE blocks | F-14-003 LOW cohort |
| **respond_to_enrolment_offer** | yes (created_by only) | **NO HELPER CALL** | NO | **anon → REST → SECDEF → entry WHERE id=_entry_id AND org_id=_org_id → state-flip succeeds if pair matches real 'offered' entry** | **F-02-015 closed-batch-02 HIGH citation per §3.8** |
| withdraw_from_enrolment_waitlist | yes (created_by) | `is_org_staff(auth.uid(), _org_id)` RAISE | staff+ | anon → REST → SECDEF → is_org_staff(NULL,...)=false → RAISE blocks | F-14-003 LOW cohort |

### 6.4 Pattern #40 NULL-3VL bypass NO MATCH

See §3.3.2 — helper-body NULL-semantics verification confirms `is_org_admin/staff/member` return boolean (not NULL) via SELECT EXISTS pattern. Pattern #40 (F-11-004 anchor) requires structurally-present `IF <caller-context> != <param>` gate that bypasses via NULL 3VL; 4 batch-14 helper-guarded fns use SELECT EXISTS helpers and are NULL-safe.

---

## §7 Frontend sweep

### 7.1 CC-19 #4 useCan unimplementation sweep (Phase 4.1)

DB-verified grep on full batch-14 frontend surface (4 pages + 5 hooks + 15 components):

| Pattern | Result |
|---|---|
| Inline `role === 'admin'` / `role === 'owner'` / `userRole === ...` / `isAdmin/isOwner/isStaff/isFinance` / `member.role === ...` | **ZERO hits** |
| `useCan(...)` invocation | **ZERO hits** |
| `useCan` import statement | **ZERO hits** |
| `allowedRoles` prop / `canShow` / `canDelete` / `canEdit` / `canCreate` affordance prop | **ZERO hits** |

**Phase 4.1 verdict: CC-19 #4 ARCHITECTURAL N/A for batch-14.**

Access control enforced via routing-layer gate (per CENSUS:83-85 owner/admin-only routes) + RLS-layer enforcement (every batch-14 table's USING expression uses is_org_admin/is_org_staff helpers). **CC-19 #4 sub-shape "ARCHITECTURAL N/A" NEW s53** (sub-class introduction within CC-19 #4 cohort; class-DISTINCT from useCan-anchored main class on design-philosophy axis per Phase 5.3b adjudication).

CC-19 #4 cumulative: ≥218 unchanged entering Phase 5 (batch-14 +0; architectural N/A POSITIVE counter-example).

### 7.2 Tier-gating audit (Phase 4.2; drift #28 negative-evidence sweep)

ZERO tier-gating helpers (useFeatureGate / useTier / useFeatureFlag / useSubscriptionTier / useEntitlements / usePlan) imported by any batch-14 page or component.

Per V2_PLAN.md §3.2 L253-258 verbatim un-deferral: batch-14 surfaces (leads + enrolment-waitlist + booking-page) are LAUNCH IN-SCOPE for all tiers; tier-gating absence may be intentional. Observation only; not a finding.

### 7.3 CC-19 #7 TS-bypass-cast cohort enrichment (Phase 4.4)

**Sub-A literal `as any` cast — 22 batch-14 instances** (hook-level `const db = supabase as any` + per-call inline casts). Cumulative ~394 → ~416.

**Sub-E catch-block `: any` — 0 batch-14 instances.** Cumulative 41 unchanged. POSITIVE counter-example (contrast batch-13 +1; batch-12 +8; batch-11 +4).

**Sub-D2 TS callback `: any` parameter — 23 batch-14 instances.** Cumulative ~2 → ~25 (substantial enrichment; +1100% from cumulative).

Per s51/s52 cohort enrichment precedent: per-instance counts logged at PLAN.md §10 ledger; NOT fresh F-14-NNN allocation.

### 7.4 CC-19 #10 Sentry edge-fn instrumentation (Phase 4.5)

| Edge fn | Sentry wrap | Pattern |
|---|---|---|
| booking-get-slots | wrapEdgeFn L24 | ✓ |
| booking-submit | wrapEdgeFn L50 | ✓ |
| waitlist-respond | wrapEdgeFn L168 | ✓ |
| enrolment-offer-expiry | wrapEdgeFn L86 | ✓ |
| send-enrolment-offer | wrapEdgeFn L328 | ✓ |

**5/5 batch-14 edge fns Sentry-wrapped.** POSITIVE counter-example. CC-19 #10 cumulative: ~11 unchanged entering Phase 5.

---

## §8 Cross-batch reach

Per Phase 5.1 matrix:

| Batch-14 surface | Cross-batch READ | Cross-batch WRITE | Closed-batch helper invocation |
|---|---|---|---|
| booking-submit | lessons + availability_blocks + closure_dates + time_off_blocks (batch-03 closed) + teachers (batch-02 closed) + booking_pages.org (batch-14) | message_log INSERT (batch-12 closed; POSITIVE per batch-12 §11.D) | none direct |
| booking-get-slots | booking_pages + booking_page_instruments + booking_page_teachers (batch-14 own) + lessons + availability_blocks + closure_dates + time_off_blocks (batch-03 closed) + teachers (batch-02 closed) | none | none direct |
| send-enrolment-offer | organisations (batch-02) + teachers (batch-02) + locations (batch-03/18) + terms (batch-09) | message_log INSERT (batch-12 closed; F-14-001 attack-surface) + enrolment_waitlist_activity INSERT (batch-14 own) | none direct |
| waitlist-respond | enrolment_waitlist (batch-14 own) via respond_to_enrolment_offer RPC | enrolment_waitlist UPDATE + enrolment_waitlist_activity INSERT via RPC | respond_to_enrolment_offer (F-02-015 attack-surface entry) |
| enrolment-offer-expiry | enrolment_waitlist (batch-14 own) | enrolment_waitlist UPDATE + enrolment_waitlist_activity INSERT (batch-14 own) | none direct |
| useConvertLead (FE) | guardians (batch-02) | guardians + students + student_guardians INSERT (batch-02) + lead_students UPDATE + leads UPDATE + lead_activities INSERT (batch-14 own) | none direct (F-14-002 HIGH; available SECDEF convert_lead bypassed per F-14-004) |
| convert_lead SECDEF | leads + guardians (FOR UPDATE; batch-02) | guardians + students + student_guardians INSERT (batch-02) + lead_students UPDATE + leads UPDATE + lead_activities INSERT (batch-14 own) | is_org_admin (F-02-020 cohort) |
| 5 batch-14 RPCs (RLS-consumer helpers) | n/a | n/a | F-02-020 cohort observation (§3.9) |
| Cron 114 (enrolment-offer-expiry-hourly) | n/a | enrolment-offer-expiry edge fn invocation | none |

**3 verified cross-batch WRITE paths** (post-Phase-2.5b correction):
1. booking-submit:289 → message_log (batch-12 closed; POSITIVE)
2. send-enrolment-offer:248+288 → message_log (batch-12 closed; F-14-001 attack-surface)
3. useConvertLead L614+L628+L644+L659 → 3-table batch-02 chain (F-14-002 finding)

**0 cross-batch lessons writes** (booking-submit L155-163 confirmed SELECT per Phase 2.5b correction).

---

## §9 Sweep-target framing

| F-14-NNN | Sweep target | Rationale |
|---|---|---|
| F-14-001 (HIGH send-enrolment-offer Pattern #41) | in-batch + Pattern #41 batch-19 watchlist | Single-fn defect; Pattern #41 dual-anchor strengthens batch-19 sweep target |
| F-14-002 (HIGH useConvertLead) | in-batch + Pattern #43 batch-19 watchlist | Single-hook defect; Pattern #43 NEW s53 PLACED single-anchor; batch-19 sweep target for additional anchors |
| F-14-003 (LOW SECDEF CC-19 #1 cohort) | batch-19 cross-cutting | Per s52 + earlier precedent |
| F-14-004 (LOW CC-19 #15 dead-code) | batch-19 cross-cutting | Per s52 + earlier precedent |
| F-14-005 (LOW F-01-017 cohort) | batch-19 cross-cutting | Per s52 + earlier precedent |
| F-14-006 (LOW CC-19 #11 cohort) | batch-19 cross-cutting | Per s52 + earlier precedent |
| F-14-007 (LOW CC-19 #3 cohort) | batch-19 cross-cutting | Per s52 + earlier precedent |

---

## §10 Cumulative tally + pattern catalog + methodology + severity

### 10.1 Cumulative tally projection (Phase 5.3a triple-cross-verified)

| | Pre s53 | Post s53 | Delta |
|---|---|---|---|
| Total active | 157 | **164** | +7 |
| Critical | 20 | 20 | 0 |
| High | 45 | **47** | +2 |
| Medium | 26 | 26 | 0 |
| Low | 66 | **71** | +5 |

Triple-cross-verify:
- Way 1 (bracket sum): 20+47+26+71 = **164** ✓
- Way 2 (per-batch-row sum): 5 (PI) + 36 (b01) + 36 (b02) + 5 (b03) + 5 (b04) + 11 (b05) + 8 (b06) + 7 (b07) + 10 (b08) + 10 (b09) + 8 (b10) + 4 (b11) + 8 (b12) + 4 (b13) + **7 (b14 fresh)** = **164** ✓
- Way 3 (header): 157 + 7 = **164** ✓

### 10.2 Pattern catalog updates

**Pattern #43 NEW s53 PLACED single-anchor**:
- Anchor: F-14-002 useConvertLead
- Class shape: "FE direct-write bypass of available atomic SECDEF; multi-table cross-batch writes without explicit transaction; partial-success-without-rollback action class"
- Placement precedent: Pattern #40 single-anchor (s50) + Pattern #41 single-anchor (s51)
- Future-anchor probability HIGH (SECDEF abstractions exist for other multi-table operations across codebase)

**Pattern #41 dual-anchor strengthening (no slot change)**:
- F-12-003 (s51) single-anchor PLACED → s53 dual-anchor PLACED with F-14-001 send-enrolment-offer
- Not a re-promotion event per s47+ refinement (placement-precedent invariance)

**POS-5 NEW s53 PLACED two-anchor: _activity-sibling-table pattern**:
- Anchor pair at s53: leads/lead_activities + enrolment_waitlist/enrolment_waitlist_activity
- Class shape: "Purpose-built _activity sibling table pattern as application-layer audit-trail alternative to audit_log trigger pattern; captures domain-semantic state transitions with structured metadata"
- Placement precedent: POS-3 IMPLICIT s52 single-anchor-pair → POS-5 two-anchor STRONGER
- Pattern slot number: POS-5 (next available after POS-4 "Divide-by-zero auth gate" s49)

**CC-19 #4 sub-shape "ARCHITECTURAL N/A" NEW s53 (sub-class introduction)**:
- Anchor at s53: entire batch-14 frontend surface (4 pages + 5 hooks + 15 components confirmed zero useCan + zero inline role-check)
- Class shape: "Permissions enforced via routing-layer gate + RLS-as-single-source-of-truth; no UI-layer affordance gating; class-DISTINCT from useCan-anchored CC-19 #4 main class"
- Sub-class introduction within CC-19 #4 cohort per drift #35.A class-specific exemption rule precedent
- Caveat: single-batch-anchor; defer placement to batch-19 sweep for cross-codebase verification

**Catalog totals post-s53**:
- Placed patterns: 36 → **37** (+1 Pattern #43)
- Candidates: 6 unchanged
- Sub-class introductions: 5 → **7** (+2 NEW s53: POS-5 _activity-sibling-table + CC-19 #4 ARCHITECTURAL N/A)
- NEGATIVE-instance flag: 1 unchanged

### 10.3 Methodology drift ledger

**Drift #37 V2_PLAN.md verbatim cite mandate — RATIFIED Cat 1 NEW s53 (reviewing-Claude origin)**:
- Origin: launching prompt §6.10 cited LESSONLOOP_V2_PLAN.md §3 HIDDEN classification for leads + enrolment-waitlist + booking-page + recurring-templates; V2_PLAN.md §3.2 L253-258 un-defers all four to LAUNCH IN-SCOPE per s24 stance recalibration (only Zoom remains HIDDEN per §3.2 L246)
- Audit-scope impact: ZERO (AUDIT SCOPE COMPLETENESS PLAN.md §3 rule 3 audits regardless of v1 visibility)
- Class shape: analogous to drift #30 (CENSUS verbatim line cite mandate)
- Operational rule: every launching-prompt section citing LESSONLOOP_V2_PLAN.md scope claims MUST include verbatim line cite from V2_PLAN.md (not paraphrase or memory citation)
- Cumulative methodology entries: 37 → **38** (34 Cat 1 + 2 Cat 2 + 2 Cat 3)

**Drift #36 procedural promotion**: first operational application COMPLETE; promotes from "NEW s52 mandate" to "standard Phase 2 procedure entering batch 15+". No fresh drift ratification (already Cat 1 #33 at s52).

**Drift #30.A 4th operational manifestation**: F-02-015 anticipated-citation-list completeness gap caught via canonical unrestricted-grep at Phase 5.2. Same class as manifestations #1-#3 (s50). No fresh drift number; editorial entry within #30.A scope. See §11.C.

**FOR-ALL polcmd=`*` cohort-counting scope**: editorial cohort-counting-scope adjudication candidate for post-Phase-B per Adjudication 9 + 24 convention. NOT a methodology drift; deferred.

### 10.4 Severity-adjustment events

**0 events at s53.** All 7 F-14-NNN pre-tags are within-bracket class-precedent applications per §18 principles. Cumulative events: **14 unchanged**.

### 10.5 CC-19 cohort enrichment ledger

| Carry | Batch-14 contribution | Cumulative pre → post |
|---|---|---|
| CC-19 #1 helper-fn EXECUTE-grant hygiene | +4 batch-14 SECDEFs (F-14-003: add_to_enrolment_waitlist + convert_lead + convert_waitlist_to_student + withdraw_from_enrolment_waitlist) | ~9 → ~13 |
| CC-19 #3 audit_log INSERT integrity gap | +4 TRUE GAP batch-14 anchors + 2 POSITIVE counter-examples + 1 PARTIAL + 2 N/A (F-14-007) | ACTIVE-mixed enriched |
| CC-19 #4 useCan unimplementation | +0 (ARCHITECTURAL N/A POSITIVE; sub-class introduction NEW s53) | ≥218 unchanged |
| CC-19 #7 Sub-A literal cast | +22 batch-14 per-instance | ~394 → ~416 |
| CC-19 #7 Sub-E catch-block `: any` | +0 batch-14 (POSITIVE counter-example) | 41 unchanged |
| CC-19 #7 Sub-D2 callback `: any` | +23 batch-14 per-instance (substantial enrichment) | ~2 → ~25 |
| CC-19 #10 Sentry edge-fn instrumentation | +0 (POSITIVE 5/5 wrap) | ~11 unchanged |
| CC-19 #11 column-CHECK-absent | +9 batch-14 anchors (F-14-006; financial sub-class flag on offered_rate_minor) | 19 → 28 |
| CC-19 #13 PERMISSIVE-as-RESTRICTIVE | +0 batch-14 | 5 bifurcated + INERT 3 unchanged |
| CC-19 #15 dead-code SECDEF + orphan triggers | +1 batch-14 (F-14-004: convert_lead) | 4 + 2 sub-shapes → 5 + 2 sub-shapes |
| CC-19 #16 rate-limit-key-mismatch | +0 batch-14 | 3 cohort unchanged |
| F-01-017 UPDATE-no-WITH-CHECK | +4 batch-14 anchors (F-14-005) | ≥29 → ≥33 |

---

## §11 Audit-method appendix

### §11.A Drift #29 EXECUTE grant enumeration operational application

5 batch-14 SECDEF RPCs enumerated at Phase 2.2 via `has_function_privilege()` for anon + authenticated + service_role roles. All 5 retain default-grant ACL pattern. F-14-003 + F-14-004 cohort allocations follow.

### §11.B Drift #30 + #30.B CENSUS verbatim line cite evidence

17-row CENSUS verbatim cite table at §2.1 for every §7.1 IN-scope entry. Closed-batch-attribution mismatches (cleanup_expired_invites batch-01 + invites batch-02 + kickstarter_signups batch-21 + validate_waitlist_credit_ownership batch-08) surfaced at Phase 1.1 with verbatim CENSUS line cite per drift #30 + #30.B mandate.

### §11.C Drift #30.A 4th operational manifestation

F-02-015 anticipated-citation-list completeness gap caught via canonical unrestricted-grep at Phase 5.2.

Origin: launching prompt §B Phase 5.2 anticipated-citation list at dispatch enumerated F-02-005 + F-02-008 + F-02-010 + F-02-020 + F-02-021 + F-05-005 + F-06-006 + F-07-005 + F-07-006/007 + F-08-002 + F-08-003 + F-09-002 + F-09-007 + F-10-002 + F-10-008 + F-11-002 + F-11-003 + F-12-003 + F-12-004 + F-12-008 + F-13-001 + F-13-002 + F-13-003 + F-13-004. **F-02-015 NOT in anticipated list.**

CC's canonical unrestricted-grep at Phase 5.2 (`rg -nP '\b(respond_to_enrolment_offer|...)\b' audit/sweep/findings/*.md`) caught the citation. Same class as drift #30.A manifestations #1-#3 (s50 batch-11 PI-50-E → F-01-005; F-11-001 → F-01-036; F-02-009 + F-02-020 helpers Phase 1). Operational scope mitigation: unrestricted findings/*.md grep at any phase — operated correctly.

No fresh drift number; editorial manifestation note within drift #30.A scope.

Consequence: F-14-001 pre-tag (respond_to_enrolment_offer) reclassified to §3.8 closed-batch-02 citation per closed-batch immutability. Allocation revised 8 → 7 fresh F-14-NNN; tally projection 165 → 164.

### §11.D Drift #31 expanded scope class-precedent citations

Every §3.x finding includes finding-ID + verbatim cite from closed-batch finding doc per drift #31 expanded scope (s51 Phase 7 refinement). 7 fresh F-14-NNN + 2 closed-batch citations + 1 cross-batch observation: 10 citation locations total. Class-shape feature verification per drift #35.B applied (class header vs cohort precedent distinguished where dual-citation applies; F-14-007 §3.7.3 evidence).

### §11.E Drift #32 Message B placeholder token count (Phase 10 forward)

For Phase 10 reviewing-Claude handover snapshot composition (forward reference): placeholder token `<s53 Phase 10 commit SHA>` MUST appear exactly 3 times at §2 + §4 + §21 of the handover snapshot. CC's Phase 10 step 2 grep -c verification is the failsafe.

### §11.F Drift #35.A + #35.B class-shape feature verification + class-specific exemption rules

Sub-drift #35.A operational application: CC-19 #16 inline-override exemption per s51 Adjudication 2A applied to booking-get-slots:40 + booking-submit:66 inline rate-limit config overrides (account-delete:51 + gdpr-delete L47 precedent).

Sub-drift #35.B operational application:
- F-01-017 4-feature class-shape verification (§3.5.2: UPDATE polcmd + USING-only + WITH-CHECK-null + FK-other-column tampering admit)
- Pattern #40 NULL-3VL bypass NO MATCH verification (§3.3.2: helper-body `SELECT EXISTS` returns boolean false; NOT NULL; gate fires correctly)
- F-02-010 class header vs F-13-003 cohort precedent dual citation for F-14-007 (§3.7.3)
- Pattern #41 6-dim feature verification for F-14-001 (§3.1.2)
- Pack E 6-dim feature verification for F-14-002 (§3.2.3)

### §11.G Drift #36 first operational application

**Drift #36 FIRST OPERATIONAL APPLICATION at s53 — COMPLETE.**

Phase 2.1 dispatch included explicit task line "live-DB body verification via SELECT prosrc FROM pg_proc + migration touch chain enumeration on materially load-bearing SECDEF RPC body claims".

CC executed the canonical query for all 5 batch-14 SECDEF RPCs (add_to_enrolment_waitlist + convert_lead + convert_waitlist_to_student + respond_to_enrolment_offer + withdraw_from_enrolment_waitlist) + migration touch chain enumeration (4 migrations enumerated). No body-vs-migration drift surfaced.

Drift #36 retroactively applied to F-02-015 closed-batch-02 body re-verification at Phase 5.2 + §3.8.2; class-shape unchanged at HEAD confirmed.

Procedural promotion: drift #36 promotes from "NEW s52 mandate" to "standard Phase 2 procedure entering batch 15+". PLAN.md §3 update note.

### §11.H Drift #37 NEW s53 V2_PLAN.md verbatim cite mandate (origin documentation)

Ratified Phase 5.3c. Cat 1 reviewing-Claude origin.

Origin context: launching prompt §6.10 cited LESSONLOOP_V2_PLAN.md §3 HIDDEN classification for leads + enrolment-waitlist + booking-page + recurring-templates. CC's Phase 0 READ-FIRST ingestion of V2_PLAN.md §3 (L191-316) surfaced verbatim text contradiction:

V2_PLAN.md §3.2 L253-258 verbatim:
> "**UN-DEFERRED in s24 (now LAUNCH IN-SCOPE per §3.1):**
> - ~~Leads pipeline~~ — un-deferred; full launch coverage in s24.
> - ~~Enrolment waitlist~~ — un-deferred; full launch coverage in s24.
> - ~~Lead funnel chart~~ — un-deferred; full launch coverage in s24.
> - ~~Recurring billing templates~~ — un-deferred; full launch coverage in s24.
> - ~~Booking page~~ — un-deferred; full launch coverage in s24 (with rate-limit + honeypot contracts).
> - ..."

Only Zoom remains HIDDEN per V2_PLAN.md §3.2 L246 verbatim:
> "Zoom integration | **HIDDEN at v1** | **No full Zoom approval yet per Jamie** — pending Zoom verification review."

Audit-scope impact: ZERO. PLAN.md §3 rule 3 AUDIT SCOPE COMPLETENESS audits all surfaces regardless of v1 visibility. Class shape: analogous to drift #30 (CENSUS verbatim line cite mandate).

Operational rule: every launching-prompt section citing LESSONLOOP_V2_PLAN.md scope claims MUST include verbatim line cite from V2_PLAN.md (not paraphrase or memory citation).

Cumulative methodology entries: 37 → 38 (34 Cat 1 + 2 Cat 2 + 2 Cat 3).

### §11.I Pattern catalog adjudications

**Pack E useConvertLead → Pattern #43 NEW s53 PLACED single-anchor.** Class-shape sketch + 6-dim 5/6 DISTINCT + placement precedent (Pattern #40 + #41 single-anchor) + future-anchor probability HIGH. See §3.2.4.

**_activity-sibling-table → POS-5 NEW s53 PLACED two-anchor.** Anchor pair: leads/lead_activities + enrolment_waitlist/enrolment_waitlist_activity. Stronger placement than POS-3 IMPLICIT s52 single-anchor-pair precedent. See §3.7.2.

**Routing-gate + RLS-as-SoT → CC-19 #4 sub-shape "ARCHITECTURAL N/A" NEW s53 (sub-class introduction).** NOT a fresh POS slot. Single-batch-anchor; defer batch-19 sweep for cross-codebase verification of placement. See §7.1.

**Sub-A / Sub-D2 unification → no slot change; editorial deferred to post-Phase-B per Adjudication 9 + 24 convention.** Ledger updates at PLAN.md (Sub-A +22, Sub-E +0 POSITIVE, Sub-D2 +23). See §7.3.

**Pattern #41 dual-anchor strengthening → no slot change; PLAN.md §4.1 note "F-12-003 single-anchor PLACED → s53 dual-anchor PLACED with F-14-001".** Per s47+ refinement (placement-precedent invariance). See §3.1.

### §11.J Severity-adjustment events at s53

**0 events.** All 7 F-14-NNN pre-tags are within-bracket class-precedent applications per §18 principles:
- F-14-001 HIGH per F-12-003 same-bracket pre-tag confirmation (6/6 MATCH)
- F-14-002 HIGH per F-11-003 operational-correctness CAPS chain + F-05-005 distinguishability
- F-14-003 LOW per F-09-002 + F-10-008 + F-11-002 CC-19 #1 hygiene cohort
- F-14-004 LOW per F-06-006 + F-07-005 CC-19 #15 cohort
- F-14-005 LOW per F-01-017 cluster header + F-13-002 cohort precedent
- F-14-006 LOW per F-07-006/007 + F-09-012 + F-10-004 + F-13-004 CC-19 #11 chain
- F-14-007 LOW per F-02-010 class header + F-13-003 cohort precedent

Cumulative severity-adjustment events: **14 unchanged**.

### §11.K Phase 0 push hygiene check operational at s53 (PLAN.md §3 rule 7 third application)

PLAN.md §3 rule 7 third application. CC Phase 0 detected HEAD == c80c664a but origin/main == f1e8cf41 (s51 close pin) — divergence direction: LOCAL 1 commit AHEAD of remote. The s52 close commit `c80c664a` had not been pushed.

Reviewing-Claude Phase 1 §A authorized push-hygiene normalization. Pre-push verification: working tree clean + HEAD = c80c664a + exactly 1 commit ahead + file diff scope audit-doc-scope only (HANDOVER.md + audit/sweep/*). Post-push: HEAD == origin/main == c80c664a.

Workflow rule operates correctly for s54+ continuation.

### §11.L Drift #36 first operational application — operational evidence summary

- 5 SECDEF RPCs body-fetched via live-DB SELECT prosrc (Phase 2.1)
- 4 migrations enumerated for cumulative touch chain (Phase 2.1)
- AUTH-H5 cohort cross-check definitive (none of 5 in cohort; Pack A REJECTED with D1 substrate dispositive)
- F-02-015 closed-batch-02 body re-verified via live-DB SELECT prosrc (Phase 5.2; class-shape unchanged at HEAD)
- Operational precedent ratified; drift #36 promotes to standard Phase 2 procedure entering batch 15+

---

*End of `audit/sweep/findings/14-bookings-leads-enrolment.md`. Status flips from In Progress → Complete at Phase 10 commit.*
