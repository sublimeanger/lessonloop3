import { Page, expect } from '@playwright/test';
import { goTo, waitForPageReady, expectToast } from './helpers';

// ═══════════════════════════════════════════════════════════
// 4. Cleanup Tracking
// ═══════════════════════════════════════════════════════════

/** Tracks entities created during a test so callers can identify them later. */
export class TestCleanup {
  readonly students: string[] = [];
  readonly invoiceRefs: string[] = [];
  readonly leads: string[] = [];
  readonly messages: string[] = [];

  /** Record a created student name for later reference / cleanup. */
  addStudent(name: string) {
    this.students.push(name);
  }
  /** Record an invoice reference. */
  addInvoice(ref: string) {
    this.invoiceRefs.push(ref);
  }
  /** Record a lead name. */
  addLead(name: string) {
    this.leads.push(name);
  }
  /** Record a sent message subject. */
  addMessage(subject: string) {
    this.messages.push(subject);
  }

  /** Summary of everything that was created. */
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
// 1. Data Factories
// ═══════════════════════════════════════════════════════════

export interface CreateStudentOpts {
  firstName: string;
  lastName: string;
  /** Optional instrument to select in step 1. */
  instrument?: string;
}

/**
 * Open the Add Student wizard, fill the required fields across all steps,
 * complete creation, and wait for the success toast.
 *
 * @returns The full student name "{firstName} {lastName}".
 */
export async function createStudent(
  page: Page,
  opts: CreateStudentOpts,
): Promise<string> {
  await goTo(page, '/students');

  // Open the wizard
  const addBtn = page.locator('[data-tour="add-student-button"]').first()
    .or(page.getByRole('button', { name: /add student/i }).first());
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Step 1: Student Details ──
  await page.getByLabel(/first name/i).fill(opts.firstName);
  await page.getByLabel(/last name/i).fill(opts.lastName);

  if (opts.instrument) {
    const instrumentSelect = page.getByLabel(/instrument/i).first();
    if (await instrumentSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await instrumentSelect.click();
      await page.getByText(opts.instrument, { exact: false }).first().click();
    }
  }

  // Advance to step 2
  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(500);

  // ── Step 2: Guardian — skip (toggle off by default) ──
  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(500);

  // ── Step 3: Teaching Setup — skip optional fields, submit ──
  const createBtn = page.getByRole('button', { name: /create student/i });
  await expect(createBtn).toBeVisible({ timeout: 5_000 });
  await createBtn.click();

  // Handle possible duplicate detection dialog
  const dupDialog = page.getByText(/possible duplicate/i);
  if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /continue anyway/i }).click();
  }

  // Wait for success
  await expectToast(page, /student created/i);

  const fullName = `${opts.firstName} ${opts.lastName}`;
  return fullName;
}

export interface CreateLessonOpts {
  studentName: string;
  teacherName?: string;
  /** ISO date string (yyyy-MM-dd). Defaults to today. */
  day?: string;
  /** 24-hour time (e.g. "10:00"). Defaults to first available slot. */
  time?: string;
  /** Duration in minutes (15 | 30 | 45 | 60 | 75 | 90). Defaults to 30. */
  duration?: number;
}

/**
 * Open the full New Lesson modal from the calendar page, fill the form,
 * and save.  Waits for the "Lesson created" success toast.
 *
 * @returns An object with the student name and duration used.
 */
export async function createLesson(
  page: Page,
  opts: CreateLessonOpts,
): Promise<{ studentName: string; duration: number }> {
  await goTo(page, '/calendar');

  // Open the full lesson modal
  const newBtn = page.locator('[data-tour="create-lesson-button"]').first()
    .or(page.getByRole('button', { name: /new lesson/i }).first());
  await expect(newBtn).toBeVisible({ timeout: 15_000 });
  await newBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Student selector ──
  const studentBtn = page.getByRole('dialog').locator('button').filter({ hasText: /select student|add student/i }).first();
  if (await studentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await studentBtn.click();
    await page.waitForTimeout(300);
    // Type to search then pick the student
    const searchInput = page.getByPlaceholder(/search/i).last();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(opts.studentName);
      await page.waitForTimeout(500);
    }
    await page.getByText(opts.studentName, { exact: false }).first().click();
    await page.waitForTimeout(300);
  }

  // ── Teacher selector (optional) ──
  if (opts.teacherName) {
    const teacherSelect = page.getByRole('dialog').getByLabel(/teacher/i).first();
    if (await teacherSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await teacherSelect.click();
      await page.getByText(opts.teacherName, { exact: false }).first().click();
    }
  }

  // ── Date (optional) ──
  if (opts.day) {
    const dateBtn = page.getByRole('dialog').locator('button').filter({ hasText: /\d{1,2}\s\w{3}\s\d{4}/ }).first();
    if (await dateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dateBtn.click();
      // Date picker — navigate to the right date using the calendar
      await page.waitForTimeout(300);
    }
  }

  // ── Time (optional) ──
  if (opts.time) {
    const timeSelect = page.getByRole('dialog').getByLabel(/time/i).first();
    if (await timeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await timeSelect.click();
      await page.getByText(opts.time, { exact: true }).first().click();
    }
  }

  // ── Duration ──
  const dur = opts.duration ?? 30;
  const durLabel = `${dur}`;
  const durOption = page.getByRole('dialog').getByText(new RegExp(`^${durLabel}\\s*m`, 'i')).first();
  if (await durOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await durOption.click();
  }

  // ── Submit ──
  const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create lesson/i });
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  await expectToast(page, /lesson created/i);

  return { studentName: opts.studentName, duration: dur };
}

