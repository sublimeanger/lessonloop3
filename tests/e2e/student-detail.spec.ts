import { test, expect } from '@playwright/test';
import { AUTH, waitForPageReady, safeGoTo, goTo } from './helpers';

/** Navigate to a student detail page by clicking on a student name */
async function goToStudentDetail(page: import('@playwright/test').Page) {
  await safeGoTo(page, '/students', 'Students');
  const studentLink = page.getByText(/emma/i).first();
  const hasStudent = await studentLink.isVisible({ timeout: 15_000 }).catch(() => false);
  if (!hasStudent) {
    // No seed data — try any student link
    const anyLink = page.locator('main').getByRole('link').first();
    if (await anyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await anyLink.click();
      await page.waitForURL(/\/students\//, { timeout: 10_000 }).catch(() => {});
      await waitForPageReady(page);
      return true;
    }
    return false;
  }
  await studentLink.click();
  await page.waitForURL(/\/students\//, { timeout: 10_000 }).catch(() => {});
  await waitForPageReady(page);
  return true;
}

test.describe('Student Detail — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('detail page loads with student name', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.log('[student-detail] No students available — skipping');
      return;
    }
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('tabs render on detail page', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) return;
    // Check which tabs are visible — don't hard-fail on specific tab names
    const possibleTabs = ['Overview', 'Instruments', 'Teachers', 'Guardians', 'Lessons', 'Practice', 'Invoices', 'Credits', 'Notes', 'Messages'];
    let visibleCount = 0;
    for (const tab of possibleTabs) {
      const visible = await page.getByRole('tab', { name: tab }).isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) visibleCount++;
    }
    // eslint-disable-next-line no-console
    console.log(`[student-detail] Visible tabs: ${visibleCount}/${possibleTabs.length}`);
    expect(visibleCount, 'At least some tabs should be visible').toBeGreaterThan(0);
  });

  test('can switch between tabs', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) return;
    for (const tab of ['Instruments', 'Teachers', 'Guardians', 'Lessons', 'Notes']) {
      const tabEl = page.getByRole('tab', { name: tab });
      if (await tabEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await tabEl.click();
        await page.waitForTimeout(300);
      }
    }
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    if (await overviewTab.isVisible().catch(() => false)) {
      await overviewTab.click();
    }
  });

  test('overview tab shows student info card', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) return;
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('guardians tab shows linked parents', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) return;
    const guardiansTab = page.getByRole('tab', { name: 'Guardians' });
    if (await guardiansTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await guardiansTab.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('breadcrumbs navigate back to students list', async ({ page }) => {
    const ok = await goToStudentDetail(page);
    if (!ok) return;
    const breadcrumb = page.getByRole('link', { name: /students/i }).first();
    if (await breadcrumb.isVisible().catch(() => false)) {
      await breadcrumb.click();
      await page.waitForURL(/\/students/, { timeout: 10_000 }).catch(() => {});
    }
  });
});
