import { Page, expect, BrowserContext } from '@playwright/test';
import { goTo, waitForPageReady, expectToast, AUTH } from '../helpers';

// ═══════════════════════════════════════════════════════════
// 1. createStudentViaWizard
// ═══════════════════════════════════════════════════════════

export interface CreateStudentOpts {
  firstName: string;
  lastName: string;
  guardian?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  instrument?: string;
}

/**
 * Open the Add Student wizard, fill required fields, optionally add a guardian,
 * and complete creation. Handles duplicate detection dialog.
 *
 * @returns The full name "{firstName} {lastName}".
 */
export async function createStudentViaWizard(
  page: Page,
  opts: CreateStudentOpts,
): Promise<string> {
  await goTo(page, '/students');

  const addBtn = page.locator('[data-tour="add-student-button"]').first()
    .or(page.getByRole('button', { name: /add student/i }).first());
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Step 1: Student Details ──
  await page.locator('#wizard-firstName').fill(opts.firstName);
  await page.locator('#wizard-lastName').fill(opts.lastName);

  if (opts.instrument) {
    const instrumentSelect = page.getByRole('dialog').getByLabel(/instrument/i).first();
    if (await instrumentSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await instrumentSelect.click();
      await page.getByText(opts.instrument, { exact: false }).first().click();
    }
  }

  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(500);

  // ── Step 2: Guardian ──
  if (opts.guardian) {
    const guardianToggle = page.locator('#add-guardian');
    if (await guardianToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const isChecked = await guardianToggle.isChecked();
      if (!isChecked) await guardianToggle.click();
      await page.waitForTimeout(300);
    }

    // Select "new" guardian mode if radio exists
    const newRadio = page.getByRole('dialog').getByLabel(/new/i).first();
    if (await newRadio.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await newRadio.click();
    }

    const gFirstName = page.getByRole('dialog').getByLabel(/first name/i).last();
    const gLastName = page.getByRole('dialog').getByLabel(/last name/i).last();
    const gEmail = page.getByRole('dialog').getByLabel(/email/i).last();

    if (await gFirstName.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gFirstName.fill(opts.guardian.firstName);
    }
    if (await gLastName.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await gLastName.fill(opts.guardian.lastName);
    }
    if (await gEmail.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await gEmail.fill(opts.guardian.email);
    }
    if (opts.guardian.phone) {
      const gPhone = page.getByRole('dialog').getByLabel(/phone/i).last();
      if (await gPhone.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await gPhone.fill(opts.guardian.phone);
      }
    }
  }

  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(500);

  // ── Step 3: Teaching Setup — submit ──
  const createBtn = page.getByRole('button', { name: /create student/i });
  await expect(createBtn).toBeVisible({ timeout: 5_000 });
  await createBtn.click();

  // Handle duplicate detection
  const dupDialog = page.getByText(/possible duplicate/i);
  if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /continue anyway/i }).click();
  }

  await expectToast(page, /student created/i);
  return `${opts.firstName} ${opts.lastName}`;
}

// ═══════════════════════════════════════════════════════════
// 2. createLessonViaCalendar
// ═══════════════════════════════════════════════════════════

export interface CreateLessonOpts {
  studentName: string;
  teacherName?: string;
  day?: string;
  time?: string;
  duration?: number;
  location?: string;
}

/**
 * Open the New Lesson modal from the calendar, fill the form, and save.
 * Uses data-tour selectors and the StudentSelector search popover.
 */
