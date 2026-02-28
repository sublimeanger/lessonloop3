/**
 * Playwright test fixtures for workflow E2E tests.
 *
 * Usage in a workflow spec file:
 * ```ts
 * import { test, expect } from '../workflow.fixtures';
 * import { AUTH } from '../helpers';
 *
 * test.describe('My Workflow', () => {
 *   test.use({ storageState: AUTH.owner });
 *
 *   test('does something', async ({ page, errorTracker, assertCleanRun }) => {
 *     // errorTracker automatically captures console errors, rejections, and 5xx
 *     await page.goto('/dashboard');
 *     // …
 *     assertCleanRun(); // throws if any errors were collected
 *   });
 * });
 * ```
 */
import { test as base } from '@playwright/test';
import {
  trackErrors,
  assertCleanErrorTracker,
  type ErrorTracker,
} from './workflow-helpers';

/* ------------------------------------------------------------------ */
/*  Fixture types                                                      */
/* ------------------------------------------------------------------ */

type WorkflowFixtures = {
  /**
   * Automatically captures console errors, unhandled rejections, and
   * HTTP 5xx responses for the lifetime of the test.
   *
   * Access the arrays directly when you need custom filtering:
   * ```ts
   * expect(errorTracker.serverErrors).toHaveLength(0);
   * ```
   */
  errorTracker: ErrorTracker;

  /**
   * Convenience assertion — calls `assertCleanErrorTracker(errorTracker)`.
   * Throws if any console errors or unhandled rejections were collected.
   *
   * ```ts
   * assertCleanRun();
   * ```
   */
  assertCleanRun: () => void;
};

/* ------------------------------------------------------------------ */
/*  Extended test                                                      */
/* ------------------------------------------------------------------ */

export const test = base.extend<WorkflowFixtures>({
  // Auto-attach error listeners to the page for every test.
  errorTracker: async ({ page }, use) => {
    const tracker = trackErrors(page);
    await use(tracker);
  },

  // Wrap the clean-run assertion as a simple callable.
  assertCleanRun: async ({ errorTracker }, use) => {
    await use(() => assertCleanErrorTracker(errorTracker));
  },
});

export { expect } from '@playwright/test';
