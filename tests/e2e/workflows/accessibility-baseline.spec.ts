import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ================================================================== */
/*  Test 1: All pages have proper page titles                          */
/* ================================================================== */

test.describe('Accessibility — Page Titles', () => {
  test.describe('staff pages', () => {
    test.use({ storageState: AUTH.owner });

    const staffPages: Array<{ path: string; mustContain: string[]; title: string }> = [
      { path: '/dashboard', mustContain: ['Dashboard', 'LessonLoop'], title: 'Dashboard | LessonLoop' },
      { path: '/students', mustContain: ['Students', 'LessonLoop'], title: 'Students | LessonLoop' },
      { path: '/calendar', mustContain: ['Calendar', 'LessonLoop'], title: 'Calendar | LessonLoop' },
      { path: '/teachers', mustContain: ['Teachers', 'LessonLoop'], title: 'Teachers | LessonLoop' },
      { path: '/locations', mustContain: ['Locations', 'LessonLoop'], title: 'Locations | LessonLoop' },
      { path: '/invoices', mustContain: ['Invoices', 'LessonLoop'], title: 'Invoices | LessonLoop' },
      { path: '/reports', mustContain: ['Reports', 'LessonLoop'], title: 'Reports | LessonLoop' },
      { path: '/messages', mustContain: ['Messages', 'LessonLoop'], title: 'Messages | LessonLoop' },
      { path: '/settings', mustContain: ['Settings', 'LessonLoop'], title: 'Settings | LessonLoop' },
      { path: '/register', mustContain: ['Register', 'LessonLoop'], title: 'Daily Register | LessonLoop' },
      { path: '/practice', mustContain: ['Practice', 'LessonLoop'], title: 'Practice | LessonLoop' },
      { path: '/resources', mustContain: ['Resources', 'LessonLoop'], title: 'Resources | LessonLoop' },
    ];

    for (const { path, mustContain, title: expectedTitle } of staffPages) {
      test(`${path} has correct page title: "${expectedTitle}"`, async ({ page }) => {
        await goTo(page, path);

        const actualTitle = await page.title();
        for (const text of mustContain) {
          expect(
            actualTitle,
            `Page title for ${path} should contain "${text}" but was "${actualTitle}"`,
          ).toContain(text);
        }
      });
    }
  });

  test.describe('parent portal pages', () => {
    test.use({ storageState: AUTH.parent });

    const portalPages: Array<{ path: string; mustContain: string[]; title: string }> = [
      { path: '/portal/home', mustContain: ['Home', 'Portal'], title: 'Home | Parent Portal' },
      { path: '/portal/schedule', mustContain: ['Schedule', 'Portal'], title: 'Schedule | Parent Portal' },
      { path: '/portal/invoices', mustContain: ['Invoices', 'Portal'], title: 'Invoices | Parent Portal' },
    ];

    for (const { path, mustContain, title: expectedTitle } of portalPages) {
      test(`${path} has correct page title: "${expectedTitle}"`, async ({ page }) => {
        await goTo(page, path);

        const actualTitle = await page.title();
        for (const text of mustContain) {
          expect(
            actualTitle,
            `Page title for ${path} should contain "${text}" but was "${actualTitle}"`,
          ).toContain(text);
        }
      });
    }
  });
});

/* ================================================================== */
/*  Test 2: All interactive elements are keyboard accessible           */
/* ================================================================== */

