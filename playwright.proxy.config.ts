/**
 * Proxy-aware config for running Playwright inside the Claude Code sandbox.
 * Extends the base config and injects the proxy + ignoreHTTPSErrors settings
 * that the egress proxy in this environment requires.
 *
 * Usage:  npx playwright test --config playwright.proxy.config.ts ...
 */
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

let proxySettings: { server: string; username?: string; password?: string } | undefined;
if (proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    proxySettings = {
      server: `${url.protocol}//${url.host}`,
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
    };
  } catch {
    // ignore – no proxy
  }
}

export default defineConfig({
  ...baseConfig,
  // Increase timeouts to compensate for proxy overhead
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    ...baseConfig.use,
    ignoreHTTPSErrors: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    launchOptions: {
      args: ['--ignore-certificate-errors'],
      proxy: proxySettings,
    },
  },
});
