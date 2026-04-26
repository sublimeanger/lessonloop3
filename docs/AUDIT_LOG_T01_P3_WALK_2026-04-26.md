# Track 0.1 P3 — entity_type Normalisation Walk — 2026-04-26

Read-only walk against main tip `0edf0624` ("Applied T01-P2 profiles audit").
Done in chat-Claude's local clone. Re-verifies and supersedes the T01-P0 walk
(`docs/AUDIT_LOG_AUDIT_2026-04-26.md`) for everything in P3 scope. The P0 walk's
P3 line items have shifted enough since 26 April that a second pass was needed.

## Headline finding

**P3 is real, smaller than the P0 walk implied, and has one significant hidden
risk that the P0 walk missed: the frontend display layer.** Schema work is
straightforward (8 trigger rewrites + 2 RPC rewrites + historical backfill +
5 edge-fn callsite fixes). The hidden risk is that `src/hooks/useAuditLog.ts`
hardcodes plural `entity_type` and the action verb `'create'` in display-logic
switch statements. Without lockstep updates, the audit-log UI silently degrades
the moment the migration applies.

Recommended phasing: **single P3 phase, three commits**. Schema migration first,
edge-fn + frontend fixes second, docs close third. Atomic at the database level,
incremental at the review-surface level.

---

## What changed since the T01-P0 walk

The P0 walk recorded "13 manual writes use plural" with this breakdown:
`invoices ×2, lessons ×2, students ×3, payments ×1, org_memberships ×2,
calendar_connections ×3, xero_connections ×2`.

**Today, only the connection-related plurals remain.** The other 10 plural
sites (invoices, lessons, students, payments, org_memberships) have been
cleaned up since 26 April — present-tense state in `src/lib/auditLog.ts`
callers (26 sites total) is already 100% singular. P3's code-fix surface is
therefore much narrower than the P0 walk projected.

The P0 walk also did not surface:
- `src/hooks/useAuditLog.ts` hardcoded plural display lookups + `'create'`
  action checks (medium-severity hidden risk).
- `src/test/audit/AuditLog.test.ts` 15 plural fixture references (low-severity,
  but tests will fail without fix).
- Two SECURITY DEFINER RPCs (`update_practice_streak`, `_notify_streak_milestone`)
  writing plural `'practice_streaks'` as `entity_type`. These are migration-defined,
  not edge-fn-defined, and need a `CREATE OR REPLACE FUNCTION` migration.

---

## Schema scope

### 8 grandfathered triggers writing plural entity_type via `log_audit_event()`

The P0 walk listed 9. Verification today shows `trg_audit_attendance` already
writes singular (`'attendance_record'`) via the custom `audit_attendance_changes()`
helper — confirmed by reading
`supabase/migrations/20260222203006_fb68ba75-60f2-4f84-9852-65ea85d7ee08.sql:23`.
P3 should leave it alone (or optionally consolidate it to call
`log_audit_event_singular('attendance_record')` — stylistic, not behavioural).

The 8 triggers below all currently call `public.log_audit_event()`, which writes
`entity_type = TG_TABLE_NAME` (verified at
`supabase/migrations/20260120002039_5a489cca:76`) and `action = 'create'` on
INSERT (verified at line 52). All 8 need rewriting to call
`log_audit_event_singular(<singular>)`:

| # | Trigger | Target table | Current entity_type | Singular target |
|---|---|---|---|---|
| 1 | `audit_students` | `students` | `'students'` | `'student'` |
| 2 | `audit_lessons` | `lessons` | `'lessons'` | `'lesson'` |
| 3 | `audit_invoices` | `invoices` | `'invoices'` | `'invoice'` |
| 4 | `audit_payments` | `payments` | `'payments'` | `'payment'` |
| 5 | `audit_org_memberships` | `org_memberships` | `'org_memberships'` | `'org_membership'` |
| 6 | `audit_ai_action_proposals` | `ai_action_proposals` | `'ai_action_proposals'` | `'ai_action_proposal'` |
| 7 | `audit_teachers_changes` | `teachers` | `'teachers'` | `'teacher'` |
| 8 | `audit_internal_messages` | `internal_messages` | `'internal_messages'` | `'internal_message'` |

