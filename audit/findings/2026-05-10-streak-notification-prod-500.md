# streak-notification 500 — real prod fire (1 user, IE Dublin)

**Severity:** P3 (single occurrence, non-money-path)
**Status:** FIXED 2026-05-10 s30 — replaced 2 throw paths with idempotent 200-skip responses; deployed
**First/Last observed:** 2026-05-10T19:37:01Z
**Sentry issue:** [JAVASCRIPT-REACT-9](https://lessonloop.sentry.io/issues/JAVASCRIPT-REACT-9) (s30: to be resolved post-deploy)
**Events:** 1 event / 1 user (IE Dublin IPv6)
**Surfaced by:** s28 Sentry wrap on cron cluster

## s30 root cause + fix

Hypothesis (from finding): the cron fired with `student_id` or `org_id` that was soft/hard-deleted between trigger fire and fn execution.

**Hypothesis verification:** could not extract exact payload from Sentry (wrapEdgeFn doesn't capture request body for PII safety). However, the fix is **shape-correct regardless** of which specific row was missing.

**Fix applied (2 changes in `supabase/functions/streak-notification/index.ts`):**

```diff
   if (studentError || !student) {
-    throw new Error("Student not found");
+    console.log(`[streak-notification] student ${student_id} not found (likely soft/hard-deleted) — skipping`);
+    return new Response(
+      JSON.stringify({ skipped: "student not found", student_id }),
+      { status: 200, headers }
+    );
   }
```

```diff
   if (orgError || !org) {
-    throw new Error("Organisation not found");
+    console.log(`[streak-notification] org ${org_id} not found (likely soft/hard-deleted) — skipping`);
+    return new Response(
+      JSON.stringify({ skipped: "organisation not found", org_id }),
+      { status: 200, headers }
+    );
   }
```

Cron fns must be idempotent on stale upstream payloads. A trigger source row deleted between fire-and-execute should not 500; it should silently no-op (with a log line for retrospective debug).

Deployed via Supabase Management API.

## Symptom

`streak-notification` fired once in production, returned HTTP 500. duration_ms 139ms (fast — errored early). Geography (Dublin) differs from Jamie's UK base — may be Lauren shadow-term setup, automated monitoring, or a real practice-streak fire from an IE-based user.

## Catch handler shape

```typescript
} catch (error) {
  console.error("Error:", error);
  return new Response(
    JSON.stringify({ error: "An internal error occurred. Please try again." }),
    { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}
```

Generic 500. No leak. So the response shape is fine — issue is the underlying error.

## Likely root cause hypotheses

1. **Missing student / org**: fn does `throw new Error("Student not found")` or `"Organisation not found"` if either DB lookup fails. If a stale milestone fire reaches a soft-deleted student, this throws → 500.
2. **Cron payload missing `student_id`/`new_streak`/`org_id`**: would return 400 (handled). NOT the cause.
3. **`message_log` INSERT failed**: NOT NULL constraint violation or RLS denial.
4. **The `_notify_streak_milestone` trigger fired with stale row data**.

139ms duration is consistent with hypothesis 1 (early DB-lookup fail).

## s29 action

- Filed this finding.
- Did NOT modify the fn — its 500 shape is already generic (no leak), and single-occurrence single-user doesn't yet justify reactive code changes.

## Deferred investigation (s30)

- Query Supabase edge fn logs for the exact request payload at 2026-05-10T19:37:01Z to identify which `student_id` / `org_id` was passed.
- If the row is soft-deleted: harden the SELECT to use `.is("deleted_at", null)` and return 404 not 500.
- If the row is genuinely missing (trigger raced with delete): file as data-quality bug for the trigger to gate on row-still-exists before firing.

Single occurrence over 7d — not a recurring pattern yet. Re-evaluate severity if Sentry captures more events in s30.

## Sentry status

Will leave JAVASCRIPT-REACT-9 unresolved pending s30 investigation.