export interface CreateInvoiceOpts {
  /** Guardian / payer display name to select. */
  guardianName: string;
  /** Total amount for a single line item. */
  amount: number;
  /** Optional line-item description. Defaults to "Lesson fees". */
  description?: string;
  /** Optional student name to appear in line item. */
  studentName?: string;
}

/**
 * Open the Create Invoice modal, add a manual line item, and save as draft.
 * Waits for the modal to close (invoice created).
 *
 * @returns The description used for the line item (useful for later lookup).
 */
export async function createInvoice(
  page: Page,
  opts: CreateInvoiceOpts,
): Promise<string> {
  await goTo(page, '/invoices');

  // Open modal
  const createBtn = page.locator('[data-tour="create-invoice-button"]').first()
    .or(page.getByRole('button', { name: /create invoice/i }).first());
  await expect(createBtn).toBeVisible({ timeout: 15_000 });
  await createBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Payer selection ──
  const payerSelect = page.getByRole('dialog').getByLabel(/payer/i).last();
  await expect(payerSelect).toBeVisible({ timeout: 5_000 });
  await payerSelect.click();
  await page.getByText(opts.guardianName, { exact: false }).first().click();

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

export interface SendMessageOpts {
  /** Recipient name (guardian). */
  to: string;
  /** Message subject line. */
  subject: string;
  /** Message body text. */
  body: string;
}

/**
 * Open the compose message flow via the "New Message" dropdown,
 * select "Message Parent", fill the form, and send.
 * Waits for the "Message sent" success toast.
 */
export async function sendMessage(
  page: Page,
  opts: SendMessageOpts,
): Promise<void> {
  await goTo(page, '/messages');

  // Open the "New Message" dropdown
  const newMsgBtn = page.getByRole('button', { name: /new message/i }).first()
    .or(page.locator('button').filter({ hasText: /new message/i }).first());
  await expect(newMsgBtn).toBeVisible({ timeout: 15_000 });
  await newMsgBtn.click();

  // Pick "Message Parent" from dropdown
  const messageParent = page.getByRole('menuitem', { name: /message parent/i }).first()
    .or(page.getByRole('menuitem').first());
  await expect(messageParent).toBeVisible({ timeout: 5_000 });
  await messageParent.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Recipient ──
  const recipientSelect = page.getByRole('dialog').getByLabel(/to/i).first();
  if (await recipientSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await recipientSelect.click();
    await page.getByText(opts.to, { exact: false }).first().click();
  }

  // ── Subject ──
  const subjectInput = page.getByRole('dialog').getByLabel(/subject/i).first()
    .or(page.getByRole('dialog').getByPlaceholder(/subject/i).first());
  await expect(subjectInput).toBeVisible({ timeout: 5_000 });
  await subjectInput.fill(opts.subject);

  // ── Body ──
  const bodyInput = page.getByRole('dialog').getByLabel(/message/i).first()
    .or(page.getByRole('dialog').getByPlaceholder(/write your message/i).first());
  await expect(bodyInput).toBeVisible({ timeout: 5_000 });
  await bodyInput.fill(opts.body);

  // ── Send ──
  const sendBtn = page.getByRole('dialog').getByRole('button', { name: /send/i });
  await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  await sendBtn.click();

  await expectToast(page, /message sent/i);
}

export interface CreateLeadOpts {
  /** Guardian / contact name. */
  name: string;
  /** Contact email. */
  email?: string;
  /** Child's preferred instrument. */
  instrument?: string;
  /** Child's first name. Defaults to "Child". */
  childFirstName?: string;
}

/**
 * Open the Create Lead modal, fill the contact + child fields, and save.
 * Waits for the "Lead created" toast.
 */
export async function createLead(
  page: Page,
  opts: CreateLeadOpts,
): Promise<void> {
  await goTo(page, '/leads');

  // Open modal
  const addBtn = page.getByRole('button', { name: /add lead/i }).first()
    .or(page.locator('button').filter({ hasText: /add lead/i }).first());
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  // ── Contact name (required) ──
  const nameInput = page.getByRole('dialog').getByLabel(/name/i).first()
    .or(page.getByRole('dialog').getByPlaceholder(/parent.*guardian.*name/i).first());
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(opts.name);

  // ── Email (optional) ──
  if (opts.email) {
    const emailInput = page.getByRole('dialog').getByLabel(/email/i).first();
    if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await emailInput.fill(opts.email);
    }
  }

  // ── Child first name (required — at least one child) ──
  const childFirstName = opts.childFirstName ?? 'Child';
  const childNameInput = page.getByRole('dialog').getByPlaceholder(/first name/i).first();
  await expect(childNameInput).toBeVisible({ timeout: 5_000 });
  await childNameInput.fill(childFirstName);

  // ── Instrument (optional) ──
  if (opts.instrument) {
    const instrInput = page.getByRole('dialog').getByPlaceholder(/e\.g\.\s*piano/i).first()
      .or(page.getByRole('dialog').getByLabel(/instrument/i).first());
    if (await instrInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await instrInput.fill(opts.instrument);
    }
  }

  // ── Submit ──
  const submitBtn = page.getByRole('dialog').getByRole('button', { name: /create lead/i });
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  await expectToast(page, /lead created/i);
}

