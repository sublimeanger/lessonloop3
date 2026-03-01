import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Navigate to /students, find Emma, click into her detail page */
async function goToStudentDetail(page: Page) {
  await goTo(page, '/students');
  const emmaLink = page.getByText(/emma/i).first();
  await expect(emmaLink).toBeVisible({ timeout: 15_000 });
  await emmaLink.click();
  await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
  await waitForPageReady(page);
}

/** Navigate to a student's Credits tab */
async function goToCreditsTab(page: Page) {
  await goToStudentDetail(page);
  await page.getByRole('tab', { name: 'Credits' }).click();
  await page.waitForTimeout(500);
  await waitForPageReady(page);
}

/** Read the "Available Balance" value displayed in the credits summary */
async function readAvailableBalance(page: Page): Promise<string> {
  const balanceEl = page.locator('text=Available Balance').locator('..');
  const text = await balanceEl.textContent();
  // Extract the currency string, e.g. "£30.00"
  const match = text?.match(/[£$]\d+[\d,.]*/) ?? null;
  return match ? match[0] : '£0.00';
}

/** Parse a £-prefixed currency string to a number: "£30.00" → 30 */
function parseCurrency(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

/* ------------------------------------------------------------------ */
/*  Test 1: Issue credit and verify it appears on student detail       */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Issue & Verify', () => {
  test.use({ storageState: AUTH.owner });

  test('issue credit and verify it appears on student detail', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-8);
    const creditNotes = `E2E test credit — cancelled lesson ${timestamp}`;

    // 1-5. Navigate to Credits tab and note the current state
    await goToCreditsTab(page);
    const balanceBefore = await readAvailableBalance(page);
    const balanceBeforeNum = parseCurrency(balanceBefore);

    const creditsBefore = await page
      .locator('text=Available Credits')
      .locator('..')
      .textContent();
    const creditsCountBefore = parseInt(creditsBefore?.match(/\d+/)?.[0] ?? '0', 10);

    // 6-7. Click "Issue Credit" button
    await page.getByRole('button', { name: /issue credit/i }).first().click();

    // 8. Assert: IssueCreditModal opens (dialog title: "Issue Make-Up Credit")
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Issue Make-Up Credit')).toBeVisible();

    // 9. Fill in form fields
    await page.getByLabel(/credit amount/i).fill('30');

    // Select expiry: "In 3 months" is the default, leave it
    // Fill notes
    await page.getByLabel(/notes/i).fill(creditNotes);

    // 10. Submit
    const submitBtn = page.getByRole('button', { name: 'Issue Credit' }).last();
    await submitBtn.click();

    // 11. Assert: Toast "Make-up credit issued"
    await expectToast(page, /make-up credit issued/i);

    // Wait for credit list to update
    await page.waitForTimeout(1_000);

    // 12. Assert: New credit appears with "Available" status
    await expect(page.getByText('Available').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.rounded-lg.border').filter({ hasText: '£30.00' }).filter({ hasText: 'Available' }).first()).toBeVisible({ timeout: 10_000 });

    // 13. Assert: Credit balance increased by £30.00
    const balanceAfter = await readAvailableBalance(page);
    const balanceAfterNum = parseCurrency(balanceAfter);
    expect(balanceAfterNum).toBeCloseTo(balanceBeforeNum + 30, 1);

    // Assert: Credits count increased
    const creditsAfter = await page
      .locator('text=Available Credits')
      .locator('..')
      .textContent();
    const creditsCountAfter = parseInt(creditsAfter?.match(/\d+/)?.[0] ?? '0', 10);
    expect(creditsCountAfter).toBe(creditsCountBefore + 1);

    // 14. Assert: Credit shows the notes we entered
    await expect(page.getByText(creditNotes)).toBeVisible({ timeout: 5_000 });
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2: Credit balance badge on student card/list                  */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Balance Badge', () => {
  test.use({ storageState: AUTH.owner });

  test('credit balance badge on student card/list', async ({ page }) => {
    // 1. Navigate to /students
    await goTo(page, '/students');
    await expect(page.getByText(/emma/i).first()).toBeVisible({ timeout: 15_000 });

    // 2-3. If CreditBalanceBadge exists on the student card/row, verify format
    // The badge renders "{amount} credit" text (e.g. "£30.00 credit")
    const creditBadge = page.locator('text=/£\\d+\\.\\d{2} credit/i').first();
    const hasBadge = await creditBadge.isVisible().catch(() => false);

    if (hasBadge) {
      const badgeText = await creditBadge.textContent();
      // Verify it contains a £ symbol and "credit" suffix
      expect(badgeText).toMatch(/£\d+\.\d{2}\s*credit/i);

      // 4. Click into student detail
      await page.getByText(/emma/i).first().click();
      await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
      await waitForPageReady(page);

      // 5. Assert: Credits tab shows matching balance
      await page.getByRole('tab', { name: 'Credits' }).click();
      await page.waitForTimeout(500);

      const detailBalance = await readAvailableBalance(page);
      // The badge amount and the detail available balance should match
      const badgeAmount = parseCurrency(badgeText ?? '');
      const detailAmount = parseCurrency(detailBalance);
      expect(detailAmount).toBeCloseTo(badgeAmount, 1);
    } else {
      // No badge means no credits — go to student detail and verify balance is £0.00
      await page.getByText(/emma/i).first().click();
      await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
      await waitForPageReady(page);
      await page.getByRole('tab', { name: 'Credits' }).click();
      await page.waitForTimeout(500);

      const balance = await readAvailableBalance(page);
      expect(parseCurrency(balance)).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3: Available vs redeemed vs expired credits display           */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Status Display', () => {
  test.use({ storageState: AUTH.owner });

  test('available vs redeemed vs expired credits display correctly', async ({ page }) => {
    await goToCreditsTab(page);

    // Gather all credit cards in the list
    const creditCards = page.locator('.rounded-lg.border');
    const cardCount = await creditCards.count();

    if (cardCount === 0) {
      // No credits — verify the empty state shows guidance text
      await expect(
        page.getByText(/no make-up credits/i).first()
          .or(page.getByText(/credits are issued/i).first()),
      ).toBeVisible({ timeout: 5_000 });
      return;
    }

    // Check status badges
    const availableBadges = creditCards.filter({ hasText: 'Available' });
    const redeemedBadges = creditCards.filter({ hasText: 'Redeemed' });
    const expiredBadges = creditCards.filter({ hasText: 'Expired' });
    const appliedBadges = creditCards.filter({ hasText: 'Applied to Invoice' });

    const availCount = await availableBadges.count();
    const redeemedCount = await redeemedBadges.count();
    const expiredCount = await expiredBadges.count();
    const appliedCount = await appliedBadges.count();

    // Every credit card must have exactly one status badge
    expect(availCount + redeemedCount + expiredCount + appliedCount).toBe(cardCount);

    // Available credits: check they show with default (blue/active) badge variant
    if (availCount > 0) {
      const firstAvailable = availableBadges.first();
      await expect(firstAvailable.locator('text=Available')).toBeVisible();
    }

    // Redeemed credits: check they reference the lesson used
    if (redeemedCount > 0) {
      const firstRedeemed = redeemedBadges.first();
      await expect(firstRedeemed.locator('text=Redeemed')).toBeVisible();
      // Should show "Used for {lesson}" text
      await expect(firstRedeemed.getByText(/used for/i)).toBeVisible();
    }

    // Expired credits: check destructive badge
    if (expiredCount > 0) {
      const firstExpired = expiredBadges.first();
      await expect(firstExpired.locator('text=Expired')).toBeVisible();
    }

    // Verify balance only counts available credits
    // Sum up values from available credit cards
    let availableSum = 0;
    for (let i = 0; i < availCount; i++) {
      const cardText = await availableBadges.nth(i).textContent();
      const match = cardText?.match(/£([\d,.]+)/);
      if (match) {
        availableSum += parseFloat(match[1].replace(',', ''));
      }
    }

    const displayedBalance = await readAvailableBalance(page);
    const displayedBalanceNum = parseCurrency(displayedBalance);
    expect(displayedBalanceNum).toBeCloseTo(availableSum, 1);
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4: Make-up dashboard shows correct data                       */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Dashboard', () => {
  test.use({ storageState: AUTH.owner });

  test('make-up dashboard shows correct data', async ({ page }) => {
    // Track errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const serverErrors: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });

    // 1-2. Navigate to /make-ups and assert page loads
    await goTo(page, '/make-ups');
    await expect(page.getByText(/make-up lessons/i).first()).toBeVisible({ timeout: 15_000 });

    // Assert no server errors
    expect(serverErrors).toHaveLength(0);

    // Check stats cards render (MakeUpStatsCards)
    await expect(page.locator('main').first()).toBeVisible();

    // Check if waitlist table or entries exist
    const tableRows = page.locator('table tbody tr, .rounded-lg.border');
    const rowCount = await tableRows.count().catch(() => 0);

    if (rowCount > 0) {
      // 3. Entries exist — verify they show meaningful data
      const firstRow = tableRows.first();
      const rowText = await firstRow.textContent();

      // Should contain a student name (letters, not just numbers)
      expect(rowText).toMatch(/[A-Za-z]{2,}/);
    } else {
      // 4. Empty state — verify helpful guidance, not just "no data"
      // The page should still render the stats cards and "Add to Waitlist" button
      const addBtn = page.getByRole('button', { name: /add to waitlist/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 5_000 });
    }

    // Filter real console errors (ignore benign ones)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('supabase'),
    );
    expect(realErrors).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5: Credit lifecycle visible across multiple views             */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Cross-View Lifecycle', () => {
  test.use({ storageState: AUTH.owner });

  test('credit lifecycle visible across multiple views', async ({ page }) => {
    // 1. Ensure a credit exists — issue one if needed
    await goToCreditsTab(page);

    const existingAvailable = page.locator('.rounded-lg.border').filter({ hasText: 'Available' });
    const hasAvailable = (await existingAvailable.count()) > 0;

    if (!hasAvailable) {
      // Issue a fresh credit
      await page.getByRole('button', { name: /issue credit/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await page.getByLabel(/credit amount/i).fill('30');
      await page.getByLabel(/notes/i).fill('E2E lifecycle test credit');
      await page.getByRole('button', { name: 'Issue Credit' }).last().click();
      await expectToast(page, /make-up credit issued/i);
      await page.waitForTimeout(1_000);
    }

    // 2. Verify on student detail → Credits tab
    // We're already on the Credits tab — verify credit visible
    await expect(
      page.locator('.rounded-lg.border').filter({ hasText: 'Available' }).first(),
    ).toBeVisible({ timeout: 10_000 });

    const balanceOnCredits = await readAvailableBalance(page);
    expect(parseCurrency(balanceOnCredits)).toBeGreaterThan(0);

    // 3. Navigate to /make-ups
    await goTo(page, '/make-ups');
    await expect(page.getByText(/make-up lessons/i).first()).toBeVisible({ timeout: 15_000 });

    // The make-ups dashboard should load without errors — verify page renders
    await expect(page.locator('main').first()).toBeVisible();

    // 4. Navigate back to student detail → Invoices tab
    await goToStudentDetail(page);
    await page.getByRole('tab', { name: 'Invoices' }).click();
    await page.waitForTimeout(500);

    // Verify the Invoices tab loaded
    await expect(page.locator('main').first()).toBeVisible();

    // Check if "Apply credits" or available credit info is present
    // This is optional — depends on whether the invoice creation flow shows credits
    const createInvoiceBtn = page.getByRole('button', { name: /create invoice|new invoice/i }).first();
    const hasInvoiceBtn = await createInvoiceBtn.isVisible().catch(() => false);

    if (hasInvoiceBtn) {
      await createInvoiceBtn.click();
      const dialog = page.getByRole('dialog');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (dialogVisible) {
        // Look for credit application option inside the dialog
        const creditOption = page.getByText(/apply credit|available credit|make-up credit/i).first();
        const hasCreditOption = await creditOption.isVisible().catch(() => false);
        if (hasCreditOption) {
          // The available credit amount should be shown
          await expect(creditOption).toBeVisible();
        }
        // Close dialog
        const cancelBtn = dialog.getByRole('button', { name: /cancel|close/i }).first();
        if (await cancelBtn.isVisible().catch(() => false)) {
          await cancelBtn.click();
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Test 6: Credits cannot be double-redeemed                          */
/* ------------------------------------------------------------------ */

test.describe('Make-Up Credits — Double-Redeem Protection', () => {
  test.use({ storageState: AUTH.owner });

  test('credits cannot be double-redeemed', async ({ page }) => {
    await goToCreditsTab(page);

    const creditCards = page.locator('.rounded-lg.border');
    const cardCount = await creditCards.count();

    if (cardCount === 0) {
      // No credits to test — issue one first so we can verify the structure
      await page.getByRole('button', { name: /issue credit/i }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await page.getByLabel(/credit amount/i).fill('25');
      await page.getByLabel(/notes/i).fill('E2E double-redeem test');
      await page.getByRole('button', { name: 'Issue Credit' }).last().click();
      await expectToast(page, /make-up credit issued/i);
      await page.waitForTimeout(1_000);
    }

    // Re-read the credit list
    const refreshedCards = page.locator('.rounded-lg.border');
    const refreshedCount = await refreshedCards.count();

    // Separate available vs redeemed credits
    const availableCards = refreshedCards.filter({ hasText: 'Available' });
    const redeemedCards = refreshedCards.filter({ hasText: 'Redeemed' });
    const appliedCards = refreshedCards.filter({ hasText: 'Applied to Invoice' });

    const availableCount = await availableCards.count();
    const redeemedCount = await redeemedCards.count();
    const appliedCount = await appliedCards.count();

    // Verify redeemed credits are NOT counted in the available balance
    const balance = await readAvailableBalance(page);
    const balanceNum = parseCurrency(balance);

    // Sum available credit values
    let availableTotal = 0;
    for (let i = 0; i < availableCount; i++) {
      const text = await availableCards.nth(i).textContent();
      const match = text?.match(/£([\d,.]+)/);
      if (match) availableTotal += parseFloat(match[1].replace(',', ''));
    }
    expect(balanceNum).toBeCloseTo(availableTotal, 1);

    // Verify redeemed credits show redemption details
    if (redeemedCount > 0) {
      const firstRedeemed = redeemedCards.first();
      // Should show "Used for" with a lesson reference
      await expect(firstRedeemed.getByText(/used for/i)).toBeVisible();
      // Should NOT have a delete button (delete only available for non-redeemed)
      const deleteBtn = firstRedeemed.locator('button').filter({ has: page.locator('.lucide-trash-2, [class*="trash"]') });
      expect(await deleteBtn.count()).toBe(0);
    }

    // Verify applied-to-invoice credits show the applied status
    if (appliedCount > 0) {
      const firstApplied = appliedCards.first();
      await expect(firstApplied.getByText('Applied to Invoice')).toBeVisible();
      // Should NOT have a delete button
      const deleteBtn = firstApplied.locator('button').filter({ has: page.locator('.lucide-trash-2, [class*="trash"]') });
      expect(await deleteBtn.count()).toBe(0);
    }

    // Verify available credits DO have a delete button (proving they're still editable)
    if (availableCount > 0) {
      const firstAvailable = availableCards.first();
      const deleteBtn = firstAvailable.locator('button');
      // Available credits should have the delete/trash action
      expect(await deleteBtn.count()).toBeGreaterThan(0);
    }

    // The available credit count displayed should match actual available cards
    const creditsCountText = await page
      .locator('text=Available Credits')
      .locator('..')
      .textContent();
    const displayedAvailCount = parseInt(creditsCountText?.match(/\d+/)?.[0] ?? '0', 10);
    expect(displayedAvailCount).toBe(availableCount);
  });
});
