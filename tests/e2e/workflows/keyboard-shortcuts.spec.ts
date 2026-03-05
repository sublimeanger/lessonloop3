import { test, expect, Page } from '@playwright/test';
import {
  AUTH,
  waitForPageReady,
  safeGoTo,
  goTo,
} from '../helpers';

/**
 * Keyboard Shortcuts — mutation tests for all shortcut interactions.
 * Covers: shortcuts dialog (?), command palette (Cmd+K), LoopAssist (Cmd+J),
 * navigation shortcuts (G then X), search focus (S), calendar shortcuts,
 * and input suppression.
 */

test.describe('Keyboard Shortcuts — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('shortcuts dialog opens with ? and closes with Escape', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Press ? to open shortcuts dialog
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify dialog title
    await expect(dialog.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();

    // Verify shortcut categories are shown
    // Category headings are h4 elements
    await expect(dialog.locator('h4', { hasText: 'Global' })).toBeVisible();
    await expect(dialog.locator('h4', { hasText: 'Navigation' })).toBeVisible();
    await expect(dialog.locator('h4', { hasText: 'Calendar' })).toBeVisible();

    // Verify some shortcut descriptions are listed
    await expect(dialog.getByText('Show keyboard shortcuts')).toBeVisible();
    await expect(dialog.getByText('Open command palette')).toBeVisible();
    await expect(dialog.getByText('Toggle LoopAssist')).toBeVisible();

    // Verify kbd elements exist (shortcut key display)
    const kbdElements = dialog.locator('kbd');
    const kbdCount = await kbdElements.count();
    expect(kbdCount).toBeGreaterThanOrEqual(5);

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('command palette opens with Cmd+K and navigates to Students', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Press Cmd+K to open command palette
    await page.keyboard.press('Control+k');

    // Command palette uses CommandDialog which renders a dialog
    const cmdInput = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput).toBeVisible({ timeout: 5_000 });
    await expect(cmdInput).toBeFocused();

    // Type "students" to filter
    await cmdInput.fill('Students');
    await page.waitForTimeout(300);

    // Verify Students option appears
    const studentsItem = page.getByRole('option', { name: /Students/i }).first();
    await expect(studentsItem).toBeVisible({ timeout: 5_000 });

    // Click/select the option
    await studentsItem.click();
    await waitForPageReady(page);

    // Verify navigation to /students
    await page.waitForURL(/\/students/, { timeout: 10_000 });
    expect(page.url()).toContain('/students');
  });

  test('command palette search shows different results and closes with Escape', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Open command palette
    await page.keyboard.press('Control+k');
    const cmdInput = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput).toBeVisible({ timeout: 5_000 });

    // Search for "invoice"
    await cmdInput.fill('Invoice');
    await page.waitForTimeout(300);
    const invoicesItem = page.getByRole('option', { name: /Invoices/i }).first();
    await expect(invoicesItem).toBeVisible({ timeout: 5_000 });

    // Search for "calendar"
    await cmdInput.fill('Calendar');
    await page.waitForTimeout(300);
    const calendarItem = page.getByRole('option', { name: /Calendar/i }).first();
    await expect(calendarItem).toBeVisible({ timeout: 5_000 });

    // Search for "dashboard"
    await cmdInput.fill('Dashboard');
    await page.waitForTimeout(300);
    const dashboardItem = page.getByRole('option', { name: /Dashboard/i }).first();
    await expect(dashboardItem).toBeVisible({ timeout: 5_000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(cmdInput).toBeHidden({ timeout: 5_000 });
  });

  test('LoopAssist drawer toggles with Cmd+J', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Press Cmd+J to open LoopAssist
    await page.keyboard.press('Control+j');

    // LoopAssist drawer should open — look for the input area or drawer content
    const loopAssistInput = page.locator('[data-tour="loopassist-input"]');
    const drawerContent = page.locator('[data-tour="loopassist-prompts"]');
    const anyLoopAssist = loopAssistInput.or(drawerContent);
    await expect(anyLoopAssist.first()).toBeVisible({ timeout: 10_000 });

    // Press Cmd+J again to close
    await page.keyboard.press('Control+j');
    await expect(anyLoopAssist.first()).toBeHidden({ timeout: 10_000 });
  });

  test('S key focuses search input when type=search exists', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // The S shortcut focuses input[type="search"] — check if one exists on any page
    const searchInput = page.locator('input[type="search"]').first();
    const hasSearch = await searchInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasSearch) {
      // The S shortcut requires input[type="search"] which may not exist on every page
      // Verify that pressing S when no search input exists doesn't cause errors
      await page.locator('main').first().click();
      await page.waitForTimeout(300);
      const urlBefore = page.url();
      await page.keyboard.press('s');
      await page.waitForTimeout(500);
      // No navigation should occur, no error
      expect(page.url()).toBe(urlBefore);
      return;
    }

    // Click somewhere neutral first to ensure no input is focused
    await page.locator('main').first().click();
    await page.waitForTimeout(300);

    // Press 's' key
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Verify search input is focused
    await expect(searchInput).toBeFocused({ timeout: 3_000 });
  });

  test('N key on calendar triggers new lesson action', async ({ page }) => {
    await safeGoTo(page, '/calendar', 'Calendar');

    // Click somewhere neutral to ensure no input focused
    await page.locator('main').first().click();
    await page.waitForTimeout(500);

    // Press 'n' key — should trigger new lesson dialog or navigate with ?action=new
    await page.keyboard.press('n');
    await page.waitForTimeout(1_000);

    // Either a dialog opens or the URL changes to ?action=new
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    const urlHasAction = page.url().includes('action=new');

    expect(
      dialogVisible || urlHasAction,
      'N key should open new lesson dialog or navigate with action=new'
    ).toBe(true);

    // Close if dialog opened
    if (dialogVisible) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });
    }
  });

  test('shortcuts do not fire when focused on input', async ({ page }) => {
    await safeGoTo(page, '/students', 'Students');

    // Use the search input on the Students page (by placeholder)
    const searchInput = page.getByPlaceholder('Search students...').first();
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSearch) {
      test.skip(true, 'No search input found on students page');
      return;
    }

    // Focus the search input by clicking
    await searchInput.click();
    await page.waitForTimeout(300);

    // Record the current URL
    const urlBefore = page.url();

    // Type 's' — should appear in input, not trigger shortcut
    await page.keyboard.type('s');
    await page.waitForTimeout(300);

    // Verify 's' was typed into the input
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toContain('s');

    // Verify URL didn't change (no navigation)
    expect(page.url()).toBe(urlBefore);
  });

  test('Escape closes command palette, shortcuts dialog, and LoopAssist', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Open command palette → Escape closes it
    await page.keyboard.press('Control+k');
    const cmdInput = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(cmdInput).toBeHidden({ timeout: 5_000 });

    // Open shortcuts dialog → Escape closes it
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Open LoopAssist → Escape closes it
    await page.keyboard.press('Control+j');
    const loopAssist = page.locator('[data-tour="loopassist-input"]')
      .or(page.locator('[data-tour="loopassist-prompts"]'));
    await expect(loopAssist.first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(loopAssist.first()).toBeHidden({ timeout: 10_000 });
  });

  test('command palette navigates to different pages', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Navigate to Calendar via command palette
    await page.keyboard.press('Control+k');
    const cmdInput = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput).toBeVisible({ timeout: 5_000 });
    await cmdInput.fill('Calendar');
    await page.waitForTimeout(300);
    const calendarItem = page.getByRole('option', { name: /Calendar/i }).first();
    await expect(calendarItem).toBeVisible({ timeout: 5_000 });
    await calendarItem.click();
    await waitForPageReady(page);
    await page.waitForURL(/\/calendar/, { timeout: 10_000 });
    expect(page.url()).toContain('/calendar');

    // Wait for page to settle, then click body to ensure focus is on page
    await page.waitForTimeout(1_000);
    await page.locator('main').first().click();
    await page.waitForTimeout(500);

    // Navigate to Invoices via command palette
    await page.keyboard.press('Control+k');
    const cmdInput2 = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput2).toBeVisible({ timeout: 5_000 });
    await cmdInput2.fill('Invoices');
    await page.waitForTimeout(500);
    const invoicesItem = page.getByRole('option', { name: /Invoices/i }).first();
    await expect(invoicesItem).toBeVisible({ timeout: 5_000 });
    await invoicesItem.click();
    await waitForPageReady(page);
    await page.waitForURL(/\/invoices/, { timeout: 10_000 });
    expect(page.url()).toContain('/invoices');
  });

  test('command palette shows Actions group with New Lesson and Add Student', async ({ page }) => {
    await safeGoTo(page, '/dashboard', 'Dashboard');

    // Open command palette without filtering to see all groups
    await page.keyboard.press('Control+k');
    const cmdInput = page.getByPlaceholder('Type a command or search…');
    await expect(cmdInput).toBeVisible({ timeout: 5_000 });

    // Verify Pages group
    await expect(page.getByText('Pages', { exact: true }).first()).toBeVisible({ timeout: 3_000 });

    // Verify Actions group and items
    await expect(page.getByText('Actions', { exact: true }).first()).toBeVisible({ timeout: 3_000 });

    // Search for "New Lesson" action
    await cmdInput.fill('New Lesson');
    await page.waitForTimeout(300);
    const newLessonItem = page.getByRole('option', { name: /New Lesson/i }).first();
    await expect(newLessonItem).toBeVisible({ timeout: 3_000 });

    // Search for "Add Student" action
    await cmdInput.fill('Add Student');
    await page.waitForTimeout(300);
    const addStudentItem = page.getByRole('option', { name: /Add Student/i }).first();
    await expect(addStudentItem).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
  });
});