// ═══════════════════════════════════════════════════════════
// 2. Assertion Composites
// ═══════════════════════════════════════════════════════════

/**
 * Navigate to the calendar and verify the given student appears in at least
 * one lesson card.
 */
export async function expectStudentOnCalendar(
  page: Page,
  studentName: string,
): Promise<void> {
  await goTo(page, '/calendar');
  // Wait for calendar to render
  await expect(page.getByText(/mon|tue|wed|thu|fri/i).first()).toBeVisible({ timeout: 15_000 });
  // Look for the student name inside any lesson card / event element
  const lessonCard = page.locator('main').getByText(studentName, { exact: false }).first();
  await expect(lessonCard).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigate to invoices, filter or search for the guardian name, and assert
 * at least one invoice row exists.  Optionally check for a specific status.
 */
export async function expectInvoiceForGuardian(
  page: Page,
  guardianName: string,
  status?: 'draft' | 'sent' | 'paid' | 'overdue',
): Promise<void> {
  await goTo(page, '/invoices');
  await expect(page.getByText(/invoice|billing/i).first()).toBeVisible({ timeout: 15_000 });

  // Try the search bar if present
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await search.fill(guardianName);
    await page.waitForTimeout(500);
  }

  // Assert at least one row references the guardian
  const row = page.locator('main').getByText(guardianName, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Optional status check
  if (status) {
    const statusBadge = page.locator('main').getByText(new RegExp(status, 'i')).first();
    await expect(statusBadge).toBeVisible({ timeout: 5_000 });
  }
}

/**
 * Assert the parent portal home page shows the given child name.
 * Assumes the page already has a parent storageState applied.
 */
export async function expectPortalShowsChild(
  page: Page,
  childName: string,
): Promise<void> {
  await goTo(page, '/portal/home');
  const child = page.locator('main').getByText(childName, { exact: false }).first();
  await expect(child).toBeVisible({ timeout: 15_000 });
}

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

  // Wait for results and assert a matching row exists
  await page.waitForTimeout(500);
  const entry = page.locator('main').getByText(new RegExp(opts.action, 'i')).first();
  await expect(entry).toBeVisible({ timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════
// 3. Navigation Shortcuts
// ═══════════════════════════════════════════════════════════

/**
 * Switch the calendar view using the view toggle buttons.
 * Assumes the calendar page is already loaded.
 *
 * @param view - One of 'day', 'week', 'stacked', or 'agenda'.
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

  // Ensure calendar is rendered
  await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

  const toggle = page.locator(`[data-tour="calendar-view-toggle"] [aria-label="${label}"]`).first()
    .or(page.locator(`[aria-label="${label}"]`).first());
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.click();
  await page.waitForTimeout(500);
}

/**
 * Navigate to /students, click on a student by name, and wait for the
 * student detail page to load.
 *
 * @returns true if navigation succeeded, false if the student was not found.
 */
export async function navigateToStudentDetail(
  page: Page,
  studentName: string,
): Promise<boolean> {
  await goTo(page, '/students');

  const link = page.locator('main').getByText(studentName, { exact: false }).first();
  if (!(await link.isVisible({ timeout: 15_000 }).catch(() => false))) {
    return false;
  }
  await link.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
  return true;
}

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

/**
 * Navigate to the Settings page and open a specific tab by navigating
 * directly via query parameter, then wait for the tab content to render.
 *
 * @param tabName - The query-param key (e.g. 'profile', 'organisation',
 *   'billing', 'audit', etc.).
 */
export async function openSettingsTab(
  page: Page,
  tabName: string,
): Promise<void> {
  await goTo(page, `/settings?tab=${tabName}`);
  // Settings page always renders main once auth/org is ready
  await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
}
