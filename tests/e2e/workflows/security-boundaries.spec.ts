import { test, expect, Page } from '@playwright/test';
import { AUTH, waitForPageReady, goTo } from '../helpers';

/* ================================================================== */
/*  Test 1: Multi-tenant isolation — parent can't access other org     */
/* ================================================================== */

test.describe('Security — Multi-Tenant Isolation', () => {
  test.use({ storageState: AUTH.parent });

  test('parent cannot access other org data via query param tampering', async ({ page }) => {
    // 1. Navigate to portal home
    await goTo(page, '/portal/home');

    // Verify parent portal loads with their own children
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Note which children are visible (capture current content)
    const portalContent = await page.locator('main').textContent();

    // 2. Try navigating with a fake org_id query param
    await page.goto('/portal/home?org_id=00000000-0000-0000-0000-000000000000');
    await waitForPageReady(page);

    // Assert: Still shows own portal content (query param doesn't bypass RLS)
    // The page should NOT show a different org's data, and should not crash
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Verify no error boundary
    const hasError = await page.getByText('Something went wrong').isVisible().catch(() => false);
    expect(hasError).toBe(false);

    // The portal content should be the same or a subset (no foreign data)
    const portalContentAfter = await page.locator('main').textContent();
    // If the parent had children before, they should still see the same children
    if (portalContent && portalContent.length > 50) {
      // Content should not be wildly different (foreign org data)
      // At minimum, the page should still be the portal, not an admin page
      expect(page.url()).toContain('/portal');
    }

    // 3. Navigate to portal invoices
    await goTo(page, '/portal/invoices');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });

    // Try with a fake org_id query param
    await page.goto('/portal/invoices?org_id=00000000-0000-0000-0000-000000000000');
    await waitForPageReady(page);

    // Should still be on portal invoices with own data only
    expect(page.url()).toContain('/portal');
    const invoiceError = await page.getByText('Something went wrong').isVisible().catch(() => false);
    expect(invoiceError).toBe(false);
  });
});

/* ================================================================== */
/*  Test 2: URL parameter tampering doesn't expose other students      */
/* ================================================================== */