export async function createLessonViaCalendar(
  page: Page,
  opts: CreateLessonOpts,
): Promise<{ studentName: string; duration: number }> {
  await goTo(page, '/calendar');

  const newBtn = page.locator('[data-tour="create-lesson-button"]').first()
    .or(page.getByRole('button', { name: /new lesson/i }).first());
  await expect(newBtn).toBeVisible({ timeout: 15_000 });
  await newBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Teacher ──
  if (opts.teacherName) {
    const teacherTrigger = page.getByRole('dialog').locator('button').filter({ hasText: /select teacher/i }).first();
    if (await teacherTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teacherTrigger.click();
      await page.getByText(opts.teacherName, { exact: false }).first().click();
      await page.waitForTimeout(300);
    }
  }

  // ── Student via StudentSelector ──
  const studentTrigger = page.getByRole('dialog').locator('button').filter({ hasText: /select student/i }).first();
  if (await studentTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await studentTrigger.click();
    await page.waitForTimeout(300);
    const searchInput = page.getByPlaceholder(/search/i).last();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(opts.studentName);
      await page.waitForTimeout(500);
    }
    await page.getByText(opts.studentName, { exact: false }).first().click();
    await page.waitForTimeout(300);
  }

  // ── Date ──
  if (opts.day) {
    const dateInput = page.getByRole('dialog').getByLabel(/date/i).first();
    if (await dateInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dateInput.fill(opts.day);
    }
  }

  // ── Time ──
  if (opts.time) {
    const timeInput = page.getByRole('dialog').getByLabel(/time/i).first();
    if (await timeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await timeInput.fill(opts.time);
    }
  }

  // ── Duration ──
  const dur = opts.duration ?? 30;
  const durOption = page.getByRole('dialog').getByText(new RegExp(`^${dur}\\s*m`, 'i')).first();
  if (await durOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await durOption.click();
  }

  // ── Location ──
  if (opts.location) {
    const locationTrigger = page.getByRole('dialog').locator('button').filter({ hasText: /select location/i }).first();
    if (await locationTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationTrigger.click();
      await page.getByText(opts.location, { exact: false }).first().click();
    }
  }

  // ── Submit ──
  const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create lesson/i });
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  await expectToast(page, /lesson created/i);
  return { studentName: opts.studentName, duration: dur };
}

// ═══════════════════════════════════════════════════════════
// 3. createInvoiceForStudent
// ═══════════════════════════════════════════════════════════

export interface CreateInvoiceOpts {
  guardianName: string;
  amount: number;
  description?: string;
}

/**
 * Open the Create Invoice modal, fill a manual line item, and save as draft.
 * Uses the "Manual Entry" tab.
 *
 * @returns The line-item description used.
 */
export async function createInvoiceForStudent(
  page: Page,
  opts: CreateInvoiceOpts,
): Promise<string> {
  await goTo(page, '/invoices');

  const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
    .or(page.getByRole('button', { name: /create invoice/i }).first());
  await expect(createBtn).toBeVisible({ timeout: 15_000 });
  await createBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // Ensure "Manual Entry" tab
  const manualTab = page.getByRole('dialog').getByRole('tab', { name: /manual/i }).first();
  if (await manualTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await manualTab.click();
    await page.waitForTimeout(300);
  }

  // ── Payer ──
  const payerTrigger = page.getByRole('dialog').locator('button').filter({ hasText: /select payer/i }).first();
  if (await payerTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await payerTrigger.click();
    await page.waitForTimeout(300);
    await page.getByText(opts.guardianName, { exact: false }).first().click();
    await page.waitForTimeout(300);
  }

  // ── Line item ──
  const desc = opts.description ?? 'Lesson fees';
  const descInput = page.getByRole('dialog').getByPlaceholder(/description/i).first();
  await descInput.fill(desc);

  const priceInput = page.getByRole('dialog').getByPlaceholder(/price/i).first();
  await priceInput.fill(String(opts.amount));

  // ── Submit ──
  const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create invoice/i });
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  // Modal closes on success
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
  return desc;
}

// ═══════════════════════════════════════════════════════════
// 4. sendInvoice
// ═══════════════════════════════════════════════════════════

/**
 * Navigate to an invoice detail page (by searching for the guardian name),
 * open the SendInvoiceModal, step through compose → preview, and send.
 */
export async function sendInvoice(
  page: Page,
  guardianName: string,
): Promise<void> {
  await goTo(page, '/invoices');

  // Search for the invoice
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await search.fill(guardianName);
    await page.waitForTimeout(500);
  }

  // Click the invoice row to open detail
  const row = page.locator('main').getByText(guardianName, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
  await waitForPageReady(page);

  // Click the "Send" button (visible when status is 'draft')
  const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
  await expect(sendBtn).toBeVisible({ timeout: 10_000 });
  await sendBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // Step through compose → preview if there are multiple steps
  const nextOrSend = page.getByRole('dialog').getByRole('button', { name: /next|send invoice/i }).first();
  await expect(nextOrSend).toBeVisible({ timeout: 5_000 });
  await nextOrSend.click();
  await page.waitForTimeout(500);

  // If there's a preview step with its own send button, click it
  const finalSend = page.getByRole('dialog').getByRole('button', { name: /send invoice/i }).first();
  if (await finalSend.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await finalSend.click();
  }

  await expectToast(page, /invoice sent/i);
}

