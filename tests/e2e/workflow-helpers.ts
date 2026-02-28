/**
 * Shared helpers for workflow E2E tests.
 *
 * These are higher-level utilities that build on top of the base helpers
 * in ./helpers.ts. Import from here when writing workflow-level tests
 * that need error tracking, page assertions, performance measurement,
 * dialog handling, or mobile-specific interactions.
 */
import { Page, expect } from '@playwright/test';
import { waitForPageReady, goTo } from './helpers';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Standard mobile viewport matching iPhone 14 Pro dimensions. */
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Console error patterns that are noisy and not caused by our app. */
const NOISY_ERROR_PATTERNS = [
  'net::ERR_',
  'favicon',
  'ResizeObserver',
  'Download the React DevTools',
  'React DevTools',
] as const;

/* ------------------------------------------------------------------ */
/*  Error tracking                                                     */
/* ------------------------------------------------------------------ */

export interface ErrorTracker {
  /** Console messages with type "error" (filtered through isNoisyConsoleError). */
  consoleErrors: string[];
  /** Unhandled promise rejections (page "pageerror" events). */
  rejections: string[];
  /** HTTP responses with status >= 500. */
  serverErrors: Array<{ status: number; url: string }>;
}

/**
 * Attach listeners to `page` that collect console errors,
 * unhandled rejections, and server 5xx responses.
 *
 * Call once at the start of a test:
 * ```ts
 * const tracker = trackErrors(page);
 * // … do stuff …
 * assertCleanErrorTracker(tracker);
 * ```
 */
export function trackErrors(page: Page): ErrorTracker {
  const tracker: ErrorTracker = {
    consoleErrors: [],
    rejections: [],
    serverErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!isNoisyConsoleError(text)) {
        tracker.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    tracker.rejections.push(err.message);
  });

  page.on('response', (r) => {
    if (r.status() >= 500) {
      tracker.serverErrors.push({ status: r.status(), url: r.url() });
    }
  });

  return tracker;
}

/** Returns true if `text` matches one of the noisy/benign error patterns. */
export function isNoisyConsoleError(text: string): boolean {
  return NOISY_ERROR_PATTERNS.some((p) => text.includes(p));
}

/**
 * Assert that no significant errors were collected by the tracker.
 * Call at the end of a test to enforce a "clean run".
 */
export function assertCleanErrorTracker(tracker: ErrorTracker) {
  expect(
    tracker.consoleErrors,
    `Console errors during test:\n${tracker.consoleErrors.join('\n')}`,
  ).toHaveLength(0);

  expect(
    tracker.rejections,
    `Unhandled promise rejections:\n${tracker.rejections.join('\n')}`,
  ).toHaveLength(0);
}

/* ------------------------------------------------------------------ */
/*  Page assertions                                                    */
/* ------------------------------------------------------------------ */

/** Assert no error boundary is shown on the current page. */
export async function assertNoErrorBoundary(page: Page) {
  const fullError = await page
    .getByText('Something went wrong')
    .isVisible()
    .catch(() => false);
  expect(fullError, 'Full-page error boundary should not be visible').toBe(false);

  const sectionError = await page
    .getByText(/Failed to load/)
    .first()
    .isVisible()
    .catch(() => false);
  expect(sectionError, 'Section error boundary should not be visible').toBe(false);
}

/** Assert a page loaded its `<main>` content without error boundaries. */
export async function assertPageLoaded(page: Page, pageName: string) {
  await expect(
    page.locator('main').first(),
    `${pageName} should have <main> element`,
  ).toBeVisible({ timeout: 15_000 });
  await assertNoErrorBoundary(page);
}

/**
 * Assert no horizontal overflow exists on the current page.
 * Use on mobile viewport tests to catch elements breaking the layout.
 */
export async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, 'Page should not have horizontal overflow').toBe(false);
}

/* ------------------------------------------------------------------ */
/*  Performance measurement                                            */
/* ------------------------------------------------------------------ */

/**
 * Log a performance metric to stdout for CI capture.
 *
 * @param name  - Metric name (e.g. "dashboard_load")
 * @param value - Numeric or string value
 * @param prefix - Log prefix (default: "perf")
 */
export function logMetric(name: string, value: number | string, prefix = 'perf') {
  const suffix = typeof value === 'number' ? `${value}ms` : value;
  // eslint-disable-next-line no-console
  console.log(`[${prefix}] ${name}: ${suffix}`);
}

/**
 * Measure milliseconds until `selector` becomes visible (or timeout).
 *
 * ```ts
 * const ms = await timeUntilVisible(page, page.getByText('Dashboard'));
 * expect(ms).toBeLessThan(3_000);
 * ```
 */
export async function timeUntilVisible(
  page: Page,
  selector: string | ReturnType<Page['locator']>,
  timeout = 15_000,
): Promise<number> {
  const start = Date.now();
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  await expect(locator).toBeVisible({ timeout });
  return Date.now() - start;
}

