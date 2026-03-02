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
      proxy: proxySettings,
    },
  },
  projects: baseConfig.projects?.map((project) => {
    // Add --ignore-certificate-errors only for Chromium-based projects
    const isChromium =
      project.name === 'desktop-chrome' ||
      project.name === 'workflow' ||
      project.name === 'auth-setup';
    return {
      ...project,
      use: {
        ...project.use,
        launchOptions: {
          ...(isChromium ? { args: ['--ignore-certificate-errors'] } : {}),
          proxy: proxySettings,
        },
      },
    };
  }),
});
