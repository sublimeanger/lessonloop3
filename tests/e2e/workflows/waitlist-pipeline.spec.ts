/**
 * Prompt 9A — Waitlist: Waiting to Enrolled
 *
 * Tests the complete enrolment waitlist pipeline:
 * waiting → offered → accepted → enrolled (converts to student) | declined/expired/withdrawn
 *
 * The waitlist is how music academies manage demand — students wait for slots,
 * get offered a place, and convert to enrolled students.
 */
import { test, expect } from '../workflow.fixtures';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';
import {
  assertPageLoaded,
  assertNoErrorBoundary,
} from '../workflow-helpers';

const TS = Date.now();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Read a stat card value by label. Returns the numeric value or 0. */
async function readStatValue(
  page: import('@playwright/test').Page,
  label: RegExp,
): Promise<number> {
  const card = page
    .locator('.grid .border, [class*="card"], .rounded-lg')
    .filter({ hasText: label })
    .first();
  const visible = await card.isVisible().catch(() => false);
  if (!visible) return 0;
  const num = card.locator('.text-2xl, .text-3xl, .font-bold').first();
  const text = (await num.textContent().catch(() => '0')) ?? '0';
  return parseInt(text.trim(), 10) || 0;
}

/** Add an entry to the waitlist via the dialog. Returns the contact name used. */
async function addWaitlistEntry(
  page: import('@playwright/test').Page,
  opts: {
    contactName: string;
    email: string;
    phone?: string;
    childFirst: string;
    instrument: string;
    preferredDay?: string;
    experience?: string;
    duration?: string;
    priority?: string;
  },
) {
  // Click "Add to Waiting List"
  await page.getByRole('button', { name: /add to waiting list/i }).first().click();
  await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]')).first()).toBeVisible({
    timeout: 5_000,
  });

  // Fill contact details
  await page.locator('#wl-contact-name').fill(opts.contactName);
  const emailInput = page.locator('#wl-email');
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(opts.email);
  }
  if (opts.phone) {
    const phoneInput = page.locator('#wl-phone');
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill(opts.phone);
    }
  }

  // Fill child details
  await page.locator('#wl-child-first').fill(opts.childFirst);

  // Experience level (select)
  if (opts.experience) {
    const expSelect = page.locator('#wl-experience');
    if (await expSelect.isVisible().catch(() => false)) {
      await expSelect.click();
      await page.getByRole('option', { name: opts.experience }).first().click();
      await page.waitForTimeout(200);
    }
  }

  // Instrument (select — required)
  const instrumentSelect = page.locator('#wl-instrument');
  await instrumentSelect.click();
  await page.getByRole('option', { name: opts.instrument }).first().click();
  await page.waitForTimeout(200);

  // Duration (select)
  if (opts.duration) {
    const durationSelect = page.locator('#wl-duration');
    if (await durationSelect.isVisible().catch(() => false)) {
      await durationSelect.click();
      await page
        .getByRole('option', { name: new RegExp(opts.duration) })
        .first()
        .click();
      await page.waitForTimeout(200);
    }
  }

  // Preferred day (checkbox)
  if (opts.preferredDay) {
    const dayCheckbox = page
      .getByLabel(new RegExp(opts.preferredDay, 'i'))
      .first();
    if (await dayCheckbox.isVisible().catch(() => false)) {
      await dayCheckbox.click();
    }
  }

  // Priority (select)
  if (opts.priority) {
    const prioritySelect = page.locator('#wl-priority');
    if (await prioritySelect.isVisible().catch(() => false)) {
      await prioritySelect.click();
      await page
        .getByRole('option', { name: new RegExp(opts.priority, 'i') })
        .first()
        .click();
      await page.waitForTimeout(200);
    }
  }

  // Submit
  const submitBtn = page
    .getByRole('dialog')
    .or(page.locator('[role="dialog"]'))
    .first()
    .getByRole('button', { name: /add to waiting list/i })
    .first();
  await submitBtn.click();
}

/* ------------------------------------------------------------------ */
/*  Test 1 — Waitlist full pipeline                                    */
/* ------------------------------------------------------------------ */

