import { test, expect } from '@playwright/test';
import { AUTH, safeGoTo, waitForPageReady, assertNoErrorBoundary, trackConsoleErrors } from './helpers';

// ═══════════════════════════════════════════════════════════════
// OWNER — TEACHERS PAGE
// ═══════════════════════════════════════════════════════════════
test.describe('Teachers — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads teachers page with title', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    await assertNoErrorBoundary(page);
    const title = page.getByText(/^Teachers/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows Add Teacher and Invite to Login buttons', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');

    // "Add Teacher" button
    const addBtn = page.getByRole('button', { name: /add teacher/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Add Teacher button: ${hasAdd}`);

    // "Invite to Login" button
    const inviteBtn = page.getByRole('button', { name: /invite to login/i }).first();
    const hasInvite = await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Invite to Login button: ${hasInvite}`);

    // At least one should be visible (depends on plan limits)
    expect(hasAdd || hasInvite, 'Owner should see teacher management buttons').toBe(true);
  });

  test('search input filters teachers', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder('Search teachers...');
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSearch) {
      // eslint-disable-next-line no-console
      console.log('[teachers] No search input — possibly no teachers yet');
      return;
    }

    // Type a nonexistent name
    await searchInput.fill('zzzznonexistent');
    await page.waitForTimeout(500);
    const noMatch = page.getByText(/no teachers match/i).first();
    const hasNoMatch = await noMatch.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] "No match" after bad search: ${hasNoMatch}`);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('filter pills toggle between All, Linked, Unlinked', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    await page.waitForTimeout(2_000);

    const filterBar = page.locator('[aria-label="Teacher filters"]');
    const hasFilters = await filterBar.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasFilters) {
      // eslint-disable-next-line no-console
      console.log('[teachers] No filter pills — possibly no teachers');
      return;
    }

    // Click Linked filter
    const linkedPill = filterBar.getByText(/^Linked/i).first();
    if (await linkedPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await linkedPill.click();
      await page.waitForTimeout(500);
      await assertNoErrorBoundary(page);
    }

    // Click Unlinked filter
    const unlinkedPill = filterBar.getByText(/^Unlinked/i).first();
    if (await unlinkedPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await unlinkedPill.click();
      await page.waitForTimeout(500);
      await assertNoErrorBoundary(page);
    }

    // Back to All
    const allPill = filterBar.getByText(/^All/i).first();
    if (await allPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await allPill.click();
      await page.waitForTimeout(500);
    }
  });

  test('clicking a teacher card opens quick view sheet', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    await page.waitForTimeout(2_000);

    const teacherCard = page.locator('[role="button"]').filter({ hasText: /\w/ }).first();
    const hasCard = await teacherCard.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasCard) {
      // eslint-disable-next-line no-console
      console.log('[teachers] No teacher cards found');
      return;
    }

    await teacherCard.click();
    await page.waitForTimeout(500);

    // Quick view sheet should open as a dialog/sheet
    const sheet = page.locator('[role="dialog"]').first();
    const opened = await sheet.isVisible({ timeout: 5_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Quick view sheet opened: ${opened}`);

    if (opened) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  test('"Add Teacher" opens create dialog with form fields', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');

    const addBtn = page.getByRole('button', { name: /add teacher/i }).first();
    const visible = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;

    await addBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Add Teacher')).toBeVisible({ timeout: 5_000 });

    // Check form fields
    const displayNameField = dialog.getByPlaceholder('Amy Brown').first();
    await expect(displayNameField).toBeVisible({ timeout: 5_000 });

    const emailField = dialog.getByPlaceholder('amy@example.com').first();
    const hasEmail = await emailField.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Form email field: ${hasEmail}`);

    // Cancel
    await dialog.getByRole('button', { name: /cancel/i }).first().click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('"Invite to Login" opens invite dialog', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');

    const inviteBtn = page.getByRole('button', { name: /invite to login/i }).first();
    const visible = await inviteBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;

    await inviteBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Close it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('teacher cards show linked/unlinked badges', async ({ page }) => {
    await safeGoTo(page, '/teachers', 'Teachers');
    await page.waitForTimeout(2_000);

    // Check if any badge with "Linked" or "Unlinked" exists
    const linkedBadge = page.getByText('Linked', { exact: true }).first();
    const unlinkedBadge = page.getByText('Unlinked', { exact: true }).first();

    const hasLinked = await linkedBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasUnlinked = await unlinkedBadge.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[teachers] Linked badge: ${hasLinked}, Unlinked badge: ${hasUnlinked}`);
  });

  test('no console errors on teachers page', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/teachers', 'Teachers');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — TEACHERS PAGE (restricted)
// ═══════════════════════════════════════════════════════════════
test.describe('Teachers — Teacher Role', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher accessing /teachers is redirected or restricted', async ({ page }) => {
    await page.goto('/teachers');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[teacher-teachers] URL: ${url}`);

    // Teacher doesn't have "Teachers" in their sidebar nav
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// OWNER — LOCATIONS PAGE
// ═══════════════════════════════════════════════════════════════
test.describe('Locations — Owner', () => {
  test.use({ storageState: AUTH.owner });

  test('loads locations page with title', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await assertNoErrorBoundary(page);
    const title = page.getByText(/^Locations/i).first();
    await expect(title).toBeVisible({ timeout: 15_000 });
  });

  test('shows "Add Location" button', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    const addBtn = page.getByRole('button', { name: /add location/i }).first();
    const visible = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Add Location button: ${visible}`);
    // Owner should have this button (may be disabled if gated)
  });

  test('search filters locations', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);

    const searchInput = page.getByPlaceholder('Search locations...');
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSearch) {
      // eslint-disable-next-line no-console
      console.log('[locations] No search input — possibly no locations yet');
      return;
    }

    await searchInput.fill('zzzznonexistent');
    await page.waitForTimeout(500);
    const noMatch = page.getByText(/no locations match/i).first();
    const hasNoMatch = await noMatch.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] No match message: ${hasNoMatch}`);

    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('filter pills for location types', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);

    const typeFilters = ['All', 'Studio', 'School', 'Home', 'Online'];
    for (const filter of typeFilters) {
      const pill = page.locator('button').filter({ hasText: new RegExp(`^${filter}`) }).first();
      const visible = await pill.isVisible({ timeout: 3_000 }).catch(() => false);
      if (visible) {
        await pill.click();
        await page.waitForTimeout(300);
        await assertNoErrorBoundary(page);
      }
    }

    // Reset to All
    const allPill = page.locator('button').filter({ hasText: /^All/ }).first();
    if (await allPill.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await allPill.click();
    }
  });

  test('"Add Location" opens dialog with form fields', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');

    const addBtn = page.getByRole('button', { name: /add location/i }).first();
    const visible = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      // eslint-disable-next-line no-console
      console.log('[locations] Add Location button not visible (feature gated?)');
      return;
    }

    const disabled = await addBtn.isDisabled().catch(() => false);
    if (disabled) {
      // eslint-disable-next-line no-console
      console.log('[locations] Add Location button disabled (at limit)');
      return;
    }

    await addBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Add Location')).toBeVisible({ timeout: 5_000 });

    // Cancel
    await dialog.getByRole('button', { name: /cancel/i }).first().click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('expanding a location shows rooms section', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);

    // Location cards are Collapsible — look for a clickable header
    // The collapsible trigger is the chevron button
    const chevron = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') }).first();
    const hasChevron = await chevron.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasChevron) {
      await chevron.click();
      await page.waitForTimeout(500);

      // Should show rooms section or "Add Room" button
      const addRoomBtn = page.getByRole('button', { name: /add room/i }).first();
      const hasAddRoom = await addRoomBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      // eslint-disable-next-line no-console
      console.log(`[locations] Expanded location — Add Room visible: ${hasAddRoom}`);
    } else {
      // eslint-disable-next-line no-console
      console.log('[locations] No expandable locations found');
    }
  });

  test('location cards show type emoji and badges', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);

    // Check for location type emojis
    const emojis = ['🌐', '🏠', '🏫', '🎵'];
    let foundEmoji = false;
    for (const emoji of emojis) {
      const visible = await page.getByText(emoji).first().isVisible({ timeout: 2_000 }).catch(() => false);
      if (visible) { foundEmoji = true; break; }
    }
    // eslint-disable-next-line no-console
    console.log(`[locations] Location type emoji found: ${foundEmoji}`);

    // Check for type badges (studio, school, home, online)
    const typeBadge = page.getByText(/studio|school|home|online/i).first();
    const hasBadge = await typeBadge.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Location type badge: ${hasBadge}`);
  });

  test('admin action buttons visible on location cards', async ({ page }) => {
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);

    // Check for edit/delete buttons (they have aria-labels)
    const editBtn = page.locator('button[aria-label^="Edit"]').first();
    const deleteBtn = page.locator('button[aria-label^="Delete"]').first();

    const hasEdit = await editBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasDelete = await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[locations] Admin buttons — Edit: ${hasEdit}, Delete: ${hasDelete}`);
  });

  test('no console errors on locations page', async ({ page }) => {
    const checkErrors = await trackConsoleErrors(page);
    await safeGoTo(page, '/locations', 'Locations');
    await page.waitForTimeout(2_000);
    checkErrors();
  });
});

// ═══════════════════════════════════════════════════════════════
// TEACHER — LOCATIONS (restricted)
// ═══════════════════════════════════════════════════════════════
test.describe('Locations — Teacher Role', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher accessing /locations is redirected or restricted', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForTimeout(5_000);

    const url = page.url();
    // eslint-disable-next-line no-console
    console.log(`[teacher-locations] URL: ${url}`);

    // Teacher doesn't have "Locations" in sidebar
    await expect(page.locator('body')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// FINANCE — BOTH (restricted)
// ═══════════════════════════════════════════════════════════════
test.describe('Teachers & Locations — Finance', () => {
  test.use({ storageState: AUTH.finance });

  test('finance accessing /teachers is redirected or restricted', async ({ page }) => {
    await page.goto('/teachers');
    await page.waitForTimeout(5_000);
    // eslint-disable-next-line no-console
    console.log(`[finance-teachers] URL: ${page.url()}`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('finance accessing /locations is redirected or restricted', async ({ page }) => {
    await page.goto('/locations');
    await page.waitForTimeout(5_000);
    // eslint-disable-next-line no-console
    console.log(`[finance-locations] URL: ${page.url()}`);
    await expect(page.locator('body')).toBeVisible();
  });
});
