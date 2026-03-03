import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR = path.join(__dirname, '.auth');

const SUPABASE_URL = 'https://ximxgnkpcswbvfrkkmjq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbXhnbmtwY3N3YnZmcmtrbWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTI4MDcsImV4cCI6MjA4NDQyODgwN30.cA56tVd1UVtwEKGBwXajOpm-gLmCeD_QUzoMwiX8d0M';

const STORAGE_KEY = 'sb-ximxgnkpcswbvfrkkmjq-auth-token';

function loginViaCurl(email: string, password: string): any {
  const payload = JSON.stringify({ email, password });
  // Write payload to a temp file to avoid shell escaping issues with special chars
  const tmpFile = `/tmp/supabase-login-${Date.now()}.json`;
  fs.writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' ` +
      `-H 'apikey: ${SUPABASE_ANON_KEY}' ` +
      `-H 'Content-Type: application/json' ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const session = JSON.parse(result);
    if (session.error || session.error_code) {
      throw new Error(`Supabase login failed for ${email}: ${JSON.stringify(session)}`);
    }
    return session;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function writeStorageState(savePath: string, baseURL: string, session: any) {
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  const state = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: STORAGE_KEY,
            value: JSON.stringify(session),
          },
        ],
      },
    ],
  };
  fs.writeFileSync(savePath, JSON.stringify(state, null, 2));
}

async function loginAndSave(
  email: string,
  password: string,
  savePath: string,
  baseURL: string,
) {
  const session = loginViaCurl(email, password);
  writeStorageState(savePath, baseURL, session);
}

setup('authenticate owner', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_OWNER_EMAIL!, process.env.E2E_OWNER_PASSWORD!, path.join(AUTH_DIR, 'owner.json'), baseURL);
});

setup('authenticate admin', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!, path.join(AUTH_DIR, 'admin.json'), baseURL);
});

setup('authenticate teacher', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!, path.join(AUTH_DIR, 'teacher.json'), baseURL);
});

setup('authenticate finance', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_FINANCE_EMAIL!, process.env.E2E_FINANCE_PASSWORD!, path.join(AUTH_DIR, 'finance.json'), baseURL);
});

setup('authenticate parent', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_PARENT_EMAIL!, process.env.E2E_PARENT_PASSWORD!, path.join(AUTH_DIR, 'parent.json'), baseURL);
});

setup('authenticate parent2', async ({}, testInfo) => {
  const baseURL = testInfo.project.use?.baseURL || 'https://app.lessonloop.net';
  await loginAndSave(process.env.E2E_PARENT2_EMAIL!, process.env.E2E_PARENT2_PASSWORD!, path.join(AUTH_DIR, 'parent2.json'), baseURL);
});
