# Audit — Feature 20: Practice Tracking

**Date:** 2026-03-16
**Auditor:** Claude (automated)
**Scope:** Practice logging, streaks, RLS, parent/student visibility, practice goals, stats/reports

---

## 1. Files Audited

### Database Migrations
| File | Purpose |
|------|---------|
| `20260124023938_b5e4da81-…` | Creates `practice_assignments` + `practice_logs` tables, RLS, indexes |
| `20260124130317_2436aeb2-…` | Creates `practice_streaks` table, `update_practice_streak()` trigger, `reset_stale_streaks()` |
| `20260124130618_7ba0ccf8-…` | Adds milestone detection (3/7/14/30/60/100 days) to streak function |
| `20260130162532_a2767bf6-…` | Adds `teacher_id` FK on `practice_assignments` (via `20260221194946`) |
| `20260221194946_a7f9c034-…` | Backfills `teacher_id` on `practice_assignments` |
| `20260222225021_7b93d19a-…` | Tightens `practice_assignments` SELECT: staff + parent-of-student only |
| `20260222225040_f99d8b7f-…` | Tightens `practice_logs` SELECT: staff + parent-of-student only |
| `20260222225055_89b272f2-…` | Tightens `practice_logs` INSERT: staff OR parent-of-student |
| `20260222225158_39485490-…` | Adds `duration_minutes <= 720` constraint |
| `20260222225228_41243f5d-…` | Rewrites `update_practice_streak()` with backdated-log recalculation |
| `20260222225252_6dcf57c5-…` | Rewrites `reset_stale_streaks()` with 2-day grace window |
| `20260222225346_acc3bc00-…` | Adds `complete_expired_assignments()` cron helper |
| `20260223004703_aed49db5-…` | Adds `grade_level_id` column to `practice_assignments` |
| `20260303170000_composite_indexes` | Composite indexes on `practice_logs(student_id, date)` and `(org_id, date)` |
| `20260303180000_streak_milestone_webhook` | Rewrites `update_practice_streak()` with `pg_net` webhook for milestones |
| `20260315100000_fix_practice_streaks_rls` | **Fixes cross-org write** — drops `WITH CHECK(true)` policies, replaces with `is_org_member` scoped |

### Application Code
| File | Purpose |
|------|---------|
| `src/hooks/usePractice.ts` | All CRUD hooks: assignments, logs, weekly progress, feedback |
| `src/hooks/usePracticeStreaks.ts` | Streak queries: single, org-wide, children (parent portal) |
| `src/components/portal/PracticeTimer.tsx` | Timer + quick-log UI, localStorage persistence, milestone celebration |
| `src/components/practice/StreakBadge.tsx` | Streak display badge |
| `src/components/practice/StreakCelebration.tsx` | Milestone celebration modal |
| `src/components/practice/TeacherPracticeReview.tsx` | Teacher review panel |
| `src/components/practice/PracticeTrendsChart.tsx` | Analytics chart |
| `src/components/practice/CreateAssignmentModal.tsx` | Assignment creation form |
| `src/components/practice/AssignmentDetailDialog.tsx` | Assignment detail view |
| `src/components/portal/PracticeHistory.tsx` | Parent portal log history |
| `src/components/portal/WeeklyProgressCard.tsx` | Progress card |
| `src/components/students/StudentPracticePanel.tsx` | Teacher-side student practice view |
| `src/pages/Practice.tsx` | Teacher/admin practice management page |
| `src/pages/portal/PortalPractice.tsx` | Parent portal practice page |
| `supabase/functions/streak-notification/index.ts` | Edge function: milestone email notifications |

---

## 2. Findings Table

