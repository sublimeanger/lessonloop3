#!/usr/bin/env node
/**
 * Pre-render LessonLoop marketing pages to static HTML for SEO.
 *
 * Usage:  node scripts/prerender.mjs
 *
 * 1. Runs `vite build` to generate the production CSS bundle.
 * 2. Starts the Vite dev server, visits every marketing route with Puppeteer,
 *    captures the fully-rendered HTML (meta tags, structured data, body).
 * 3. Links a shared production CSS file instead of inlining dev styles.
 * 4. Copies all static assets (images, SVGs, favicons) into marketing-html/.
 * 5. Rewrites image paths so they resolve within the static output.
 */

import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, copyFileSync, statSync } from 'fs';
import { resolve, dirname, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'marketing-html');
const SITE_DOMAIN = 'https://lessonloop.net';

// App routes that should point to app.lessonloop.net
const APP_PATHS = [
  '/login', '/signup', '/dashboard', '/calendar', '/students', '/teachers',
  '/locations', '/invoices', '/reports', '/messages', '/settings', '/onboarding',
  '/practice', '/resources', '/help', '/register', '/make-ups', '/leads',
  '/portal', '/auth', '/forgot-password', '/batch-attendance',
];

// ─── 0. Asset helpers ─────────────────────────────────────────────

const CSS_FILENAME = 'styles.css';

/** Copy a directory recursively. */
function copyDirSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Build production CSS via `vite build`, then copy the CSS bundle
 * and all static assets into OUT_DIR.
 */
function copyStaticAssets() {
  // 1. Find the production CSS from dist/assets/
  const distAssets = join(ROOT, 'dist', 'assets');
  if (!existsSync(distAssets)) {
    throw new Error('dist/assets/ not found — run `npm run build` first.');
  }

  const cssFile = readdirSync(distAssets).find(f => f.endsWith('.css'));
  if (!cssFile) {
    throw new Error('No CSS file found in dist/assets/.');
  }

  // Copy production CSS → marketing-html/styles.css
  copyFileSync(join(distAssets, cssFile), join(OUT_DIR, CSS_FILENAME));
  console.log(`  ✓ Copied production CSS → ${CSS_FILENAME} (${(statSync(join(OUT_DIR, CSS_FILENAME)).size / 1024).toFixed(1)} KB)`);

  // 2. Copy marketing images: src/assets/marketing/ → marketing-html/assets/marketing/
  const marketingSrc = join(ROOT, 'src', 'assets', 'marketing');
  const marketingDest = join(OUT_DIR, 'assets', 'marketing');
  if (existsSync(marketingSrc)) {
    mkdirSync(marketingDest, { recursive: true });
    let count = 0;
    for (const file of readdirSync(marketingSrc)) {
      const ext = extname(file).toLowerCase();
      // Only copy actual media files, not .ts index files
      if (['.png', '.jpg', '.jpeg', '.svg', '.webp', '.avif', '.mp4', '.gif'].includes(ext)) {
        copyFileSync(join(marketingSrc, file), join(marketingDest, file));
        count++;
      }
    }
    console.log(`  ✓ Copied ${count} marketing images → assets/marketing/`);
  }

  // 3. Copy public/ assets that pages reference
  const publicDir = join(ROOT, 'public');
  const publicFiles = [
    'logo-horizontal.svg',
    'favicon.svg',
    'favicon.ico',
    'og-image.png',
    'placeholder.svg',
  ];
  for (const file of publicFiles) {
    const src = join(publicDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(OUT_DIR, file));
    }
  }
  console.log(`  ✓ Copied public assets (logo, favicons, OG image)`);

  // 4. Copy public/blog/ SVGs → marketing-html/blog/
  const blogSvgSrc = join(publicDir, 'blog');
  if (existsSync(blogSvgSrc)) {
    const blogDest = join(OUT_DIR, 'blog');
    // blog/ dirs are created per-route, but we need the SVGs at the root of blog/
    mkdirSync(blogDest, { recursive: true });
    for (const file of readdirSync(blogSvgSrc)) {
      if (file.endsWith('.svg')) {
        copyFileSync(join(blogSvgSrc, file), join(blogDest, file));
      }
    }
    console.log(`  ✓ Copied blog SVGs → blog/`);
  }

  // 5. Copy PWA icons if they exist
  for (const file of readdirSync(publicDir)) {
    if (file.startsWith('pwa-') && file.endsWith('.png')) {
      copyFileSync(join(publicDir, file), join(OUT_DIR, file));
    }
  }

  console.log('');
}

