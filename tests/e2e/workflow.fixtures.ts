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
 *   test('does something', async ({ page, errorTracker, assertCleanRun, softAssert }) => {
 *     // errorTracker automatically captures console errors, rejections, and 5xx
 *     await page.goto('/dashboard');
 *
 *     // softAssert collects failures without stopping the test:
 *     softAssert(1 === 1, 'math works');
 *     softAssert(false, 'this fails but test continues');
 *
 *     assertCleanRun(); // throws if any errors were collected
 *     // soft assertion failures are reported automatically after the test
 *   });
 * });
 * ```
 */
import { test as base, expect as baseExpect } from '@playwright/test';
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
   */
  errorTracker: ErrorTracker;

  /**
   * Convenience assertion — calls `assertCleanErrorTracker(errorTracker)`.
   * Throws if any console errors or unhandled rejections were collected.
   */
  assertCleanRun: () => void;

  /**
   * Collects assertion failures without stopping the test.
   * All failures are reported together after the test finishes.
   *
   * ```ts
   * softAssert(condition, 'description of what went wrong');
   * ```
   */
  softAssert: (condition: boolean, message: string) => void;
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

  // Collect soft-assertion failures and report them after the test.
  softAssert: async ({}, use, testInfo) => {
    const failures: string[] = [];
    const fn = (condition: boolean, message: string) => {
      if (!condition) {
        failures.push(message);
      }
    };
    await use(fn);

    // After test: report all collected failures
    if (failures.length > 0) {
      const summary = failures.map((f, i) => `  ${i + 1}. ${f}`).join('\n');
      baseExpect(
        failures,
        `Soft assertion failures in "${testInfo.title}":\n${summary}`,
      ).toHaveLength(0);
    }
  },
});

export { expect } from '@playwright/test';