/**
 * Navigate via client-side routing (popstate) without a full page reload.
 * Falls back to `page.goto` if the SPA doesn't pick up the event.
 */
export async function clientNavigate(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  if (!page.url().includes(path)) {
    await page.goto(path);
  }
  await waitForPageReady(page);
}

/* ------------------------------------------------------------------ */
/*  Dialog helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Wait for a DeleteValidationDialog (AlertDialog) to finish loading.
 * These show "Checking dependencies…" first, then the result.
 */
export async function waitForDeleteValidationResult(page: Page): Promise<{
  isBlocked: boolean;
  hasWarnings: boolean;
  dialogText: string;
}> {
  const dialog = page.locator('[role="alertdialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await expect(dialog.getByText('Checking dependencies…'))
    .toBeHidden({ timeout: 10_000 })
    .catch(() => {});

  await page.waitForTimeout(500);

  const dialogText = (await dialog.textContent()) ?? '';
  return {
    isBlocked: dialogText.includes('Cannot Delete'),
    hasWarnings: dialogText.includes('Are you sure you want to delete'),
    dialogText,
  };
}

/** Close an AlertDialog via the Close/Cancel button or Escape. */
export async function closeAlertDialog(page: Page) {
  const dialog = page.locator('[role="alertdialog"]').first();
  const closeBtn = dialog.getByRole('button', { name: /close|cancel/i }).first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  } else {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

/* ------------------------------------------------------------------ */
/*  Mobile helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Open the mobile sidebar menu via the SidebarTrigger button.
 * The trigger uses `data-sidebar="trigger"` and renders a Sheet overlay.
 */
export async function openMobileMenu(page: Page) {
  const trigger = page.locator('[data-sidebar="trigger"]').first();
  await expect(trigger).toBeVisible({ timeout: 5_000 });
  await trigger.click();
  await page.waitForTimeout(400);
}

/** Click a sidebar nav link by exact title text. */
export async function clickSidebarLink(page: Page, title: string) {
  const link = page.getByRole('link', { name: title, exact: true }).first();
  await expect(link).toBeVisible({ timeout: 5_000 });
  await link.click();
  await waitForPageReady(page);
}

/* ------------------------------------------------------------------ */
/*  Student & credit helpers                                           */
/* ------------------------------------------------------------------ */

/** Navigate to /students, find "Emma", click into her detail page. */
export async function goToStudentDetail(page: Page) {
  await goTo(page, '/students');
  const emmaLink = page.getByText(/emma/i).first();
  await expect(emmaLink).toBeVisible({ timeout: 15_000 });
  await emmaLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
}

/** Navigate to a student's Credits tab (via Emma's detail page). */
export async function goToCreditsTab(page: Page) {
  await goToStudentDetail(page);
  await page.getByRole('tab', { name: 'Credits' }).click();
  await page.waitForTimeout(500);
  await waitForPageReady(page);
}

/** Read the "Available Balance" value from the credits panel. Returns e.g. "£30.00". */
export async function readAvailableBalance(page: Page): Promise<string> {
  const balanceEl = page.locator('text=Available Balance').locator('..');
  const text = await balanceEl.textContent();
  const match = text?.match(/[£$]\d+[\d,.]*/) ?? null;
  return match ? match[0] : '£0.00';
}

/** Parse a £-prefixed currency string to a number: "£30.00" → 30. */
export function parseCurrency(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

/* ------------------------------------------------------------------ */
/*  Continuation helpers                                               */
/* ------------------------------------------------------------------ */

/** Navigate to /continuation and wait for the page to be ready. */
export async function goToContinuation(page: Page) {
  await goTo(page, '/continuation');
  await expect(
    page
      .getByText(/term continuation/i)
      .first()
      .or(page.getByText(/no continuation runs/i).first()),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Determine whether an active continuation run exists on the page.
 * Returns true if a run status badge is visible.
 */
export async function hasActiveRun(page: Page): Promise<boolean> {
  const statusBadges = page.getByText(
    /Draft|Collecting Responses|Reminding|Deadline Passed/,
  );
  return (await statusBadges.count()) > 0;
}

/** Extract visible summary stat values from the four continuation stats cards. */
export async function readContinuationStats(page: Page) {
  const readStat = async (label: string) => {
    const card = page
      .locator('.grid .border, [class*="card"]')
      .filter({ hasText: label })
      .first();
    const visible = await card.isVisible().catch(() => false);
    if (!visible) return 0;
    const boldNum = card.locator('.text-2xl').first();
    const text = await boldNum.textContent().catch(() => '0');
    return parseInt(text?.trim() || '0', 10);
  };

  return {
    confirmed: await readStat('Confirmed'),
    pending: await readStat('Pending'),
    withdrawing: await readStat('Withdrawing'),
    noResponse: await readStat('No Response'),
  };
}
