import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Detect container egress proxy (used in sandboxed CI environments)
function parseProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const server = `${url.protocol}//${url.hostname}:${url.port}`;
    return {
      server,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    };
  } catch {
    return { server: raw };
  }
}
const proxy = parseProxy();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://app.lessonloop.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    ignoreHTTPSErrors: true,
    ...(proxy ? { proxy } : {}),
  },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'workflow',
      testDir: './tests/e2e/workflows',
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
      timeout: 120_000,
      dependencies: ['auth-setup'],
    },
  ],
  webServer: undefined,
});
