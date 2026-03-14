/**
 * Shared helpers for the Complete System Test suite.
 * Uses Patrick's test accounts in the "E2E Test Academy" org.
 */
import { Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { AUTH, goTo, waitForPageReady, generateTestId } from '../../helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Patrick's org
export const PATRICK_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';

// Re-export existing AUTH states (these map to the .env.test E2E accounts)
export { AUTH };

// Unique prefix for this test run — used in names for cleanup
export const TEST_RUN_ID = generateTestId();

// Student names for this run
export const STUDENTS = {
  oliver: { firstName: `Oliver_${TEST_RUN_ID}`, lastName: 'Test' },
  emma: { firstName: `Emma_${TEST_RUN_ID}`, lastName: 'Test' },
  lily: { firstName: `Lily_${TEST_RUN_ID}`, lastName: 'Test' },
};

export const GUARDIANS = {
  sarah: { firstName: 'Sarah', lastName: `Test_${TEST_RUN_ID}`, email: `sarah_${TEST_RUN_ID}@test.lessonloop.net` },
  james: { firstName: 'James', lastName: `Test_${TEST_RUN_ID}`, email: `james_${TEST_RUN_ID}@test.lessonloop.net` },
  rachel: { firstName: 'Rachel', lastName: `Test_${TEST_RUN_ID}`, email: `rachel_${TEST_RUN_ID}@test.lessonloop.net` },
};

/**
 * Navigate to a page and wait for main content, with retry.
 */
export async function safeGoTo(page: Page, urlPath: string) {
  await goTo(page, urlPath);
  const mainVisible = await page.locator('main').first().isVisible({ timeout: 20_000 }).catch(() => false);
  if (!mainVisible) {
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 });
  }
}

/**
 * Click a button and wait briefly for network settle.
 */
export async function clickButton(page: Page, name: string | RegExp) {
  const btn = page.getByRole('button', { name }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();
  await page.waitForTimeout(500);
}

/**
 * Expect a toast notification.
 */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-radix-collection-item]').filter({ hasText: text })
    .or(page.locator('[data-state="open"][role="status"]').filter({ hasText: text }));
  await expect(toast.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Assert no horizontal overflow (mobile test).
 */
export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, 'No horizontal overflow').toBe(false);
}

/**
 * Assert a dialog is visible.
 */
export async function expectDialog(page: Page) {
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}