// ═══════════════════════════════════════════════════════════
// 5. markAttendance
// ═══════════════════════════════════════════════════════════

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Cxl (T)' | 'Cxl (S)';

/**
 * Navigate to the daily register page and mark a student with the given status.
 * Looks for the student row and clicks the matching status button.
 */
export async function markAttendance(
  page: Page,
  studentName: string,
  status: AttendanceStatus,
): Promise<void> {
  await goTo(page, '/register');

  // Find the row containing the student name
  const studentRow = page.locator('main').locator('tr, [role="row"], div').filter({ hasText: studentName }).first();
  await expect(studentRow).toBeVisible({ timeout: 15_000 });

  // Click the status button within that row
  const statusBtn = studentRow.getByRole('button', { name: new RegExp(`^${status}$`, 'i') }).first()
    .or(studentRow.locator('button').filter({ hasText: new RegExp(`^${status}$`, 'i') }).first());
  await expect(statusBtn).toBeVisible({ timeout: 5_000 });
  await statusBtn.click();
  await page.waitForTimeout(300);
}

// ═══════════════════════════════════════════════════════════
// 6. navigateToStudentDetail
// ═══════════════════════════════════════════════════════════

/**
 * Navigate to /students, search for a student by name, click to open their
 * detail page, and wait for the detail page to load.
 *
 * @returns true if navigation succeeded, false if student not found.
 */
export async function navigateToStudentDetail(
  page: Page,
  studentName: string,
): Promise<boolean> {
  await goTo(page, '/students');

  // Use search to filter
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await search.fill(studentName);
    await page.waitForTimeout(500);
  }

  const link = page.locator('main').getByText(studentName, { exact: false }).first();
  if (!(await link.isVisible({ timeout: 15_000 }).catch(() => false))) {
    return false;
  }
  await link.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
  return true;
}

// ═══════════════════════════════════════════════════════════
// 7. switchToRole
// ═══════════════════════════════════════════════════════════

export type RoleName = keyof typeof AUTH;

/**
 * Apply the storageState for a given role to the current browser context.
 * After calling this, subsequent navigations will use the new role's session.
 */
export async function switchToRole(
  context: BrowserContext,
  role: RoleName,
): Promise<void> {
  const statePath = AUTH[role];
  await context.storageState({ path: statePath });
  // Clear cookies and re-apply to force a session refresh
  await context.clearCookies();
  const fs = await import('fs');
  const stateStr = fs.readFileSync(statePath, 'utf-8');
  const state = JSON.parse(stateStr);
  if (state.cookies?.length) {
    await context.addCookies(state.cookies);
  }
}

// ═══════════════════════════════════════════════════════════
// 8. assertNoConsoleErrors
// ═══════════════════════════════════════════════════════════

const BENIGN_ERROR_PATTERNS = [
  'favicon',
  'net::',
  'Failed to fetch',
  '401',
  '403',
  'ResizeObserver',
  'postMessage',
  'AbortError',
  'ChunkLoadError',
  'Loading chunk',
  'status of 404',
  'Failed to load resource',
  'Download the React DevTools',
  'third-party cookie',
  'Permissions-Policy',
];

/**
 * Collect console errors from the page and assert none are present,
 * filtering out known benign warnings (network, auth, chunk loading, etc.).
 *
 * @returns The list of real (non-benign) console errors.
 */
export async function assertNoConsoleErrors(
  page: Page,
  errors: string[],
): Promise<string[]> {
  const real = errors.filter(
    (e) => !BENIGN_ERROR_PATTERNS.some((pattern) => e.includes(pattern)),
  );
  expect(real, `Console errors: ${real.join(', ')}`).toHaveLength(0);
  return real;
}

// ═══════════════════════════════════════════════════════════
// 9. assertNoBrokenImages
// ═══════════════════════════════════════════════════════════

/**
 * Check all <img> elements on the page and assert none have broken src
 * (naturalWidth === 0 indicates the image failed to load).
 */
export async function assertNoBrokenImages(page: Page): Promise<void> {
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src);
  });
  expect(broken, `Broken images: ${broken.join(', ')}`).toHaveLength(0);
}

// ═══════════════════════════════════════════════════════════
// 10. waitForDataLoad
// ═══════════════════════════════════════════════════════════

/**
 * A more robust data-loading wait that goes beyond waitForPageReady.
 * Gates on: <main> visible → network idle → no .animate-spin spinners →
 * optional content selector visible.
 */
