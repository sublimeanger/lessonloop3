# Findings — Batch 18: Settings Tabs

Session: **s57** (2026-05-18) — Phase B systematic audit; batch 18 of 21.
HEAD at close: **`fed324dc`** (post-s56-drift-#32-cleanup commit; canonical SHA pointer at STATUS.md L77 + HANDOVER.md L32 updated Phase 8 per drift #39 sub-class editorial pre-authorization from prior stale `109b9cc7`).
Audit-only mode (no code touched outside `audit/sweep/` + `HANDOVER.md`).

---

## §1 Summary

### 1.1 Batch context

Batch 18 covers the Settings IA surface and the Help page per PLAN.md §5 verbatim: "All 24 settings tabs (per V2 plan §5 PR3 — pre-IA-pass). Each tab's functionality + data wiring + RLS reachability (PI-10 lives here)."

Live IA per CENSUS §8.6: **21 live nav entries + 3 nested components (24 components total)** organised in 5 logical section groups (Account / Organisation / Teaching / Business / Compliance). The s39 prompt expected 24 per V2 plan §5 PR3 pre-IA-pass framing; live IA has collapsed three into sub-components.

### 1.2 Audit basis statement — Zoom carve-out

Per PLAN.md §3 rule 3 AUDIT SCOPE COMPLETENESS:

> "Zoom-specific surface (`zoom-oauth-callback` / `zoom-oauth-start` / `zoom-sync-lesson` edge fns; `ZoomOAuthCallback.tsx`; `ZoomIntegrationTab`; `ZoomGuide` marketing page) is deferred pending external Zoom authorization/verification — out of audit scope for THIS batch ONLY, NOT shelved. All non-Zoom surface in this batch is audited fully."

LESSONLOOP_V2_PLAN.md §3.2 L246 verbatim (drift #37 OPERATIONAL CARRY 5th operational application; filesystem-verified at composition):

> "| Zoom integration | **HIDDEN at v1** | **No full Zoom approval yet per Jamie** — pending Zoom verification review. Lights up once Zoom approval lands. The 3 Zoom edge fns (zoom-oauth-start, zoom-oauth-callback, zoom-sync-lesson) stay 🟡 in audit/MASTER.md. |"

`ZoomIntegrationTab.tsx` (170L) is the only batch-18 surface affected by the carve-out; audited at filesystem-walk only (Phase 1 §1.A line count + FeatureGate wrap observed). All other batch-18 components (20 non-Zoom tabs + 3 nested + 2 pages + 4 hooks) audited fully.

### 1.3 Allocation

| Severity | Fresh F-18-NNN | IDs |
|---|---|---|
| Critical | 0 | — |
| **High** | **1** | F-18-001 |
| Medium | 0 | — |
| **Low** | **3** | F-18-002, F-18-003, F-18-004 |
| **Total fresh** | **4** | — |

Plus:
- 8 closed-batch citation entries (no F-18-NNN allocation per drift #30.A 9th cumulative manifestation pre-emption)
- 7 POSITIVE pattern observations (§5)
- 3 sub-class introductions (Phase 7 RATIFIED; documentation-only per s47+ placement-slot invariance): F-04-002 sub-class introduction (consumer-substrate-trust-misalignment) + CC-19 #4 INLINE-DOMINANT sub-shape + F-04-001 operator-side-Sentry-mitigated sub-shape variant

### 1.4 Pre/post tally (Framing A; per Phase 5 §5.J 4-cross-verify)

| Metric | Entering s57 | Exit s57 | Delta |
|---|---|---|---|
| Grand active findings | 191 (20C/52H/28M/91L) | **194 (20C/52H/28M/94L)** | +0C / 0H / 0M / +3L net (1H fresh − 1H PI closure) |
| PI cohort active+partial | 3 (0C/2H/1M/0L) | **2 (0C/1H/1M/0L)** | −1 (PI-10 RESOLVED-PARTIAL-ZOOM-DEFERRED) |
| Cumulative events | 16 | **16 unchanged** | 0 (ZERO event #17 candidates per Phase 5.D probe) |
| Cumulative methodology entries | 42 (36 Cat 1 + 2 Cat 2 + 4 Cat 3) | **42 unchanged** | 0 (both s57 drift ratifications sub-instances under existing entries) |
| Pattern catalog PLACED | 38 | **38 unchanged** | 0 |
| Pattern catalog candidates | 6 | **6 unchanged** | 0 |
| Pattern catalog sub-class introductions | 8 | **11** | +3 |
| NEGATIVE-instance flag | 1 | **1 unchanged** | 0 |
| Drift #30.A manifestations | 8 | **9** | +1 |
| Drift #36 STANDARD PROCEDURE applications | 3 | **4** | +1 |
| Drift #38 4-part attestation (per-batch PASS) | 18/18 s56 high-water | **6/6 batch-18 PASS** + s56 high-water preserved | +6 per-batch |

### 1.5 Path Y phase

Phase B systematic audit; **batch 18 of 21**. Remaining: batch 19 (cross-cutting) + batch 20 (ux-flows) + batch 21 (marketing-surface).

### 1.6 Scope IN/OUT (per launching prompt §7)

**IN-SCOPE**:
- 21 live SettingsNav tabs (20 audited + 1 ZoomIntegrationTab carve-out)
- 3 nested non-nav components: InvoiceSettingsTab + RecurringBillingTab + CalendarSyncHealth
- 5 non-tab support components: SettingsLayout + SettingsNav + InviteMemberDialog + PendingInvitesList + TermManagementCard
- 2 pages: Settings.tsx + Help.tsx
- 4 hooks tagged 18: useFirstRunExperience + useProactiveAlerts + useUrgentActions + useAuditLog
- 1 widget: FirstRunExperience (CENSUS L241 batch-18-consumer-attributed)
- recurring-billing/ subdir 4 files (RecurringFailuresBanner + TermModeField + ItemsField + RecipientsField; consumer-only of RecurringBillingTab + RecurringTemplateDetail batch-05 surface)
- RecurringBillingTab orphan determination (CC-19 #15 sub-shape evaluation)
- PI-10 consumer-side adjudication (AccountingTab silent-zero-rows UX)
- push_tokens consumer-attribution-migration-candidate (PLAN.md L117 framing)
- Cross-batch helper SECDEF re-verification per drift #36 STANDARD PROCEDURE

**OUT-OF-SCOPE**:
- ZoomIntegrationTab settings tab + zoom-* edge fns (per §1.2 audit basis statement)
- Closed-batch surfaces (findings/01-17 READ-ONLY citations only per PLAN.md §6 closed-batch immutability)
- Fix work / migrations / edge fn deploys / config changes (discipline contract per Phase B rules)

---

## §2 Surface inventory

### 2.1 Components (29 files in src/components/settings/ + 4 in recurring-billing/ subdir; ~11,075 lines)

Per Phase 1 §1.A 26-row matrix (verbatim filesystem-verified at composition):

**Account group (3 tabs):**
| Tab value | Component | Lines | adminOnly |
|---|---|---|---|
| `profile` | ProfileTab.tsx | 552 | — |
| `notifications` | NotificationsTab.tsx | 182 | — |
| `help-tours` | HelpToursTab.tsx | 71 | — |

**Organisation group (4 tabs):**
| Tab value | Component | Lines | adminOnly |
|---|---|---|---|
| `organisation` | OrganisationTab.tsx | 414 | ✓ |
| `branding` | BrandingTab.tsx | 673 | ✓ |
| `members` | OrgMembersTab.tsx | 177 | ✓ |
| `data-import` | DataImportTab.tsx | 104 | ✓ |

**Teaching group (5 tabs):**
| Tab value | Component | Lines | adminOnly |
|---|---|---|---|
| `scheduling` | SchedulingSettingsTab.tsx | 951 | ✓ |
| `availability` | TeacherAvailabilityTab.tsx (via AvailabilityTabWithSelector wrapper) | 561 | — (teaching role) |
| `calendar` | CalendarIntegrationsTab.tsx | 405 | — |
| `zoom` | ZoomIntegrationTab.tsx | 170 | — **(OUT-SCOPE Zoom carve-out)** |
| `music` | MusicSettingsTab.tsx | 340 | ✓ |

**Business group (7 tabs):**
| Tab value | Component | Lines | adminOnly |
|---|---|---|---|
| `billing` | BillingTab.tsx (+ inline InvoiceSettingsTab nested) | 1292 | ✓ |
| `rate-cards` | RateCardsTab.tsx | 322 | ✓ |
| `messaging` | MessagingSettingsTab.tsx | 225 | ✓ |
| `booking-page` | BookingPageTab.tsx | 573 | ✓ |
| `loopassist` | LoopAssistPreferencesTab.tsx | 194 | ✓ |
| `continuation` | ContinuationSettingsTab.tsx | 174 | ✓ |
| `accounting` | AccountingTab.tsx | 412 | ✓ |

**Compliance group (2 tabs):**
| Tab value | Component | Lines | adminOnly |
|---|---|---|---|
| `privacy` | PrivacyTab.tsx | 347 | ✓ |
| `audit` | AuditLogTab.tsx | 267 | ✓ |

**Nested (3; rendered under parent tabs):**
- InvoiceSettingsTab.tsx (514L; rendered inline by BillingTab)
- RecurringBillingTab.tsx (442L; **NOT** referenced from SettingsNav; reachable via Invoices.tsx:29+429 batch-05 surface — orphan flag REFUTED at Phase 1 §1.B per CENSUS L983 question resolution)
- CalendarSyncHealth.tsx (163L; embedded in CalendarIntegrationsTab)

**Non-tab support (5):**
- SettingsLayout.tsx (75L) — layout shell + dispatcher
- SettingsNav.tsx (237L) — canonical adminOnly visibility model + SettingsSidebar + SettingsMobileNav
- InviteMemberDialog.tsx (170L) — OrgMembersTab consumer
- PendingInvitesList.tsx (208L) — OrgMembersTab consumer
- TermManagementCard.tsx (381L) — SchedulingSettingsTab consumer

**recurring-billing/ subdir (4; entire subdir batch-05 consumer surface):**
- RecurringFailuresBanner.tsx (71L)
- TermModeField.tsx (104L)
- ItemsField.tsx (114L)
- RecipientsField.tsx (190L)

### 2.2 Pages (2)

| File | Lines | Purpose | Audience |
|---|---|---|---|
| `src/pages/Settings.tsx` | 172 | URL-routed `?tab=` dispatcher; 22 imports; 15-tab `adminTabs` array L132 + silent-redirect L137 (`!isOrgAdmin && adminTabs.includes(rawTab) ? 'profile' : rawTab`) | owner/admin/finance/teacher |
| `src/pages/Help.tsx` | 205 | Static helpArticles browser; ZERO DB calls; LoopAssist drawer integration via useLoopAssistUI | (any auth'd) |

### 2.3 Hooks tagged 18 (4)

Per CENSUS §9 verbatim L1019 + L1194-1195 + L1200:

| File | Lines | Purpose | Direct supabase calls |
|---|---|---|---|
| `useFirstRunExperience.ts` | 331 | First-run tour orchestration | 1 (profiles UPDATE L310-318 owner-row) |
| `useProactiveAlerts.ts` | 188 | Proactive alert composition | 5 (lessons + make_up_waitlist + attendance_records ×2 + practice_streaks) |
| `useUrgentActions.ts` | 229 | Urgent action surfacing | 8 (teachers + invoices ×2 + message_requests + term_continuation_responses + invoice_installments + practice_logs + student_teacher_assignments) + 1 RPC (`get_unmarked_lesson_count`) |
| `useAuditLog.ts` | 212 | Audit log read | 2 (audit_log + profiles actor-lookup) |

### 2.4 FirstRunExperience widget (batch-18 consumer-attributed per CENSUS L241)

`src/components/dashboard/FirstRunExperience.tsx:36` — consumer of useFirstRunExperience hook; rendered by Dashboard.tsx L170 + L291; also consumed by OnboardingChecklist (src/components/shared/) L118. ZERO direct supabase calls.

### 2.5 Cross-batch helper SECDEFs reached (3; drift #36 STANDARD PROCEDURE 4th application Phase 2 §2.A)

| RPC | Owning batch | secdef | anon EXEC | Consumer | Phase 2 verdict |
|---|---|---|---|---|---|
| `get_org_calendar_health(p_org_id uuid)` | 15-calendar-sync-zoom-xero (CENSUS L575+; F-15-006 anchor closed) | TRUE | TRUE | CalendarSyncHealth.tsx:50 | **ZERO body drift** vs F-15-006 anchor cite "is_org_admin(auth.uid(), p_org_id) in WHERE ✓" |
| `get_unmarked_lesson_count(_org_id uuid, _teacher_id uuid)` | 08-attendance-credits-waitlists (CENSUS L575) | TRUE | TRUE | useUrgentActions.ts:47 | HEAD body-state captured per refinement (no precise body-state anchor cite in findings/08 — "10 cross-batch reach SECDEF RPCs observed Phase 2 §B ... closed-batch immutable; body-integrity observation only"); **F-18-002 LOW allocated** under F-02-034 class extension |
| `reassign_teacher_conversations_to_owner(_org_id uuid)` | 12-messages-notifications (CENSUS L624) | TRUE | TRUE | MessagingSettingsTab.tsx:68 | HEAD body-state captured per refinement (no precise body-state anchor cite in findings/12 — "SECDEF RPCs IN-12: reassign_teacher_conversations_to_owner — audited Phase 1 not surfaced as fresh finding"); STRONG body-gate `IF NOT is_org_admin(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'` at HEAD |

### 2.6 Cross-batch edge fns reached (6; Phase 2 §2.B + §2.C)

| Edge fn | Owning batch | Consumer | Class-shape consistency |
|---|---|---|---|
| `xero-oauth-start` | 15-calendar-sync-zoom-xero (F-15-001 anchor) | AccountingTab.tsx:35+198 | F-15-001 chain consumer-side POSITIVE (caller passes orgId from authenticated org context) |
| `xero-disconnect` | 15-calendar-sync-zoom-xero (findings/15 §3.20 observation) | AccountingTab.tsx:125 | Closed-batch §3.20 observation framing; not class-precedent |
| `xero-sync-invoice` | 15-calendar-sync-zoom-xero (F-15-001 chain) | AccountingTab.tsx:170 | F-15-001 chain consumer-side POSITIVE |
| `stripe-billing-history` | 06-payments-stripe-connect (CENSUS L323; findings/06 §1.3 20-edge-fn inventory) | BillingTab.tsx:1004 | POSITIVE consumer-side (wrapEdgeFn + Authorization + role check L11-16) |
| `send-invite-email` | 02-org-management (F-02-017 + F-02-018 anchors) | InviteMemberDialog.tsx:100 + PendingInvitesList.tsx:87 | Consumer-side observation only; F-02-017/018 body-defect class closed-batch immutable |
| `stripe-subscription-checkout` | 16-subscription-tiers (findings/16 §3.14 Pattern #41 NEGATIVE counter-example anchor) | useSubscriptionCheckout → BillingTab consumer | POSITIVE consumer-side (preserves Pattern #41 NEGATIVE class-shape; caller does NOT supply identity) |

### 2.7 Tables touched (all owned by other batches; ZERO batch-18 OWNED)

Per Phase 1 §1.F: settings tabs + 4 hooks touch tables owned by closed batches 01/02/03/05/07/08/09/12/13/15 + cross-cutting batch-19 (audit_log). **ZERO batch-18 primary-write tables** identified.

`push_tokens` consumer-attribution-migration-candidate (PLAN.md L117): primary-write at `src/services/pushNotifications.ts:38` (platform-services layer); send-push edge fn consumer (batch-12 closed F-12-003 Pattern #41 anchor); default-attribution batch-18 carries unchanged at s57 (5-table consumer-attribution-migration-candidate list preserved).

`cancellation_feedback` table consumer-only at BillingTab.tsx:1139 (`.from('cancellation_feedback').insert(...)`; best-effort silent-swallow per L1144 "Non-blocking"). Table absent from CENSUS or finding docs — editorial CENSUS gap; batch-16 implicit-attribution candidate per consumer surface; defer to post-Phase-B editorial workstream per PLAN.md L117 (see §8 + §11.N).

---

## §3 Findings detail

### §3.1 F-18-001 HIGH — F-04-002 sub-class B introduction (consumer-substrate-trust-misalignment; capability-loss direction)

| Field | Value |
|---|---|
| **ID** | F-18-001 |
| **Severity** | **HIGH** (operational-correctness CAPS-at-HIGH per F-03-004 + F-05-005 chain; feature-broken-for-100%-of-affected-orgs magnitude factor; bounded-impact modulator applied — pre-launch; 0 paying customers; all DB rows test data; PI-10 PARTIAL since s54 with no production exploitation because no production) |
| **Area** | Settings consumer-side substrate-trust misalignment / FE-direct anon SELECT on zero-policies-RLS table |
| **Phase surfaced** | Phase 3 (Task 3.B 6-dim adjudication on 5 candidates; sub-class introduction RATIFIED at Phase 7) |
| **Class anchor (drift #38 4-part attestation)** | **F-04-002** — finding-ID verbatim; severity verbatim "Severity: High" (findings/04 §3.2 body); class-shape verbatim "`lesson_notes.teacher_private_notes` exposed via parent-context RLS with no column-level filter; column-level-privacy-bypass (NEW class, 2 anchors); regression-class framing: server-side fix defeated by consumer ships with direct `.from()` query"; batch attribution verbatim **04-lessons-scheduling-deep (closed)** |
| **Sub-class** | **Sub-shape B introduction NEW s57** — "reads FAIL-CLOSED bypassing access intent" (capability-loss UX); class-DISTINCT from F-04-002 anchor sub-shape A "reads SUCCEED bypassing privacy intent" (privacy-of-record leakage); shared root cause: FE consumer uses wrong client choice (anon vs authenticated-with-token vs server-side SECDEF accessor) for substrate that requires the other; opposite consequence directions of same root design fault |

#### 3.1.1 Evidence — substrate DB-verified (Phase 1 §1.F + Phase 2 §2.B)

Live-DB state via `mcp__supabase__execute_sql` at HEAD `fed324dc`:

```sql
SELECT schemaname, tablename, rowsecurity FROM pg_tables
  WHERE schemaname='public' AND tablename IN ('xero_connections','xero_entity_mappings');
-- [{"schemaname":"public","tablename":"xero_connections","rowsecurity":true},
--  {"schemaname":"public","tablename":"xero_entity_mappings","rowsecurity":true}]

SELECT * FROM pg_policies WHERE tablename IN ('xero_connections','xero_entity_mappings');
-- []  (ZERO policies)

SELECT 'xero_connections' AS t, COUNT(*) AS rows FROM public.xero_connections
  UNION ALL SELECT 'xero_entity_mappings', COUNT(*) FROM public.xero_entity_mappings;
-- [{"t":"xero_connections","rows":2},{"t":"xero_entity_mappings","rows":2}]
```

**Substrate confirmation**: rowsecurity=true + 0 policies + 2 real rows per table. Per F-15-005 closure framing (findings/15 §3.5 HIGH): "POSITIVE architectural counter-example formalized at findings/15 §5" — zero-policies is INTENTIONAL defense-in-depth design; consumer-side reads via anon client RETURN ZERO ROWS for all callers regardless of substrate state.

#### 3.1.2 Evidence — consumer-side call sites (AccountingTab.tsx)

**Mount + OAuth callback effect** (L345-363):
```typescript
export function AccountingTab() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('xero_connected') === 'true') {
      toast.success('Xero connected successfully');
      searchParams.delete('xero_connected');
      setSearchParams(searchParams, { replace: true });
    }
    // ...
  }, []);
```

**Initial query — FE-direct anon SELECT** (L365-377):
```typescript
const { data: connection, isLoading } = useQuery({
  queryKey: ['xero-connection', orgId],
  queryFn: async () => {
    if (!orgId) return null;
    const { data } = await supabase
      .from('xero_connections')
      .select('id, org_id, tenant_name, last_sync_at, auto_sync_invoices, auto_sync_payments, sync_status, error_message')
      .eq('org_id', orgId)
      .maybeSingle();
    return data;
  },
  enabled: !!orgId,
});
```

Imported `supabase` at L4: `import { supabase } from '@/integrations/supabase/client';` — **shared anon client**. Substrate fail-closes anon SELECT → `connection = null` for ALL callers regardless of substrate state.

**Sync-stats query — same pattern** (L379-395):
```typescript
const { data: syncStats = {} } = useQuery({
  queryKey: ['xero-sync-stats', orgId],
  queryFn: async () => {
    if (!orgId) return {};
    const { data } = await supabase
      .from('xero_entity_mappings')
      .select('entity_type')
      .eq('org_id', orgId);
    // ...
  },
  enabled: !!orgId && !!connection,  // defensive — only enabled if connection exists
});
```

**Render branch** (L397-409):
```typescript
if (isLoading) return <div>...Loader2...</div>;
if (!orgId) return null;
if (connection) {
  return <ConnectedState connection={connection} syncStats={syncStats} />;  // NEVER reached
}
return <DisconnectedState orgId={orgId} />;  // ALWAYS reached for all orgs
```

**Additional fail-closed call sites within ConnectedState** (never reached but documented for completeness):
- L108-113 `updateToggle`: `supabase.from('xero_connections').update(patch).eq('id', connection.id)` via anon — would fail-silently (0 rows affected; no error reported) if reached
- L144-148 `handleSyncAll` reads `xero_entity_mappings` via anon — would return empty Set
- L152-155 `handleSyncAll` reads `invoices` via anon — would work (invoices has RLS policies)

#### 3.1.3 UX path trace (Phase 2 §2.B 8-step trace; infinite OAuth loop)

1. **Mount**: useOrg() → orgId; useSearchParams() for OAuth callback URL params.
2. **OAuth callback effect**: If `xero_connected=true` → toast success + URL cleanup; if `xero_error=*` → toast error + URL cleanup.
3. **`useQuery['xero-connection']`**: anon SELECT on xero_connections → null (zero-policies).
4. **Substrate fail-closed** (DB-verified): rowsecurity=true, 0 policies → ALL anon SELECT returns null regardless of substrate state. Real DB has 2 rows; anon client sees 0.
5. **`useQuery['xero-sync-stats']`**: `enabled: !!orgId && !!connection` — defensive (only runs if connection exists, which it never does).
6. **Render branch**: `if (isLoading) → loader`; `if (!orgId) → null`; `if (connection) → ConnectedState` (never reached for any org); implicit else → DisconnectedState (always reached).
7. **DisconnectedState**: renders "Connect to Xero" CTA → invokes `xero-oauth-start` edge fn (works via service-role bypass at OAuth callback) → navigates to Xero OAuth flow.
8. **Outcome**: Org admin clicks Connect → OAuth completes → service-role inserts xero_connections row → returns to AccountingTab → `useQuery['xero-connection']` re-runs → anon SELECT returns null → DisconnectedState renders again → infinite loop.

#### 3.1.4 6-dim adjudication vs F-04-002 anchor (Phase 3 Task 3.B)

| Dim | F-04-002 anchor (sub-shape A) | F-18-001 candidate (sub-shape B) | Verdict |
|---|---|---|---|
| **D1 substrate identity** | lesson_notes table; server-side SECDEF RPCs (get_lesson_notes_for_staff + get_parent_lesson_notes) are design accessor; row-level RLS exists but lacks column-level filter | xero_connections + xero_entity_mappings; server-side edge fns (xero-oauth-callback service-role + xero-disconnect + xero-sync-*) are design accessor; row-level RLS exists with zero-policies (intentional defense-in-depth per F-15-005 POSITIVE) | **MATCH** — both have server-side SECDEF/edge fn accessor as design; consumer bypasses via direct `.from()` |
| **D2 reachability** | FE-direct `.from()` from authenticated staff context (`is_org_staff` predicate) | FE-direct `.from()` from authenticated org admin context (shared `supabase` anon client) | **MATCH** — both FE-direct from authenticated context |
| **D3 payload** | org-scoped data (lesson_notes.teacher_private_notes column) | org-scoped data (xero_connections rows + xero_entity_mappings rows) | **MATCH** |
| **D4 consequence direction** | Reads SUCCEED bypassing privacy intent → data LEAKS to consumer that shouldn't see column | Reads FAIL-CLOSED bypassing access intent → data INVISIBLE to legitimate consumer | **DIVERGE — opposite consequences** (sub-class introduction motivation) |
| **D5 mitigation** | Server-side SECDEF RPCs exist + correctly filter columns; client must adopt; anchor fix = GRANT revoke OR masked view OR WITH CHECK | Server-side edge fns exist for write paths only (xero-disconnect + xero-sync-*); read path lacks server-side accessor (no get_xero_connection_for_org SECDEF); anchor fix = create read-path server-side accessor OR add proper RLS policies allowing org admins to SELECT | **PARTIAL** — both have server-side accessors for some operations; F-04-002 covers all reads; F-18-001 lacks read accessor |
| **D6 composition** | Privacy-of-record exposure; bounded; no composition pathway elevating | Capability-loss UX defect; bounded; no composition pathway elevating (UI displays wrong state; doesn't enable adversary action) | **MATCH** — both bounded; zero composition escalation |

**Summary**: 4 MATCH + 1 PARTIAL + 1 DIVERGE = **4.5/6 strong structural match** → sub-class B introduction within F-04-002 class header RATIFIED.

#### 3.1.5 Composition probe (Phase 4 §G)

UPDATE-via-anon path (L108-113 `updateToggle`): never reached in current UX (ConnectedState never renders due to fail-closed initial query). If a future code change renders ConnectedState (e.g., new RLS policy lets admins SELECT but UPDATE still RLS-denied), UPDATE via anon on zero-policies-RLS would silently affect 0 rows → toast.success false-positive. **Latent composition risk** but not currently exploitable. **ZERO event #17 escalation candidate** per Phase 5.D probe.

#### 3.1.6 Cross-batch reach 4-part attestation (drift #38) — xero-* call sites

| Call site | Edge fn | Anchor finding-ID | Verbatim severity | Verbatim class-shape | Verbatim batch attribution |
|---|---|---|---|---|---|
| AccountingTab L35 + L198 | `xero-oauth-start` | F-15-001 | CRITICAL | "xero OAuth flow Pattern #41 state-poisoning + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection composition chain (event #15 NEW s54)" (findings/15 §3.1 heading verbatim) | 15-calendar-sync-zoom-xero (closed) |
| AccountingTab L125 | `xero-disconnect` | (no F-15-NNN; closed-batch §3.20 observation) | n/a | "xero-disconnect / xero_entity_mappings CASCADE re-creation operational concern" (findings/15 §3.20 verbatim) | 15-calendar-sync-zoom-xero (closed) |
| AccountingTab L170 | `xero-sync-invoice` | F-15-001 chain (downstream component) | CRITICAL (chain) | "xero-sync-* financial-routing-redirection composition chain" (findings/15 §3.1 chain framing verbatim) | 15-calendar-sync-zoom-xero (closed) |

**4-part attestation PASS count**: 2/3 explicit F-NN-NNN anchors with full 4-part cite (F-15-001 ×2 sites); xero-disconnect cites the §3.20 closed-batch observation framing without a fresh F-NN-NNN.

#### 3.1.7 Severity reasoning (PLAN.md §4 + class-consistency)

- Operational-correctness CAPS-at-HIGH chain (F-03-004 + F-05-005 + F-09-007 + F-10-001 + F-11-004 + F-12-001/F-12-002 + F-17-001 precedent) — dispositive cap
- Feature-broken-for-100%-of-affected-orgs magnitude factor (DB-verified 2 active xero_connections + zero-policies RLS confirmed)
- Bounded-impact modulator: 0 paying customers; all DB rows pre-launch test data; PI-10 PARTIAL since s54 with no production exploitation (because no production)
- F-04-002 anchor severity HIGH preserved (sub-class introduction preserves anchor severity; placement-slot invariance per s47+)

#### 3.1.8 Anchor fix surface (Phase C reference)

Two non-mutually-exclusive remediation directions:
- (a) **Read-path server-side SECDEF accessor** — create `get_xero_connection_for_org(p_org_id uuid)` SECDEF mirroring F-15-006 + F-15-006a pattern (body-guarded via `is_org_admin(auth.uid(), p_org_id)`; STABLE; anon EXEC revoked per CC-19 #1 hygiene); migrate AccountingTab consumer from `.from('xero_connections').select(...)` to `.rpc('get_xero_connection_for_org', { p_org_id: orgId })`. Symmetric for xero_entity_mappings.
- (b) **Proper RLS policies allowing org admins to SELECT** — add policies on xero_connections + xero_entity_mappings: `USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'))`. Substrate-level fix preserves FE-direct `.from()` pattern. Trade-off: substrate-level RLS removes intentional defense-in-depth design F-15-005 framing; weighs differently than (a).

Phase C tradeoff decision. NO fix work at Phase B (audit-only).

#### 3.1.9 Closure (open)

---

### §3.2 F-18-002 LOW — `get_unmarked_lesson_count` anon EXEC + no body-gate (F-02-034 class anchor extension)

| Field | Value |
|---|---|
| **ID** | F-18-002 |
| **Severity** | **LOW** (lowest amplification class — pure scalar enumeration of non-PII state per F-02-034 rationale; class-consistency CAP confirmed) |
| **Area** | Cross-batch helper SECDEF anon-EXEC info-leak / bounded-scalar enumeration |
| **Phase surfaced** | Phase 2 §2.A row 2 (drift #36 STANDARD PROCEDURE 4th application HEAD body-state capture); reviewing-Claude push-back at Phase 4 elevated from Option III closed-batch-08 citation only → Option II F-18-NNN fresh allocation under F-02-034 class extension |
| **Class anchor (drift #38 4-part attestation)** | **F-02-034** — finding-ID verbatim; severity verbatim "Severity: Low (class, 2 fns)" (findings/02); class-shape verbatim "is_org_active + is_org_write_allowed class — cross-tenant subscription-state boolean probing; lowest amplification class — pure boolean enumeration of non-PII state; no caller-context check; EXECUTE granted to authenticated + anon" (findings/02 verbatim); batch attribution verbatim **02-org-management (closed)** |

#### 3.2.1 Evidence — live-DB body verbatim (Phase 2 §2.A row 2)

`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_unmarked_lesson_count' AND prosecdef = TRUE;`:

```sql
CREATE OR REPLACE FUNCTION public.get_unmarked_lesson_count(_org_id uuid, _teacher_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT l.id)::integer
  FROM lessons l
  JOIN lesson_participants lp ON lp.lesson_id = l.id
  LEFT JOIN attendance_records ar
    ON ar.lesson_id = l.id AND ar.student_id = lp.student_id
  WHERE l.org_id = _org_id
    AND l.status = 'scheduled'
    AND l.end_at < NOW()
    AND l.end_at > NOW() - INTERVAL '30 days'
    AND ar.id IS NULL
    AND (_teacher_id IS NULL OR l.teacher_id = _teacher_id);
$function$
```

**NO body-level auth gate**. Only WHERE clause filter `l.org_id = _org_id` with no validation that `auth.uid()` has access to `_org_id`.

#### 3.2.2 Evidence — anon EXECUTE + migration touch (drift #29 + drift #40)

EXECUTE grants per `has_function_privilege()`:
- anon: TRUE
- authenticated: TRUE
- service_role: TRUE

Migration touch (filesystem-verified at composition per drift #40 OPERATIONAL CARRY):
- `supabase/migrations/20260330234226_add_get_unmarked_lesson_count_rpc.sql` — 1 migration touch (CREATE OR REPLACE)

Cross-check against AUTH-H5 mass REVOKE migration (Phase 3 §F.3):
- `supabase/migrations/20260401000000_auth_rls_hardening.sql` — DB-verified ABSENT from REVOKE list (`SELECT version, name, CASE WHEN statements::text ~* 'get_unmarked_lesson_count' THEN 'PRESENT' ELSE 'absent' END FROM supabase_migrations.schema_migrations WHERE version = '20260401000000';` → "absent")

**Mechanism distinct from F-13-001 META cohort** (REVOKE-incomplete from anon): get_unmarked_lesson_count is REVOKE-omitted-from-migration-entirely (different mechanism). Temporal ordering: fn created 2026-03-30 BEFORE AUTH-H5 migration 2026-04-01; AUTH-H5 author did not include this fn in REVOKE enumeration.

#### 3.2.3 Consumer site (batch-18 attribution)

`src/hooks/useUrgentActions.ts:47`:
```typescript
const { data: unmarkedCount } = await (supabase as any).rpc('get_unmarked_lesson_count', {
  _org_id: currentOrg.id,
  _teacher_id: teacherId || null,
});
```

Hook caller is authenticated (useUrgentActions wraps `useQuery` enabled by `!!currentOrg && !!user`). **Attack vector is NOT the batch-18 consumer** — attack vector is direct anon HTTP POST to RPC URL: `POST https://xmrhmxizpslhtkibqyfy.supabase.co/rest/v1/rpc/get_unmarked_lesson_count` with `Authorization: Bearer <anon_key>` + JSON body `{"_org_id": "<arbitrary uuid>"}` → returns integer count for any org.

#### 3.2.4 6-dim adjudication vs F-02-034 anchor

| Dim | F-02-034 anchor | F-18-002 candidate | Verdict |
|---|---|---|---|
| D1 substrate identity | SECDEF anon-EXEC no body-gate; returns boolean state | SECDEF anon-EXEC no body-gate; returns integer count scalar | MATCH (class extension to bounded scalar) |
| D2 reachability | anon-callable directly via REST API | anon-callable directly via REST API | MATCH |
| D3 payload | boolean (active/non-active subscription state) | integer (count of unmarked lessons per org; bounded by 30-day window + status='scheduled' filter) | MATCH — both bounded non-PII scalars |
| D4 consequence | Cross-tenant subscription-state enumeration | Cross-tenant operational-tempo enumeration (number of unmarked lessons indicates org activity level + staff diligence) | MATCH — info-leak bounded scalar class |
| D5 mitigation | Anchor fix: REVOKE EXECUTE FROM anon + body-gate add | Same anchor fix recommended | MATCH |
| D6 composition | Bounded; no composition | Bounded; no composition | MATCH |

**Summary**: 6/6 MATCH per Phase 4 push-back. Class extension to bounded-scalar (integer count vs boolean state). Severity LOW per lowest-amplification-class CAP.

#### 3.2.5 Severity reasoning + class-consistency

- F-02-034 anchor severity LOW preserved per class-consistency CAP
- Magnitude factor: 30-day window + status='scheduled' filter bounds returned count; not full enumeration of all lessons
- Mitigation framing per F-02-034 anchor fix: REVOKE EXECUTE FROM anon, authenticated; body fn calls `is_org_admin(auth.uid(), _org_id)` precondition. Cross-cutting class fix candidate at Phase C.

#### 3.2.6 Anchor fix surface (Phase C reference)

Per F-02-034 anchor fix model: `REVOKE EXECUTE ON FUNCTION public.get_unmarked_lesson_count(uuid, uuid) FROM anon;` + optional `REVOKE FROM authenticated` + add body-gate `IF NOT is_org_admin(auth.uid(), _org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;` at function entry. Cluster with batch-19 cross-cutting CC-19 #1 sweep (helper-fn EXECUTE-grant hygiene).

#### 3.2.7 Closure (open)

---

### §3.3 F-18-003 LOW — CC-19 #4 main class cohort enrichment + NEW INLINE-DOMINANT sub-shape introduction reference

| Field | Value |
|---|---|
| **ID** | F-18-003 |
| **Severity** | **LOW** (cohort-enrichment CAPS chain F-08-006/F-12-007/F-13/F-14/F-15 LOW precedent; F-09-009 outlier MEDIUM at original anchor allocation; sub-shape modulator one-axis-weaker; class-consistency CAP confirmed) |
| **Area** | useCan unimplementation cohort enrichment / FE-side defense-in-depth gap |
| **Phase surfaced** | Phase 1 §3 magnet + Phase 4 §B FINAL count |
| **Class anchor (drift #38 4-part attestation)** | **F-09-009** — finding-ID verbatim; severity verbatim "Severity: Medium" (STATUS.md L45 batch-09 row + findings/09 §4.8); class-shape verbatim "useCan unimplementation cohort 13 batch-09 mutation hooks; RLS load-bearing server-side; defence-in-depth class" (STATUS.md L45 verbatim); batch attribution verbatim **09-term-continuation (closed)** |
| **Sub-shape introduction** | **CC-19 #4 INLINE-DOMINANT sub-shape NEW s57** (Phase 7 §A.2 ratification; sub-class introduction #10; documentation-only per s47+ placement-slot invariance) — defining features: zero useCan + extensive inline `useOrg().{isOrgAdmin, isOrgOwner, currentRole}`; class-DISTINCT from main class (mixed useCan+inline oversight pattern) AND from ARCHITECTURAL N/A sub-shape s53 batch-14 origin + s56 batch-17 cohort 2 (zero useCan AND zero inline; server-side-gate-as-SSOT design) |

#### 3.3.1 Evidence — 46 inline role-check sites concentration

Per Phase 4 §A.2 enumeration (`grep -cE "isOrgAdmin|isOrgOwner|currentRole"`):

| Component | Inline site count |
|---|---|
| SettingsNav.tsx | 8 (canonical adminOnly visibility filter) |
| `src/pages/Settings.tsx` | 8 (adminTabs guard L132 + dispatcher) |
| LoopAssistPreferencesTab.tsx | 7 (heaviest per-component; admin-gated controls) |
| OrgMembersTab.tsx | 5 |
| SettingsLayout.tsx | 4 |
| BillingTab.tsx | 2 |
| BrandingTab.tsx | 2 |
| CalendarIntegrationsTab.tsx | 2 |
| InvoiceSettingsTab.tsx | 2 |
| OrganisationTab.tsx | 2 |
| PendingInvitesList.tsx | 2 |
| RecurringBillingTab.tsx | 2 |
| **TOTAL batch-18** | **46** |

Plus `useCan(` plain grep across `src/components/settings/*.tsx` + `src/pages/Settings.tsx` + `src/pages/Help.tsx` + 4 hooks tagged 18: **ZERO matches** (the one false-positive `useCancellationNoticeSetting` at SchedulingSettingsTab L10+L32 is a different hook starting with "useCan").

Cumulative CC-19 #4 main class:
- Entering s57: ≥218 per-usage (s53 close + s56 unchanged)
- Batch-18 contribution: **+46** sites
- Exit s57: **≥264** per-usage (+21%)

#### 3.3.2 6-dim adjudication vs F-09-009 anchor

| Dim | F-09-009 anchor | F-18-003 candidate | Verdict |
|---|---|---|---|
| D1 substrate identity | useCan abstraction available + 13 mutation hooks bypass it | useCan abstraction available + 46 settings sites bypass it | MATCH |
| D2 reachability | FE consumer surfaces (mutation hooks) | FE consumer surfaces (UI affordance gating + dispatcher) | MATCH |
| D3 payload | RLS-load-bearing-server-side; UI affordance gap | Same | MATCH |
| D4 consequence | Defense-in-depth gap; canonical RLS preserves correctness; useCan abstraction provides centralized policy lookup | INLINE-DOMINANT variant: defense-in-depth-via-different-primitive (`useOrg().{isOrgAdmin, isOrgOwner, currentRole}`); class-DISTINCT defining feature | PARTIAL — sub-shape pattern |
| D5 mitigation | Anchor fix: migrate 13 hooks to useCan() | Anchor fix: migrate 46 sites to useCan() per same model | MATCH |
| D6 composition | Bounded; no composition | Bounded; no composition | MATCH |

**Summary**: 5/6 MATCH + 1 PARTIAL (D4 sub-shape pattern INLINE-DOMINANT). Severity LOW per cohort-enrichment CAPS chain.

#### 3.3.3 Sub-shape introduction reference

See §10 + §11 for Phase 7 §A.2 sub-class introduction #10 RATIFIED text block (CC-19 #4 INLINE-DOMINANT sub-shape; single-anchor batch-18; placement-slot invariance preserved per s47+).

#### 3.3.4 Anchor fix surface (Phase C reference)

Per F-09-009 anchor fix model: migrate inline `isOrgAdmin/isOrgOwner/currentRole` references to `useCan()` per-affordance policy lookup. Cluster with batch-19 cross-cutting CC-19 #4 sweep across cumulative ≥264 sites.

#### 3.3.5 Closure (open)

---

### §3.4 F-18-004 LOW — `useUrgentActions` catch-and-return-empty (F-04-001 cohort + operator-side-Sentry-mitigated sub-shape variant)

| Field | Value |
|---|---|
| **ID** | F-18-004 |
| **Severity** | **LOW** (Sentry-mitigation modulator one-axis-weaker than F-04-001 MEDIUM anchor; drift #35.A DiD-weaker observation modulator applied to consumer-side outcomes per s56 F-17-007 PERMISSIVE-DEFAULT precedent) |
| **Area** | Silent-query-error → empty-state masquerade / Sentry-mitigated variant |
| **Phase surfaced** | Phase 3 §A V23 vector + Phase 4 §D priority deep walk (6-dim adjudication 5/6 MATCH + 1 PARTIAL with Sentry-mitigation modulator dispositive) |
| **Class anchor (drift #38 4-part attestation)** | **F-04-001** — finding-ID verbatim; severity verbatim "Severity: Medium" (findings/04 §3.1 body); class-shape verbatim "useNotesExplorer + 5 cross-batch hooks destructure { data, isLoading } without error; silent-query-error → empty-state masquerade class-finding (6 surfaces)" (findings/04 §3.1 heading verbatim); batch attribution verbatim **04-lessons-scheduling-deep (closed)** |
| **Sub-shape variant** | **F-04-001 operator-side-Sentry-mitigated sub-shape variant NEW s57** (Phase 7 §A.3 ratification; sub-class introduction #11; documentation-only per s47+ placement-slot invariance) — defining feature: operator-side Sentry log via `logger.error(...)` catch handler; user-side empty-state masquerade preserved; one-axis-weaker than F-04-001 anchor zero-defensive-layers per drift #35.A DiD-weaker observation modulator |

#### 3.4.1 Evidence — call site verbatim

`src/hooks/useUrgentActions.ts:213-216`:
```typescript
      } catch (error) {
        logger.error('Error fetching urgent actions:', error);
        return [];
      }
```

Wraps a 7-query try block at L33-212 (queries: `get_unmarked_lesson_count` RPC + 2× invoices SELECT [overdue + past-due] + message_requests + term_continuation_responses + invoice_installments + practice_logs + student_teacher_assignments). Per Phase 4 §D walk: ANY single query failure in the block → catch fires → empty array returned → UrgentActionsBar dashboard widget renders no badge.

#### 3.4.2 6-dim adjudication vs F-04-001 anchor

| Dim | F-04-001 anchor | F-18-004 candidate | Verdict |
|---|---|---|---|
| D1 substrate | Silent query error → empty-state UI; no error binding in TanStack destructure | 7-query try block catches ANY error → returns [] | MATCH (silent-query-error class) |
| D2 reachability | 6 cross-batch surfaces | useUrgentActions consumed by UrgentActionsBar (CENSUS L241 batch-02 attribution; dashboard widget) | MATCH (cross-batch consumer) |
| D3 payload | Empty-state UI ("No notes yet" indistinguishable from successful zero-row read) | Empty-state UI (badge invisibility / no urgent actions shown) | MATCH |
| D4 consequence | User can't distinguish "no data" from "query failed" | Admin can't distinguish "no urgent actions" from "queries broken" | MATCH |
| D5 mitigation | Anchor: zero defensive layers (no catch, no error state) | **PARTIAL — V23 has `logger.error → Sentry` operator-side mitigation; user-side still silent** | PARTIAL (Sentry-mitigation modulator) |
| D6 composition | Bounded; no composition | Bounded; no composition | MATCH |

**Summary**: 5/6 MATCH + 1 PARTIAL (D5 Sentry-mitigation modulator).

#### 3.4.3 Sub-shape variant introduction reference

See §10 + §11 for Phase 7 §A.3 sub-class introduction #11 RATIFIED text block (F-04-001 operator-side-Sentry-mitigated sub-shape variant; single-anchor batch-18 F-18-004; placement-slot invariance preserved per s47+).

#### 3.4.4 Anchor fix surface (Phase C reference)

Per F-04-001 anchor fix model: bind `error` to TanStack destructure + surface to UI (e.g., RecalcFailureBanner-style affordance OR error-state badge variant for UrgentActionsBar). Per-query catch handlers as alternative to wrapping all 7 queries in single try-catch (per-query catch limits blast radius to single query type). Cluster with batch-19 cross-cutting silent-query-error sweep.

#### 3.4.5 Closure (open)

---

## §4 Cross-batch citations (drift #30.A 9th cumulative manifestation evidence)

Per Phase 3 Task 3.G + Phase 5 §5.E canonical re-grep (manifestation count unchanged at 9 cumulative through s57):

| Component | Closed-batch cite | Citation type |
|---|---|---|
| CalendarIntegrationsTab | findings/15:935+1082 | Settings-UI batch-18 attribution observation framing |
| ZoomIntegrationTab | findings/02:39 + findings/15:935 | OUT-SCOPE Zoom carve-out per V2_PLAN §3.2 L246 |
| CalendarSyncHealth | findings/15:935+1020+1082 | F-15-006 LOW (CC-19 #1 hygiene anchor) for get_org_calendar_health body-guard observation; full 4-part PASS at Phase 2 §2.A |
| AccountingTab | findings/15:935+1082 (substrate); F-15-001 CRITICAL (xero-oauth-start consumer-reach; §3.1.6) | F-15-001 4-part PASS per Phase 2 §2.B |
| BillingTab | findings/16:38+185+329+334+336 | F-16-006 MEDIUM partial-recovery framing observation (settings-UI tier-display POSITIVE per findings/16 §3.7); no fresh class-precedent invoked |
| LoopAssistPreferencesTab | findings/17:99+572+955 | findings/17 §3.14 useFeatureGate('loop_assist') 2-consumer POSITIVE per s56 close; observation framing |
| ContinuationSettingsTab | findings/09:72+280 | findings/09 useTerms consumer + cross-batch 18-settings-tabs ZERO useCan observation |
| InviteMemberDialog + PendingInvitesList | findings/14:108+821 | invites table batch-02 closed-immutable primary-write per F-14 §3.10 observation; F-02-017 MEDIUM + F-02-018 MEDIUM anchors for send-invite-email body-defect class consumer-side observation only |

**Drift #30.A 9th cumulative manifestation RATIFIED** (mitigation operating as designed; pre-empted F-18-NNN over-allocation against 6 settings-tab components cited in closed-batch finding docs; Phase 5 canonical re-grep unchanged).

---

## §5 POSITIVE pattern observations (7 from Phase 7 §C)

### 5.1 3-layer admin gate defense-in-depth POSITIVE

`SettingsNav.tsx` SETTINGS_NAV_GROUPS adminOnly markers (15 of 21 nav entries flagged) + `Settings.tsx` L137 silent-redirect (`!isOrgAdmin && adminTabs.includes(rawTab) ? 'profile' : rawTab`; 15-tab adminTabs array L132) + RLS substrate SSOT canonical enforcement. Class-consistency with s50 Pattern #5/#31 three-layer defence-in-depth precedent (continuation-portal-confirm + bulk-process-continuation 5-layer DiD anchor); batch-18 cohort enrichment observation. No fresh allocation.

### 5.2 Hook-mediated supabase access discipline (Pattern #27 cohort enrichment POSITIVE)

16 of 24 settings components delegate via 25 distinct domain hooks (per Phase 1 §1.A enumeration). 8 components have direct `supabase.{from,rpc,functions.invoke}` calls (17 total sites per Phase 1 §1.D). Pattern #27 anchor s47 batch-08 (11/11 hook-mediated discipline) extended to batch-18 cohort.

### 5.3 useFeatureGate tier-gating 4 sites POSITIVE

CalendarIntegrationsTab L94+403 `feature="calendar_sync"` + ZoomIntegrationTab L51+168 `feature="calendar_sync"` + LoopAssistPreferencesTab L97+192 `feature="loop_assist"` + BillingTab L43 LimitReached. F-16-007 V2_PLAN-FE divergence class NEGATIVE counter-examples (tier-gating wired correctly at 4 settings sites with V2_PLAN-compliant feature flags).

### 5.4 useAuditLog throws on error POSITIVE

`src/hooks/useAuditLog.ts:67`: `if (error) throw error;` — NOT silent; throws to TanStack Query error binding. F-04-001 class POSITIVE counter-example (silent-query-error → empty-state masquerade class anchor 6 surfaces; useAuditLog is the discipline-positive instance in batch-18).

### 5.5 useAuditLog L178 Pattern #38 MAJOR↔MINOR formatting POSITIVE

`src/hooks/useAuditLog.ts:178`: `const amount = ((entry.after.amount_minor as number) || 0) / 100;` — proper MAJOR rendering from MINOR via explicit `/ 100` conversion at formatter boundary. Pattern #38 anchor s49 batch-10 (TeacherLink.tsx:213 + TeacherQuickView.tsx:215 + PaymentAnalyticsCard.tsx + ActiveDisputesCard.tsx:41 POSITIVE chain; usePayroll.ts:213 F-10-001 NEGATIVE anchor). useAuditLog L178 is batch-18 POSITIVE counter-example.

### 5.6 useProactiveAlerts fromZonedTime timezone discipline POSITIVE

`src/hooks/useProactiveAlerts.ts:28-30`: `fromZonedTime(startOfDay(now), tz).toISOString()` — proper org-timezone conversion using `date-fns-tz` (not naive UTC). F-09-007 PI-13 class POSITIVE counter-example (UTC-based time arithmetic ignoring org timezone class anchor at process-term-adjustment:735 setUTCHours; useProactiveAlerts discipline-positive instance preserves org-timezone semantics for cancellation/upcoming/missing-reason/churn-risk/practice-drop alert thresholds).

### 5.7 useProactiveAlerts L139 dismissalKey discipline (Pattern #28 cohort POSITIVE)

`src/hooks/useProactiveAlerts.ts:139`: `dismissalKey: \`churn_risk_${studentHash}\`` — stable hash-based dismissal key over at-risk student-ID set; same students → same key → stays dismissed; new student → new key → re-surfaces. Pattern #28 shadow-mode interception cohort s47 batch-08 cohort enrichment (semantic-stability discipline class).

---

## §6 Internal-trust + Pattern sweep results

Per Phase 4 §F:

| Pattern | Sweep result | Verdict |
|---|---|---|
| #28 shadow-mode interception | ZERO email-sending settings flows directly in batch-18 (send-invite-email is batch-02 closed) | N/A at batch-18 |
| #41 unvalidated identity | 4 NEGATIVE counter-examples preserved at AccountingTab xero-* sites (F-15-001 chain POSITIVE: consumer passes orgId from authenticated org context, not caller-supplied identity) + stripe-subscription-checkout consumer POSITIVE | +4 NEGATIVE counter-examples / cohort enrichment unchanged |
| #44 prompt-injection mitigation | LoopAssistPreferencesTab reaches looopassist-* edge fns (batch-17 closed immutable); consumer-side observation only — POSITIVE | +1 consumer-side observation POSITIVE |
| Internal-trust observation (s52 streak-notification sole anchor) | ZERO cron-secret-gated edge fn reach from batch-18 settings tabs | +0 from batch-18 |
| #42 registry-defined-but-uninvoked rate-limit | ZERO batch-18-owned edge fns; cross-batch reach edge fns audited at closing batches | N/A at batch-18 |

---

## §7 Capability matrix closures

**N/A at batch-18.** Per Phase 1 §5.8 + audit/feature-catalogues/ directory inspection: only `loopassist.md` exists in feature-catalogues; no `settings.md` catalogue. No capability matrix dependency for batch-18 closure.

---

## §8 Cross-batch observations (non-citation)

### 8.1 F-18-001 composition probe

Latent UPDATE-via-anon path at AccountingTab L108-113 `updateToggle.mutationFn`: `supabase.from('xero_connections').update(patch).eq('id', connection.id)` via anon. **Never reached in current UX** (ConnectedState never renders due to fail-closed initial query). If a future code change renders ConnectedState (e.g., new RLS policy lets admins SELECT but UPDATE still RLS-denied), UPDATE via anon on zero-policies-RLS would silently affect 0 rows → toast.success false-positive. Latent composition risk but not currently exploitable. **ZERO event #17 candidate** per Phase 5.D probe.

### 8.2 `cancellation_feedback` table CENSUS gap

BillingTab.tsx:1139 `.from('cancellation_feedback').insert({org_id, user_id, reason, details})` consumer site; table NOT in CENSUS or finding docs. Best-effort silent-swallow at L1144 ("Non-blocking — best effort"). Implicit-attribution candidate batch-16 (subscription cancel UX flow) per consumer surface. **Editorial post-Phase-B** per PLAN.md L117 consumer-attribution-migration-candidate framing; no fresh F-18-NNN. See §11.N.

### 8.3 RecurringBillingTab file-location-vs-consumer-attribution editorial observation

Lives in `src/components/settings/RecurringBillingTab.tsx` (442L) but consumed by `src/pages/Invoices.tsx:29+429` (batch-05 surface). Orphan flag REFUTED at Phase 1 §1.B per CENSUS L983 question resolution. **CC-19 #15 cohort unchanged** (5 anchors entering s57: F-06-006 + F-07-005 + F-14-004 + F-15-007 + 1 batch-15 generate_ical_token). File-location-vs-consumer-attribution editorial post-Phase-B; recurring-billing/ subdir 4 files (RecurringFailuresBanner + TermModeField + ItemsField + RecipientsField) are entirely batch-05 consumer surface. See §11.N.

### 8.4 push_tokens consumer-attribution-migration-candidate unchanged

Per PLAN.md L117 codification (s51 Phase 7 implicit-attribution convention; s52 Phase 1.3 reconfirmation): primary-write at `src/services/pushNotifications.ts:38` (FE platform-services layer); send-push edge fn consumer (batch-12 closed F-12-003 Pattern #41 anchor). 5-table consumer-attribution-migration-candidate list (message_batches + message_log + ai_messages + payment_notifications + push_tokens) preserved at s57. Editorial post-Phase-B.

---

## §9 PI register update

### 9.1 PI-10 closure transition (Framing A per Phase 3 §6.C + Phase 5 §5.J)

| Phase | Status | Resolution |
|---|---|---|
| Entering s57 | HIGH PARTIAL-HANDOVER s54 | Substrate addressed via F-15-003 + F-15-004 + F-15-005 at batch-15 close (s54); consumer side + Zoom carry remaining |
| Exit s57 | **RESOLVED-PARTIAL-ZOOM-DEFERRED** | Consumer side addressed via F-18-001 HIGH at batch-18 (s57); Zoom sub-surface external-dependency-gated outside Path Y; PI cohort active+partial 3 → 2 |

**Framing A rationale** (per Phase 5 §5.J): PI-10's audit-addressable portions are BOTH fully closed at s57 (substrate at s54 + consumer at s57). Zoom sub-surface is external-dependency-gated (pending Zoom OAuth approval) which is OUTSIDE Path Y audit control. PI-10 tagged RESOLVED-PARTIAL-ZOOM-DEFERRED with carry-forward note for post-Zoom-approval session.

**Carry-forward note**: Zoom sub-surface audit will execute when external Zoom authorization/verification lands; not a Path Y batch-19/20/21 sweep target; out-of-band session at post-Zoom-approval.

### 9.2 PI cohort entering s58

Active+partial: **2 (0C/1H/1M/0L)** — PI-09 HIGH (batch-19 cross-cutting; migration-replay safety) + PI-17 MEDIUM (batch-19 cross-cutting; timezone class). 15 RESOLVED tags (incl. PI-10 newly RESOLVED-PARTIAL-ZOOM-DEFERRED at s57).

---

## §10 CC-19 carry register delta + Pattern catalog

### 10.1 CC-19 carry register

16 active CC-19 carries (unchanged in count; cohort enrichments documentation-only per s47+ placement-slot invariance):

| Carry | Entering s57 | Exit s57 | Delta |
|---|---|---|---|
| #1 helper-fn EXECUTE-grant hygiene | ~15 | ~15 unchanged | 0 (batch-18 reaches batch-15 + batch-08 + batch-12 closed SECDEFs; closed-batch immutable; F-18-002 F-02-034 class extension allocation) |
| #3 audit_log INSERT integrity gap | enriched s54 ACTIVE-mixed | unchanged | 0 (no batch-18 owned tables) |
| #4 useCan unimplementation | ≥218 | **≥264 (+46)** | **+46 batch-18 sites concentrated in 11 settings components + Settings.tsx; INLINE-DOMINANT sub-shape introduction NEW (sub-class introduction #10; Phase 7 §A.2)** |
| #6 SECDEF body-guard variants | unchanged | unchanged | 0 |
| #7 Sub-A `as any` cast | ~416 | ~419 (+3) | +3 documentation-only (InvoiceSettingsTab L68 + MusicSettingsTab L67 + TermManagementCard L82) per cohort-enrichment-without-fresh-anchor convention |
| #7 Sub-D2 callback `: any` | ~25 | unchanged | 0 |
| #7 Sub-E catch-block `: any` | 41 | unchanged | 0 |
| #10 wrapEdgeFn Sentry | ~12 | unchanged | 0 (no batch-18 owned edge fns) |
| #11 column-CHECK-absent | 38 | unchanged | 0 (no batch-18 owned tables) |
| #13 PERMISSIVE-as-RESTRICTIVE | 6 bifurcated + 4 INERT | unchanged | 0 |
| #14 claimed-service-role-gate misnaming | 2 | unchanged | 0 |
| #15 dead-code SECDEF + orphan trigger fns | 5 | unchanged | 0 (RecurringBillingTab orphan REFUTED at Phase 1 §1.B; reachable via Invoices.tsx) |
| #16 rate-limit-key-mismatch | 3 (1 Sub-A + 2 Sub-B) | unchanged | 0 |
| F-01-017 UPDATE-no-WITH-CHECK | ≥35 main + 1 editorial B1 | unchanged | 0 (no batch-18 owned tables) |
| Pattern #41 PLACED | 4 per-flow | unchanged | 0 (+4 NEGATIVE counter-examples + 1 POSITIVE consumer observation at AccountingTab xero-* + stripe-subscription-checkout) |
| Pattern #42 candidate | 1 (F-12-008) | unchanged | 0 |

### 10.2 Pattern catalog post-s57

| Slot category | Entering s57 | Exit s57 | Delta |
|---|---|---|---|
| **PLACED slots** | 38 | **38 unchanged** | 0 |
| **Candidate slots** | 6 (#26 + #29 + #34 + #37 + #39 + #42) | **6 unchanged** | 0 |
| **Sub-class introductions** | 8 | **11** | **+3** (F-04-002 sub-class + CC-19 #4 INLINE-DOMINANT + F-04-001 Sentry-mitigated sub-shape variant) |
| **NEGATIVE-instance flag** | 1 (Pattern #27 sub-B PortalContinuation:71) | **1 unchanged** | 0 |

### 10.3 3 sub-class introductions NEW s57 (verbatim Phase 7 §A.1-§A.3 text)

#### 10.3.1 Sub-class introduction #9 — F-04-002 consumer-substrate-trust-misalignment

**s57 NEW Sub-class introduction #9 F-04-002 consumer-substrate-trust-misalignment** (RATIFIED Phase 7 s57 batch-18; class family: F-04-002 closed-batch-04 column-level-privacy-bypass; class-shape: "FE consumer uses wrong client choice (anon vs authenticated-with-token vs server-side SECDEF accessor) for substrate that requires the other; opposite consequence directions of same root design fault"; **Sub-shape A (anchor)**: F-04-002 batch-04 closed — "reads SUCCEED bypassing privacy intent" (privacy-of-record leakage; `usePreviousLessonNotes.ts:55-74` direct `.from('lesson_notes')` query defeats server-side SECDEF accessor `get_lesson_notes_for_staff`/`get_parent_lesson_notes` per migration `20260315100100_fix_lesson_notes_private_access.sql:1-8` documented intent); **Sub-shape B (NEW)**: F-18-001 batch-18 — "reads FAIL-CLOSED bypassing access intent" (capability-loss UX; `AccountingTab.tsx:369-374` `.from('xero_connections').select(...).maybeSingle()` + `:383-386` `.from('xero_entity_mappings').select('entity_type')` via shared `supabase` anon client on zero-policies-RLS substrate; admin orgs see "Connect to Xero" CTA permanently despite 2 real DB rows; F-15-005 POSITIVE substrate framing intentional defense-in-depth design); 6-dim adjudication 4 MATCH + 1 PARTIAL + 1 DIVERGE (D4 consequence direction = sub-class introduction motivation); placement-slot invariance per s47+ refinement preserved — F-04-002 main slot unchanged).

#### 10.3.2 Sub-class introduction #10 — CC-19 #4 INLINE-DOMINANT sub-shape

**s57 NEW Sub-class introduction #10 CC-19 #4 INLINE-DOMINANT sub-shape** (RATIFIED Phase 7 s57 batch-18; class family: CC-19 #4 main class useCan unimplementation cohort; cumulative ≥218 entering s57 → **≥264 exit** (+46 batch-18 contribution); class-shape: "Permissions enforced via extensive inline `useOrg().{isOrgAdmin, isOrgOwner, currentRole}` role-checks with ZERO useCan adoption; class-DISTINCT from CC-19 #4 main class oversight pattern (useCan adopted but missing per-site instances + inline used as fallback) AND from CC-19 #4 ARCHITECTURAL N/A sub-shape s53 batch-14 origin + s56 batch-17 cohort 2 (zero useCan AND zero inline; server-side-gate-as-SSOT design); INLINE-DOMINANT preserves UI-layer affordance gating but bypasses the useCan centralized policy lookup abstraction"; **single-anchor batch-18** = 46 sites concentrated across 11 settings components + Settings.tsx dispatcher; heaviest contributors: SettingsNav 8 (canonical adminOnly visibility filter) + Settings.tsx 8 (adminTabs guard L132 + dispatcher) + LoopAssistPreferencesTab 7 + OrgMembersTab 5 + SettingsLayout 4 + BillingTab 2 + BrandingTab 2 + CalendarIntegrationsTab 2 + InvoiceSettingsTab 2 + OrganisationTab 2 + PendingInvitesList 2 + RecurringBillingTab 2; placement precedent: Pattern #40 single-anchor s50 + Pattern #41 single-anchor s51 + Pattern #43 single-anchor s53 + Pattern #44 single-anchor s56 + CC-19 #4 ARCHITECTURAL N/A single-anchor s53).

#### 10.3.3 Sub-class introduction #11 — F-04-001 operator-side-Sentry-mitigated sub-shape variant

**s57 NEW Sub-class introduction #11 F-04-001 operator-side-Sentry-mitigated sub-shape variant** (RATIFIED Phase 7 s57 batch-18; class family: F-04-001 closed-batch-04 silent-query-error → empty-state masquerade class-finding 6 surfaces; class-shape variant: "operator-side Sentry log via `logger.error(...)` catch handler; user-side empty-state masquerade preserved; one-axis-weaker than F-04-001 anchor zero-defensive-layers per drift #35.A DiD-weaker observation modulator"; **single-anchor batch-18** = F-18-004 anchor `src/hooks/useUrgentActions.ts:213-215` catch-and-return-empty pattern wrapping a 7-query try block (L33-212); operator notified via Sentry; consumer (UrgentActionsBar dashboard widget; CENSUS L241 batch-02 attribution) renders empty badge invisible; user can't distinguish "no urgent actions" from "queries broken"; severity LOW per Sentry-mitigation modulator one-axis-weaker than F-04-001 MEDIUM anchor; placement-slot invariance preserved — F-04-001 main slot unchanged).

---

## §11 Audit-method appendix

### §11.A Pre-investigation methodology overview

s57 batch-18 audit follows 11-section Path Y prompt contract (PLAN.md §10) across 10 phases (Phase 0 → 1 → 2 → 3 → 4 → 5 → 7 → 6 → 8 → 9 → 10 per s47+ ordering refinement). Surface fully filesystem-walked + DB-state-verified via Supabase MCP execute_sql at HEAD `fed324dc`.

### §11.B Drift #30.A 9th cumulative operational manifestation

Per Phase 1 §1.H + Phase 5 §5.E unrestricted `audit/sweep/findings/*.md` grep caught 6 settings-tab components cited in closed-batch finding docs (CalendarIntegrationsTab + ZoomIntegrationTab + CalendarSyncHealth + AccountingTab + BillingTab + LoopAssistPreferencesTab + ContinuationSettingsTab + InviteMemberDialog + PendingInvitesList). Pre-empted F-18-NNN over-allocation per Pattern #10/#11 POSITIVE precedents. Mitigation rule operated correctly; same class as prior manifestations (s50 #1-#2 + s52 #3 + s53 #4 + s54 #5 + s55 #6-#7 + s56 #8 + s57 #9). Cumulative count: **8 → 9**.

### §11.C Drift #36 STANDARD PROCEDURE 4th operational application

Per Phase 2 §2.A: 3 cross-batch SECDEFs body-state captured via live-DB `pg_get_functiondef` + `supabase_migrations` regex on each. **1/3 explicit-anchor PASS** (get_org_calendar_health vs F-15-006 anchor cite "is_org_admin(auth.uid(), p_org_id) in WHERE ✓" — ZERO body drift). **2/3 HEAD body-state captures per refinement** (get_unmarked_lesson_count + reassign_teacher_conversations_to_owner; no precise body-state anchor cite in respective owning-batch finding docs; HEAD body-state captured for forward reference). Cumulative drift #36 applications: **4 (s54 + s55 + s56 + s57) with ZERO body drift on explicit-anchor-bearing cases**.

### §11.D Drift #36 STANDARD PROCEDURE refinement RATIFIED (sub-instance; no fresh drift # counter)

Per Phase 5 §5.H + Phase 7 §B.1: refinement language "When a closed-batch SECDEF lacks precise body-state anchor cite in its owning-batch finding doc (only 'audited Phase 1, not surfaced as fresh finding' or 'closed-batch immutable; body-integrity observation only' framing), drift #36 STANDARD PROCEDURE produces HEAD body-state capture for forward reference rather than binary drift verdict."

### §11.E Drift #37 OPERATIONAL CARRY 5th application

V2_PLAN.md §3.2 L246 verbatim cite filesystem-verified at Phase 0 READ-FIRST + Phase 6 doc-write §1.2 composition. 5th operational application complete with ZERO cite drift.

### §11.F Drift #38 4-part attestation 6/6 PASS per-batch

| Anchor | Citation context | Verbatim severity | Verbatim class-shape | Batch attribution | Verdict |
|---|---|---|---|---|---|
| F-04-002 | F-18-001 primary anchor | "Severity: High" (findings/04 §3.2) | "lesson_notes.teacher_private_notes exposed via parent-context RLS with no column-level filter; column-level-privacy-bypass (NEW class, 2 anchors); regression-class framing: server-side fix defeated by consumer ships with direct .from() query" | 04-lessons-scheduling-deep (closed) | **PASS** |
| F-02-034 | F-18-002 primary anchor | "Severity: Low (class, 2 fns)" (findings/02) | "is_org_active + is_org_write_allowed class — cross-tenant subscription-state boolean probing; lowest amplification class — pure boolean enumeration of non-PII state; no caller-context check; EXECUTE granted to authenticated + anon" | 02-org-management (closed) | **PASS** |
| F-09-009 | F-18-003 primary anchor | "Severity: Medium" (STATUS.md L45 batch-09 row + findings/09 §4.8) | "useCan unimplementation cohort 13 batch-09 mutation hooks; RLS load-bearing server-side; defence-in-depth class" | 09-term-continuation (closed) | **PASS** |
| F-04-001 | F-18-004 primary anchor | "Severity: Medium" (findings/04 §3.1) | "useNotesExplorer + 5 cross-batch hooks destructure { data, isLoading } without error; silent-query-error → empty-state masquerade class-finding (6 surfaces)" | 04-lessons-scheduling-deep (closed) | **PASS** |
| F-15-001 | AccountingTab L35+L198 + L170 cross-batch reach (×2 sites; §3.1.6) | "F-15-001 CRITICAL" (findings/15 §3.1 heading) | "xero OAuth flow Pattern #41 state-poisoning + UNIQUE(org_id) permanent-hijack + xero-sync-* financial-routing-redirection composition chain (event #15 NEW s54)" | 15-calendar-sync-zoom-xero (closed) | **PASS** |
| F-15-006 | CalendarSyncHealth L50 cross-batch reach (get_org_calendar_health body-guarded MATCH; §2.5) | "F-15-006 LOW" (findings/15 §3.6) | "CC-19 #1 helper-fn EXECUTE-grant hygiene cohort enrichment (get_org_calendar_health + get_org_sync_error_count body-guarded)" | 15-calendar-sync-zoom-xero (closed) | **PASS** |

**Drift #38 4-part attestation PASS count**: **6/6 class-precedent citations PASS** (100% per-batch target met; s56 18/18 cumulative high-water preserved as separate metric).

### §11.G Drift #39 sub-class introduction RATIFIED Option A (sub-class; no fresh drift # counter)

Per Phase 5 §5.I + Phase 7 §B.2: sub-class extension "After a Phase 10 cleanup amend-and-force-push, the substitution discipline must re-fire on the new SHA — canonical pointers at STATUS.md session log row + HANDOVER.md HEAD pin line must update to the post-cleanup SHA. Snapshot file remains UNCHANGED with literal placeholders retained per drift #32/#39 invariant."

**Cumulative sub-class manifestations**: 1 (s56 cleanup commit `fed324dc` force-pushed to origin/main; canonical SHA pointers at STATUS.md L77 + HANDOVER.md L32 remained stale at `109b9cc7` until s57 Phase 8 editorial update). Phase 8 editorial pre-authorized at s57: STATUS.md L77 + HANDOVER.md L32 update from `109b9cc7bbddb6ef04a94d1a180214dcada455bc` to `fed324dce822dd42687bea08ade58ffa5dca256b`; snapshot file `audit/sweep/handovers/reviewing-claude-s56-close.md` UNCHANGED.

Operational rule for future sessions: Phase 10 cleanup amend-and-force-push operations MUST cascade to substitution discipline re-fire on the new SHA at canonical pointer positions; snapshot file substitution scope remains exempt (literals retained per drift #32/#39 invariant).

### §11.H Drift #41 §6 24-vector enumeration + Phase 5.1 self-check (zero late-surfacing)

Per Phase 3 Task 3.A 24-vector enumeration table + Phase 5 §5.C self-check (ZERO late-surfacing vectors at Phase 5):

| # | Vector | Disposition |
|---|---|---|
| V1 | PI-10 consumer-side AccountingTab silent-zero-rows UX | F-18-001 HIGH fresh |
| V2 | F-04-002 class-header sub-class introduction | Sub-class introduction #9 RATIFIED Phase 7 |
| V3 | get_unmarked_lesson_count META cohort enrichment candidate | F-18-002 LOW fresh under F-02-034 class extension (Phase 4 push-back from Option III to Option II) |
| V4 | V2_PLAN IA-pass divergence vs §5 PR3 | POSITIVE observation |
| V5 | CC-19 #4 INLINE-DOMINANT sub-shape candidate | Sub-class introduction #10 RATIFIED Phase 7 |
| V6 | CC-19 #4 cohort enrichment | F-18-003 LOW fresh (cumulative ≥218 → ≥264) |
| V7 | CC-19 #7 Sub-A cohort enrichment — 3 sites | Subsumed in F-18-003 documentation (cumulative ~416 → ~419) |
| V8 | drift #30.A 9th manifestation | RATIFIED |
| V9 | drift #36 STANDARD PROCEDURE refinement | Sub-instance RATIFIED Phase 5.H |
| V10 | drift #39 sub-class introduction | Sub-class RATIFIED Option A Phase 5.I |
| V11 | RecurringBillingTab orphan REFUTED | POSITIVE observation + editorial |
| V12 | cancellation_feedback gap | Editorial post-Phase-B (§8.2) |
| V13 | 3-layer admin gate | POSITIVE observation (§5.1) |
| V14 | Pattern #41 NEGATIVE counter-examples at AccountingTab xero-* | +4 NEGATIVE counter-examples |
| V15 | Pattern #41 NEGATIVE at stripe-subscription-checkout consumer | +1 POSITIVE consumer observation |
| V16 | Pattern #28 shadow-mode at send-invite-email consumer | N/A at batch-18 |
| V17 | Internal-trust observation | +0 from batch-18 |
| V18 | Sub-pattern D pre-empt sweep | N/A at batch-18 |
| V19 | push_tokens consumer-attribution-migration-candidate | Editorial unchanged (§8.4) |
| V20 | 4 hooks deep walk | Phase 4 §D complete |
| V21 | FeatureGate tier-gating POSITIVE | +4 POSITIVE observations (§5.3) |
| V22 | Phase 5.1 self-check | Clean; mitigation operating as designed |
| V23 | useUrgentActions silent-on-error | F-18-004 LOW fresh |
| V24 | Composition probe | ZERO event #17 (§8.1) |

**Vector cohort delta: 24 → 24 unchanged (no V25+ late surface).**

### §11.I Cumulative methodology entries

**42 (36 Cat 1 + 2 Cat 2 + 4 Cat 3); UNCHANGED at s57** (both drift ratifications sub-instances under existing entries; no fresh drift # counter increment).

### §11.J Composition-discovery escalation framework probe

Per Phase 5 §5.D: re-probed each F-18-NNN candidate. **ZERO event #17 candidates at batch-18.** Cumulative events: **16 unchanged.** 6-criterion event ratification framework probe NEGATIVE across all 4 F-18-NNN candidates.

### §11.K Class-consistency principle verification (findings/03 L38 verbatim)

"safeguarding/security/destructive/financial classes anchor at CRITICAL ceiling; operational-correctness anchors at HIGH ceiling"

| ID | Class family | Anchor severity ceiling | Allocated severity | Verdict |
|---|---|---|---|---|
| F-18-001 | operational-correctness (capability-loss UX) | HIGH (per F-03-004 CAPS-at-HIGH chain) | HIGH | **CAP OK** |
| F-18-002 | info-disclosure bounded scalar | LOW (per F-02-034 lowest-amplification-class) | LOW | **CAP OK** |
| F-18-003 | useCan unimplementation cohort (defense-in-depth class) | MEDIUM (F-09-009 anchor); LOW (cohort enrichment precedent chain) | LOW | **CAP OK** |
| F-18-004 | silent-query-error masquerade | MEDIUM (F-04-001 anchor); modulator LOW (Sentry-mitigation) | LOW | **CAP OK** |

**Class-consistency CAP: 4/4 OK.**

### §11.L F-13-001 META cohort cross-check + mechanism distinction

get_unmarked_lesson_count is **ABSENT** from AUTH-H5 migration 20260401000000:307-396 REVOKE list per Phase 3 §F.3 DB-grep verification. Mechanism is REVOKE-omission-from-migration-entirely, **DISTINCT from F-13-001 META cohort mechanism** (REVOKE-insufficient-despite-inclusion). Temporal ordering: fn created 2026-03-30 (migration 20260330234226) BEFORE AUTH-H5 migration 2026-04-01; AUTH-H5 author did not include this fn in REVOKE enumeration. F-13-001 META cohort 13 unchanged at s57; batch-19 CC-19 #1 systematic sweep is the canonical home for cross-cutting helper-fn EXECUTE-grant hygiene cleanup.

### §11.M PI-10 closure framing rationale (Framing A)

Per Phase 5 §5.J + §9.1: PI-10's audit-addressable portions are BOTH fully closed at s57 (substrate at s54 via F-15-003/004/005; consumer at s57 via F-18-001). Zoom sub-surface is external-dependency-gated (pending Zoom OAuth approval) which is OUTSIDE Path Y audit control. PI-10 tagged **RESOLVED-PARTIAL-ZOOM-DEFERRED** Framing A with carry-forward note for post-Zoom-approval session.

Framing B alternative (PI-10 PARTIAL preserved with consumer-addressed annotation; PI cohort 3 unchanged; grand active 195) was REJECTED per: (i) audit-addressable scope distinction — Zoom is external-dependency-gated outside Path Y control vs Path Y audit-addressable; (ii) tracking simplicity at s58+ — PI cohort 2 vs 3 entering batch-19 is cleaner; (iii) precedent — closures at PI-15 (s48) used "fully-resolved" framing with closure-class notes for non-audit-blockable concerns.

### §11.N Editorial deferrals to post-Phase-B

1. **`cancellation_feedback` table CENSUS gap** (BillingTab.tsx:1139 consumer site; table NOT in CENSUS or finding docs; best-effort silent-swallow at L1144 "Non-blocking"). Implicit-attribution candidate batch-16 (subscription cancel UX flow). Editorial post-Phase-B per PLAN.md L117 consumer-attribution-migration-candidate framing.
2. **RecurringBillingTab file-location-vs-consumer-attribution** (lives in src/components/settings/ but consumed by Invoices.tsx batch-05; orphan flag REFUTED at Phase 1 §1.B per CENSUS L983 question resolution). File-organisation editorial; CENSUS clarification candidate post-Phase-B.
3. **push_tokens consumer-attribution-migration-candidate unchanged** (per PLAN.md L117 codification; 5-table list preserved at s57).
4. **drift #39 sub-class introduction editorial scope** (Phase 8 editorial update STATUS.md L77 + HANDOVER.md L32 SHA pointer cascade from `109b9cc7` to `fed324dc` post-s56-cleanup; snapshot file UNCHANGED per drift #32/#39 invariant).

---

## §12 Cohort tally arithmetic (drift #27 OPERATIONAL CARRY)

Per Phase 5 Task 5.J Framing A 4-cross-verify:

- **(a) Bracket sum**: 20C + 52H + 28M + 94L = **194** ✓
- **(b) Per-batch-row sum**: 2 (PI cohort) + 36 (b01) + 36 (b02) + 5 (b03) + 5 (b04) + 11 (b05) + 8 (b06) + 7 (b07) + 10 (b08) + 10 (b09) + 8 (b10) + 4 (b11) + 8 (b12) + 4 (b13) + 7 (b14) + 12 (b15) + 8 (b16) + 9 (b17) + **4 (b18 NEW)** = **194** ✓
- **(c) PI cohort math**: entering 3 − 1 closure (PI-10 RESOLVED-PARTIAL-ZOOM-DEFERRED) = exit **2** ✓
- **(d) Grand active math**: entering 191 + 4 fresh batch-18 − 1 PI bracket-delta (1H closed) = exit **194** ✓

**Triple-cross-verify converges. Framing A propagated consistently.**

---

End of findings/18-settings-tabs.md.
