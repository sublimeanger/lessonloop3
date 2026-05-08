/**
 * 04 — Onboarding wizard (`/onboarding`)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §4
 *
 * Tests cover the full multi-step wizard: welcome → teaching →
 * migration → plan → loading → success/error. Includes profile-ensure
 * self-heal, idempotency, network failure paths, and `?new=true`
 * forcing re-render.
 *
 * **Pre-requisite**: requires a fresh user that hasn't completed
 * onboarding. To run these, the test must create a throwaway auth
 * user via supabase admin API, run the wizard, then delete the user.
 *
 * For now, scaffolded with TODOs — needs throwaway-user seed helper
 * before they can run.
 */

import { test } from './_fixtures/auth-refresh';

test.describe('Onboarding wizard', () => {
  test.fixme('solo teacher happy path (no migration, no import)', async () => {
    // 1. Create throwaway user, sign in, force /onboarding?new=true
    // 2. Welcome step: fill name, select org_type=solo_teacher, Continue
    // 3. Teaching step: skip orgName (solo), select studentCount, instruments, Continue
    // 4. Migration step: select 'starting_fresh', Continue
    // 5. Plan step: assert 'solo_teacher' is recommended, Continue
    // 6. Loading: progress bar 0→100, success
    // 7. Verify: organisations row created, subscription_plan='solo_teacher',
    //    trial_ends_at = now()+14d, profiles.has_completed_onboarding=true
  });

  test.fixme('studio with team size 5 + CSV migration', async () => {
    // …upload CSV with 3 students → see studentsCreated=3, guardiansCreated=3
  });

  test.fixme('profile missing on mount → profile-ensure self-heals', async () => {
    // Delete profiles row directly, navigate to /onboarding,
    // assert wizard renders without error after profile-ensure runs
  });

  test.fixme('existing membership → wizard skipped, redirects to /dashboard', async () => {});

  test.fixme('?new=true forces wizard render even when has_completed_onboarding=true', async () => {});

  test.fixme('network timeout (mock 30s+ delay) → error state with retry CTA', async () => {});

  test.fixme('backend 500 → error state, error message visible', async () => {});

  test.fixme('idempotency: rapid double-click on Submit detects existing membership', async () => {});

  test.fixme('localStorage state persists across reload at step 3', async () => {});
});