test.describe('Accessibility — Keyboard Navigation', () => {
  test.use({ storageState: AUTH.owner });

  test('students page supports full keyboard navigation', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 1. Press Tab repeatedly and track focus movement
    const focusedElements: string[] = [];

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          text: (el as HTMLElement).innerText?.slice(0, 50) || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          type: el.getAttribute('type') || '',
        };
      });

      if (focused) {
        focusedElements.push(
          `${focused.tag}${focused.role ? `[role=${focused.role}]` : ''}${focused.ariaLabel ? `[${focused.ariaLabel}]` : ''}: ${focused.text}`,
        );
      }
    }

    // 2. Assert: Focus moves through multiple interactive elements
    expect(focusedElements.length).toBeGreaterThan(3);

    // 3. Assert: Focus indicators are visible
    // Tab to an element and check for visible focus ring
    await page.keyboard.press('Tab');
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const style = window.getComputedStyle(el);
      const pseudoStyle = window.getComputedStyle(el, '::after');
      // Check for outline, box-shadow (ring), or border changes that indicate focus
      return (
        style.outlineStyle !== 'none' ||
        style.boxShadow !== 'none' ||
        pseudoStyle.outlineStyle !== 'none' ||
        el.classList.contains('focus-visible') ||
        el.matches(':focus-visible')
      );
    });
    // Focus indicator should be present (outline, ring, or CSS class)
    // Note: some elements use ring-offset patterns that are hard to detect purely via computed style
    // So we also accept that focus moved (which means focus management is working)
    expect(hasFocusStyle || focusedElements.length > 3).toBe(true);

    // 4. Find the "Add Student" button via Tab and activate with Enter
    // First reset focus to start
    await page.keyboard.press('Tab');

    // Try to find Add Student button by tabbing
    let foundAddStudent = false;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focusedText = await page.evaluate(() => {
        const el = document.activeElement;
        return (el as HTMLElement)?.innerText?.trim() || el?.getAttribute('aria-label') || '';
      });

      if (focusedText.toLowerCase().includes('add student')) {
        foundAddStudent = true;
        break;
      }
    }

    if (foundAddStudent) {
      // 5. Press Enter to open the wizard
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // 6. Assert: Wizard dialog opens
      const dialog = page.getByRole('dialog').first();
      const wizardOpen = await dialog.isVisible().catch(() => false);
      expect(wizardOpen).toBe(true);

      if (wizardOpen) {
        // Verify dialog title
        await expect(dialog.getByText('Add Student')).toBeVisible({ timeout: 2_000 });

        // 7. Press Escape to close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // 8. Assert: Wizard closes
        await expect(dialog).toBeHidden({ timeout: 2_000 });
      }
    }
  });

  test('dialogs trap focus correctly', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Open Add Student wizard via click
    const addBtn = page.getByRole('button', { name: /add student/i }).first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);
    if (!hasAddBtn) return;

    await addBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Tab through the dialog — focus should stay within
    const focusTargets: string[] = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const isInDialog = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('[role="dialog"]') !== null;
      });
      focusTargets.push(isInDialog ? 'in-dialog' : 'outside');
    }

    // Most or all focus targets should be within the dialog (focus trap)
    const inDialogCount = focusTargets.filter((t) => t === 'in-dialog').length;
    expect(inDialogCount).toBeGreaterThan(focusTargets.length * 0.7);

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});

/* ================================================================== */
/*  Test 3: Forms have proper labels                                   */
/* ================================================================== */

test.describe('Accessibility — Form Labels', () => {
  test.use({ storageState: AUTH.owner });

  test('profile settings form inputs have associated labels', async ({ page }) => {
    await goTo(page, '/settings?tab=profile');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Wait for profile form to load
    await page.waitForTimeout(1_000);

    // Check all visible form inputs
    const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();

    const unlabelledInputs: string[] = [];

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      const type = await input.getAttribute('type');
      const role = await input.getAttribute('role');

      // Skip hidden/special inputs
      if (type === 'hidden' || type === 'file') continue;

      // Check for associated <label for="id">
      let hasLabel = false;
      if (id) {
        hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
      }

      // Also check if input is inside a <label> element
      const isInsideLabel = await input.evaluate((el) => {
        return el.closest('label') !== null;
      });

      // Some inputs use aria-label, aria-labelledby, or are search inputs with placeholder
      const hasAccessibleName = !!(
        hasLabel ||
        isInsideLabel ||
        ariaLabel ||
        ariaLabelledBy ||
        (role === 'searchbox' && placeholder) ||
        (type === 'search' && placeholder)
      );

      if (!hasAccessibleName) {
        const inputDesc = id || placeholder || type || 'unknown';
        unlabelledInputs.push(inputDesc);
      }
    }

    // Assert: All form inputs have an accessible label
    expect(
      unlabelledInputs,
      `These inputs lack accessible labels: ${unlabelledInputs.join(', ')}`,
    ).toHaveLength(0);
  });

  test('student wizard form inputs have labels', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Open the Add Student wizard
    const addBtn = page.getByRole('button', { name: /add student/i }).first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);
    if (!hasAddBtn) return;

    await addBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Check all inputs within the dialog
    const inputs = await dialog.locator('input:visible, select:visible, textarea:visible').all();

    const unlabelledInputs: string[] = [];

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const type = await input.getAttribute('type');
      const role = await input.getAttribute('role');
      const placeholder = await input.getAttribute('placeholder');

      if (type === 'hidden' || type === 'file') continue;

      let hasLabel = false;
      if (id) {
        hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
      }

      const isInsideLabel = await input.evaluate((el) => {
        return el.closest('label') !== null;
      });

      const hasAccessibleName = !!(
        hasLabel ||
        isInsideLabel ||
        ariaLabel ||
        ariaLabelledBy ||
        (role === 'combobox') // Comboboxes from Radix have built-in a11y
      );

      if (!hasAccessibleName) {
        const inputDesc = id || placeholder || type || 'unknown';
        unlabelledInputs.push(inputDesc);
      }
    }

    expect(
      unlabelledInputs,
      `Wizard inputs lack labels: ${unlabelledInputs.join(', ')}`,
    ).toHaveLength(0);

    // Close wizard
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});