// ─── 1. Gather routes ──────────────────────────────────────────────

const STATIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/about',
  '/blog',
  '/contact',
  '/privacy',
  '/terms',
  '/gdpr',
  '/cookies',
  '/uk',
  '/features/scheduling',
  '/features/billing',
  '/features/parent-portal',
  '/features/loopassist',
  '/features/students',
  '/features/teachers',
  '/features/attendance',
  '/features/practice-tracking',
  '/features/messaging',
  '/features/reports',
  '/features/locations',
  '/features/resources',
  '/compare/lessonloop-vs-my-music-staff',
  '/compare/lessonloop-vs-teachworks',
  '/compare/lessonloop-vs-opus1',
  '/compare/lessonloop-vs-jackrabbit-music',
  '/compare/lessonloop-vs-fons',
  '/for/music-academies',
  '/for/solo-teachers',
  '/for/piano-schools',
  '/for/guitar-schools',
  '/for/performing-arts',
];

/** Parse blog slugs from the data file so new posts are auto-discovered. */
function getBlogSlugs() {
  const blogPath = join(ROOT, 'src/data/blogPosts.ts');
  if (!existsSync(blogPath)) return [];
  const src = readFileSync(blogPath, 'utf-8');
  const slugs = [];
  const re = /slug:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) slugs.push(m[1]);
  return slugs;
}

function getAllRoutes() {
  const routes = [...STATIC_ROUTES];
  const slugs = getBlogSlugs();
  for (const slug of slugs) routes.push(`/blog/${slug}`);
  return routes;
}

// ─── 2. Find Chrome binary ─────────────────────────────────────────

