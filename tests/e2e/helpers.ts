import { Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH = {
  owner: path.join(__dirname, '.auth/owner.json'),
  admin: path.join(__dirname, '.auth/admin.json'),
  teacher: path.join(__dirname, '.auth/teacher.json'),
  finance: path.join(__dirname, '.auth/finance.json'),
  parent: path.join(__dirname, '.auth/parent.json'),
  parent2: path.join(__dirname, '.auth/parent2.json'),
};

/** Wait for auth/org init, spinners to disappear, and main content to render.
 *  Order matters: RouteGuard renders AppShellSkeleton (no <main>) until auth+org
 *  initialise, so we gate on <main> appearing first (signals RouteGuard passed),
 *  then wait for page-level Loader2 spinners (.animate-spin) to clear.
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  // main only appears after RouteGuard (auth + org init) passes
  await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 }).catch(() => {});
  // Let page-level data queries fire
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // Wait for ALL page-level loading spinners to clear
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-spin').length === 0,
      { timeout: 10_000 },
    );
  } catch { /* no spinners or timeout */ }
}

/** Assert a toast notification appears */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[data-radix-collection-item]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });
}

/** Click a sidebar or top-level nav link */
export async function navigateTo(page: Page, linkText: string) {
  await page.getByRole('link', { name: linkText, exact: true }).first().click();
  await waitForPageReady(page);
}

/** Open a dialog via a button */
export async function openDialog(page: Page, buttonText: string | RegExp) {
  await page.getByRole('button', { name: buttonText }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

/** Navigate directly and wait for content.
 *  Handles the Supabase auth race condition: if the route guard redirects
 *  before the async session restore finishes, we retry once.
 */
export async function goTo(page: Page, path: string) {
  await page.goto(path);
  // Give auth session a moment to restore from localStorage before RouteGuard redirects
  await page.waitForLoadState('domcontentloaded');

  // If auth redirected us away, the session is now warm — retry once
  if (!page.url().includes(path)) {
    await page.goto(path);
  }

  // Single thorough wait for auth + org + page data
  await waitForPageReady(page);
}

/** Expect a page redirect */
export async function expectRedirect(page: Page, path: string, redirectPattern: RegExp) {
  await page.goto(path);
  await page.waitForURL(url => redirectPattern.test(url.toString()), { timeout: 10_000 });
  expect(page.url()).not.toContain(path);
}