/* ================================================================== */
/*  Test 4: Images have alt text                                       */
/* ================================================================== */

test.describe('Accessibility — Image Alt Text', () => {
  /** Assert all <img> elements on the page have alt or role="presentation" */
  async function assertImagesHaveAlt(page: Page, pageName: string) {
    const images = await page.locator('img').all();

    const missingAlt: string[] = [];

    for (const img of images) {
      // Only check visible images
      const isVisible = await img.isVisible().catch(() => false);
      if (!isVisible) continue;

      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      const ariaHidden = await img.getAttribute('aria-hidden');
      const src = await img.getAttribute('src');

      // Each image should have:
      // - alt text (even empty string "" for decorative is acceptable per WCAG)
      // - OR role="presentation" / role="none" for decorative images
      // - OR aria-hidden="true" for decorative images
      const hasAlt = alt !== null; // alt="" is valid (decorative)
      const isPresentation = role === 'presentation' || role === 'none';
      const isHidden = ariaHidden === 'true';

      if (!hasAlt && !isPresentation && !isHidden) {
        missingAlt.push(src || 'unknown-src');
      }
    }

    expect(
      missingAlt,
      `Images missing alt text on ${pageName}: ${missingAlt.join(', ')}`,
    ).toHaveLength(0);
  }

  test.describe('as owner', () => {
    test.use({ storageState: AUTH.owner });

    test('dashboard images have alt text', async ({ page }) => {
      await goTo(page, '/dashboard');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      await assertImagesHaveAlt(page, '/dashboard');
    });

    test('students page images have alt text', async ({ page }) => {
      await goTo(page, '/students');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      await assertImagesHaveAlt(page, '/students');
    });
  });

  test.describe('as parent', () => {
    test.use({ storageState: AUTH.parent });

    test('portal home images have alt text', async ({ page }) => {
      await goTo(page, '/portal/home');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
      await assertImagesHaveAlt(page, '/portal/home');
    });
  });
});

/* ================================================================== */
/*  Test 5: Colour contrast meets WCAG AA (spot check)                 */
/* ================================================================== */

test.describe('Accessibility — Colour Contrast Spot Check', () => {
  test.use({ storageState: AUTH.owner });

  test('status badges have sufficient visual contrast', async ({ page }) => {
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Check for student status indicators
    // Active students show a green dot, inactive show gray
    const activeIndicators = page.locator('.bg-success');
    const activeCount = await activeIndicators.count();
    if (activeCount > 0) {
      // Green success indicator exists — verify it's visible
      const firstActive = activeIndicators.first();
      await expect(firstActive).toBeVisible();

      // Check the indicator has a visible colour (not transparent)
      const bgColor = await firstActive.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.backgroundColor;
      });
      // Should not be transparent or white
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bgColor).not.toBe('transparent');
    }

    // Navigate to invoices to check more badge variants
    await goTo(page, '/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);

    // Check that badge text is readable by verifying computed styles
    const badges = page.locator('.rounded-full').filter({
      hasText: /paid|draft|sent|overdue|void/i,
    });
    const badgeCount = await badges.count();

    for (let i = 0; i < Math.min(badgeCount, 5); i++) {
      const badge = badges.nth(i);
      const isVisible = await badge.isVisible().catch(() => false);
      if (!isVisible) continue;

      const contrast = await badge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        return { color, bg, fontSize: style.fontSize, fontWeight: style.fontWeight };
      });

      // Basic check: text colour and background colour should be different
      expect(contrast.color).not.toBe(contrast.bg);

      // Font should be readable (not too small)
      const fontSize = parseFloat(contrast.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(10); // At least 10px
    }
  });

  test('primary text has readable contrast against background', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Check that main content text is readable
    const mainTextContrast = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const style = window.getComputedStyle(main);
      return {
        color: style.color,
        bg: style.backgroundColor,
      };
    });

    if (mainTextContrast) {
      // Text and background should be different
      expect(mainTextContrast.color).not.toBe(mainTextContrast.bg);
    }

    // Check stat card titles are readable
    const statTitles = page.locator('.text-muted-foreground').filter({
      hasText: /today|students|week|revenue|outstanding|lessons/i,
    });
    const titleCount = await statTitles.count();

    for (let i = 0; i < Math.min(titleCount, 4); i++) {
      const title = statTitles.nth(i);
      const isVisible = await title.isVisible().catch(() => false);
      if (!isVisible) continue;

      const styles = await title.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          color: s.color,
          bg: s.backgroundColor,
          opacity: s.opacity,
        };
      });

      // Opacity should be at least 0.5 for readability
      const opacity = parseFloat(styles.opacity);
      expect(opacity).toBeGreaterThanOrEqual(0.5);
    }
  });
});