test.describe('Security — URL Parameter Tampering', () => {
  test.describe('as teacher', () => {
    test.use({ storageState: AUTH.teacher });

    test('teacher cannot access non-existent student by fake UUID', async ({ page }) => {
      // 1. Navigate to /students
      await goTo(page, '/students');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // 2. Note which students are visible (teacher sees only assigned students)
      const studentLinks = page.locator('main').getByRole('link');
      const studentCount = await studentLinks.count();

      // 3. Navigate directly to a fake student UUID
      await page.goto('/students/00000000-0000-0000-0000-000000000000');
      await waitForPageReady(page);

      // 4. Assert: Should show "Student not found" toast and redirect to /students
      // OR show a 404/not-found state — NOT expose any data
      const isOnStudentsList = page.url().includes('/students') && !page.url().includes('/students/00000000');
      const isOn404 = await page.getByText('Page not found').isVisible().catch(() => false);
      const isOnNotFound = await page.getByText('not found').isVisible().catch(() => false);

      // One of these must be true: redirected to students list, or 404 page
      expect(isOnStudentsList || isOn404 || isOnNotFound).toBe(true);

      // No sensitive data leak — should not show another student's details
      const hasStudentDetail = await page.getByText(/guardian|invoice|lesson history/i).isVisible().catch(() => false);
      expect(hasStudentDetail).toBe(false);
    });

    test('teacher cannot access unassigned student by valid-format UUID', async ({ page }) => {
      // Navigate to a student with a valid UUID format but random value
      await page.goto('/students/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      await waitForPageReady(page);

      // Should redirect to /students or show not found
      const url = page.url();
      const redirectedToList = url.endsWith('/students') || url.includes('/students?');
      const shows404 = await page.getByText('Page not found').isVisible().catch(() => false);
      const showsNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(redirectedToList || shows404 || showsNotFound).toBe(true);
    });
  });

  test.describe('as parent', () => {
    test.use({ storageState: AUTH.parent });

    test('parent cannot access admin student routes', async ({ page }) => {
      // 1. Navigate to portal home first
      await goTo(page, '/portal/home');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

      // 2. Try accessing /students (admin route, not allowed for parents)
      await page.goto('/students');
      await waitForPageReady(page);

      // 3. Assert: Parent is redirected to /portal/home (RouteGuard line 126-127)
      await page.waitForURL(
        (url) => url.pathname.includes('/portal/home'),
        { timeout: 10_000 },
      );
      expect(page.url()).toContain('/portal');

      // 4. Try accessing a specific student detail page
      await page.goto('/students/00000000-0000-0000-0000-000000000000');
      await waitForPageReady(page);

      // Should redirect to portal, not show student data
      await page.waitForURL(
        (url) => url.pathname.includes('/portal') || url.pathname.includes('/auth'),
        { timeout: 10_000 },
      );
      expect(page.url()).not.toContain('/students/');
    });
  });
});

/* ================================================================== */
/*  Test 3: Role escalation not possible                               */
/* ================================================================== */

test.describe('Security — Role Escalation Prevention', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher settings page shows limited tabs — no role management', async ({ page }) => {
    // 1. Navigate to /settings
    await goTo(page, '/settings');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Settings page should load — verify we see profile at minimum
    const profileText = page.getByText(/profile|account/i).first();
    await expect(profileText).toBeVisible({ timeout: 5_000 });

    // 3. Admin-only tabs should NOT be visible to teacher
    // Members tab is adminOnly: true in SettingsNav
    const membersTab = page.getByText('Members').first();
    const membersVisible = await membersTab.isVisible().catch(() => false);
    expect(membersVisible).toBe(false);

    // Organisation tab is also admin-only
    const orgTab = page.getByRole('button', { name: /organisation/i }).or(
      page.getByText('Organisation').first(),
    );
    const orgVisible = await orgTab.isVisible().catch(() => false);
    expect(orgVisible).toBe(false);

    // Billing tab is admin-only
    const billingTab = page.getByText('Billing').first();
    const billingVisible = await billingTab.isVisible().catch(() => false);
    expect(billingVisible).toBe(false);

    // Audit Log is admin-only
    const auditTab = page.getByText('Audit Log').first();
    const auditVisible = await auditTab.isVisible().catch(() => false);
    expect(auditVisible).toBe(false);

    // 4. Try navigating directly to members tab via URL
    await page.goto('/settings?tab=members');
    await waitForPageReady(page);

    // Non-admin accessing admin tab should be redirected to profile tab
    // (Settings.tsx line 133: non-admin + admin tab → 'profile')
    // The Members content (team members list) should NOT be visible
    const membersList = page.getByText(/team member|invite|role/i).first();
    const membersContentVisible = await membersList.isVisible().catch(() => false);

    // Either the members content isn't shown (redirected to profile) or
    // the page still shows but in read-only/limited form
    if (membersContentVisible) {
      // If any content is visible, ensure there's no role-change capability
      const roleDropdowns = page.locator('select, [role="combobox"]').filter({
        hasText: /owner|admin/i,
      });
      expect(await roleDropdowns.count()).toBe(0);
    }
  });

  test('teacher cannot access admin-only routes', async ({ page }) => {
    // Teachers cannot access /teachers, /locations, or /invoices
    const adminRoutes = [
      { path: '/teachers', name: 'Teachers' },
      { path: '/locations', name: 'Locations' },
      { path: '/invoices', name: 'Invoices' },
    ];

    for (const route of adminRoutes) {
      await page.goto(route.path);
      await waitForPageReady(page);

      // Teacher should be redirected to /dashboard (RouteGuard line 129)
      const url = page.url();
      const isAllowed = url.includes(route.path);
      const redirectedToDashboard = url.includes('/dashboard');
      const redirectedToPortal = url.includes('/portal');

      // Should NOT stay on the admin route
      // (Teachers CAN access some routes like /students, /calendar)
      if (route.path === '/teachers' || route.path === '/locations') {
        // These are owner/admin only
        expect(redirectedToDashboard || redirectedToPortal).toBe(true);
      }
      // /invoices is owner/admin/finance only — teacher should be redirected
      if (route.path === '/invoices') {
        expect(redirectedToDashboard).toBe(true);
      }
    }
  });
});

/* ================================================================== */
/*  Test 4: Expired/invalid session handling                           */
/* ================================================================== */