| # | Severity | Component | Finding | Detail |
|---|----------|-----------|---------|--------|
| F1 | **HIGH** | `update_practice_streak()` | Backdated-log recalculation lost in later migration | Migration `20260303180000` (webhook) overwrites the function from `20260222225228` but drops the backdated-log recalculation branch. The current production function silently ignores backdated practice logs (`RETURN NEW` with no streak update). |
| F2 | **MEDIUM** | `update_practice_streak()` | No auth check in SECURITY DEFINER trigger | The trigger runs as superuser. It trusts `NEW.student_id` and `NEW.org_id` from the inserting row. Since `practice_logs` INSERT RLS validates the caller is staff or parent-of-student, this is implicitly gated. However, the function itself does not verify the relationship between `student_id` and `org_id` — a crafted INSERT with mismatched `student_id`/`org_id` that passes RLS could create a streak record pointing to the wrong org. |
| F3 | **MEDIUM** | `practice_streaks` RLS | Fix migration may not apply if original policies were already dropped | Migration `20260315100000` uses `DROP POLICY IF EXISTS` then creates new org-member-scoped policies. This is correct. **However**, the `update_practice_streak()` trigger is SECURITY DEFINER and bypasses RLS, so the INSERT/UPDATE policies on `practice_streaks` only matter for direct client access, not for the trigger path. The trigger path is safe. |
| F4 | **MEDIUM** | Streak timezone | No timezone awareness in streak calculation | `_practice_date := NEW.practice_date` uses the `DATE` column which is timezone-naive. The `reset_stale_streaks()` function uses `CURRENT_DATE` (server timezone, typically UTC). A student practicing at 11pm local time gets credit for "today" only if their local date matches the server date. The 2-day grace window in `reset_stale_streaks()` partially mitigates this but doesn't fully solve it. |
| F5 | **LOW** | `practice_logs` | No DELETE policy | There is no RLS policy allowing deletion of practice logs. This means no one (not even admins) can delete practice logs through the client. This may be intentional (audit trail), but if a parent logs practice for the wrong student, there's no way to remove it without a service-role call. |
| F6 | **LOW** | `practice_assignments` | `teacher_user_id` has no FK constraint | Column `teacher_user_id UUID NOT NULL` on `practice_assignments` has no `REFERENCES auth.users(id)` constraint. Orphan user IDs could persist. |
| F7 | **LOW** | `useLogPractice` | Deduplication race condition | The client-side dedup check (same student + date + duration within 60s) uses a read-then-write pattern with no DB-level uniqueness constraint. Two concurrent tabs could both pass the check. |
| F8 | **LOW** | `useUpdateAssignment` | No org_id scoping on update | `useUpdateAssignment` does `.update(data).eq('id', id)` without `.eq('org_id', currentOrg.id)`. RLS protects against cross-org writes, but best practice is defense-in-depth with client-side org scoping. |
| F9 | **INFO** | `streak-notification` edge function | Service role key in vault secrets | The `update_practice_streak()` trigger reads `SUPABASE_SERVICE_ROLE_KEY` from `vault.decrypted_secrets` to call the edge function. This is the recommended Supabase pattern for pg_net calls. No issue, but noted for completeness. |
| F10 | **INFO** | Practice goals | No dedicated "goals" entity | Practice goals are implicitly modeled via `target_minutes_per_day` and `target_days_per_week` on `practice_assignments`. There is no separate `practice_goals` table. Weekly progress is calculated client-side in `useWeeklyProgress()`. This is sufficient for current needs. |
| F11 | **INFO** | `complete_expired_assignments()` | SECURITY DEFINER with no auth check | This function auto-completes expired assignments. It's called by cron (not user-facing), so no auth check is needed. Noted for completeness. |

---

## 3. RLS Policy Matrix

### practice_assignments

| Operation | Policy Name | Who | Condition |
|-----------|-------------|-----|-----------|
| SELECT | "Staff can view practice assignments" | Staff (owner/admin/teacher/finance) | `is_org_staff(auth.uid(), org_id)` |
| SELECT | "Parents can view own children assignments" | Parents | `is_parent_of_student(auth.uid(), student_id)` |
| INSERT | "Teachers and admins can create assignments" | Owner/admin/teacher | `org_memberships.role IN ('owner','admin','teacher')` |
| UPDATE | "Teachers and admins can update assignments" | Owner/admin/teacher | `org_memberships.role IN ('owner','admin','teacher')` |
| DELETE | "Teachers and admins can delete assignments" | Owner/admin/teacher | `org_memberships.role IN ('owner','admin','teacher')` |

**Cross-org isolation:** Yes — all policies scope by `org_id` via `org_memberships`.

### practice_logs

| Operation | Policy Name | Who | Condition |
|-----------|-------------|-----|-----------|
| SELECT | "Staff can view practice logs" | Staff | `is_org_staff(auth.uid(), org_id)` |
| SELECT | "Parents can view own children logs" | Parents | `is_parent_of_student(auth.uid(), student_id)` |
| INSERT | "Staff can create practice logs" | Staff | `is_org_staff(auth.uid(), org_id)` |
| INSERT | "Parents can create logs for own children" | Parents | `is_parent_of_student(auth.uid(), student_id)` |
| UPDATE | "Teachers can update practice logs for feedback" | Owner/admin/teacher | `org_memberships.role IN ('owner','admin','teacher')` |
| DELETE | — | **Nobody** | No policy exists |

