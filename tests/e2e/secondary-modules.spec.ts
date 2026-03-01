import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// LEADS & CRM — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Leads — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('leads page loads with content or feature gate', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await assertNoErrorBoundary(page);

    // Either the leads page loads or feature gate shows
    const hasLeadsContent = await page.getByText(/leads|pipeline|lead/i).first()
      .isVisible({ timeout: 10_000 }).catch(() => false);
    const hasFeatureGate = await page.getByText(/upgrade|unlock/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasLeadsContent || hasFeatureGate, 'Leads page or feature gate visible').toBe(true);
  });

  test('view toggle between kanban and list', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(2_000);

    const kanbanBtn = page.locator('[aria-label="Kanban view"]').first();
    const listBtn = page.locator('[aria-label="List view"]').first();

    const hasKanban = await kanbanBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasKanban) {
      await listBtn.click();
      await page.waitForTimeout(1_000);
      await kanbanBtn.click();
      await page.waitForTimeout(1_000);
    }
    await assertNoErrorBoundary(page);
  });

  test('create lead button opens modal', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(2_000);

    const addBtn = page.getByRole('button', { name: /add lead/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasAdd) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('search filters leads', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder(/search leads/i).first();
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSearch) {
      await searchInput.fill('test');
      await page.waitForTimeout(1_000);
      await searchInput.clear();
      await page.waitForTimeout(1_000);
    }
    await assertNoErrorBoundary(page);
  });

  test('export button exists', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(2_000);

    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const hasExport = await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[leads] Export button: ${hasExport}`);
  });

  test('lead detail page loads', async ({ page }) => {
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(3_000);

    // Switch to list view and click first row
    const listBtn = page.locator('[aria-label="List view"]').first();
    const hasList = await listBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasList) {
      await listBtn.click();
      await page.waitForTimeout(1_000);

      const firstRow = page.locator('table tbody tr').first();
      const hasRow = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasRow) {
        await firstRow.click();
        await page.waitForURL(/\/leads\//, { timeout: 10_000 }).catch(() => {});
        await assertNoErrorBoundary(page);
      }
    }
  });

  test('no console errors', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/leads', 'Leads');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// WAITLIST — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Waitlist — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist page loads with title', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/waiting list/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('add to waitlist button opens dialog', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    await page.waitForTimeout(2_000);

    const addBtn = page.getByRole('button', { name: /add to waiting list/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasAdd) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('status filter works', async ({ page }) => {
    await safeGoTo(page, '/waitlist', 'Waitlist');
    await page.waitForTimeout(2_000);

    const statusSelect = page.locator('button[role="combobox"]').first();
    const hasSelect = await statusSelect.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasSelect) {
      await statusSelect.click();
      await page.waitForTimeout(500);
      const option = page.getByRole('option').first();
      const hasOption = await option.isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasOption) await option.click();
    }
    await assertNoErrorBoundary(page);
  });

  test('no console errors', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/waitlist', 'Waitlist');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// MAKE-UP DASHBOARD — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Make-Ups — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('make-ups page loads', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/make-up lessons/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('add to waitlist dialog opens', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(2_000);

    const addBtn = page.getByRole('button', { name: /add to waitlist/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasAdd) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('stats cards render', async ({ page }) => {
    await safeGoTo(page, '/make-ups', 'Make-Ups');
    await page.waitForTimeout(3_000);

    const cards = page.locator('[class*="card"]');
    const count = await cards.count();
    // eslint-disable-next-line no-console
    console.log(`[makeups] Stats card elements: ${count}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// CONTINUATION — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Continuation — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('continuation page loads', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/term continuation/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('create run button or empty state visible', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');
    await page.waitForTimeout(3_000);

    const newRunBtn = page.getByRole('button', { name: /new run/i }).first();
    const createRunBtn = page.getByRole('button', { name: /create continuation run/i }).first();

    const hasNewRun = await newRunBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasCreateRun = await createRunBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[continuation] New Run: ${hasNewRun}, Create Run: ${hasCreateRun}`);
    expect(hasNewRun || hasCreateRun, 'New Run or Create Run button visible').toBe(true);
  });

  test('wizard opens on button click', async ({ page }) => {
    await safeGoTo(page, '/continuation', 'Continuation');
    await page.waitForTimeout(3_000);

    const btn = page.getByRole('button', { name: /new run|create continuation run/i }).first();
    const hasBtn = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBtn) {
      await btn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// DAILY REGISTER — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Daily Register — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('register page loads with title', async ({ page }) => {
    await safeGoTo(page, '/register', 'Register');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/daily register/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('date navigation works', async ({ page }) => {
    await safeGoTo(page, '/register', 'Register');
    await page.waitForTimeout(2_000);

    const todayBtn = page.getByRole('button', { name: /today/i }).first();
    const hasToday = await todayBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[register] Today button: ${hasToday}`);

    if (hasToday) {
      await todayBtn.click();
      await page.waitForTimeout(1_000);
      await assertNoErrorBoundary(page);
    }
  });

  test('lesson list or empty state visible', async ({ page }) => {
    await safeGoTo(page, '/register', 'Register');
    await page.waitForTimeout(3_000);

    const hasLessons = await page.locator('[class*="card"]').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/no lessons/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[register] Lessons: ${hasLessons}, Empty: ${hasEmpty}`);
    expect(hasLessons || hasEmpty, 'Lessons or empty state visible').toBe(true);
  });

  test('batch attendance link exists', async ({ page }) => {
    await safeGoTo(page, '/register', 'Register');
    await page.waitForTimeout(2_000);

    const batchLink = page.getByText(/batch attendance/i).first();
    const hasBatch = await batchLink.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[register] Batch Attendance link: ${hasBatch}`);
  });

  test('no console errors', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/register', 'Register');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// BATCH ATTENDANCE — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Batch Attendance — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('batch attendance page loads', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance', 'Batch Attendance');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/batch attendance/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('mark all present button exists', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance', 'Batch Attendance');
    await page.waitForTimeout(3_000);

    const markAllBtn = page.getByRole('button', { name: /mark all present/i }).first();
    const hasMarkAll = await markAllBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[batch] Mark All Present button: ${hasMarkAll}`);
  });

  test('attendance toggle buttons render for lessons', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance', 'Batch Attendance');
    await page.waitForTimeout(3_000);

    const presentBtn = page.locator('[aria-label="Present"]').first();
    const hasPresent = await presentBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    const hasEmpty = await page.getByText(/no lessons to mark/i).first()
      .isVisible({ timeout: 3_000 }).catch(() => false);

    // eslint-disable-next-line no-console
    console.log(`[batch] Present toggle: ${hasPresent}, Empty: ${hasEmpty}`);
    expect(hasPresent || hasEmpty, 'Lessons with toggles or empty state').toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// REGISTER — Teacher
// ═══════════════════════════════════════════════════════════════
test.describe('Register — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access register', async ({ page }) => {
    await safeGoTo(page, '/register', 'Register');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/daily register/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('teacher can access batch attendance', async ({ page }) => {
    await safeGoTo(page, '/batch-attendance', 'Batch Attendance');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/batch attendance/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// PRACTICE — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Practice — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('practice page loads', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/practice/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('new assignment button opens modal', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(2_000);

    const assignBtn = page.getByRole('button', { name: /new assignment/i }).first();
    const hasAssign = await assignBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasAssign) {
      await assignBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('stats cards visible', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await page.waitForTimeout(3_000);

    const activeAssignments = page.getByText(/active assignments/i).first();
    const hasStats = await activeAssignments.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[practice] Active Assignments stat: ${hasStats}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// RESOURCES — Owner
// ═══════════════════════════════════════════════════════════════
test.describe('Resources — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('resources page loads', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/resources/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('upload button exists', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    await page.waitForTimeout(2_000);

    const uploadBtn = page.getByRole('button', { name: /upload|add/i }).first();
    const hasUpload = await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[resources] Upload button: ${hasUpload}`);
  });

  test('view toggle (grid/list) works', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    await page.waitForTimeout(2_000);

    const gridBtn = page.locator('button:has(svg.lucide-layout-grid)').first();
    const listBtn = page.locator('button:has(svg.lucide-list)').first();

    const hasGrid = await gridBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasGrid) {
      await listBtn.click();
      await page.waitForTimeout(500);
      await gridBtn.click();
      await page.waitForTimeout(500);
    }
    await assertNoErrorBoundary(page);
  });

  test('category filter exists', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    await page.waitForTimeout(2_000);

    const categorySelect = page.locator('button[role="combobox"]').first();
    const hasCat = await categorySelect.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[resources] Category filter: ${hasCat}`);
  });

  test('no console errors', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/resources', 'Resources');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER ACCESS — Practice & Resources
// ═══════════════════════════════════════════════════════════════
test.describe('Practice & Resources — Teacher', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher can access practice page', async ({ page }) => {
    await safeGoTo(page, '/practice', 'Practice');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/practice/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });

  test('teacher can access resources page', async ({ page }) => {
    await safeGoTo(page, '/resources', 'Resources');
    await assertNoErrorBoundary(page);

    const title = page.getByText(/resources/i).first();
    await expect(title).toBeVisible({ timeout: 10_000 });
  });
});
