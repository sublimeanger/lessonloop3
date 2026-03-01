import { Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH = {
  owner: path.join(__dirname, '.auth/owner.json'),
  admin: path.join(__dirname, '.auth/admin.json'),
  teacher: path.join(__dirname, '.auth/teacher.json'),
  finance: path.join(__dirname, '.auth/finance.json'),
  parent: path.join(__dirname, '.auth/parent.json'),
  parent2: path.join(__dirname, '.auth/parent2.json'),
};

/** Wait for any loading spinners to disappear and main content to render */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 5_000 }).catch(() => {});
  await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
}

/** Assert a toast notification appears */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-radix-collection-item]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}

/** Click a sidebar or top-level nav link */
export async function navigateTo(page: Page, linkText: string) {
  await page.getByRole('link', { name: linkText, exact: true }).first().click();
  await waitForPageReady(page);
}

/** Open a dialog via a button */
export async function openDialog(page: Page, buttonText: string | RegExp) {
  await page.getByRole('button', { name: buttonText }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

/** Navigate directly and wait for content.
 *  Handles the Supabase auth race condition: if the route guard redirects
 *  before the async session restore finishes, we retry once.
 */
export async function goTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageReady(page);

  // If auth redirected us away, the session is now warm — retry once
  if (!page.url().includes(path)) {
    await page.goto(path);
    await waitForPageReady(page);
  }
}

/** Expect a page redirect */
export async function expectRedirect(page: Page, path: string, redirectPattern: RegExp) {
  await page.goto(path);
  await page.waitForURL(url => redirectPattern.test(url.toString()), { timeout: 10_000 });
  expect(page.url()).not.toContain(path);
}

/** Assert no error boundary is shown on the current page. */
export async function assertNoErrorBoundary(page: Page) {
  const fullError = await page.getByText('Something went wrong').isVisible().catch(() => false);
  expect(fullError, 'Full-page error boundary should not be visible').toBe(false);

  const sectionError = await page.getByText(/Failed to load/).first().isVisible().catch(() => false);
  expect(sectionError, 'Section error boundary should not be visible').toBe(false);
}

/**
 * Navigate to a page and wait for <main> to appear.
 * Retries the navigation once if main doesn't show up —
 * handles slow Supabase connections in CI.
 */
export async function safeGoTo(page: Page, path: string, pageName = path) {
  await goTo(page, path);

  const mainVisible = await page
    .locator('main')
    .first()
    .isVisible({ timeout: 20_000 })
    .catch(() => false);

  if (!mainVisible) {
    // Retry once — CI can be slow on first navigation
    await page.reload();
    await waitForPageReady(page);
    await expect(
      page.locator('main').first(),
      `${pageName} should have <main> element after retry`,
    ).toBeVisible({ timeout: 20_000 });
  }

  await assertNoErrorBoundary(page);
}

/**
 * Fill a form field by its label text, placeholder, or id.
 * Tries label first, then placeholder, then #id.
 */
export async function fillField(page: Page, labelOrPlaceholder: string, value: string) {
  const byLabel = page.getByLabel(labelOrPlaceholder, { exact: false }).first();
  if (await byLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await byLabel.fill(value);
    return;
  }
  const byPlaceholder = page.getByPlaceholder(labelOrPlaceholder).first();
  if (await byPlaceholder.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await byPlaceholder.fill(value);
    return;
  }
  // Fallback: try lowercase-kebab-case id derived from label
  const id = labelOrPlaceholder.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  await page.locator(`#${id}`).fill(value);
}

/**
 * Select an option from a combobox, select, or dropdown.
 * Clicks the trigger, then clicks the matching option text.
 */
export async function selectOption(page: Page, triggerLabel: string, optionText: string) {
  // Try Radix select / combobox trigger by label
  const trigger = page.getByLabel(triggerLabel, { exact: false }).first()
    .or(page.getByRole('combobox', { name: triggerLabel }).first())
    .or(page.locator(`[data-tour*="${triggerLabel.toLowerCase().replace(/\s+/g, '-')}"]`).first());
  await trigger.first().click();
  await page.waitForTimeout(300);
  // Click the option from the dropdown
  const option = page.getByRole('option', { name: optionText }).first()
    .or(page.getByText(optionText, { exact: false }).first());
  await option.first().click();
  await page.waitForTimeout(200);
}

/**
 * Click a button by name/text and wait for network to settle.
 */
export async function clickButton(page: Page, name: string | RegExp) {
  const btn = page.getByRole('button', { name }).first();
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.click();
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}

/**
 * Wait for a success toast to appear.
 * Checks for common success text patterns if no specific text provided.
 */
export async function expectToastSuccess(page: Page, text?: string | RegExp) {
  const pattern = text ?? /success|created|saved|updated|sent|deleted|added|recorded|completed/i;
  // Radix toast uses data-radix-collection-item, or check by role
  const toast = page.locator('[data-radix-collection-item]').filter({ hasText: pattern })
    .or(page.locator('[data-state="open"][role="status"]').filter({ hasText: pattern }));
  await expect(toast.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Wait for a destructive/error toast to appear.
 */
export async function expectToastError(page: Page, text?: string | RegExp) {
  const pattern = text ?? /error|failed|invalid|could not|unable|problem/i;
  const toast = page.locator('[data-radix-collection-item]').filter({ hasText: pattern })
    .or(page.locator('.destructive[data-state="open"]').filter({ hasText: pattern }));
  await expect(toast.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Close the currently open dialog by clicking X or Cancel.
 */
export async function closeDialog(page: Page) {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible().catch(() => false))) return;
  // Try close (X) button first, then Cancel button
  const closeBtn = dialog.locator('button[aria-label="Close"]')
    .or(dialog.locator('button').filter({ hasText: /^close$/i }))
    .or(dialog.getByRole('button', { name: /cancel/i }));
  if (await closeBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeBtn.first().click();
  } else {
    // Press Escape as fallback
    await page.keyboard.press('Escape');
  }
  await expect(dialog).toBeHidden({ timeout: 5_000 }).catch(() => {});
}

/**
 * Wait for a table or list to have at least `minRows` items of content.
 * Checks for table rows, link elements, or card-like children inside <main>.
 */
export async function waitForTableData(page: Page, minRows = 1) {
  // Try table rows first
  const tableRows = page.locator('main tbody tr, main [role="row"]');
  const hasTableRows = await tableRows.first().isVisible({ timeout: 10_000 }).catch(() => false);
  if (hasTableRows) {
    const count = await tableRows.count();
    expect(count, `Expected at least ${minRows} table rows`).toBeGreaterThanOrEqual(minRows);
    return count;
  }
  // Fallback: count links or cards within main
  const items = page.locator('main').getByRole('link');
  const hasItems = await items.first().isVisible({ timeout: 10_000 }).catch(() => false);
  if (hasItems) {
    const count = await items.count();
    expect(count, `Expected at least ${minRows} list items`).toBeGreaterThanOrEqual(minRows);
    return count;
  }
  return 0;
}

/**
 * Return the main content locator for scoping assertions.
 */
export function getMainContent(page: Page) {
  return page.locator('main').first();
}

/**
 * Count matching elements on the page.
 */
export async function countElements(page: Page, selector: string) {
  return page.locator(selector).count();
}

/**
 * Set up console error tracking on the page.
 * Call at the start of a test, then call the returned function at the end
 * to assert no unexpected console errors occurred.
 *
 * Usage:
 *   const checkErrors = await trackConsoleErrors(page);
 *   // ... do test actions ...
 *   checkErrors(); // asserts no errors
 */
export async function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known benign errors
      if (
        text.includes('Failed to load resource') ||
        text.includes('favicon') ||
        text.includes('ResizeObserver') ||
        text.includes('net::ERR') ||
        text.includes('third-party cookie') ||
        text.includes('Refused to connect') ||
        text.includes('ERR_BLOCKED') ||
        text.includes('postMessage') ||
        text.includes('auth/session')
      ) return;
      errors.push(text);
    }
  });
  return () => {
    expect(errors, `Unexpected console errors: ${errors.join('; ')}`).toEqual([]);
  };
}

/**
 * Generate a unique test identifier to avoid data collisions.
 * Returns a string like "e2e_1709312456789"
 */
export function generateTestId() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Assert the page has no horizontal scroll overflow.
 * Useful for mobile viewport tests.
 */
export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, 'Page should not have horizontal overflow').toBe(false);
}
