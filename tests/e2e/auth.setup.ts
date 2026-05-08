import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR = path.join(__dirname, '.auth');

// Read from env (set in .env.test) so tests target whichever Supabase
// project the current run is for. Defaults match the destination
// (xmrhmxizpslhtkibqyfy) — the production project after the
// 2026-05-08 migration. The previous source project
// (ximxgnkpcswbvfrkkmjq) is decommissioned.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL
  || process.env.SUPABASE_URL
  || 'https://xmrhmxizpslhtkibqyfy.supabase.co';
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
  throw new Error('E2E_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) must be set in .env.test');
}

// supabase-js stores the session in localStorage under a key derived
// from the project ref. Compute it dynamically from the URL so we
// don't have to hardcode the project ref.
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const STORAGE_KEY = `sb-${projectRef}-auth-token`;

function loginViaCurl(email: string, password: string): any {
  const payload = JSON.stringify({ email, password });
  // Write payload to a temp file to avoid shell escaping issues with special chars.
  // RACE CONDITION FIX (2026-05-08): with parallel auth-setup workers, Date.now()
  // can collide within the same millisecond — admin's payload would be overwritten
  // with finance's payload before admin's curl reads it, resulting in admin.json
  // containing the finance user's session. Use crypto.randomBytes to guarantee
  // uniqueness across parallel workers.
  const tmpFile = `/tmp/supabase-login-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -sk -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' ` +
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
    try { fs.unlinkSync(tmpFile); } catch { /* already cleaned up */ }
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
