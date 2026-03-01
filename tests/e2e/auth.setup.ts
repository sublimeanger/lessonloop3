import { test as setup } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR = path.join(__dirname, '.auth');

async function loginAndSave(
  page: any,
  email: string,
  password: string,
  savePath: string,
) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#password', { state: 'visible', timeout: 30_000 });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for login to complete — accept ANY post-login redirect
  // (dashboard, onboarding, portal, etc.)
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  });

  await page.context().storageState({ path: savePath });
}

setup('authenticate owner', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_OWNER_EMAIL!, process.env.E2E_OWNER_PASSWORD!, path.join(AUTH_DIR, 'owner.json'));
});

setup('authenticate admin', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!, path.join(AUTH_DIR, 'admin.json'));
});

setup('authenticate teacher', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!, path.join(AUTH_DIR, 'teacher.json'));
});

setup('authenticate finance', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_FINANCE_EMAIL!, process.env.E2E_FINANCE_PASSWORD!, path.join(AUTH_DIR, 'finance.json'));
});

setup('authenticate parent', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_PARENT_EMAIL!, process.env.E2E_PARENT_PASSWORD!, path.join(AUTH_DIR, 'parent.json'));
});

setup('authenticate parent2', async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAndSave(page, process.env.E2E_PARENT2_EMAIL!, process.env.E2E_PARENT2_PASSWORD!, path.join(AUTH_DIR, 'parent2.json'));
});
