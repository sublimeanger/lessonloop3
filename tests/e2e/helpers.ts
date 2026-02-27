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

/** Wait for any loading spinners to disappear and main content to render */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 15_000 }).catch(() => {});
  await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
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

/** Navigate directly and wait for content */
export async function goTo(page: Page, path: string) {
  await page.goto(path);
  await waitForPageReady(page);
}

/** Expect a page redirect */
export async function expectRedirect(page: Page, path: string, redirectPattern: RegExp) {
  await page.goto(path);
  await page.waitForURL(url => redirectPattern.test(url.toString()), { timeout: 10_000 });
  expect(page.url()).not.toContain(path);
}