function findChrome() {
  const candidates = [
    '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error('Could not find a Chrome / Chromium binary. Install one or set CHROME_PATH.');
}

// ─── 3. Post-process HTML ──────────────────────────────────────────

function postProcess(html, routePath) {
  const canonical = routePath === '/'
    ? SITE_DOMAIN + '/'
    : SITE_DOMAIN + routePath;

  // Add SSG comment at top
  html = '<!-- Pre-rendered by LessonLoop SSG -->\n' + html;

  // Replace all lessonloop.co.uk → lessonloop.net
  html = html.replace(/lessonloop\.co\.uk/g, 'lessonloop.net');

  // Ensure canonical is correct for this page
  if (html.includes('<link rel="canonical"')) {
    html = html.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="${canonical}"`
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${canonical}">\n  </head>`);
  }

  // Convert app routes to app.lessonloop.net
  for (const appPath of APP_PATHS) {
    // href="/login" → href="https://app.lessonloop.net/login"
    const escaped = appPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp(`href="${escaped}"`, 'g'),
      `href="https://app.lessonloop.net${appPath}"`
    );
    html = html.replace(
      new RegExp(`href="${escaped}/"`, 'g'),
      `href="https://app.lessonloop.net${appPath}/"`
    );
  }

  // Remove all <script> tags (JS bundles) but KEEP <script type="application/ld+json">
  html = html.replace(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove any remaining empty <script> self-closing or module-type tags
  html = html.replace(/<script[^>]*type\s*=\s*["']module["'][^>]*\/?\s*>/gi, '');

  // Strip the MarketingChatWidget
  // The chat widget renders as a button with class containing "fixed bottom-4 right-4" and "z-50 w-14 h-14"
  // and its open panel. We remove the entire fragment.
  // Strategy: remove the outermost fragment that matches the chat widget patterns
  // The widget is at the end of the body, after the footer.

  // Remove the chat floating button (motion.button with MessageCircle)
  html = html.replace(
    /<button[^>]*class="[^"]*fixed bottom-4 right-4[^"]*z-50 w-14 h-14[^"]*"[^>]*>[\s\S]*?<\/button>/gi,
    ''
  );

  // Also remove any empty container divs left behind by the widget
  // The chat widget is wrapped in AnimatePresence which may leave empty wrapper divs

  // Rewrite /src/assets/marketing/ → /assets/marketing/ (production paths)
  html = html.replace(/\/src\/assets\/marketing\//g, '/assets/marketing/');

  // Remove CSP meta tag (not needed for static site, can block resources)
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/gi, '');

  // Remove manifest link (PWA not needed for static marketing)
  html = html.replace(/<link rel="manifest"[^>]*>/gi, '');

  // Ensure Google Fonts link is present
  const fontsLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';
  if (!html.includes('fonts.googleapis.com/css2')) {
    html = html.replace('</head>', `  ${fontsLink}\n  </head>`);
  }

  // Make sure we have theme-color
  if (!html.includes('theme-color')) {
    html = html.replace('</head>', '  <meta name="theme-color" content="#00c2b8">\n  </head>');
  }

  // Make sure favicon links are present
  if (!html.includes('favicon.svg')) {
    html = html.replace('</head>',
      '  <link rel="icon" type="image/svg+xml" href="/favicon.svg">\n' +
      '  <link rel="alternate icon" href="/favicon.ico">\n' +
      '  <link rel="apple-touch-icon" href="/pwa-192x192.png">\n  </head>');
  }

  return html;
}

// ─── 4. Main pipeline ──────────────────────────────────────────────

async function main() {
  const routes = getAllRoutes();
  console.log(`\n🚀 Pre-rendering ${routes.length} marketing pages...\n`);

  // Start Vite dev server on a random port
  const vite = await createServer({
    root: ROOT,
    server: { port: 0, strictPort: false },
    logLevel: 'warn',
  });
  const server = await vite.listen();
  const port = server.config.server.port;
  const origin = `http://localhost:${port}`;
  console.log(`  Vite dev server running on ${origin}\n`);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  // Clean output directory
  if (existsSync(OUT_DIR)) {
    const { rmSync } = await import('fs');
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  // Copy production CSS and static assets
  console.log('  Copying static assets...\n');
  copyStaticAssets();

  const results = [];
  const errors = [];

  for (const route of routes) {
    const url = origin + route;
    const label = route || '/';
    process.stdout.write(`  Rendering ${label} ... `);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for React to finish rendering (Suspense / lazy)
      await page.waitForFunction(
        () => document.querySelector('#root')?.children.length > 0,
        { timeout: 10000 }
      );

      // Extra wait for animations / late-loading content
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      // Extract the full rendered HTML
      const rawHtml = await page.content();

      // Build the final HTML — link to shared CSS instead of inlining
      let finalHtml = `<!DOCTYPE html>\n<html lang="en-GB">\n`;

      // Parse head and body from the captured HTML
      const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

      if (headMatch && bodyMatch) {
        let head = headMatch[1];

        // Remove all dev-mode <style> and <link rel="stylesheet"> tags
        head = head.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        head = head.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
        // Remove Vite client script and module scripts
        head = head.replace(/<script[^>]*@vite\/client[^>]*>[\s\S]*?<\/script>/gi, '');
        head = head.replace(/<script[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi, '');

        // Add link to production CSS
        finalHtml += `<head>\n${head}\n<link rel="stylesheet" href="/${CSS_FILENAME}">\n</head>\n`;
        finalHtml += `<body>\n${bodyMatch[1]}\n</body>\n`;
      } else {
        // Fallback: use raw HTML
        finalHtml = rawHtml;
      }

      finalHtml += '</html>';

      // Post-process
      finalHtml = postProcess(finalHtml, route);

      // Determine output path
      const outPath = route === '/'
        ? join(OUT_DIR, 'index.html')
        : join(OUT_DIR, route.slice(1), 'index.html');

      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, finalHtml, 'utf-8');

      const sizeKB = (Buffer.byteLength(finalHtml, 'utf-8') / 1024).toFixed(1);
      console.log(`✓  (${sizeKB} KB)`);
      results.push({ route: label, size: sizeKB, status: 'ok' });
    } catch (err) {
      console.log(`✗  ERROR: ${err.message}`);
      errors.push({ route: label, error: err.message });
      results.push({ route: label, size: '0', status: 'error' });
    } finally {
      await page.close();
    }
  }

  // Shut down
  await browser.close();
  await vite.close();

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`\n✅ Pre-rendered ${results.filter(r => r.status === 'ok').length} / ${routes.length} pages`);
  console.log(`   Output directory: ${OUT_DIR}\n`);

  if (errors.length > 0) {
    console.log('⚠️  Pages with errors:');
    for (const e of errors) console.log(`   ${e.route}: ${e.error}`);
    console.log('');
  }

  // Table
  console.log('Page'.padEnd(55) + 'Size');
  console.log('─'.repeat(65));
  let totalKB = 0;
  for (const r of results) {
    if (r.status === 'ok') {
      totalKB += parseFloat(r.size);
      console.log(`${r.route.padEnd(55)} ${r.size} KB`);
    } else {
      console.log(`${r.route.padEnd(55)} ERROR`);
    }
  }
  console.log('─'.repeat(65));
  console.log(`${'Total'.padEnd(55)} ${totalKB.toFixed(1)} KB\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