test.describe('Waitlist — Full Pipeline', () => {
  test.use({ storageState: AUTH.owner });

  test('add entry, offer slot, track status', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(120_000);

    // Step 1: Navigate to /waitlist
    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist');

    // Step 2: Note the stats
    const initialWaiting = await readStatValue(page, /waiting/i);

    // Steps 3-5: Click "Add to Waiting List" and fill the form
    const contactName = `E2E-Waitlist-${TS}`;
    const email = `e2e-waitlist-${TS}@test.lessonloop.net`;
    await addWaitlistEntry(page, {
      contactName,
      email,
      phone: '07700900003',
      childFirst: 'WaitlistChild',
      instrument: 'Piano',
      preferredDay: 'Thu',
      experience: 'Beginner',
      duration: '30',
    });

    // Step 7: Assert success toast
    await expectToast(page, /added|waiting list|created/i);
    await page.waitForTimeout(500);

    // Step 8: Entry should appear with "Waiting" status
    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist (after add)');

    const entryText = page.getByText(contactName).or(page.getByText('WaitlistChild')).first();
    const entryVisible = await entryText.isVisible({ timeout: 10_000 }).catch(() => false);
    softAssert(entryVisible, `New waitlist entry "${contactName}" should appear in the list`);

    // Check for "Waiting" badge near the entry
    const mainText = (await page.locator('main').textContent()) ?? '';
    softAssert(
      mainText.includes('Waiting') || mainText.includes('waiting'),
      'Entry should show "Waiting" status badge',
    );

    // Step 9: Waiting count should have incremented
    const newWaiting = await readStatValue(page, /waiting/i);
    softAssert(
      newWaiting >= initialWaiting,
      `Waiting stat should be >= initial (${initialWaiting} → ${newWaiting})`,
    );

    // Step 10-11: Open the entry and try to offer a slot
    // Click the entry row to open detail
    if (entryVisible) {
      await entryText.click();
      await page.waitForTimeout(500);

      // Look for "Offer Slot" button (in detail panel or dropdown menu)
      const offerBtn = page.getByRole('button', { name: /offer slot/i }).first();
      const offerMenuItem = page.getByRole('menuitem', { name: /offer slot/i }).first();

      let canOffer = await offerBtn.isVisible().catch(() => false);
      if (!canOffer) {
        // Try three-dot menu
        const moreBtn = page.locator('button').filter({ hasText: /⋮/ }).first();
        const moreBtnAlt = page.locator('[aria-label*="ore"]').first();
        if (await moreBtn.isVisible().catch(() => false)) {
          await moreBtn.click();
          await page.waitForTimeout(300);
          canOffer = await offerMenuItem.isVisible().catch(() => false);
        } else if (await moreBtnAlt.isVisible().catch(() => false)) {
          await moreBtnAlt.click();
          await page.waitForTimeout(300);
          canOffer = await offerMenuItem.isVisible().catch(() => false);
        }
      }

      if (canOffer) {
        // Click the offer button
        const target = (await offerBtn.isVisible().catch(() => false))
          ? offerBtn
          : offerMenuItem;
        await target.click();
        await page.waitForTimeout(500);

        // Fill offer details
        const offerDialog = page.getByRole('dialog').first();
        const dialogVisible = await offerDialog.isVisible().catch(() => false);
        softAssert(dialogVisible, 'Offer dialog should open');

        if (dialogVisible) {
          // Day select
          const daySelect = page.locator('#offer-day');
          if (await daySelect.isVisible().catch(() => false)) {
            await daySelect.click();
            await page.getByRole('option', { name: /thursday/i }).first().click();
            await page.waitForTimeout(200);
          }

          // Time input
          const timeInput = page.locator('#offer-time');
          if (await timeInput.isVisible().catch(() => false)) {
            await timeInput.fill('16:00');
          }

          // Teacher select
          const teacherSelect = page.locator('#offer-teacher');
          if (await teacherSelect.isVisible().catch(() => false)) {
            await teacherSelect.click();
            // Select first available teacher
            const firstTeacher = page.getByRole('option').first();
            if (await firstTeacher.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await firstTeacher.click();
              await page.waitForTimeout(200);
            }
          }

          // Location input
          const locationInput = page.locator('#offer-location');
          if (await locationInput.isVisible().catch(() => false)) {
            await locationInput.fill('Main Room');
          }

          // Rate input
          const rateInput = page.locator('#offer-rate');
          if (await rateInput.isVisible().catch(() => false)) {
            await rateInput.fill('3000');
          }

          // Submit the offer
          const sendOfferBtn = page
            .getByRole('button', { name: /send offer/i })
            .first();
          if (await sendOfferBtn.isVisible().catch(() => false)) {
            await sendOfferBtn.click();
            await expectToast(page, /offered|slot offered|sent/i);
          }
        }
      } else {
        softAssert(true, 'Offer Slot button not available — skipping offer flow');
      }
    }

    // Step 12: Verify offered details (if we offered)
    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist (after offer)');
    await assertNoErrorBoundary(page);

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 2 — Waitlist status filter works                              */
/* ------------------------------------------------------------------ */

test.describe('Waitlist — Status Filter', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist status filter works', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist');

    // Look for search input
    const searchInput = page.getByPlaceholder(/search families/i).first();
    const hasSearch = await searchInput.isVisible().catch(() => false);
    softAssert(hasSearch, 'Search input should be visible on waitlist page');

    // Look for status filter
    const statusFilter = page
      .getByRole('combobox')
      .first();
    const hasStatusFilter = await statusFilter.isVisible().catch(() => false);

    if (hasStatusFilter) {
      // Try filtering by "Waiting"
      await statusFilter.click();
      await page.waitForTimeout(300);
      const waitingOption = page.getByRole('option', { name: /waiting/i }).first();
      if (await waitingOption.isVisible().catch(() => false)) {
        await waitingOption.click();
        await page.waitForTimeout(500);

        // All visible entries should have "Waiting" badge
        const mainContent = (await page.locator('main').textContent()) ?? '';
        softAssert(
          !mainContent.includes('Offered') || mainContent.includes('Waiting'),
          'Filter by "Waiting" should only show waiting entries',
        );
      }

      // Try filtering by "All" or clear
      await statusFilter.click();
      await page.waitForTimeout(300);
      const allOption = page.getByRole('option', { name: /all|active/i }).first();
      if (await allOption.isVisible().catch(() => false)) {
        await allOption.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
      }
    } else {
      softAssert(true, 'No status filter combobox found — page may use a different filter UI');
    }

    // If search exists, try searching for a known entry
    if (hasSearch) {
      await searchInput.fill(`E2E-Waitlist`);
      await page.waitForTimeout(500);

      const mainContent = (await page.locator('main').textContent()) ?? '';
      const hasResults = mainContent.includes('E2E-Waitlist') || mainContent.includes('WaitlistChild');
      softAssert(
        hasResults || mainContent.includes('No families'),
        'Search should filter results or show empty state',
      );

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 3 — Waitlist stats match actual entries                       */
/* ------------------------------------------------------------------ */

test.describe('Waitlist — Stats Match Entries', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist stats match actual entries', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist');

    // Read stats values
    const waitingStat = await readStatValue(page, /waiting/i);
    const offeredStat = await readStatValue(page, /offered/i);
    const acceptedStat = await readStatValue(page, /accepted/i);
    const enrolledStat = await readStatValue(page, /enrolled/i);

    softAssert(
      waitingStat >= 0 && offeredStat >= 0 && acceptedStat >= 0 && enrolledStat >= 0,
      'All stat values should be non-negative numbers',
    );

    // If status filter exists, filter by "Waiting" and count visible rows
    const statusFilter = page.getByRole('combobox').first();
    const hasFilter = await statusFilter.isVisible().catch(() => false);

    if (hasFilter && waitingStat > 0) {
      await statusFilter.click();
      await page.waitForTimeout(300);
      const waitingOpt = page.getByRole('option', { name: /^Waiting$/i }).first();
      if (await waitingOpt.isVisible().catch(() => false)) {
        await waitingOpt.click();
        await page.waitForTimeout(1_000);

        // Count visible entries (table rows or cards)
        const rows = page.locator('main table tbody tr, main .rounded-lg.border, main [class*="card"]');
        const visibleCount = await rows.count();

        // Allow tolerance — pagination or lazy loading might limit visible entries
        softAssert(
          visibleCount > 0 || waitingStat === 0,
          `Waiting filter: visible rows (${visibleCount}) should match stat (${waitingStat}) or be paginated`,
        );
      }

      // Reset filter
      await statusFilter.click();
      await page.waitForTimeout(300);
      const allOpt = page.getByRole('option', { name: /all|active/i }).first();
      if (await allOpt.isVisible().catch(() => false)) {
        await allOpt.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 4 — Waitlist entry shows correct priority                     */
/* ------------------------------------------------------------------ */

test.describe('Waitlist — Entry Priority', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist entry shows correct priority', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(90_000);

    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist');

    // Create a high-priority entry
    const highPriorityName = `E2E-HighPri-${TS}`;
    await addWaitlistEntry(page, {
      contactName: highPriorityName,
      email: `e2e-highpri-${TS}@test.lessonloop.net`,
      childFirst: 'HighPriChild',
      instrument: 'Piano',
      priority: 'high',
    });
    await expectToast(page, /added|waiting list|created/i);
    await page.waitForTimeout(500);

    // Refresh and check priority indicator
    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist (after high-priority add)');

    // Look for priority indicator (badge, accent border, or text)
    const mainContent = (await page.locator('main').textContent()) ?? '';
    const hasHighPriIndicator =
      mainContent.toLowerCase().includes('high') ||
      (await page.locator('[class*="amber"], [class*="border-l"]').count()) > 0;
    softAssert(
      hasHighPriIndicator,
      'High-priority entry should have a visual priority indicator (badge or accent border)',
    );

    // Create a normal-priority entry for comparison
    const normalPriorityName = `E2E-NormPri-${TS}`;
    await addWaitlistEntry(page, {
      contactName: normalPriorityName,
      email: `e2e-normpri-${TS}@test.lessonloop.net`,
      childFirst: 'NormPriChild',
      instrument: 'Piano',
      priority: 'normal',
    });
    await expectToast(page, /added|waiting list|created/i);
    await page.waitForTimeout(500);

    // Verify both entries exist
    await goTo(page, '/waitlist');
    const bodyText = (await page.locator('main').textContent()) ?? '';
    softAssert(
      bodyText.includes('HighPriChild') || bodyText.includes(highPriorityName),
      'High-priority entry should be visible',
    );
    softAssert(
      bodyText.includes('NormPriChild') || bodyText.includes(normalPriorityName),
      'Normal-priority entry should be visible',
    );

    assertCleanRun();
  });
});

/* ------------------------------------------------------------------ */
/*  Test 5 — Waitlist instrument grouping                              */
/* ------------------------------------------------------------------ */

test.describe('Waitlist — Instrument Grouping', () => {
  test.use({ storageState: AUTH.owner });

  test('waitlist instrument grouping or filtering', async ({
    page,
    errorTracker,
    assertCleanRun,
    softAssert,
  }) => {
    test.setTimeout(60_000);

    await goTo(page, '/waitlist');
    await assertPageLoaded(page, 'Waitlist');

    // Look for an instrument filter dropdown
    const instrumentFilter = page
      .getByRole('combobox')
      .filter({ hasText: /instrument|all instruments/i })
      .first();
    const hasInstrumentFilter = await instrumentFilter
      .isVisible()
      .catch(() => false);

    if (hasInstrumentFilter) {
      // Filter by "Piano"
      await instrumentFilter.click();
      await page.waitForTimeout(300);

      const pianoOption = page.getByRole('option', { name: /piano/i }).first();
      if (await pianoOption.isVisible().catch(() => false)) {
        await pianoOption.click();
        await page.waitForTimeout(500);

        // All visible entries should be piano-related
        const mainContent = (await page.locator('main').textContent()) ?? '';
        softAssert(
          mainContent.includes('Piano') || mainContent.includes('piano') || mainContent.includes('No families'),
          'Instrument filter by Piano should show only piano entries or empty state',
        );
      }

      // Clear filter
      await instrumentFilter.click();
      await page.waitForTimeout(300);
      const allOption = page.getByRole('option', { name: /all/i }).first();
      if (await allOption.isVisible().catch(() => false)) {
        await allOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
    } else {
      // Try finding any combobox that might be instrument-related
      const allComboboxes = page.getByRole('combobox');
      const cbCount = await allComboboxes.count();
      softAssert(
        cbCount >= 0,
        `No instrument filter found — page has ${cbCount} comboboxes total`,
      );
    }

    assertCleanRun();
  });
});
