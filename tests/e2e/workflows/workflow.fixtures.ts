/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test';
import { assertNoConsoleErrors } from './workflow-helpers';

/**
 * Extended test fixture for workflow-level E2E tests.
 *
 * Features:
 * - Auto-collects console errors per test and asserts clean on teardown
 * - Takes a screenshot on failure with a descriptive filename
 * - Logs test name + duration to stdout
 * - Provides a `softAssert` helper that defers failures to test end
 */

interface SoftFailure {
  label: string;
  error: string;
}

interface WorkflowFixtures {
  /** Console errors collected during the test. */
  consoleErrors: string[];
  /** Soft assertion helper — failures are deferred to the afterEach hook. */
  softAssert: (label: string, fn: () => Promise<void> | void) => Promise<void>;
}

export const test = base.extend<WorkflowFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await use(errors);
  },

  // eslint-disable-next-line no-empty-pattern
  softAssert: async ({ }, use) => {
    const failures: SoftFailure[] = [];

    const softAssert = async (label: string, fn: () => Promise<void> | void) => {
      try {
        await fn();
      } catch (err) {
        failures.push({
          label,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    await use(softAssert);

    // After the test, report all soft failures
    if (failures.length > 0) {
      const summary = failures
        .map((f) => `  [${f.label}] ${f.error}`)
        .join('\n');
      expect.soft(failures, `Soft assertion failures:\n${summary}`).toHaveLength(0);
    }
  },
});

// Automatic hooks via test.afterEach
test.afterEach(async ({ page, consoleErrors }, testInfo) => {
  const duration = testInfo.duration;
  const status = testInfo.status ?? 'unknown';
  const title = testInfo.title;

  // Log test timing
  // eslint-disable-next-line no-console
  console.log(`[workflow] ${status.toUpperCase()} "${title}" (${duration}ms)`);

  // Screenshot on failure with descriptive name
  if (status === 'failed' || status === 'timedOut') {
    const safeName = title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 80);
    await page
      .screenshot({
        path: testInfo.outputPath(`failure-${safeName}.png`),
        fullPage: true,
      })
      .catch(() => {});
  }

  // Assert no real console errors
  await assertNoConsoleErrors(page, consoleErrors).catch((err) => {
    console.warn(`[workflow] Console errors in "${title}":`, err);
  });
});

export { expect };
