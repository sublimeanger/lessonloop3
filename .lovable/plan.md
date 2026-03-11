

## Fix: Students List Capped at 1000

### Problem
The students list shows exactly 1000 records despite the E2E Test Academy having 1,445 students. The pagination code in `useStudents.ts` uses `.range()` in batches of 1000, but hosted Supabase enforces a PostgREST `max-rows` of 1000 — meaning the second page request (offset 1000+) likely returns 0 rows, and the loop exits early since `0 < 1000`.

### Solution
Create a server-side database function (`get_students_for_org`) that returns all students in one call, bypassing PostgREST's row limit. Then update the `useStudents` hook to call this RPC instead of querying the table directly.

### Changes

**1. Database migration — create `get_students_for_org` function**
- Accepts `_org_id uuid`, `_role text`, `_user_id uuid`
- Returns all non-deleted students for the org (with guardian count)
- For teachers, filters to assigned students only
- `SECURITY DEFINER` with `search_path = public` so it respects the function owner's permissions (no RLS row cap)
- Ordered by last_name, first_name, id

**2. Update `src/hooks/useStudents.ts`**
- Replace the pagination loop with a single `supabase.rpc('get_students_for_org', { ... })` call
- Remove the `STUDENT_FETCH_PAGE_SIZE` and `STUDENT_FETCH_MAX` constants
- Map the RPC result to `StudentListItem[]`

**3. Update `src/lib/studentQuery.ts`**
- Replace `activeStudentsQuery` with an RPC call or add `.limit(5000)` note that this helper is used for usage counts only — verify it also works correctly

### Why this works
Database functions (RPC) bypass PostgREST's `max-rows` limit since the query runs entirely server-side. This permanently fixes the 1000-row cap for any org size up to the function's own limits.

