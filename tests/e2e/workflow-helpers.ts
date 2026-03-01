/**
 * Shared helpers for workflow E2E tests.
 *
 * These are higher-level utilities that build on top of the base helpers
 * in ./helpers.ts. Import from here when writing workflow-level tests
 * that need error tracking, page assertions, performance measurement,
 * dialog handling, or mobile-specific interactions.
 */
import { Page, expect } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, expectToast } from './helpers';

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

/* ------------------------------------------------------------------ */
/*  Data factory helpers                                               */
/* ------------------------------------------------------------------ */

export interface CreateStudentData {
  firstName: string;
  lastName: string;
  email?: string;
  instrument?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
}

/**
 * Create a student through the Add Student wizard.
 *
 * Navigates to /students, opens the wizard, completes all 3 steps,
 * waits for the success toast, and returns the full student name.
 */
export async function createStudentViaWizard(
  page: Page,
  data: CreateStudentData,
): Promise<string> {
  await goTo(page, '/students');
  await assertPageLoaded(page, 'Students');

  // Open the wizard
  await page.getByRole('button', { name: /add student/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Step 1: Student Info ──
  await page.locator('#wizard-firstName').fill(data.firstName);
  await page.locator('#wizard-lastName').fill(data.lastName);
  if (data.email) {
    await page.locator('#wizard-email').fill(data.email);
  }
  if (data.instrument) {
    // Instrument is a Select/Combobox — click the trigger then the option
    const instrumentTrigger = page.getByRole('dialog').locator('text=Instrument').locator('..');
    const select = instrumentTrigger.getByRole('combobox').first();
    if (await select.isVisible().catch(() => false)) {
      await select.click();
      await page.getByRole('option', { name: data.instrument }).first().click();
    }
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(500);

  // ── Step 2: Guardian ──
  if (data.guardianName) {
    // Enable the "Add a parent or guardian" switch
    const addGuardianSwitch = page.locator('#add-guardian');
    if (await addGuardianSwitch.isVisible().catch(() => false)) {
      const checked = await addGuardianSwitch.isChecked().catch(() => false);
      if (!checked) await addGuardianSwitch.click();
    }
    await page.waitForTimeout(300);

    // Select "Create new guardian" radio
    const newGuardianRadio = page.locator('#mode-new');
    if (await newGuardianRadio.isVisible().catch(() => false)) {
      await newGuardianRadio.click();
      await page.waitForTimeout(300);
    }

    await page.locator('#new-guardian-name').fill(data.guardianName);
    if (data.guardianEmail) {
      await page.locator('#new-guardian-email').fill(data.guardianEmail);
    }
    if (data.guardianPhone) {
      await page.locator('#new-guardian-phone').fill(data.guardianPhone);
    }
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(500);

  // ── Step 3: Teaching Defaults — skip (all optional) ──
  await page.getByRole('dialog').getByRole('button', { name: 'Create Student' }).click();

  // Wait for success
  await expectToast(page, /student created/i);
  await page.waitForTimeout(500);

  return `${data.firstName} ${data.lastName}`;
}

export interface CreateLessonData {
  studentName: string;
  teacherName?: string;
  date?: string;
  time?: string;
  duration?: string;
  instrument?: string;
  locationName?: string;
  roomName?: string;
}

/**
 * Create a lesson via the calendar's "New Lesson" modal.
 *
 * Navigates to /calendar, opens the full lesson modal,
 * fills fields, saves, and waits for the success toast.
 */
export async function createLessonViaCalendar(
  page: Page,
  data: CreateLessonData,
): Promise<void> {
  await goTo(page, '/calendar');
  await assertPageLoaded(page, 'Calendar');

  // Open the lesson modal — look for "New Lesson" or "Add Lesson" button
  const newLessonBtn = page
    .getByRole('button', { name: /new lesson|add lesson/i })
    .first();
  const hasNewLesson = await newLessonBtn.isVisible().catch(() => false);
  if (hasNewLesson) {
    await newLessonBtn.click();
  } else {
    // Fallback: click an empty time slot to get the quick-create popover,
    // then click "More" to open the full modal
    const timeSlot = page.locator('[data-time-slot]').first();
    if (await timeSlot.isVisible().catch(() => false)) {
      await timeSlot.click();
      await page.waitForTimeout(300);
      const moreBtn = page.getByRole('button', { name: 'More' }).first();
      if (await moreBtn.isVisible().catch(() => false)) {
        await moreBtn.click();
      }
    }
  }
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Select student ──
  // StudentSelector uses a popover with search
  const studentLabel = page.getByRole('dialog').getByText('Student').first();
  const studentTrigger = studentLabel.locator('..').getByRole('button').first();
  if (await studentTrigger.isVisible().catch(() => false)) {
    await studentTrigger.click();
    await page.waitForTimeout(300);
    // Type the student name into the search input
    const searchInput = page.getByPlaceholder('Search students...').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(data.studentName);
      await page.waitForTimeout(500);
      // Click the matching student option
      await page.getByText(data.studentName, { exact: false }).first().click();
      await page.waitForTimeout(300);
    }
  }

  // ── Select teacher (if specified) ──
  if (data.teacherName) {
    const teacherSelect = page.getByRole('dialog').locator('text=Teacher').locator('..');
    const combobox = teacherSelect.getByRole('combobox').first();
    if (await combobox.isVisible().catch(() => false)) {
      await combobox.click();
      await page.getByRole('option', { name: data.teacherName }).first().click();
    }
  }

  // ── Select time (if specified) ──
  if (data.time) {
    const timeSelect = page.getByRole('dialog').locator('text=Time').locator('..');
    const combobox = timeSelect.getByRole('combobox').first();
    if (await combobox.isVisible().catch(() => false)) {
      await combobox.click();
      await page.getByRole('option', { name: data.time }).first().click();
    }
  }

  // ── Select duration (if specified) ──
  if (data.duration) {
    const durationSelect = page.getByRole('dialog').locator('text=Duration').locator('..');
    const combobox = durationSelect.getByRole('combobox').first();
    if (await combobox.isVisible().catch(() => false)) {
      await combobox.click();
      await page.getByRole('option', { name: data.duration }).first().click();
    }
  }

  // ── Save ──
  await page.getByRole('dialog').getByRole('button', { name: 'Create Lesson' }).click();
  await expectToast(page, /lesson created/i);
  await page.waitForTimeout(500);
}

export interface CreateInvoiceData {
  studentName: string;
  amount: number;
  description?: string;
}

/**
 * Create an invoice for a student's guardian.
 *
 * Navigates to /invoices, opens the create modal, fills in a single
 * line item, saves, and waits for the success toast.
 */
export async function createInvoiceForStudent(
  page: Page,
  data: CreateInvoiceData,
): Promise<void> {
  await goTo(page, '/invoices');
  await assertPageLoaded(page, 'Invoices');

  await page.getByRole('button', { name: 'Create Invoice' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Select payer ──
  // First select "Guardian" as payer type (should be default)
  const payerSelect = page.getByRole('dialog').locator('text=Payer').locator('..');
  const payerCombobox = payerSelect.getByRole('combobox').first();
  if (await payerCombobox.isVisible().catch(() => false)) {
    await payerCombobox.click();
    await page.waitForTimeout(300);
    // Search for the student name — the guardian will be listed near them
    await page.getByRole('option').filter({ hasText: new RegExp(data.studentName, 'i') }).first().click();
  }

  // ── Fill line item ──
  const descInput = page.getByRole('dialog').locator('input[placeholder="Description"]').first();
  await descInput.fill(data.description ?? `Lesson — ${data.studentName}`);

  const priceInput = page.getByRole('dialog').locator('input[placeholder="Price"]').first();
  await priceInput.fill(data.amount.toString());

  // ── Save ──
  await page.getByRole('dialog').getByRole('button', { name: 'Create Invoice' }).last().click();
  await expectToast(page, /invoice created/i);
  await page.waitForTimeout(500);
}

/**
 * Send a draft invoice.
 *
 * Finds an invoice matching `invoiceIdentifier` in the list, opens it,
 * clicks Send, confirms the send dialog.
 */
export async function sendInvoice(page: Page, invoiceIdentifier: string): Promise<void> {
  // Find the invoice row/card in the list and click into it
  const invoiceEl = page.getByText(invoiceIdentifier, { exact: false }).first();
  await expect(invoiceEl).toBeVisible({ timeout: 10_000 });
  await invoiceEl.click();
  await page.waitForURL(/\/invoices\//, { timeout: 5_000 });
  await waitForPageReady(page);

  // Click "Send" on the detail page
  await page.getByRole('button', { name: 'Send' }).first().click();
  await page.waitForTimeout(300);

  // Confirm in the send dialog
  const dialog = page.getByRole('dialog').first();
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'Send Invoice' }).click();
  }

  await expectToast(page, /invoice sent/i);
  await page.waitForTimeout(500);
}

/**
 * Mark attendance for a student's lesson on the register page.
 *
 * Navigates to /register, finds the student's lesson row,
 * and clicks the status button.
 */
export async function markAttendance(
  page: Page,
  data: { studentName: string; status: 'present' | 'absent' | 'late' },
): Promise<void> {
  await goTo(page, '/register');
  await assertPageLoaded(page, 'Register');

  // Find the lesson row that contains the student name
  const lessonRow = page
    .locator('.rounded-xl.border')
    .filter({ hasText: data.studentName })
    .first();
  await expect(lessonRow).toBeVisible({ timeout: 10_000 });

  // Expand the row if collapsed (click the row header to expand)
  await lessonRow.click();
  await page.waitForTimeout(300);

  // Click the status button
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  const statusBtn = lessonRow.getByRole('button', { name: statusLabel }).first();
  // fallback: try the single-letter abbreviation (mobile shows P/A/L)
  const altBtn = lessonRow.getByRole('button', { name: data.status[0].toUpperCase() }).first();
  if (await statusBtn.isVisible().catch(() => false)) {
    await statusBtn.click();
  } else if (await altBtn.isVisible().catch(() => false)) {
    await altBtn.click();
  }
  await page.waitForTimeout(500);
}

/**
 * Navigate to a student's detail page by searching for their name.
 *
 * Unlike `goToStudentDetail` (hardcoded to Emma), this accepts any name.
 */
export async function navigateToStudentDetail(
  page: Page,
  studentName: string,
): Promise<void> {
  await goTo(page, '/students');
  await assertPageLoaded(page, 'Students');

  // Use the search input to find the student
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(studentName);
    await page.waitForTimeout(500);
  }

  // Click on the student link
  const studentLink = page.getByText(studentName, { exact: false }).first();
  await expect(studentLink).toBeVisible({ timeout: 10_000 });
  await studentLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
}

/**
 * Wait for all loading states to finish and at least one data element
 * to be visible in the main content area.
 */
export async function waitForDataLoad(page: Page) {
  await waitForPageReady(page);
  // Wait for at least one meaningful data element (link, row, card) in main
  await expect(
    page.locator('main').getByRole('link').first()
      .or(page.locator('main table tbody tr').first())
      .or(page.locator('main .rounded-lg.border').first()),
  ).toBeVisible({ timeout: 15_000 });
}

/** Returns an array of all currently visible toast messages. */
export async function getToastMessages(page: Page): Promise<string[]> {
  const toasts = page.locator('[data-radix-collection-item]');
  const count = await toasts.count();
  const messages: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await toasts.nth(i).textContent();
    if (text) messages.push(text.trim());
  }
  return messages;
}

/** Check all `<img>` elements on the page loaded without errors. */
export async function assertNoBrokenImages(page: Page) {
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src);
  });
  expect(broken, `Broken images: ${broken.join(', ')}`).toHaveLength(0);
}

/**
 * Get the correct storageState path for a role.
 * Use with `test.use({ storageState })` or BrowserContext.
 */
export function getAuthState(role: 'owner' | 'admin' | 'teacher' | 'finance' | 'parent' | 'parent2'): string {
  return AUTH[role];
}
