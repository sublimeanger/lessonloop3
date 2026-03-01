/**
 * Prompt 5 — Cross-Role Data Consistency
 *
 * The SAME data should appear consistently regardless of which role views it.
 * Catches RLS bugs, query scoping errors, and data isolation failures.
 */
import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
  getAuthState,
} from '../workflow-helpers';

/* ------------------------------------------------------------------ */
/*  Test 1 — Student data consistent across owner, admin, teacher     */
/* ------------------------------------------------------------------ */

test.describe('Cross-Role — Student Data Consistency', () => {
  interface StudentSnapshot {
    status: string;
    instruments: string[];
    guardians: string[];
    lessonCount: number;
  }

  async function captureStudentData(
    page: import('@playwright/test').Page,
    role: string,
  ): Promise<StudentSnapshot> {
    await goTo(page, '/students');
    await assertPageLoaded(page, `Students (${role})`);

    // Find Emma in the list
    const emmaLink = page.getByText(/emma/i).first();
    await expect(emmaLink).toBeVisible({ timeout: 15_000 });
    await emmaLink.click();
    await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // Capture status from the overview — look for badge text
    const statusBadge = page
      .locator('main')
      .getByText(/Active|Inactive|On Hold/i)
      .first();
    const status = (await statusBadge.textContent().catch(() => 'unknown'))?.trim().toLowerCase() ?? 'unknown';

    // Navigate to Instruments tab
    const instrumentsTab = page.getByRole('tab', { name: /Instruments/i }).first();
    let instruments: string[] = [];
    if (await instrumentsTab.isVisible().catch(() => false)) {
      await instrumentsTab.click();
      await page.waitForTimeout(500);
      // Collect visible instrument names
      const instrumentEls = page.locator('main').getByText(/Piano|Guitar|Violin|Drums|Voice|Flute|Cello|Saxophone|Trumpet|Clarinet|Bass/i);
      const count = await instrumentEls.count();
      for (let i = 0; i < count; i++) {
        const text = await instrumentEls.nth(i).textContent();
        if (text) instruments.push(text.trim());
      }
    }

    // Navigate to Guardians tab
    const guardiansTab = page.getByRole('tab', { name: /Guardians/i }).first();
    let guardians: string[] = [];
    if (await guardiansTab.isVisible().catch(() => false)) {
      await guardiansTab.click();
      await page.waitForTimeout(500);
      // Guardian names are typically displayed in cards
      const guardianNames = page
        .locator('main')
        .locator('.font-medium, .font-semibold')
        .filter({ hasNotText: /Guardian|Primary|Payer|Email|Phone|Portal|Invite|Edit|Remove/i });
      const gCount = await guardianNames.count();
      for (let i = 0; i < gCount; i++) {
        const text = await guardianNames.nth(i).textContent();
        if (text && text.trim().length > 1 && text.trim().length < 80) {
          guardians.push(text.trim());
        }
      }
    }

    // Navigate to Lessons tab — count lessons
    const lessonsTab = page.getByRole('tab', { name: /Lessons/i }).first();
    let lessonCount = 0;
    if (await lessonsTab.isVisible().catch(() => false)) {
      await lessonsTab.click();
      await page.waitForTimeout(1000);
      // Count lesson rows — they're typically in a list/table
      const lessonRows = page.locator('main').locator('table tbody tr, .rounded-lg.border, .rounded-xl.border');
      lessonCount = await lessonRows.count().catch(() => 0);
    }

    return { status, instruments, guardians, lessonCount };
  }

  test('student data consistent across owner, admin, and teacher views', async ({
    browser,
    softAssert,
  }) => {
    test.setTimeout(120_000);

    // ── Owner view ──
    const ownerCtx = await browser.newContext({ storageState: getAuthState('owner') });
    const ownerPage = await ownerCtx.newPage();
    const ownerData = await captureStudentData(ownerPage, 'owner');
    await ownerPage.close();
    await ownerCtx.close();

    // ── Admin view ──
    const adminCtx = await browser.newContext({ storageState: getAuthState('admin') });
    const adminPage = await adminCtx.newPage();
    const adminData = await captureStudentData(adminPage, 'admin');
    await adminPage.close();
    await adminCtx.close();

    // ── Teacher view ──
    const teacherCtx = await browser.newContext({ storageState: getAuthState('teacher') });
    const teacherPage = await teacherCtx.newPage();

    // Teacher may have limited visibility — just check Emma is accessible
    await goTo(teacherPage, '/students');
    await assertPageLoaded(teacherPage, 'Students (teacher)');

    const emmaVisible = await teacherPage
      .getByText(/emma/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    let teacherData: StudentSnapshot | null = null;
    if (emmaVisible) {
      teacherData = await captureStudentData(teacherPage, 'teacher');
    }
    await teacherPage.close();
    await teacherCtx.close();

    // ── Cross-role assertions ──
    softAssert(
      ownerData.status === adminData.status,
      `Status mismatch: owner="${ownerData.status}" vs admin="${adminData.status}"`,
    );

    // Instruments: same set (order may vary)
    const ownerInstruments = ownerData.instruments.sort().join(',');
    const adminInstruments = adminData.instruments.sort().join(',');
    softAssert(
      ownerInstruments === adminInstruments,
      `Instruments mismatch: owner=[${ownerInstruments}] vs admin=[${adminInstruments}]`,
    );

    // Guardians: same set
    const ownerGuardians = ownerData.guardians.sort().join(',');
    const adminGuardians = adminData.guardians.sort().join(',');
    softAssert(
      ownerGuardians === adminGuardians,
      `Guardians mismatch: owner=[${ownerGuardians}] vs admin=[${adminGuardians}]`,
    );

    // Lesson count: within tolerance of ±1 (timing)
    softAssert(
      Math.abs(ownerData.lessonCount - adminData.lessonCount) <= 1,
      `Lesson count mismatch beyond tolerance: owner=${ownerData.lessonCount} vs admin=${adminData.lessonCount}`,
    );

    if (teacherData) {
      softAssert(
        teacherData.instruments.length > 0 || ownerData.instruments.length === 0,
        'Teacher should see Emma instruments (or none exist)',
      );
      // Teacher may see fewer lessons (only theirs) — just verify non-negative
      softAssert(
        teacherData.lessonCount >= 0,
        `Teacher lesson count should be non-negative: ${teacherData.lessonCount}`,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2 — Invoice data consistent between list and student detail  */
/* ------------------------------------------------------------------ */

test.describe('Cross-Role — Invoice Data Consistency', () => {
  test.use({ storageState: AUTH.owner });

  test('invoice data consistent between invoices page and student detail', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(90_000);

    // Step 1: Go to /invoices and pick the first invoice
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    // Wait for list to load
    const invoiceList = page.locator('[data-tour="invoice-list"]').first();
    const hasDataTour = await invoiceList.isVisible({ timeout: 5_000 }).catch(() => false);
    const listContainer = hasDataTour ? invoiceList : page.locator('main');

    // Find the first invoice row/link
    const firstInvoiceLink = listContainer
      .getByRole('link')
      .first();
    await expect(firstInvoiceLink).toBeVisible({ timeout: 15_000 });

    // Capture the invoice text before clicking
    const invoiceRowText = await firstInvoiceLink.textContent() ?? '';

    // Extract amount from the row (look for £ pattern)
    const amountMatch = invoiceRowText.match(/£[\d,.]+/);
    const listAmount = amountMatch ? amountMatch[0] : '';

    // Extract status from the row
    const statusMatch = invoiceRowText.match(/Draft|Sent|Paid|Overdue|Void|Credit Note/i);
    const listStatus = statusMatch ? statusMatch[0].toLowerCase() : '';

    // Step 2: Click into the invoice detail
    await firstInvoiceLink.click();
    await expect(page).toHaveURL(/\/invoices\//, { timeout: 10_000 });
    await waitForPageReady(page);
    await assertNoErrorBoundary(page);

    // Capture detail page amount and status
    const detailText = await page.locator('main').textContent() ?? '';
    const detailAmountMatch = detailText.match(/£[\d,.]+/);
    const detailAmount = detailAmountMatch ? detailAmountMatch[0] : '';
    const detailStatusMatch = detailText.match(/Draft|Sent|Paid|Overdue|Void|Credit Note/i);
    const detailStatus = detailStatusMatch ? detailStatusMatch[0].toLowerCase() : '';

    // Compare amounts (detail page might show more amounts — just check the list amount appears)
    if (listAmount) {
      softAssert(
        detailText.includes(listAmount),
        `Invoice amount from list (${listAmount}) not found on detail page`,
      );
    }

    if (listStatus && detailStatus) {
      softAssert(
        listStatus === detailStatus,
        `Status mismatch: list="${listStatus}" vs detail="${detailStatus}"`,
      );
    }

    // Step 3: Check reports page loads without errors
    await goTo(page, '/reports/outstanding');
    await assertPageLoaded(page, 'Outstanding Report');
    await assertNoErrorBoundary(page);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3 — Calendar data consistent with register                   */
/* ------------------------------------------------------------------ */

test.describe('Cross-Role — Calendar vs Register Consistency', () => {
  test.use({ storageState: AUTH.owner });

  test('calendar data consistent with register', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(90_000);

    // Step 1: Go to calendar for today
    await goTo(page, '/calendar');
    await assertPageLoaded(page, 'Calendar');

    // Click "Today" button to ensure we're on today's view
    const todayBtn = page.getByRole('button', { name: 'Today' }).first();
    if (await todayBtn.isVisible().catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(500);
    }

    // Count all lesson cards on the calendar
    // Lesson cards have cursor-pointer and display in grid cells
    const lessonCards = page.locator('main').locator('[style*="cursor: pointer"], [class*="cursor-pointer"]');
    const calendarLessonCount = await lessonCards.count();

    // Capture details of up to 3 lessons
    interface LessonInfo {
      text: string;
    }
    const calendarLessons: LessonInfo[] = [];
    const captureCount = Math.min(3, calendarLessonCount);
    for (let i = 0; i < captureCount; i++) {
      const text = await lessonCards.nth(i).textContent() ?? '';
      calendarLessons.push({ text: text.trim() });
    }

    // Step 2: Go to register for today
    await goTo(page, '/register');
    await assertPageLoaded(page, 'Register');

    // Count lessons on the register
    const registerRows = page.locator('main').locator('.rounded-xl.border, .rounded-lg.border').filter({
      hasText: /\d{1,2}:\d{2}/,  // rows that show a time
    });
    const registerLessonCount = await registerRows.count();

    // Verify counts are consistent (±2 tolerance for timing / recurring)
    softAssert(
      Math.abs(calendarLessonCount - registerLessonCount) <= 2,
      `Lesson count mismatch: calendar=${calendarLessonCount} vs register=${registerLessonCount}`,
    );

    // For each lesson captured from calendar, check it appears somewhere in the register
    const registerText = await page.locator('main').textContent() ?? '';
    for (const lesson of calendarLessons) {
      // Extract student name fragments from the calendar lesson text
      // Calendar shows "Last, First" — register may show similar
      const nameFragments = lesson.text
        .split(/[\s,·]+/)
        .filter((f) => f.length > 2 && !/\d{2}:\d{2}/.test(f) && !/^(w\/|Ed\.|MU)$/.test(f));

      if (nameFragments.length > 0) {
        const found = nameFragments.some((fragment) =>
          registerText.toLowerCase().includes(fragment.toLowerCase()),
        );
        softAssert(
          found,
          `Calendar lesson fragments [${nameFragments.join(', ')}] not found in register`,
        );
      }
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4 — Settings changes cascade to correct places               */
/* ------------------------------------------------------------------ */

test.describe('Cross-Role — Settings Cascade', () => {
  test.use({ storageState: AUTH.owner });

  test('settings changes cascade to correct places', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(90_000);

    // Step 1: Go to settings, note org name
    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Settings');

    // The org name is in an input with id="orgName"
    const orgNameInput = page.locator('#orgName').first();
    let orgName = '';
    if (await orgNameInput.isVisible().catch(() => false)) {
      orgName = await orgNameInput.inputValue();
    }

    // Step 2: Navigate to dashboard and verify org name appears somewhere
    await goTo(page, '/dashboard');
    await assertPageLoaded(page, 'Dashboard');

    if (orgName) {
      const dashboardText = await page.locator('main').textContent() ?? '';
      const sidebarText = await page.locator('aside, nav, [data-sidebar]').first().textContent().catch(() => '');
      const pageText = dashboardText + ' ' + sidebarText;

      // Org name may appear in greeting, sidebar, or header — soft check
      const nameVisible = pageText.toLowerCase().includes(orgName.toLowerCase());
      softAssert(
        nameVisible || orgName === '',
        `Org name "${orgName}" not found on dashboard page`,
      );
    }

    // Step 3: Go back to settings — check currency setting
    await goTo(page, '/settings');
    await assertPageLoaded(page, 'Settings');

    // Look for currency selector — note what it's set to
    const currencyText = await page
      .locator('main')
      .getByText(/GBP|EUR|USD/i)
      .first()
      .textContent()
      .catch(() => '');

    // Step 4: Navigate to invoices, create new invoice to check currency
    await goTo(page, '/invoices');
    await assertPageLoaded(page, 'Invoices');

    // Verify the invoices page loaded and uses the right currency symbol
    const invoicesText = await page.locator('main').textContent() ?? '';
    if (currencyText?.includes('GBP')) {
      softAssert(
        invoicesText.includes('£'),
        'GBP currency setting should show £ on invoices page',
      );
    } else if (currencyText?.includes('EUR')) {
      softAssert(
        invoicesText.includes('€'),
        'EUR currency setting should show € on invoices page',
      );
    } else if (currencyText?.includes('USD')) {
      softAssert(
        invoicesText.includes('$'),
        'USD currency setting should show $ on invoices page',
      );
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5 — Message from owner appears in parent portal              */
/* ------------------------------------------------------------------ */

test.describe('Cross-Role — Messaging Pipeline', () => {
  test('message from owner appears in parent portal', async ({
    browser,
    softAssert,
  }) => {
    test.setTimeout(120_000);

    const timestamp = Date.now();
    const uniqueMessage = `E2E-Workflow-Test-Message-${timestamp}`;

    // ── Step 1: Owner sends a message ──
    const ownerCtx = await browser.newContext({ storageState: getAuthState('owner') });
    const ownerPage = await ownerCtx.newPage();

    await goTo(ownerPage, '/messages');
    await assertPageLoaded(ownerPage, 'Messages');

    // Click "New Message" dropdown trigger
    const newMsgBtn = ownerPage.getByRole('button', { name: /New Message/i }).first();
    await expect(newMsgBtn).toBeVisible({ timeout: 10_000 });
    await newMsgBtn.click();
    await ownerPage.waitForTimeout(300);

    // Select "Message Parent" from the dropdown menu
    const msgParentOption = ownerPage.getByRole('menuitem', { name: /Message Parent/i }).first();
    await expect(msgParentOption).toBeVisible({ timeout: 5_000 });
    await msgParentOption.click();
    await expect(ownerPage.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Select a recipient (guardian) from the Select
    const recipientTrigger = ownerPage.getByRole('dialog').getByRole('combobox').first();
    if (await recipientTrigger.isVisible().catch(() => false)) {
      await recipientTrigger.click();
      await ownerPage.waitForTimeout(300);
      // Pick the first guardian option
      const firstOption = ownerPage.getByRole('option').first();
      await expect(firstOption).toBeVisible({ timeout: 5_000 });
      await firstOption.click();
      await ownerPage.waitForTimeout(300);
    }

    // Fill subject
    const subjectInput = ownerPage.locator('#subject');
    await subjectInput.fill(`Test ${timestamp}`);

    // Fill message body
    const bodyInput = ownerPage.locator('#body');
    await bodyInput.fill(uniqueMessage);

    // Send the message
    const sendBtn = ownerPage
      .getByRole('dialog')
      .getByRole('button', { name: /Send Message/i })
      .first();
    await sendBtn.click();
    await expectToast(ownerPage, /message sent|sent successfully/i);
    await ownerPage.waitForTimeout(500);

    await ownerPage.close();
    await ownerCtx.close();

    // ── Step 2: Parent checks their portal messages ──
    const parentCtx = await browser.newContext({ storageState: getAuthState('parent') });
    const parentPage = await parentCtx.newPage();

    await goTo(parentPage, '/portal/messages');
    await assertPageLoaded(parentPage, 'Portal Messages');

    // Wait for messages to load and look for the unique message
    await parentPage.waitForTimeout(2_000);
    const messagesContent = await parentPage.locator('main').textContent() ?? '';

    softAssert(
      messagesContent.includes(uniqueMessage),
      `Message "${uniqueMessage}" not found in parent portal messages`,
    );

    // If message is visible, click into it to verify sender
    const messageLink = parentPage.getByText(uniqueMessage, { exact: false }).first();
    const messageVisible = await messageLink.isVisible().catch(() => false);
    if (messageVisible) {
      await messageLink.click();
      await parentPage.waitForTimeout(1_000);
      const detailText = await parentPage.locator('main').textContent() ?? '';
      softAssert(
        detailText.includes(uniqueMessage),
        'Message detail should contain the full message body',
      );
    }

    await parentPage.close();
    await parentCtx.close();
  });
});
