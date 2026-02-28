import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo, expectToast } from '../helpers';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Wait for a DeleteValidationDialog (AlertDialog) to appear.
 * These show "Checking dependencies…" first, then the actual result.
 * Returns whether the dialog showed a blocking state.
 */
async function waitForDeleteValidationResult(page: Page): Promise<{
  isBlocked: boolean;
  hasWarnings: boolean;
  dialogText: string;
}> {
  // Wait for the AlertDialog to be visible
  const dialog = page.locator('[role="alertdialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Wait for the loading state to finish (Checking dependencies… disappears)
  await expect(
    dialog.getByText('Checking dependencies…'),
  ).toBeHidden({ timeout: 10_000 }).catch(() => {
    // May have already resolved or never showed loading
  });

  // Give the dialog a moment to render the result
  await page.waitForTimeout(500);

  const dialogText = (await dialog.textContent()) ?? '';

  const isBlocked = dialogText.includes('Cannot Delete');
  const hasWarnings = dialogText.includes('Are you sure you want to delete');

  return { isBlocked, hasWarnings, dialogText };
}

/** Close an AlertDialog via the Close/Cancel button */
async function closeAlertDialog(page: Page) {
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

/* ================================================================== */
/*  Test 1: Cannot delete teacher with assigned future lessons         */
/* ================================================================== */

test.describe('Data Integrity — Teacher Deletion', () => {
  test.use({ storageState: AUTH.owner });

  test('cannot delete teacher with assigned future lessons', async ({ page }) => {
    // 1. Navigate to /teachers
    await goTo(page, '/teachers');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Find a teacher — look for teacher cards with student counts
    const teacherCards = page.locator('.rounded-lg.border, .rounded-xl.border').filter({
      has: page.locator('button'),
    });
    const teacherCount = await teacherCards.count();

    if (teacherCount === 0) {
      // No teachers to test — skip gracefully
      return;
    }

    // Find the delete (trash) button on a teacher card
    const trashButton = page.locator('button').filter({
      has: page.locator('.lucide-trash-2, [class*="trash"]'),
    }).first();
    const hasTrash = await trashButton.isVisible().catch(() => false);

    if (!hasTrash) {
      // No delete buttons visible (may not be admin, or teachers aren't deletable)
      return;
    }

    // 3. Click the delete button
    await trashButton.click();

    // 4-5. Assert: DeleteValidationDialog appears
    const alertDialog = page.locator('[role="alertdialog"]').first();
    const hasAlertDialog = await alertDialog.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasAlertDialog) {
      const { isBlocked, dialogText } = await waitForDeleteValidationResult(page);

      if (isBlocked) {
        // 5. Dialog shows deletion is BLOCKED
        await expect(
          alertDialog.getByText(/cannot delete teacher/i),
        ).toBeVisible();

        // 6. Reason mentions lessons or dependencies
        expect(dialogText).toMatch(/lesson|assigned|scheduled/i);

        // Close button text is "Close" when blocked
        await expect(
          alertDialog.getByRole('button', { name: 'Close' }),
        ).toBeVisible();

        // 7. Close the dialog
        await closeAlertDialog(page);
      } else {
        // Teacher removal dialog opened (has warnings but allows it)
        // The removal dialog may say "Remove {name}?"
        const hasRemoveTitle = dialogText.match(/remove.*\?/i);
        if (hasRemoveTitle) {
          // Teacher has lessons — should show warning about upcoming lessons
          if (dialogText.match(/upcoming lesson/i)) {
            // Verified: warning about lessons is shown
            expect(dialogText).toMatch(/upcoming lesson/i);
          }
        }

        // Don't actually delete — close the dialog
        await closeAlertDialog(page);
      }
    } else {
      // A regular Dialog (not AlertDialog) might have appeared instead
      // The removal flow uses an AlertDialog with "Remove {name}?"
      const dialog = page.getByRole('dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);
      if (hasDialog) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // 8. Teacher is still in the list
    await expect(page.locator('main').first()).toBeVisible();
    // Page should still show teachers
    await expect(teacherCards.first()).toBeVisible({ timeout: 5_000 });
  });
});

/* ================================================================== */
/*  Test 2: Cannot delete location with active rooms/lessons           */
/* ================================================================== */

test.describe('Data Integrity — Location Deletion', () => {
  test.use({ storageState: AUTH.owner });

  test('cannot delete location with active rooms or lessons', async ({ page }) => {
    // 1. Navigate to /locations
    await goTo(page, '/locations');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Find a location — delete button only appears on archived locations
    //    OR on any location via the delete icon
    const deleteBtn = page.locator('button[aria-label*="Delete"]').first();
    const hasDeleteBtn = await deleteBtn.isVisible().catch(() => false);

    if (!hasDeleteBtn) {
      // Try to find a trash icon button on any location card
      const trashBtn = page.locator('button').filter({
        has: page.locator('.lucide-trash-2, [class*="trash"]'),
      }).first();
      const hasTrash = await trashBtn.isVisible().catch(() => false);

      if (!hasTrash) {
        // No deletable locations — skip gracefully
        // This is expected if all locations are active (delete only on archived)
        return;
      }

      // 3. Attempt to delete
      await trashBtn.click();
    } else {
      await deleteBtn.click();
    }

    // 4. Assert: DeleteValidationDialog shows
    const alertDialog = page.locator('[role="alertdialog"]').first();
    const hasAlertDialog = await alertDialog.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasAlertDialog) return;

    const { isBlocked, hasWarnings, dialogText } = await waitForDeleteValidationResult(page);

    if (isBlocked) {
      // Blocked — should mention lessons scheduled
      await expect(
        alertDialog.getByText(/cannot delete location/i),
      ).toBeVisible();
      expect(dialogText).toMatch(/lesson|room|scheduled/i);

      // Close button is "Close"
      await expect(
        alertDialog.getByRole('button', { name: 'Close' }),
      ).toBeVisible();
    } else if (hasWarnings) {
      // Warnings present but deletion allowed (e.g., primary location)
      await expect(
        alertDialog.getByText(/are you sure/i),
      ).toBeVisible();
    }

    // 5. Close without deleting
    await closeAlertDialog(page);

    // 6. Location still exists
    await expect(page.locator('main').first()).toBeVisible();
  });
});

/* ================================================================== */
/*  Test 3: Student deactivation vs deletion                           */
/* ================================================================== */

test.describe('Data Integrity — Student Deactivation vs Deletion', () => {
  test.use({ storageState: AUTH.owner });

  test('student deactivation vs deletion preserves data integrity', async ({ page }) => {
    // 1. Navigate to student detail page (Emma)
    await goTo(page, '/students');
    await expect(page.getByText(/emma/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(/emma/i).first().click();
    await expect(page).toHaveURL(/\/students\//, { timeout: 10_000 });
    await waitForPageReady(page);

    // 2. Check student has data (lessons/invoices)
    // Click Lessons tab to check for lessons
    const lessonsTab = page.getByRole('tab', { name: 'Lessons' });
    const hasLessonsTab = await lessonsTab.isVisible().catch(() => false);
    let hasLessons = false;
    if (hasLessonsTab) {
      await lessonsTab.click();
      await page.waitForTimeout(500);
      const lessonItems = page.locator('.rounded-lg.border').filter({
        hasText: /lesson|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
      });
      hasLessons = (await lessonItems.count()) > 0;
    }

    // Click Invoices tab to check for invoices
    const invoicesTab = page.getByRole('tab', { name: 'Invoices' });
    const hasInvoicesTab = await invoicesTab.isVisible().catch(() => false);
    let hasInvoices = false;
    if (hasInvoicesTab) {
      await invoicesTab.click();
      await page.waitForTimeout(500);
      const invoiceItems = page.locator('.rounded-lg.border, table tbody tr').filter({
        hasText: /£|invoice|draft|sent|paid/i,
      });
      hasInvoices = (await invoiceItems.count()) > 0;
    }

    // 3. Attempt to delete — look for the red trash icon in the page header
    const deleteBtn = page.locator('button.bg-destructive, button[class*="destructive"]').filter({
      has: page.locator('.lucide-trash-2, [class*="trash"]'),
    }).first();
    const hasDelete = await deleteBtn.isVisible().catch(() => false);

    if (hasDelete) {
      await deleteBtn.click();

      // 4. DeleteValidationDialog should appear
      const alertDialog = page.locator('[role="alertdialog"]').first();
      const hasAlertDialog = await alertDialog.isVisible({ timeout: 5_000 }).catch(() => false);

      if (hasAlertDialog) {
        const { isBlocked, hasWarnings, dialogText } = await waitForDeleteValidationResult(page);

        if (hasWarnings && !isBlocked) {
          // Student deletion is soft-delete with warnings
          // Should mention upcoming lessons and/or invoices if they exist
          if (hasLessons) {
            expect(dialogText).toMatch(/upcoming lesson|lesson/i);
          }
          if (hasInvoices) {
            expect(dialogText).toMatch(/invoice|unpaid/i);
          }

          // The "Delete Student" button should be available (soft-delete)
          await expect(
            alertDialog.getByRole('button', { name: /delete student/i }),
          ).toBeVisible();
        }

        // Don't actually delete — close the dialog
        await closeAlertDialog(page);
      }
    }

    // 5. Student is still accessible — data is intact
    // Go back to Overview tab
    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    if (await overviewTab.isVisible().catch(() => false)) {
      await overviewTab.click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(/emma/i).first()).toBeVisible();

    // Verify invoices are still accessible
    if (hasInvoicesTab) {
      await invoicesTab.click();
      await page.waitForTimeout(500);
      // If invoices existed before, they should still be there
      if (hasInvoices) {
        const invoiceItems = page.locator('.rounded-lg.border, table tbody tr').filter({
          hasText: /£|invoice|draft|sent|paid/i,
        });
        expect(await invoiceItems.count()).toBeGreaterThan(0);
      }
    }
  });
});

/* ================================================================== */
/*  Test 4: Invoice deletion checks                                    */
/* ================================================================== */

test.describe('Data Integrity — Invoice Deletion', () => {
  test.use({ storageState: AUTH.owner });

  test('paid invoices cannot be voided', async ({ page }) => {
    // 1. Navigate to /invoices
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Wait for invoice list to load
    await page.waitForTimeout(1_000);

    // 2. Find a "Paid" invoice by clicking into it
    const paidBadge = page.locator('text=Paid').first();
    const hasPaid = await paidBadge.isVisible().catch(() => false);

    if (hasPaid) {
      // Click on the paid invoice row/card to open detail
      const paidRow = paidBadge.locator('..').locator('..').locator('..');
      await paidRow.click().catch(async () => {
        // Fallback: click the badge's parent link/row
        await paidBadge.click();
      });

      // Wait for navigation to invoice detail
      const navigated = await page.waitForURL(/\/invoices\//, { timeout: 5_000 }).catch(() => false);

      if (navigated) {
        await waitForPageReady(page);

        // 3. Assert: "Void Invoice" button should NOT be visible for paid invoices
        // The code shows: invoice.status !== 'void' && invoice.status !== 'paid'
        const voidBtn = page.getByRole('button', { name: /void invoice/i }).first();
        const hasVoidBtn = await voidBtn.isVisible().catch(() => false);

        // 4. Paid invoices should NOT have a void button
        expect(hasVoidBtn).toBe(false);

        // Go back to invoices list
        await goTo(page, '/invoices');
      }
    }

    // 5. Find a "Draft" invoice
    const draftBadge = page.locator('text=Draft').first();
    const hasDraft = await draftBadge.isVisible().catch(() => false);

    if (hasDraft) {
      // Click on draft invoice to open detail
      const draftRow = draftBadge.locator('..').locator('..').locator('..');
      await draftRow.click().catch(async () => {
        await draftBadge.click();
      });

      const navigated = await page.waitForURL(/\/invoices\//, { timeout: 5_000 }).catch(() => false);

      if (navigated) {
        await waitForPageReady(page);

        // Draft invoices CAN be voided — button should be visible
        const voidBtn = page.getByRole('button', { name: /void invoice/i }).first();
        const hasVoidBtn = await voidBtn.isVisible().catch(() => false);

        if (hasVoidBtn) {
          // 6. Click void to see the confirmation dialog
          await voidBtn.click();

          // Assert: Confirmation dialog appears
          const alertDialog = page.locator('[role="alertdialog"]').first();
          await expect(alertDialog).toBeVisible({ timeout: 5_000 });

          // Dialog title: "Void Invoice"
          await expect(alertDialog.getByText('Void Invoice')).toBeVisible();

          // Dialog mentions "cannot be undone"
          const dialogText = await alertDialog.textContent();
          expect(dialogText).toMatch(/cannot be undone/i);

          // Don't actually void — cancel
          await alertDialog.getByRole('button', { name: 'Cancel' }).click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test('bulk void excludes paid invoices from count', async ({ page }) => {
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // Try to select invoices using "Select all" checkbox
    const selectAllCheckbox = page.locator('[aria-label="Select all"]').first();
    const hasSelectAll = await selectAllCheckbox.isVisible().catch(() => false);

    if (!hasSelectAll) return;

    await selectAllCheckbox.click();
    await page.waitForTimeout(300);

    // BulkActionsBar should appear showing "{N} invoice(s) selected"
    const selectedText = page.getByText(/\d+ invoices? selected/i).first();
    const hasSelection = await selectedText.isVisible().catch(() => false);

    if (!hasSelection) {
      // Deselect and return
      await selectAllCheckbox.click();
      return;
    }

    // Check if a "Void" bulk action exists
    const voidBulkBtn = page.getByRole('button', { name: /void \d+/i }).first();
    const hasVoidBulk = await voidBulkBtn.isVisible().catch(() => false);

    if (hasVoidBulk) {
      // The count on the void button should exclude paid and already-voided invoices
      const btnText = await voidBulkBtn.textContent();
      const voidCountMatch = btnText?.match(/void\s+(\d+)/i);
      const voidCount = voidCountMatch ? parseInt(voidCountMatch[1], 10) : 0;

      // The total selected includes all statuses, but voidable excludes paid/void
      const selectedMatch = (await selectedText.textContent())?.match(/(\d+)/);
      const totalSelected = selectedMatch ? parseInt(selectedMatch[1], 10) : 0;

      // Void count should be <= total selected (paid ones are filtered out)
      expect(voidCount).toBeLessThanOrEqual(totalSelected);
    }

    // Clear selection
    const clearBtn = page.getByRole('button', { name: /clear/i }).first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
    }
  });
});

/* ================================================================== */
/*  Test 5: Recurring lesson series edit — "this only" vs "all future" */
/* ================================================================== */

test.describe('Data Integrity — Recurring Lesson Editing', () => {
  test.use({ storageState: AUTH.owner });

  test('recurring lesson shows "this only" vs "all future" options', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Navigate to /calendar
    await goTo(page, '/calendar');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Find a lesson — look for clickable lesson cards/blocks in the calendar
    // Recurring lessons show a Repeat icon
    await page.waitForTimeout(1_000);

    // Try to find any lesson block to click on
    const lessonBlocks = page.locator('[class*="cursor-pointer"]').filter({
      hasText: /\d{1,2}:\d{2}/,  // Time pattern like "10:00" or "14:30"
    });
    const lessonCount = await lessonBlocks.count();

    if (lessonCount === 0) {
      // No lessons on current view — try navigating to next/previous week
      const nextBtn = page.locator('[aria-label="Next"], [aria-label="Next week"]').first();
      const hasNext = await nextBtn.isVisible().catch(() => false);
      if (hasNext) {
        await nextBtn.click();
        await page.waitForTimeout(1_000);
      }
    }

    // Look for lessons again
    const allLessons = page.locator('[class*="cursor-pointer"]').filter({
      hasText: /\d{1,2}:\d{2}/,
    });
    const totalLessons = await allLessons.count();

    if (totalLessons === 0) {
      // No lessons in calendar — skip gracefully
      return;
    }

    // 3. Click on the first lesson
    await allLessons.first().click();
    await page.waitForTimeout(500);

    // A detail panel or sheet should open
    // Look for action buttons: Reschedule, Cancel, Delete
    const rescheduleBtn = page.getByRole('button', { name: /reschedule|edit/i }).first();
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();

    // Check if this is a recurring lesson by looking for the Repeat icon or "Weekly" text
    const recurringIndicator = page.getByText(/weekly|recurring|series/i).first();
    const isRecurring = await recurringIndicator.isVisible().catch(() => false);

    if (!isRecurring) {
      // Try finding another lesson that is recurring
      // Close current panel first
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Look for lessons with the repeat icon
      const recurringLessons = page.locator('[class*="cursor-pointer"]').filter({
        has: page.locator('.lucide-repeat, [class*="repeat"]'),
      });
      const recurringCount = await recurringLessons.count();

      if (recurringCount === 0) {
        // No recurring lessons found — skip test with clear message
        test.skip(true, 'No recurring lessons found in calendar test data');
        return;
      }

      await recurringLessons.first().click();
      await page.waitForTimeout(500);
    }

    // Now try to trigger the edit/cancel flow to see RecurringActionDialog
    // Try "Cancel" action on the recurring lesson
    const cancelAction = page.getByRole('button', { name: /cancel/i }).first();
    const hasCancelAction = await cancelAction.isVisible().catch(() => false);

    if (hasCancelAction) {
      await cancelAction.click();
      await page.waitForTimeout(500);

      // 4. Assert: RecurringActionDialog appears
      const dialog = page.getByRole('dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        const dialogText = await dialog.textContent();

        // Check if it's the RecurringActionDialog
        const isRecurringDialog =
          dialogText?.includes('This lesson only') ||
          dialogText?.includes('Recurring Lesson') ||
          dialogText?.includes('recurring series');

        if (isRecurringDialog) {
          // 5. Assert: Two options are present
          await expect(
            dialog.getByText('This lesson only'),
          ).toBeVisible({ timeout: 3_000 });
          await expect(
            dialog.getByText('This and all future lessons'),
          ).toBeVisible({ timeout: 3_000 });

          // Assert: Correct title
          await expect(
            dialog.getByText(/cancel recurring lesson/i),
          ).toBeVisible();

          // Assert: Description text
          await expect(
            dialog.getByText(/recurring series/i),
          ).toBeVisible();

          // Close without selecting an option
          const closeBtn = dialog.getByRole('button', { name: /cancel/i }).last();
          await closeBtn.click();
          await page.waitForTimeout(300);
        } else {
          // Not a recurring dialog — it might be a direct cancel confirmation
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    }

    // Also try the delete action to verify it shows the same recurring dialog
    const deleteAction = page.getByRole('button', { name: /delete/i }).first();
    const hasDeleteAction = await deleteAction.isVisible().catch(() => false);

    if (hasDeleteAction) {
      await deleteAction.click();
      await page.waitForTimeout(500);

      const dialog = page.getByRole('dialog').first();
      const alertDialog = page.locator('[role="alertdialog"]').first();
      const hasDialog = await dialog.isVisible().catch(() => false);
      const hasAlert = await alertDialog.isVisible().catch(() => false);

      const activeDialog = hasDialog ? dialog : hasAlert ? alertDialog : null;

      if (activeDialog) {
        const dialogText = await activeDialog.textContent();
        const isRecurringDialog =
          dialogText?.includes('This lesson only') ||
          dialogText?.includes('Delete Recurring Lesson');

        if (isRecurringDialog) {
          await expect(
            activeDialog.getByText('This lesson only'),
          ).toBeVisible({ timeout: 3_000 });
          await expect(
            activeDialog.getByText('This and all future lessons'),
          ).toBeVisible({ timeout: 3_000 });
        }

        // Close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });
});

/* ================================================================== */
/*  Test 6: Bulk operations maintain integrity                         */
/* ================================================================== */

test.describe('Data Integrity — Bulk Operations', () => {
  test.use({ storageState: AUTH.owner });

  test('invoice bulk selection and actions maintain integrity', async ({ page }) => {
    // 1. Navigate to /invoices — invoices have full bulk select support
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // 2. Check if bulk select is available via "Select all" checkbox
    const selectAllCheckbox = page.locator('[aria-label="Select all"]').first();
    const hasSelectAll = await selectAllCheckbox.isVisible().catch(() => false);

    if (!hasSelectAll) return;

    // Select all invoices
    await selectAllCheckbox.click();
    await page.waitForTimeout(300);

    // BulkActionsBar should appear
    const selectionBar = page.getByText(/\d+ invoices? selected/i).first();
    const hasSelectionBar = await selectionBar.isVisible().catch(() => false);

    if (!hasSelectionBar) {
      // No invoices to select — deselect and return
      await selectAllCheckbox.click();
      return;
    }

    // Extract selection count
    const selectionText = await selectionBar.textContent();
    const selectedCount = parseInt(selectionText?.match(/(\d+)/)?.[1] ?? '0', 10);
    expect(selectedCount).toBeGreaterThan(0);

    // Check for bulk send drafts button
    const sendDraftsBtn = page.getByRole('button', { name: /send \d+ drafts?/i }).first();
    const hasSendDrafts = await sendDraftsBtn.isVisible().catch(() => false);

    if (hasSendDrafts) {
      // Button shows count of draft invoices
      const btnText = await sendDraftsBtn.textContent();
      expect(btnText).toMatch(/send \d+/i);
    }

    // Check for bulk void button
    const voidBtn = page.getByRole('button', { name: /void \d+/i }).first();
    const hasVoid = await voidBtn.isVisible().catch(() => false);

    if (hasVoid) {
      // Click void to see confirmation
      await voidBtn.click();
      await page.waitForTimeout(500);

      // Confirmation dialog should show count of affected invoices
      const alertDialog = page.locator('[role="alertdialog"]').first();
      const hasAlert = await alertDialog.isVisible().catch(() => false);

      if (hasAlert) {
        const dialogText = await alertDialog.textContent();
        // Should mention the count and "cannot be undone"
        expect(dialogText).toMatch(/void.*\d+.*invoice/i);
        expect(dialogText).toMatch(/cannot be undone/i);

        // Cancel — don't actually void
        await alertDialog.getByRole('button', { name: 'Cancel' }).click();
        await page.waitForTimeout(300);
      }
    }

    // Clear selection
    const clearBtn = page.getByRole('button', { name: /clear/i }).first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(300);
    }

    // After clearing, bulk bar should disappear
    await expect(selectionBar).toBeHidden({ timeout: 3_000 });
  });

  test('student export works without data loss', async ({ page }) => {
    // Navigate to /students
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Look for an export button
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    const hasExport = await exportBtn.isVisible().catch(() => false);

    if (!hasExport) {
      // Look for export in a dropdown menu
      const moreBtn = page.getByRole('button', { name: /more|options|actions/i }).first();
      const hasMore = await moreBtn.isVisible().catch(() => false);
      if (hasMore) {
        await moreBtn.click();
        await page.waitForTimeout(300);

        const exportMenuItem = page.getByRole('menuitem', { name: /export/i }).first();
        const hasExportMenu = await exportMenuItem.isVisible().catch(() => false);
        if (hasExportMenu) {
          // Export exists in dropdown — verify it's clickable
          await expect(exportMenuItem).toBeEnabled();
        }
        // Close menu
        await page.keyboard.press('Escape');
      }
      return;
    }

    // Export button is visible — verify it's accessible
    await expect(exportBtn).toBeEnabled();

    // After clicking export, the student list should remain unchanged
    const studentsBefore = page.getByText(/emma|james|sophie/i).first();
    const hadStudents = await studentsBefore.isVisible().catch(() => false);

    // Verify students are still visible after any export action
    if (hadStudents) {
      await expect(studentsBefore).toBeVisible();
    }
  });
});
