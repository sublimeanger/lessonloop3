import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders all login elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
  });

  test('empty form shows validation toast', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/missing fields/i)).toBeVisible({ timeout: 5_000 });
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-owner@test.lessonloop.net');
    await page.locator('#password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Sign in failed', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('password visibility toggle', async ({ page }) => {
    await page.goto('/login');
    const pw = page.locator('#password');
    await pw.fill('SomePassword');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(pw).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('owner login redirects to /dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_OWNER_EMAIL!);
    await page.locator('#password').fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test('parent login redirects to /portal/home', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_PARENT_EMAIL!);
    await page.locator('#password').fill(process.env.E2E_PARENT_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/portal\/home/, { timeout: 20_000 });
  });

  test('unauthenticated user redirected from /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/(auth|login)/, { timeout: 10_000 });
  });

  test('forgot password link navigates', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

test.describe('Signup Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText(/create your account/i)).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeVisible();
  });

  test('sign in link from signup', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Forgot Password', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send|reset/i })).toBeVisible();
  });
});