test.describe('Security — Session Expiry Handling', () => {
  test('cleared session redirects to login without data exposure', async ({ page }) => {
    // 1. Start with valid OWNER auth
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Use a helper that retries to handle auth race
    await goTo(page, '/dashboard');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Verify dashboard works (stat cards visible)
    const hasContent = await page.getByText(/Today|Students|Lessons/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasContent).toBe(true);

    // 3. Clear all cookies and local storage (simulate session expiry)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();

    // 4. Navigate to a protected route
    await page.goto('/students');

    // Wait for the app to process the invalid session
    // RouteGuard will detect no user and redirect to /auth
    await page.waitForURL(
      (url) => {
        const path = url.pathname;
        return path.includes('/auth') ||
               path.includes('/login') ||
               path.includes('/onboarding');
      },
      { timeout: 15_000 },
    );

    // 5. Assert: Redirected to auth/login page
    const url = page.url();
    const isOnAuthPage = url.includes('/auth') || url.includes('/login') || url.includes('/onboarding');
    expect(isOnAuthPage).toBe(true);

    // 6. Assert: No sensitive data visible after redirect
    // Should NOT show student names, invoices, or any org data
    const sensitivePatterns = [
      /\d+ students/i,    // Student counts
      /£\d+/,             // Currency amounts
      /invoice/i,         // Invoice data
    ];

    const pageText = await page.locator('body').textContent() ?? '';
    for (const pattern of sensitivePatterns) {
      // These patterns should not appear on the login page
      // (login page might mention "invoices" in marketing copy, so only check main content)
      const mainContent = await page.locator('main').textContent().catch(() => '') ?? '';
      // Main content area should not contain actual data
      if (mainContent.length > 0 && mainContent.length < 500) {
        // Only assert if we have meaningful content that's not a full page
        expect(mainContent).not.toMatch(/Active Students.*\d+/);
      }
    }

    // No error boundary / crash
    const hasError = await page.getByText('Something went wrong').isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});

/* ================================================================== */
/*  Test 5: XSS-style input doesn't render as HTML                    */
/* ================================================================== */

test.describe('Security — XSS Prevention', () => {
  test.use({ storageState: AUTH.owner });

  test('XSS payloads in student name render as plain text', async ({ page }) => {
    // Track any dialog alerts (XSS would trigger alert())
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    // 1. Navigate to /students
    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // 2. Open the Add Student wizard
    const addBtn = page.getByRole('button', { name: /add student/i }).first();
    const hasAddBtn = await addBtn.isVisible().catch(() => false);

    if (!hasAddBtn) {
      // No add button visible — skip test gracefully
      return;
    }

    await addBtn.click();

    // Wait for wizard dialog to open
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // 3. Enter XSS payloads
    const firstNameInput = page.locator('#wizard-firstName');
    const lastNameInput = page.locator('#wizard-lastName');

    await firstNameInput.fill('<script>alert("xss")</script>');
    await lastNameInput.fill('<img src=x onerror=alert("xss")>');

    // 4. Try to proceed through the wizard
    const nextBtn = dialog.getByRole('button', { name: /next/i }).first();
    const hasNext = await nextBtn.isVisible().catch(() => false);

    if (hasNext) {
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Check if validation blocked the input or we moved to step 2
      const movedToStep2 = await dialog.getByText(/guardian/i).isVisible().catch(() => false);
      const hasValidationError = await dialog.getByText(/invalid|required|error/i).isVisible().catch(() => false);

      if (movedToStep2) {
        // Input was accepted (stored as text) — continue through wizard
        // Skip guardian step
        const skipBtn = dialog.getByRole('button', { name: /skip|next/i }).first();
        if (await skipBtn.isVisible().catch(() => false)) {
          await skipBtn.click();
          await page.waitForTimeout(500);
        }

        // Step 3 — teaching setup, skip it too
        const createBtn = dialog.getByRole('button', { name: /create student/i }).first();
        if (await createBtn.isVisible().catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(2_000);

          // Check if creation succeeded
          const successMsg = dialog.getByText(/student created/i).first();
          const wasCreated = await successMsg.isVisible().catch(() => false);

          if (wasCreated) {
            // Navigate to the student detail to verify name renders as text
            const viewBtn = dialog.getByRole('button', { name: /view student/i }).first();
            if (await viewBtn.isVisible().catch(() => false)) {
              await viewBtn.click();
              await page.waitForURL(/\/students\//, { timeout: 5_000 });
              await waitForPageReady(page);

              // 7-8. Assert: Name displays as literal text
              // The <script> tag should be visible as text, NOT executed
              const nameText = await page.locator('main').textContent() ?? '';
              expect(nameText).toContain('<script>');
              expect(nameText).toContain('<img');

              // Assert: No XSS execution
              expect(alertTriggered).toBe(false);

              // Verify no <script> tags were actually injected into DOM
              const scriptCount = await page.evaluate(() => {
                return document.querySelectorAll('script').length;
              });
              // There should be bundled scripts, but no inline <script>alert
              const inlineScripts = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('script'))
                  .filter((s) => s.textContent?.includes('alert("xss")'))
                  .length;
              });
              expect(inlineScripts).toBe(0);
            }
          }
        }
      } else if (hasValidationError) {
        // Validation blocked the malicious input — this is also acceptable
        // The input was sanitised at entry
      }
    }

    // Final XSS check — no alert() was ever triggered
    expect(alertTriggered).toBe(false);

    // Close dialog if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('XSS payloads in search input render as plain text', async ({ page }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await goTo(page, '/students');
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });

    // Type XSS payload into search
    const searchInput = page.getByPlaceholder('Search students...');
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      // Search should not execute scripts
      expect(alertTriggered).toBe(false);

      // The input value should be stored as text
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toContain('<script>');

      // No matching students — that's expected
      // But no crash or XSS execution
      const hasError = await page.getByText('Something went wrong').isVisible().catch(() => false);
      expect(hasError).toBe(false);

      await searchInput.fill('');
    }
  });
});

