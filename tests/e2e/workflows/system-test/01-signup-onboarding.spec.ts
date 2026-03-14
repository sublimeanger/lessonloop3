/**
 * PART 1: Fresh Signup & Onboarding (Desktop)
 * Tests 1.1.1 – 1.2.10
 *
 * NOTE: Tests 1.2.4 (email inbox) stays manual.
 * This uses a fresh throwaway email — no pre-existing auth state.
 */
import { test, expect } from '../../workflows/workflow.fixtures';
import { generateTestId } from '../../helpers';

const testId = generateTestId();
const testEmail = `signup_${testId}@test.lessonloop.net`;
const testPassword = 'TestSignup2026!';
const testName = `Tester ${testId}`;
const orgName = `Patrick Academy ${testId}`;

test.describe('Part 1: Fresh Signup & Onboarding', () => {
  test.describe.configure({ mode: 'serial' });

  // 1.1 — Signup
  test('1.1.1 – root redirects to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/(login|signup|dashboard|portal)/, { timeout: 15_000 });
    // Should land on login (or redirect to dashboard if already authed)
    expect(page.url()).toMatch(/\/(login|signup|dashboard|portal)/);
  });

  test('1.1.2 – /signup loads correctly', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('main, form, [data-testid="signup-form"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('1.1.3 – shows name, email, password fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel(/name/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test('1.1.4 – empty submit shows validation errors', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForTimeout(1_000);
    const submitBtn = page.getByRole('button', { name: /sign up|create account|register/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.click();
    // Should show validation — either inline errors or toast
    const hasError = await page.locator('[role="alert"], .text-destructive, [data-state="open"]').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasError).toBe(true);
  });

  test('1.1.5 – invalid email shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForTimeout(1_000);
    const nameField = page.getByLabel(/name/i).first();
    const emailField = page.getByLabel(/email/i).first();
    const passwordField = page.getByLabel(/password/i).first();
    await nameField.fill('Test User');
    await emailField.fill('not-an-email');
    await passwordField.fill('ValidPass123!');
    const submitBtn = page.getByRole('button', { name: /sign up|create account|register/i }).first();
    await submitBtn.click();
    const hasError = await page.locator('[role="alert"], .text-destructive, [data-state="open"], :invalid').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasError).toBe(true);
  });

  // NOTE: 1.1.6-1.1.8 and 1.2.x require actual account creation which 
  // would need email verification (auto-confirm is off). These are marked
  // as manual-only tests. The existing onboarding.spec.ts covers the 
  // wizard flow using pre-provisioned accounts.
});