export async function waitForDataLoad(
  page: Page,
  contentSelector?: string,
): Promise<void> {
  // Auth/org init gate
  await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 });

  // Network quiesce
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // All spinners gone
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-spin').length === 0,
      { timeout: 10_000 },
    );
  } catch { /* no spinners */ }

  // Optional: wait for specific content to appear
  if (contentSelector) {
    await expect(page.locator(contentSelector).first()).toBeVisible({ timeout: 15_000 });
  }
}

// ═══════════════════════════════════════════════════════════
// 11. getToastMessages
// ═══════════════════════════════════════════════════════════

/**
 * Return text content of all currently visible toast notifications.
 * Uses Radix UI toast collection items which are the toast elements in LessonLoop.
 */
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

// ═══════════════════════════════════════════════════════════
// 12. TestCleanup
// ═══════════════════════════════════════════════════════════

/** Tracks entities created during a test so callers can identify them later. */
export class TestCleanup {
  readonly students: string[] = [];
  readonly invoiceRefs: string[] = [];
  readonly leads: string[] = [];
  readonly messages: string[] = [];

  addStudent(name: string) {
    this.students.push(name);
  }
  addInvoice(ref: string) {
    this.invoiceRefs.push(ref);
  }
  addLead(name: string) {
    this.leads.push(name);
  }
  addMessage(subject: string) {
    this.messages.push(subject);
  }

  summary(): string {
    const parts: string[] = [];
    if (this.students.length) parts.push(`students: ${this.students.join(', ')}`);
    if (this.invoiceRefs.length) parts.push(`invoices: ${this.invoiceRefs.join(', ')}`);
    if (this.leads.length) parts.push(`leads: ${this.leads.join(', ')}`);
    if (this.messages.length) parts.push(`messages: ${this.messages.join(', ')}`);
    return parts.join(' | ') || '(nothing created)';
  }
}

// ═══════════════════════════════════════════════════════════
// 13. expectAuditEntry
// ═══════════════════════════════════════════════════════════

/**
 * Navigate to Settings → Audit Log tab, apply filters, and assert at least
 * one entry matching the given action and entity type exists.
 */
export async function expectAuditEntry(
  page: Page,
  opts: { action: 'Created' | 'Updated' | 'Deleted'; entity: string },
): Promise<void> {
  await goTo(page, '/settings?tab=audit');
  await expect(page.getByText(/audit log/i).first()).toBeVisible({ timeout: 15_000 });

  // Filter by entity type if a select is visible
  const entitySelect = page.getByLabel(/entity type/i).first();
  if (await entitySelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await entitySelect.click();
    const option = page.getByText(new RegExp(opts.entity, 'i')).first();
    if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await option.click();
    }
  }

  // Filter by action if a select is visible
  const actionSelect = page.getByLabel(/^action$/i).first();
  if (await actionSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await actionSelect.click();
    await page.getByText(opts.action).first().click();
  }

  await page.waitForTimeout(500);
  const entry = page.locator('main').getByText(new RegExp(opts.action, 'i')).first();
  await expect(entry).toBeVisible({ timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════
// 14. switchToCalendarView
// ═══════════════════════════════════════════════════════════

/**
 * Switch the calendar view using the view toggle buttons.
 * Assumes the calendar page is already loaded.
 */
export async function switchToCalendarView(
  page: Page,
  view: 'day' | 'week' | 'stacked' | 'agenda',
): Promise<void> {
  const ariaLabels: Record<string, string> = {
    day: 'Day view',
    week: 'Time grid view',
    stacked: 'Stacked view',
    agenda: 'Agenda view',
  };
  const label = ariaLabels[view];

  await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

  const toggle = page.locator(`[data-tour="calendar-view-toggle"] [aria-label="${label}"]`).first()
    .or(page.locator(`[aria-label="${label}"]`).first());
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.click();
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════
// 15. navigateToInvoiceDetail
// ═══════════════════════════════════════════════════════════

/**
 * Navigate to /invoices, click on an invoice row matching the given
 * reference / description text, and wait for the invoice detail page.
 *
 * @returns true if navigation succeeded, false if the invoice was not found.
 */
export async function navigateToInvoiceDetail(
  page: Page,
  invoiceRef: string,
): Promise<boolean> {
  await goTo(page, '/invoices');

  const row = page.locator('main').getByText(invoiceRef, { exact: false }).first();
  if (!(await row.isVisible({ timeout: 15_000 }).catch(() => false))) {
    return false;
  }
  await row.click();
  await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
  await waitForPageReady(page);
  return true;
}