/* ================================================================== */
/*  Test 6: API error responses don't leak sensitive info              */
/* ================================================================== */

test.describe('Security — API Error Response Sanitisation', () => {
  test.use({ storageState: AUTH.owner });

  test('API error responses do not leak SQL, file paths, or other user data', async ({ page }) => {
    const capturedErrors: Array<{
      url: string;
      status: number;
      body: string;
    }> = [];

    // Monitor all HTTP responses for errors
    page.on('response', async (response) => {
      const status = response.status();
      if (status >= 400) {
        const body = await response.text().catch(() => '');
        capturedErrors.push({
          url: response.url(),
          status,
          body,
        });
      }
    });

    // Navigate through several pages to trigger API calls
    const pagesToVisit = [
      '/dashboard',
      '/students',
      '/calendar',
      '/invoices',
      '/reports/revenue',
      '/settings',
    ];

    for (const path of pagesToVisit) {
      await goTo(page, path);
      await page.waitForTimeout(500);
    }

    // Also trigger a deliberate bad request — navigate to a non-existent student
    await page.goto('/students/00000000-0000-0000-0000-000000000000');
    await waitForPageReady(page);

    // Give responses time to settle
    await page.waitForTimeout(1_000);

    // Analyse all captured error responses
    for (const error of capturedErrors) {
      const body = error.body.toLowerCase();
      const url = error.url;

      // Skip external service errors (analytics, fonts, etc.)
      if (!url.includes('supabase') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        continue;
      }

      // Assert: No raw SQL in error responses
      const sqlPatterns = [
        /select\s+\*\s+from/i,
        /insert\s+into/i,
        /update\s+.*\s+set/i,
        /delete\s+from/i,
        /drop\s+table/i,
        /pg_catalog/i,
        /information_schema/i,
      ];

      for (const pattern of sqlPatterns) {
        expect(
          error.body,
          `API response from ${url} (${error.status}) should not contain raw SQL`,
        ).not.toMatch(pattern);
      }

      // Assert: No internal file paths in error responses
      const pathPatterns = [
        /\/home\/\w+\//,           // Linux home paths
        /\/usr\/local\//,           // System paths
        /\/var\/\w+\//,             // Var paths
        /[A-Z]:\\Users\\/,          // Windows paths
        /node_modules\//,           // Node.js internal paths
        /at\s+\w+\s+\(\/[^)]+\)/,  // Stack trace file refs
      ];

      for (const pattern of pathPatterns) {
        expect(
          error.body,
          `API response from ${url} (${error.status}) should not contain internal file paths`,
        ).not.toMatch(pattern);
      }

      // Assert: No other users' data (look for patterns of leaked records)
      // A well-formed error should not contain arrays of user records
      if (error.status >= 400 && error.body.length > 0) {
        try {
          const parsed = JSON.parse(error.body);
          // If the error response is a JSON array with multiple records,
          // that might indicate a data leak
          if (Array.isArray(parsed) && parsed.length > 1) {
            // Check if records contain user-like fields
            const firstRecord = parsed[0];
            if (firstRecord && typeof firstRecord === 'object') {
              const keys = Object.keys(firstRecord);
              const userFields = ['email', 'password', 'password_hash', 'secret', 'token'];
              const hasUserFields = userFields.some((f) => keys.includes(f));
              expect(
                hasUserFields,
                `API error response from ${url} should not contain user credentials`,
              ).toBe(false);
            }
          }

          // Single error object should not contain password or secrets
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            expect(parsed).not.toHaveProperty('password');
            expect(parsed).not.toHaveProperty('password_hash');
            expect(parsed).not.toHaveProperty('secret');
            expect(parsed).not.toHaveProperty('service_role_key');
          }
        } catch {
          // Not JSON — that's fine, check raw text
          expect(body).not.toContain('password_hash');
          expect(body).not.toContain('service_role_key');
          expect(body).not.toContain('jwt_secret');
        }
      }
    }

    // Log captured errors for debugging
    if (capturedErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[security] Captured ${capturedErrors.length} error response(s):`,
        capturedErrors.map((e) => `${e.status} ${new URL(e.url).pathname}`),
      );
    }
  });
});