**Cross-org isolation:** Yes — all policies scope by org or parent-child relationship.
**Can a parent log for someone else's child?** No — `is_parent_of_student` checks `student_guardians` → `guardians.user_id`.

### practice_streaks

| Operation | Policy Name | Who | Condition |
|-----------|-------------|-----|-----------|
| SELECT | "Staff can view org streaks" | Staff | `is_org_staff(auth.uid(), org_id)` |
| SELECT | "Parent can view child streaks" | Parents | `has_org_role(…, 'parent') AND is_parent_of_student(…)` |
| INSERT | "Users can insert own streaks" | Org members | `is_org_member(auth.uid(), org_id)` |
| UPDATE | "Users can update own streaks" | Org members | `is_org_member(auth.uid(), org_id)` |
| DELETE | — | **Nobody** | No policy exists |

**Cross-org write prevention:** Fixed in `20260315100000`. Previously had `WITH CHECK(true)` / `USING(true)` allowing any authenticated user to write any org's streaks.
**Current state:** INSERT/UPDATE require `is_org_member`. However, normal operations go through the `SECURITY DEFINER` trigger which bypasses RLS entirely.

> **Note on F3:** The INSERT/UPDATE policies on `practice_streaks` only matter if a client attempts direct writes. The trigger path (which is the normal flow) bypasses RLS. A malicious client could attempt a direct INSERT into `practice_streaks` — the `is_org_member` check prevents cross-org writes but allows any org member (including parents) to fabricate streak records. Consider restricting to `is_org_staff` or removing client-side write access entirely (trigger-only writes).

---

## 4. Streak Mechanics Analysis

### How calculated
- **Real-time trigger:** `AFTER INSERT ON practice_logs` fires `update_practice_streak()`.
- Increments streak if `practice_date = last_practice_date + 1` (consecutive calendar day).
- Resets to 1 if gap > 1 day.
- Same-day duplicates are ignored (no streak change).
- **Backdated logs:** Currently silently ignored (regression from F1).

### What breaks a streak
- Missing a calendar day (gap > 1 day from last practice date).
- `reset_stale_streaks()` cron job resets streaks where `last_practice_date < CURRENT_DATE - 2`.

### Timezone awareness
- **Not timezone-aware.** Uses `DATE` type (no timezone) and `CURRENT_DATE` (server timezone).
- The 2-day grace window in `reset_stale_streaks()` provides a partial buffer but does not solve the core issue.
- A student in UTC-12 practicing at 11pm local time could have their date interpreted as the next day in UTC.

### Configurability
- Streak break threshold is hardcoded (1 day gap).
- Milestone thresholds are hardcoded (3, 7, 14, 30, 60, 100).
- Not configurable per-org or per-student.

---

## 5. Verdict

### Overall: PASS with caveats

The practice tracking feature has a solid architecture with proper RLS separation between staff and parents, cross-org isolation, and a well-designed streak system with milestone notifications.

### Must Fix (before production)

| # | Issue | Risk |
|---|-------|------|
| **F1** | Backdated-log recalculation regression | Streak counts will be wrong when parents log practice for previous days (common use case). The webhook migration (`20260303180000`) must be updated to include the backdated recalculation logic from `20260222225228`. |

### Should Fix (soon)

| # | Issue | Risk |
|---|-------|------|
| **F2** | `student_id`/`org_id` mismatch in trigger | Low probability but could create cross-org streak records. Add a check that `student_id` belongs to `org_id`. |
| **F4** | Timezone-naive streaks | Users in extreme timezones (UTC+12/UTC-12) may see incorrect streak behavior. Consider storing user timezone on org or student and using it for date calculations. |
| **F3/Note** | `practice_streaks` INSERT open to any org member | Parents could fabricate streak records via direct INSERT. Consider restricting to staff-only or removing client write policies (trigger handles all writes). |

### Nice to Have

| # | Issue |
|---|-------|
| **F5** | Add admin DELETE policy on `practice_logs` for error correction |
| **F6** | Add FK on `teacher_user_id` → `auth.users(id)` |
| **F7** | Add DB-level dedup constraint (e.g., unique on `student_id, practice_date, duration_minutes, created_at` truncated to minute) |
| **F8** | Add `org_id` scoping to `useUpdateAssignment` and `useDeleteAssignment` mutations |