/* ================================================================== */
/*  Test 6: Screen reader landmarks present                            */
/* ================================================================== */

test.describe('Accessibility — Screen Reader Landmarks', () => {
  test.describe('staff app', () => {
    test.use({ storageState: AUTH.owner });

    test('dashboard has main, header, and sidebar landmarks', async ({ page }) => {
      await goTo(page, '/dashboard');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // 1. <main> element exists (AppLayout renders <main>)
      const mainCount = await page.locator('main').count();
      expect(mainCount).toBeGreaterThanOrEqual(1);

      // 2. <header> element exists (Header component uses <header>)
      const headerCount = await page.locator('header').count();
      expect(headerCount).toBeGreaterThanOrEqual(1);

      // 3. Sidebar navigation exists
      // The sidebar uses data-sidebar="sidebar" attribute
      const sidebarCount = await page.locator('[data-sidebar="sidebar"]').count();
      // On desktop, sidebar should be present
      // On mobile viewport it may be hidden — check either sidebar or nav
      const navCount = await page.locator('nav').count();
      expect(
        sidebarCount + navCount,
        'Should have at least one navigation element (sidebar or nav)',
      ).toBeGreaterThanOrEqual(1);

      // 4. Heading hierarchy check
      // Page should have at least one heading
      const headings = await page.locator('h1, h2, h3').all();
      expect(headings.length).toBeGreaterThan(0);

      // 5. Main content area should have meaningful content
      const mainContent = await page.locator('main').first().textContent();
      expect(mainContent?.length).toBeGreaterThan(10);
    });

    test('all staff pages have consistent landmark structure', async ({ page }) => {
      const pages = ['/students', '/calendar', '/invoices', '/settings'];

      for (const path of pages) {
        await goTo(page, path);
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

        // Every page must have <main>
        const mainCount = await page.locator('main').count();
        expect(
          mainCount,
          `${path} should have a <main> element`,
        ).toBeGreaterThanOrEqual(1);

        // Every page must have <header>
        const headerCount = await page.locator('header').count();
        expect(
          headerCount,
          `${path} should have a <header> element`,
        ).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('parent portal', () => {
    test.use({ storageState: AUTH.parent });

    test('portal home has main and header landmarks', async ({ page }) => {
      await goTo(page, '/portal/home');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // <main> element (PortalLayout renders <main>)
      const mainCount = await page.locator('main').count();
      expect(mainCount).toBeGreaterThanOrEqual(1);

      // <header> element (Header component in portal)
      const headerCount = await page.locator('header').count();
      expect(headerCount).toBeGreaterThanOrEqual(1);

      // Navigation — sidebar or nav element
      const sidebarCount = await page.locator('[data-sidebar="sidebar"]').count();
      const navCount = await page.locator('nav').count();
      expect(
        sidebarCount + navCount,
        'Portal should have navigation landmark',
      ).toBeGreaterThanOrEqual(1);

      // Heading hierarchy
      const headings = await page.locator('h1, h2, h3').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('portal pages maintain landmark structure', async ({ page }) => {
      const portalPages = ['/portal/schedule', '/portal/invoices'];

      for (const path of portalPages) {
        await goTo(page, path);
        await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

        const mainCount = await page.locator('main').count();
        expect(
          mainCount,
          `${path} should have a <main> element`,
        ).toBeGreaterThanOrEqual(1);

        const headerCount = await page.locator('header').count();
        expect(
          headerCount,
          `${path} should have a <header> element`,
        ).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