After rewriting, **`log_audit_event()` has zero callers**. Recommendation:
drop it. No shim needed (verified: zero references outside the 8 triggers
across `supabase/migrations/`, `supabase/functions/`, `src/`).

### 2 SECURITY DEFINER RPCs writing plural `'practice_streaks'`

Both are migration-defined functions. P3 needs `CREATE OR REPLACE FUNCTION`
re-emission of each in a P3 migration:

| Function | File | Line |
|---|---|---|
| `public.update_practice_streak()` | `supabase/migrations/20260303180000_streak_milestone_webhook.sql` | 79 |
| `public._notify_streak_milestone()` | `supabase/migrations/20260316310000_fix_practice_tracking_audit.sql` | 181 |

Both write `entity_type = 'practice_streaks'`. Target singular: `'practice_streak'`.
The actual table name `practice_streaks` stays plural (it's just the table name);
only the audit-log entity_type string changes.

Note: an even older variant of `update_practice_streak` exists at
`20260222225228_41243f5d:86,110` and `20260124130618_7ba0ccf8:87` — those are
superseded by `20260303180000_streak_milestone_webhook.sql` (latest definition
wins under PostgreSQL's `CREATE OR REPLACE` semantics). P3 only needs to fix
the live versions.

### Historical row backfill

Two single-statement UPDATEs cover the schema-side backfill:

```sql
-- entity_type plural → singular (8 entities + practice_streaks)
UPDATE audit_log SET entity_type = 'student'             WHERE entity_type = 'students';
UPDATE audit_log SET entity_type = 'lesson'              WHERE entity_type = 'lessons';
UPDATE audit_log SET entity_type = 'invoice'             WHERE entity_type = 'invoices';
UPDATE audit_log SET entity_type = 'payment'             WHERE entity_type = 'payments';
UPDATE audit_log SET entity_type = 'org_membership'      WHERE entity_type = 'org_memberships';
UPDATE audit_log SET entity_type = 'ai_action_proposal'  WHERE entity_type = 'ai_action_proposals';
UPDATE audit_log SET entity_type = 'teacher'             WHERE entity_type = 'teachers';
UPDATE audit_log SET entity_type = 'internal_message'    WHERE entity_type = 'internal_messages';
UPDATE audit_log SET entity_type = 'practice_streak'     WHERE entity_type = 'practice_streaks';

-- action 'create' → 'insert' (only for entities the 8 triggers wrote — see scope note below)
UPDATE audit_log SET action = 'insert'
  WHERE action = 'create'
    AND entity_type IN (
      'student','lesson','invoice','payment','org_membership',
      'ai_action_proposal','teacher','internal_message'
    );
```

**Action backfill scope is narrow.** Only the 8 grandfathered triggers wrote
`action = 'create'`. RPCs write rich domain verbs (`'credit_issued'`,
`'streak_milestone'`, `'payment_plan_cancelled'`, etc.) which stay as-is. The
`logAudit()` helper in `src/lib/auditLog.ts` has 26 callers in `src/`; some
write `'create'` (e.g., `useLessonForm.ts:803` writes `'create'` for `'lesson'`).
Those are deliberate domain-event verbs distinct from CRUD actions and should
**keep** writing `'create'` — the design intent is "create" = lesson scheduled
as a user action, vs `'insert'` = trigger-captured row-level CRUD.

The WHERE-clause restriction on the action backfill enforces this distinction:
historical pre-P3 trigger rows get `'insert'`, but any `logAudit('create', 'lesson', ...)`
row (which writes singular `'lesson'`) is not touched because the entity_type filter
catches only *post-backfill* singular forms, and the action 'create' rows from
`logAudit` callers are interleaved with rows from `log_audit_event` that wrote
plural `'lessons'`. Once those plurals are normalised to singular, the action
backfill could in theory affect singular-and-`'create'` rows that came from
`logAudit('create', 'lesson', ...)` calls — and those *would* incorrectly become
`'insert'`.

**This is a real ordering problem.** Two safe approaches:

(a) **Run the action backfill BEFORE the entity_type backfill.** Then the WHERE
   filter on `entity_type IN ('students', 'lessons', ...)` (plural forms) catches
   only trigger-emitted rows.

(b) **Add a marker column or exploit a different distinguisher.** Triggers write
   `before/after` as full row jsonb; `logAudit()` callers write partial. Could
   filter on shape, but it's brittle.

**Recommended: (a).** Run the action backfill first, with WHERE-clause matching
the *plural* forms, then the entity_type backfill. The migration order in P3-C1
should be:

```sql
-- Step 1: action 'create' → 'insert' (filter on plural entity_type — only triggers)
UPDATE audit_log SET action = 'insert'
  WHERE action = 'create'
    AND entity_type IN (
      'students','lessons','invoices','payments','org_memberships',
      'ai_action_proposals','teachers','internal_messages'
    );

-- Step 2: entity_type plural → singular
UPDATE audit_log SET entity_type = 'student'             WHERE entity_type = 'students';
-- ...etc (full list above)
```

This is reversible to its current state by inverting the singular-to-plural map and 'insert' back to 'create' with the same filter (Jamie's "rewrite history" approval is what makes this acceptable; if P3 needs to be reverted, we'd accept the rich semantics of the trigger-emitted historical rows are gone but the rows themselves remain queryable).

### `audit_log` table — no schema changes

Confirmed: `audit_log.entity_type` is `text NOT NULL` (no enum, no check
constraint), so any string value is accepted. Schema doesn't need a CHECK
constraint addition — adding one would require enumerating every singular
entity_type that's used today (35+ values across triggers, RPCs, and
`logAudit()` callers), and any future addition would need migration. Skip.

---

## Code scope

### 5 edge function call sites still write plural

| File | Line | Plural value | Singular target |
|---|---|---|---|
| `supabase/functions/calendar-disconnect/index.ts` | 193 | `'calendar_connections'` | `'calendar_connection'` |
| `supabase/functions/calendar-oauth-callback/index.ts` | 149 | `'calendar_connections'` | `'calendar_connection'` |
| `supabase/functions/zoom-oauth-callback/index.ts` | 155 | `'calendar_connections'` | `'calendar_connection'` |
| `supabase/functions/xero-disconnect/index.ts` | 86 | `'xero_connections'` | `'xero_connection'` |
| `supabase/functions/xero-oauth-callback/index.ts` | 122 | `'xero_connections'` | `'xero_connection'` |

These also need historical row backfill:

```sql
UPDATE audit_log SET entity_type = 'calendar_connection' WHERE entity_type = 'calendar_connections';
UPDATE audit_log SET entity_type = 'xero_connection'    WHERE entity_type = 'xero_connections';
```

Add to step 2 of the schema migration above. The backfill goes **after** the
edge-fn fix lands and is deployed by Lovable; otherwise live writes during the
deploy window split history across both forms.

### Frontend display layer (THE HIDDEN RISK)

`src/hooks/useAuditLog.ts` has hardcoded plural keys and `'create'` action
checks. After the migration applies, the audit-log UI will degrade silently:
audit entries will display raw entity_type strings (`'student'` instead of
`'Student'`) and `getChangeDescription` will fall through to the generic
`"<Entity> was <action>"` template instead of the rich messages.

**Required changes in `src/hooks/useAuditLog.ts`:**

```typescript
// Line 102-106: action label map
const labels: Record<string, string> = {
  create: 'Created',     // KEEP — domain verb still in use by logAudit() callers
  insert: 'Created',     // ADD — trigger-emitted CRUD insert
  update: 'Updated',
  delete: 'Deleted',
};

// Line 110-118: entity label map (rewrite plural → singular)
const labels: Record<string, string> = {
  student:           'Student',
  lesson:            'Lesson',
  invoice:           'Invoice',
  payment:           'Payment',
  org_membership:    'Membership',
  // (consider adding: teacher, internal_message, ai_action_proposal,
  //  attendance_record, practice_streak, calendar_connection, xero_connection,
  //  and the T01-P1 walk-surfaced singular labels)
};

// Lines 125, 126, 130, 133, 136, 140, 146, 151, 156, 163, 164:
// Switch all entity_type comparisons to singular AND
// switch action === 'create' to action === 'insert' || action === 'create'
// (covers both legacy and new rows during the deploy window)
```

**Optional but recommended:** expand the entity_label map to cover all 16+
T01-P1 trigger-emitted entity types so the UI shows nice labels for every
audited entity. Currently it falls back to the raw string.

### 15 test fixture references

`src/test/audit/AuditLog.test.ts` has 15 plural references and 8 `action: 'create'`
references. Update all to singular and `'insert'` (or keep `'create'` for the
fixture testing that specific path). Tests will fail otherwise.

### `src/lib/auditLog.ts` — no changes

Already takes `entityType: string` parameter. All 26 callers in `src/` already
pass singular values. Leave as-is.

---

## Lovable apply artifact pattern (worth noting)

When Lovable applies a Claude-Code-authored migration, it re-emits the migration
content under a new timestamp + UUID filename. Confirmed today: Lovable's apply
of T01-P1 produced `20260426174938_df1c4ec6-a9f4-4002-9390-2867ecec793e.sql`
with the comment `"Combines 20260505100000 + 20260505100100 from main."` — this
is benign because both source migrations and apply artifacts use idempotent
patterns (`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` ahead of
`CREATE TRIGGER`).

P3 migration must use the same idempotent patterns for safe re-apply:
- `CREATE OR REPLACE FUNCTION` for any function rewrites.
- `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...` for trigger replacements.
- Backfill UPDATE statements are naturally idempotent (running twice on already-singular
  rows is a no-op because the WHERE clause matches plural).

---

## Recommended P3 commit structure

| Commit | Subject | Files | Lovable apply step |
|---|---|---|---|
| T01-P3-C1 | `feat(audit): T01-P3 entity_type normalisation — triggers, RPCs, backfill` | 1 new migration in `supabase/migrations/` | YES — runs migration |
| T01-P3-C2 | `fix(audit): plural→singular entity_type in edge functions and frontend display` | 5 edge fns + `src/hooks/useAuditLog.ts` + `src/test/audit/AuditLog.test.ts` | Lovable redeploys edge fns; frontend ships via build |
| T01-P3-C3 | `chore(docs): T01-P3 close + Track 0.1 closure in roadmap` | `docs/AUDIT_LOG_T01_P3_WALK_2026-04-26.md`, `POLISH_NOTES.md`, `LESSONLOOP_PRODUCTION_ROADMAP.md` | Docs only |

C1 is one migration file with: function drop (`log_audit_event`), 8 trigger
DROP+CREATE, 2 RPC `CREATE OR REPLACE`, 2 backfill statement blocks (action
first, entity_type second). Commit ordering: C1 lands and Lovable applies
**before** C2 lands so old plural-writing edge fns continue to coexist with
new singular triggers during the deploy window. Lovable then redeploys C2
edge fns immediately after merge — the brief should make this explicit so
Jamie schedules the Lovable apply tightly.

Alternative ordering — **C2 before C1** — is also safe given the deploy window
overlap. The schema accepts both forms (text column, no constraint), so during
the window after C2 ships but before C1 applies, edge fns write singular but
triggers still write plural. Backfill in C1 catches both forms cleanly.
**Either ordering works.** C1-first is the cleaner mental model.

---

## Open questions for Jamie

### OQ1 — Drop `log_audit_event` or keep as a `RAISE NOTICE` shim?

P0 walk (the corrected version) suggested either. After P3 there are zero
callers. **Recommendation: drop entirely.** No shim. The typecheck doesn't
catch SQL function calls anyway, so a shim adds zero defensive value. If a
runaway migration is ever found that still calls it, the `function does not
exist` error is louder and more actionable than a swallowed `RAISE NOTICE`.

### OQ2 — Migrate `audit_attendance_changes` to call `log_audit_event_singular`?

Behavioural no-op (both write the same thing). Pure consolidation. **My
preference: leave it.** Custom helper has clearer intent at the call site
(`'attendance_record'` literal in the function body) than `TG_ARGV[0]`-driven
indirection. Two helpers is fine.

### OQ3 — Action verb 'create' coexists with 'insert' permanently?

Yes — that's the design recommendation. Triggers write CRUD verbs
(`'insert'/'update'/'delete'`); `logAudit()` callers write domain verbs
(`'create'`, `'cancel'`, `'student.created'`, etc.). Frontend display map
covers both. Document in `MIGRATION_CONVENTIONS.md` as the convention going
forward.

### OQ4 — Expand `useAuditLog.ts` entity label map to cover all T01-P1 entities?

Optional but improves UI. Currently 5 entries (student, lesson, invoice,
payment, membership). T01-P1 added 16 triggers — recommend expanding to cover
all of them so the audit log UI doesn't show raw `'guardian_payment_preference'`
strings. Trivial — 15-line map expansion. **Recommend yes**, fold into C2.

---

## Walk methodology

1. Listed all `CREATE TRIGGER ... audit*` statements via grep against
   `supabase/migrations/`.
2. Read `log_audit_event()` body in full
   (`20260120002039_5a489cca-73e1-4414-b942-b64afa4833d9.sql:36-83`).
3. Verified each of the 9 grandfathered triggers' target table and helper
   function via direct file reads.
4. Found `audit_attendance_changes` already writes singular — eliminated
   from P3 schema scope.
5. Catalogued every `INSERT INTO audit_log` in `supabase/migrations/` to
   distinguish trigger-helper writes from RPC writes — found 2 RPCs writing
   `'practice_streaks'` plural that the P0 walk did not surface.
6. Re-grepped `supabase/functions/` and `src/` for plural entity_type — found
   only 5 production code sites + 15 test fixtures (P0 walk's "13 plural
   manual writes" stale by 10 sites).
7. Read `src/hooks/useAuditLog.ts` in full — surfaced the frontend display
   layer hidden risk.
8. Enumerated all `logAudit()` callers (26 sites) — confirmed all already
   write singular; no changes needed.
9. Distinct action-verb literals across all `INSERT INTO audit_log` writers
   — confirmed RPC verbs are rich and do not collide with trigger-CRUD verbs.

What this walk did NOT do:
- Did not write any migration (this is a walk).
- Did not run any operator query against the live database (would be useful
  to know how many `audit_log` rows have plural `entity_type` today, to
  estimate backfill cost — but the count is bounded by total audit_log
  size and the UPDATE is index-fast).
- Did not benchmark trigger overhead before/after the rewrite (no change
  expected — both helpers do one INSERT each).

Confidence: **high** for trigger inventory and singular targets. **High** for
the frontend display layer scope. **High** for the action-verb backfill
ordering risk and recommendation. **Medium-high** for the recommendation to
drop `log_audit_event` (low risk but irreversible).

---

## Summary table

| Surface | Count | Change | Migration step |
|---|---|---|---|
| Grandfathered triggers (plural) | 8 | DROP + CREATE pointing at `log_audit_event_singular(<singular>)` | C1 |
| `audit_attendance_changes` trigger | 1 | LEAVE | — |
| `log_audit_event()` helper | 1 | DROP after triggers migrated | C1 |
| `update_practice_streak()` RPC | 1 | `CREATE OR REPLACE`, change literal | C1 |
| `_notify_streak_milestone()` RPC | 1 | `CREATE OR REPLACE`, change literal | C1 |
| `audit_log` historical rows: action 'create' | (count from operator) | UPDATE → 'insert' (filter plural entity_type) | C1 |
| `audit_log` historical rows: 9 plural entity types | (count from operator) | UPDATE → singular | C1 |
| Edge function call sites | 5 | Edit literals | C2 |
| `src/hooks/useAuditLog.ts` | 1 file, ~15 lines | Add 'insert' action; flip plural keys → singular; expand entity map | C2 |
| `src/test/audit/AuditLog.test.ts` | 15 fixture references | plural → singular; `'create'` → `'insert'` (or split | C2 |
| `src/lib/auditLog.ts` callers | 26 | LEAVE — already singular | — |
| Roadmap + POLISH_NOTES + walk doc | 3 files | Close T01-P3 | C3 |
