# AuthContext.onAuthStateChange async callback hangs Profile/Roles fetch

**Severity:** high
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** (this commit)
**Affected components:** src/contexts/AuthContext.tsx

## Symptom

Every newly-signed-up user (and likely some sign-ins) saw two console warnings on first auth-state-change event:

```
[WARN] Profile fetch timeout after 5s
[WARN] Roles fetch timeout after 5s
```

Followed by a delay of ~5 seconds before any authenticated route loaded usefully. Profile + roles eventually populated via the retry path, but the user experience was: sign in → 5-second blank → app appears.

## Root cause

`AuthContext` registered an **async** callback with `supabase.auth.onAuthStateChange` and `await`ed `Promise.all([fetchProfile, fetchRoles])` inside it:

```ts
supabase.auth.onAuthStateChange(async (event, newSession) => {
  // … synchronous setState calls …
  const [profileData, rolesData] = await Promise.all([
    fetchProfile(newSession.user.id),
    fetchRoles(newSession.user.id),
  ]);
  // …
});
```

This is the well-documented Supabase anti-pattern. The supabase-js client serialises auth-state mutations through an internal lock; `await`ing a PostgREST call inside the callback blocks the lock from releasing, which causes the very query being awaited to stall until the lock times out (~5s default). The `Promise.race` with 5s timeout in `fetchProfile` / `fetchRoles` then resolves to `null` / `[]`, and the warnings fire.

DB-level the queries are fast (`profiles` PK lookup ~3ms, `get_user_roles` RPC ~13ms — verified via `EXPLAIN ANALYZE`). The 5-second delay is entirely client-side, in the supabase-js auth lock window.

Per Supabase docs:

> "Avoid using async functions as callbacks. Async callbacks can lead to issues with the auth state."

## Fix

Made the `onAuthStateChange` callback synchronous (no `async`) and deferred the DB fetches via `setTimeout(0)`:

```ts
supabase.auth.onAuthStateChange((event, newSession) => {
  // synchronous setState calls run inside the lock window — fine
  setSession(newSession);
  setUser(newSession?.user ?? null);

  // …

  // Defer DB work OUTSIDE the auth lock window
  setTimeout(async () => {
    try {
      const [profileData, rolesData] = await Promise.all([
        fetchProfile(userId),
        fetchRoles(userId),
      ]);
      // setState here
    } finally {
      fetchingRef.current = false;
    }
  }, 0);
});
```

The `setTimeout(0)` schedules the async work on the next macrotask, which is past the auth lock release. PostgREST calls now go through unblocked.

`fetchingRef` reset moved into a `finally` block so it always clears on either success or exception (was previously only on success path).

## Verification

- Type-check clean (`npx tsc --noEmit` exit 0).
- Browser test pending: Jamie's signup re-test should now show no `Profile fetch timeout` / `Roles fetch timeout` warnings in the console post-signup, and the dashboard should appear within a normal load time (≤2s) rather than after the 5s timeout.

## Lessons / follow-ups

- Any callback registered with `supabase.auth.onAuthStateChange` MUST be synchronous. Defer DB queries via `setTimeout(0)` or `queueMicrotask`.
- Same anti-pattern existed nowhere else in the codebase (single `onAuthStateChange` registration in `AuthContext.tsx`, second in `ResetPassword.tsx` which doesn't await DB work).
- This was masked in source-environment Lovable deploys because the supabase-js version there may have differed; destination's pinned version + cleaner JWT path made the lock hold longer or more deterministically.
- Worth also auditing: the initial `getSession()`-then-`Promise.all` block in `initializeAuth` (lines 220-244) doesn't have this issue because it runs at component mount, not inside an auth callback. Left unchanged.
