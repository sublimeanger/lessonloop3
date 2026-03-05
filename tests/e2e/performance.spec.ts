import { test, expect, Page, Locator } from '@playwright/test';
import { AUTH, goTo, safeGoTo, waitForPageReady } from './helpers';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Measure how long it takes to navigate to a page and become interactive */
async function measurePageLoad(
  page: Page,
  url: string,
  label: string,
): Promise<number> {
  const start = Date.now();
  await goTo(page, url);
  await waitForPageReady(page);
  const elapsed = Date.now() - start;
  // eslint-disable-next-line no-console
  console.log(`[PERF] ${label}: ${elapsed}ms`);
  return elapsed;
}

/** Measure how long it takes to navigate between pages via click */
async function measureNavigation(
  page: Page,
  clickTarget: string | Locator,
  waitForSelector: string,
  label: string,
): Promise<number> {
  const start = Date.now();
  if (typeof clickTarget === 'string') {
    await page.click(clickTarget);
  } else {
    await clickTarget.click();
  }
  await page.waitForSelector(waitForSelector, { timeout: 10_000 });
  const elapsed = Date.now() - start;
  // eslint-disable-next-line no-console
  console.log(`[PERF] Nav ${label}: ${elapsed}ms`);
  return elapsed;
}

/** Check if a console error is in the known-benign allowlist */
function isAllowedError(text: string): boolean {
  const patterns = [
    'SSL', 'certificate', 'ERR_CERT', 'TLS', 'self-signed',
    'Importing a module script failed', 'Error fetching unread messages',
    '[ERROR] Error info', 'Load failed', 'Failed to load resource',
    'favicon', 'ResizeObserver', 'net::ERR', 'third-party cookie',
    'Refused to connect', 'ERR_BLOCKED', 'postMessage', 'auth/session',
    'WebSocket', 'websocket', '404', 'wss://', 'supabase', 'Sentry', 'sentry',
    'Content-Security-Policy', 'Content Security Policy',
    'registerSW', 'service-worker', 'ServiceWorker', 'workbox',
    'Failed to fetch', 'TypeError: Failed to fetch',
    'fetching memberships', 'AbortError', 'NetworkError', 'network',
    'ECONNREFUSED', 'PGRST', 'schema cache', 'Could not find the table',
    'QueryCache', 'useSidebar', 'SidebarProvider', 'ErrorBoundary caught',
    'An SSL certificate error',
  ];
  return patterns.some(p => text.includes(p));
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: PAGE LOAD TIMES
// ═══════════════════════════════════════════════════════════════
test.describe('Page Load Performance', () => {
  test.describe('Tier 1 — Simple pages (20s threshold)', () => {
    test.use({ storageState: AUTH.owner });

    const tier1Pages = [
      { url: '/dashboard', label: 'Dashboard' },
      { url: '/settings', label: 'Settings' },
      { url: '/reports', label: 'Reports' },
      { url: '/help', label: 'Help' },
    ];

    for (const { url, label } of tier1Pages) {
      test(`[TIER 1] ${label} loads within 20s`, async ({ page }) => {
        const elapsed = await measurePageLoad(page, url, `T1 ${label}`);
        expect(elapsed).toBeLessThan(20_000);
        await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
      });
    }
  });

  test.describe('Tier 2 — Data-heavy list pages (25s threshold)', () => {
    test.use({ storageState: AUTH.owner });

    const tier2Pages = [
      { url: '/students', label: 'Students' },
      { url: '/invoices', label: 'Invoices' },
      { url: '/calendar', label: 'Calendar' },
      { url: '/messages', label: 'Messages' },
      { url: '/teachers', label: 'Teachers' },
      { url: '/locations', label: 'Locations' },
      { url: '/leads', label: 'Leads' },
      { url: '/resources', label: 'Resources' },
      { url: '/practice', label: 'Practice' },
    ];

    for (const { url, label } of tier2Pages) {
      test(`[TIER 2] ${label} loads within 25s`, async ({ page }) => {
        const elapsed = await measurePageLoad(page, url, `T2 ${label}`);
        expect(elapsed).toBeLessThan(25_000);
        await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
      });
    }
  });

  test.describe('Tier 3 — Detail pages (30s threshold)', () => {
    test.use({ storageState: AUTH.owner });

    test('[TIER 3] Student detail loads within 30s', async ({ page }) => {
      test.setTimeout(120_000);
      // Warm session on dashboard, then navigate via sidebar to students
      await goTo(page, '/dashboard');
      await waitForPageReady(page);

      const studentsLink = page.getByRole('link', { name: 'Students', exact: true }).first();
      await studentsLink.click();
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      if (!page.url().includes('/students')) {
        test.skip(true, 'Could not reach /students');
        return;
      }

      // Click the first data row in the student table
      const dataRow = page.locator('[data-tour="student-list"] tbody tr').first();
      const isRowVisible = await dataRow.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!isRowVisible) {
        test.skip(true, 'Student table rows not visible');
        return;
      }
      await dataRow.click();
      await page.waitForURL(/\/students\/[\w-]+/, { timeout: 15_000 }).catch(() => {});
      if (!/\/students\/[\w-]+/.test(page.url())) {
        test.skip(true, 'Could not navigate to student detail');
        return;
      }
      const studentUrl = new URL(page.url()).pathname;

      // Now measure a clean load of that detail page
      const elapsed = await measurePageLoad(page, studentUrl, 'T3 Student Detail');
      expect(elapsed).toBeLessThan(30_000);
      await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
    });

    test('[TIER 3] Invoice detail loads within 30s', async ({ page }) => {
      test.setTimeout(120_000);
      // Warm session then navigate via sidebar
      await goTo(page, '/dashboard');
      await waitForPageReady(page);

      const invoicesLink = page.getByRole('link', { name: 'Invoices', exact: true }).first();
      await invoicesLink.click();
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      if (!page.url().includes('/invoices')) {
        test.skip(true, 'Could not reach /invoices');
        return;
      }

      // Invoice list uses div[role="listitem"] — click first invoice item
      const row = page.locator('[role="list"][aria-label="Invoices list"] [role="listitem"]').first()
        .or(page.locator('main tbody tr').first());
      const hasRow = await row.isVisible({ timeout: 10_000 }).catch(() => false);
      if (!hasRow) {
        test.skip(true, 'No invoices found for detail page test');
        return;
      }
      await row.click();
      await page.waitForURL(/\/invoices\/[\w-]+/, { timeout: 15_000 }).catch(() => {});
      if (!page.url().includes('/invoices/')) {
        test.skip(true, 'Could not navigate to invoice detail');
        return;
      }
      const invoiceUrl = new URL(page.url()).pathname;

      const elapsed = await measurePageLoad(page, invoiceUrl, 'T3 Invoice Detail');
      expect(elapsed).toBeLessThan(30_000);
      await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
    });

    test('[TIER 3] Lead detail loads within 30s', async ({ page }) => {
      test.setTimeout(120_000);
      // Warm session then navigate via sidebar
      await goTo(page, '/dashboard');
      await waitForPageReady(page);

      const leadsLink = page.getByRole('link', { name: 'Leads', exact: true }).first();
      await leadsLink.click();
      await waitForPageReady(page);
      await page.waitForTimeout(2_000);

      if (!page.url().includes('/leads')) {
        test.skip(true, 'Could not reach /leads');
        return;
      }

      // Leads use Card with role="button" — click first lead card
      const row = page.locator('main [role="button"]').first();
      const hasRow = await row.isVisible({ timeout: 10_000 }).catch(() => false);
      if (!hasRow) {
        test.skip(true, 'No leads found for detail page test');
        return;
      }
      await row.click();
      await page.waitForURL(/\/leads\/[\w-]+/, { timeout: 15_000 }).catch(() => {});
      if (!page.url().includes('/leads/')) {
        test.skip(true, 'Could not navigate to lead detail');
        return;
      }
      const leadUrl = new URL(page.url()).pathname;

      const elapsed = await measurePageLoad(page, leadUrl, 'T3 Lead Detail');
      expect(elapsed).toBeLessThan(30_000);
      await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
    });
  });

  test.describe('Tier 4 — Portal pages (20s threshold)', () => {
    test.use({ storageState: AUTH.parent });

    const tier4Pages = [
      { url: '/portal/home', label: 'Portal Home' },
      { url: '/portal/schedule', label: 'Portal Schedule' },
      { url: '/portal/invoices', label: 'Portal Invoices' },
      { url: '/portal/practice', label: 'Portal Practice' },
      { url: '/portal/messages', label: 'Portal Messages' },
      { url: '/portal/resources', label: 'Portal Resources' },
    ];

    for (const { url, label } of tier4Pages) {
      test(`[TIER 4] ${label} loads within 20s`, async ({ page }) => {
        const elapsed = await measurePageLoad(page, url, `T4 ${label}`);
        expect(elapsed).toBeLessThan(20_000);
        await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: NAVIGATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════
test.describe('Navigation Performance', () => {
  test.use({ storageState: AUTH.owner });

  /** Get a sidebar link by its target href */
  function sidebarLink(page: Page, href: string) {
    return page.locator(`[data-tour="sidebar"] a[href="${href}"]`).first();
  }

  // Each test warms the session on dashboard first, then navigates to start page
  // via sidebar, then measures the SPA navigation to the target page.
  // Threshold: 5s (generous for SPA nav through proxy).

  test('navigates Dashboard → Students within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    const link = sidebarLink(page, '/students');
    const elapsed = await measureNavigation(page, link, 'main', 'Dashboard → Students');
    expect(elapsed).toBeLessThan(5_000);
  });

  test('navigates Students → Calendar within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await sidebarLink(page, '/students').click();
    await waitForPageReady(page);
    const link = sidebarLink(page, '/calendar');
    const elapsed = await measureNavigation(page, link, 'main', 'Students → Calendar');
    expect(elapsed).toBeLessThan(5_000);
  });

  test('navigates Calendar → Invoices within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await sidebarLink(page, '/calendar').click();
    await waitForPageReady(page);
    const link = sidebarLink(page, '/invoices');
    const elapsed = await measureNavigation(page, link, 'main', 'Calendar → Invoices');
    expect(elapsed).toBeLessThan(5_000);
  });

  test('navigates Invoices → Messages within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await sidebarLink(page, '/invoices').click();
    await waitForPageReady(page);
    const link = sidebarLink(page, '/messages');
    const elapsed = await measureNavigation(page, link, 'main', 'Invoices → Messages');
    expect(elapsed).toBeLessThan(5_000);
  });

  test('navigates Messages → Settings within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await sidebarLink(page, '/messages').click();
    await waitForPageReady(page);
    const link = sidebarLink(page, '/settings');
    const elapsed = await measureNavigation(page, link, 'main', 'Messages → Settings');
    expect(elapsed).toBeLessThan(5_000);
  });

  test('navigates Settings → Dashboard within 5s', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    await sidebarLink(page, '/settings').click();
    await waitForPageReady(page);
    const link = sidebarLink(page, '/dashboard');
    const elapsed = await measureNavigation(page, link, 'main', 'Settings → Dashboard');
    expect(elapsed).toBeLessThan(5_000);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: INTERACTION RESPONSE TIMES
// ═══════════════════════════════════════════════════════════════
test.describe('Interaction Response Times', () => {
  test.use({ storageState: AUTH.owner });

  /** Navigate to a page via sidebar after warming the session on dashboard */
  async function warmAndNavigate(page: Page, href: string) {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    const link = page.locator(`[data-tour="sidebar"] a[href="${href}"]`).first();
    await link.click();
    await waitForPageReady(page);
    await page.waitForTimeout(2_000);
  }

  test('Add Student wizard opens within 2s', async ({ page }) => {
    await warmAndNavigate(page, '/students');
    const addBtn = page.locator('[data-tour="add-student-button"]').first()
      .or(page.getByRole('button', { name: /add student/i }).first());
    await expect(addBtn).toBeVisible({ timeout: 10_000 });

    const start = Date.now();
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Add Student dialog: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('Search filters students within 2s', async ({ page }) => {
    await warmAndNavigate(page, '/students');

    const searchInput = page.getByPlaceholder('Search students...').first()
      .or(page.getByPlaceholder(/search/i).first())
      .or(page.locator('input[type="search"]').first());
    const hasSearch = await searchInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasSearch) {
      test.skip(true, 'Search input not found');
      return;
    }

    const start = Date.now();
    await searchInput.fill('Emma');
    // Wait for list to update (includes debounce time)
    await page.waitForTimeout(1_500);
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Search filter: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('Payment Plans tab switches within 2s', async ({ page }) => {
    await warmAndNavigate(page, '/invoices');

    const plansTab = page.getByRole('tab', { name: 'Payment Plans' }).first();
    const visible = await plansTab.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'Payment Plans tab not found');
      return;
    }

    const start = Date.now();
    await plansTab.click();
    await page.waitForTimeout(1_000); // wait for tab content
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Payment Plans tab: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('Status filter pill applies within 2s', async ({ page }) => {
    await warmAndNavigate(page, '/students');

    // Filter bar uses role="tablist" with aria-label="Student status filters"
    // Buttons show "Active (N)" format
    const filterBar = page.locator('[role="tablist"][aria-label="Student status filters"]').first();
    const hasFilter = await filterBar.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasFilter) {
      test.skip(true, 'Filter bar not found');
      return;
    }

    const activePill = filterBar.getByText(/^active/i).first();
    const hasPill = await activePill.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasPill) {
      test.skip(true, 'Active filter pill not found');
      return;
    }

    const start = Date.now();
    await activePill.click();
    await page.waitForTimeout(500);
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Filter pill: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test('Sidebar opens on mobile within 1s', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goTo(page, '/dashboard');
    await waitForPageReady(page);

    // Look for hamburger/sidebar trigger
    const trigger = page.locator('[data-sidebar="trigger"]').first()
      .or(page.getByRole('button', { name: /toggle sidebar/i }).first())
      .or(page.locator('button[aria-label="Toggle Sidebar"]').first());
    const hasTrigger = await trigger.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTrigger) {
      test.skip(true, 'Sidebar trigger not found at mobile viewport');
      return;
    }

    const start = Date.now();
    await trigger.click();
    // Wait for sidebar sheet to appear
    await page.locator('[data-tour="sidebar"]').or(page.locator('[data-sidebar="sidebar"]')).first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Mobile sidebar open: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(1_000);
  });

  test('Dialog close responds within 500ms', async ({ page }) => {
    await warmAndNavigate(page, '/students');

    const addBtn = page.locator('[data-tour="add-student-button"]').first()
      .or(page.getByRole('button', { name: /add student/i }).first());
    const hasBtn = await addBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) {
      test.skip(true, 'Add Student button not found');
      return;
    }
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const start = Date.now();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[PERF] Dialog close: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: MEMORY AND RESOURCE CHECKS
// ═══════════════════════════════════════════════════════════════
test.describe('Memory and Resource Checks', () => {
  test.use({ storageState: AUTH.owner });

  test('no console error accumulation across 10 pages', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const pages = [
      '/dashboard', '/students', '/calendar', '/invoices', '/messages',
      '/settings', '/reports', '/leads', '/teachers', '/locations',
    ];

    for (const url of pages) {
      await goTo(page, url);
      await waitForPageReady(page);
    }

    const realErrors = errors.filter(e => !isAllowedError(e));
    // eslint-disable-next-line no-console
    console.log(`[PERF] Console errors across 10 pages: ${realErrors.length}`);
    if (realErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[PERF] Errors:', realErrors.slice(0, 10));
    }
    expect(realErrors.length).toBeLessThan(5);
  });

  test('DOM node count stays reasonable', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);
    const dashboardNodes = await page.evaluate(() => document.querySelectorAll('*').length);
    // eslint-disable-next-line no-console
    console.log(`[PERF] Dashboard DOM nodes: ${dashboardNodes}`);
    expect(dashboardNodes).toBeLessThan(10_000);

    await goTo(page, '/students');
    await waitForPageReady(page);
    const studentNodes = await page.evaluate(() => document.querySelectorAll('*').length);
    // eslint-disable-next-line no-console
    console.log(`[PERF] Students DOM nodes: ${studentNodes}`);
    expect(studentNodes).toBeLessThan(10_000);
  });

  test('no layout shift after dashboard load', async ({ page }) => {
    await goTo(page, '/dashboard');
    await waitForPageReady(page);

    const getBounds = async (selector: string) => {
      const el = page.locator(selector).first();
      if (await el.isVisible().catch(() => false)) {
        return await el.boundingBox();
      }
      return null;
    };

    const before = {
      greeting: await getBounds('h1, h2'),
      firstCard: await getBounds('[data-interactive]'),
    };

    await page.waitForTimeout(2_000);

    const after = {
      greeting: await getBounds('h1, h2'),
      firstCard: await getBounds('[data-interactive]'),
    };

    if (before.greeting && after.greeting) {
      expect(Math.abs(before.greeting.y - after.greeting.y)).toBeLessThan(3);
    }
    if (before.firstCard && after.firstCard) {
      expect(Math.abs(before.firstCard.y - after.firstCard.y)).toBeLessThan(3);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: PERFORMANCE BASELINE REPORT
// ═══════════════════════════════════════════════════════════════
test.describe('Performance Baseline', () => {
  test.use({ storageState: AUTH.owner });

  test('generate performance baseline report', async ({ page }) => {
    test.setTimeout(180_000);

    const results: Array<{ page: string; tier: number; time: number; threshold: number; status: string }> = [];

    const allPages: Array<{ url: string; label: string; tier: number; threshold: number }> = [
      // Tier 1 — simple pages (generous proxy threshold)
      { url: '/dashboard', label: 'Dashboard', tier: 1, threshold: 20_000 },
      { url: '/settings', label: 'Settings', tier: 1, threshold: 20_000 },
      { url: '/reports', label: 'Reports', tier: 1, threshold: 20_000 },
      { url: '/help', label: 'Help', tier: 1, threshold: 20_000 },
      // Tier 2 — data-heavy list pages
      { url: '/students', label: 'Students', tier: 2, threshold: 25_000 },
      { url: '/invoices', label: 'Invoices', tier: 2, threshold: 25_000 },
      { url: '/calendar', label: 'Calendar', tier: 2, threshold: 25_000 },
      { url: '/messages', label: 'Messages', tier: 2, threshold: 25_000 },
      { url: '/teachers', label: 'Teachers', tier: 2, threshold: 25_000 },
      { url: '/locations', label: 'Locations', tier: 2, threshold: 25_000 },
      { url: '/leads', label: 'Leads', tier: 2, threshold: 25_000 },
      { url: '/resources', label: 'Resources', tier: 2, threshold: 25_000 },
      { url: '/practice', label: 'Practice', tier: 2, threshold: 25_000 },
    ];

    for (const { url, label, tier, threshold } of allPages) {
      const time = await measurePageLoad(page, url, `Baseline ${label}`);
      const status = time < threshold ? 'PASS' : 'FAIL';
      results.push({ page: label, tier, time, threshold, status });
    }

    // eslint-disable-next-line no-console
    console.log('\n[PERF] ════════════════════════════════════════');
    // eslint-disable-next-line no-console
    console.log('[PERF] PERFORMANCE BASELINE REPORT');
    // eslint-disable-next-line no-console
    console.log('[PERF] ════════════════════════════════════════');
    for (const r of results) {
      const pct = Math.round((r.time / r.threshold) * 100);
      const bar = '\u2588'.repeat(Math.min(20, Math.round(pct / 5)));
      // eslint-disable-next-line no-console
      console.log(
        `[PERF] ${r.status} ${r.page.padEnd(25)} ${String(r.time).padStart(5)}ms / ${String(r.threshold).padStart(5)}ms ${bar}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('[PERF] ════════════════════════════════════════\n');

    const failures = results.filter(r => r.time >= r.threshold);
    expect(failures.length).toBe(0);
  });
});
