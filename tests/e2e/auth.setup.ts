import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR = path.join(__dirname, '.auth');

const SUPABASE_URL = 'https://ximxgnkpcswbvfrkkmjq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbXhnbmtwY3N3YnZmcmtrbWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTI4MDcsImV4cCI6MjA4NDQyODgwN30.cA56tVd1UVtwEKGBwXajOpm-gLmCeD_QUzoMwiX8d0M';

const STORAGE_KEY = 'sb-ximxgnkpcswbvfrkkmjq-auth-token';

async function loginViaAPI(email: string, password: string): Promise<any> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase login failed for ${email}: ${res.status} ${body}`);
  }
  return res.json();
}

async function loginAndSave(
  page: any,
  email: string,
  password: string,
  savePath: string,
) {
  // Get session tokens directly from Supabase API (no UI needed)
  const session = await loginViaAPI(email, password);

  const baseURL = page.context()._options?.baseURL || 'https://app.lessonloop.net';

  // Inject the session into localStorage via the browser
  await page.goto(baseURL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(session) },
  );

  // Save the full storage state (cookies + localStorage)
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  await page.context().storageState({ path: savePath });
}

setup('authenticate owner', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_OWNER_EMAIL!, process.env.E2E_OWNER_PASSWORD!, path.join(AUTH_DIR, 'owner.json'));
});

setup('authenticate admin', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!, path.join(AUTH_DIR, 'admin.json'));
});

setup('authenticate teacher', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!, path.join(AUTH_DIR, 'teacher.json'));
});

setup('authenticate finance', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_FINANCE_EMAIL!, process.env.E2E_FINANCE_PASSWORD!, path.join(AUTH_DIR, 'finance.json'));
});

setup('authenticate parent', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_PARENT_EMAIL!, process.env.E2E_PARENT_PASSWORD!, path.join(AUTH_DIR, 'parent.json'));
});

setup('authenticate parent2', async ({ page }) => {
  setup.setTimeout(60_000);
  await loginAndSave(page, process.env.E2E_PARENT2_EMAIL!, process.env.E2E_PARENT2_PASSWORD!, path.join(AUTH_DIR, 'parent2.json'));
});
