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
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, copyFileSync, statSync, unlinkSync } from 'fs';
import { resolve, dirname, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sharp from 'sharp';
import { PurgeCSS } from 'purgecss';

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

// ─── 0b. Optimization helpers ───────────────────────────────────────

const RESPONSIVE_WIDTHS = [400, 800, 1400];
const BUILD_DATE = new Date().toISOString().split('T')[0];
const imageMetadata = new Map(); // src path → { width, height, srcset }

/** Recursively collect files matching given extensions from a directory. */
function collectFiles(dir, extensions) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.some(ext => full.toLowerCase().endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Convert all PNG/JPG images to WebP and generate responsive variants (400w, 800w, 1400w). */
async function convertImagesToWebP() {
  const images = collectFiles(OUT_DIR, ['.png', '.jpg', '.jpeg']);
  let converted = 0;
  for (const img of images) {
    const fileName = basename(img);
    // Skip OG image and PWA icons — they must remain PNG
    if (fileName === 'og-image.png' || fileName.startsWith('pwa-')) continue;

    const name = fileName.replace(/\.(png|jpe?g)$/i, '');
    const imgDir = dirname(img);
    const relPath = imgDir.substring(OUT_DIR.length).replace(/\\/g, '/');

    try {
      const meta = await sharp(img).metadata();
      const origW = meta.width || 1400;
      const origH = meta.height || 900;
      const srcsetParts = [];

      // Generate responsive variants for widths smaller than original
      for (const w of RESPONSIVE_WIDTHS) {
        if (w < origW) {
          const h = Math.round(origH * (w / origW));
          await sharp(img).resize({ width: w }).webp({ quality: 80 })
            .toFile(join(imgDir, `${name}-${w}w.webp`));
          srcsetParts.push({ w, h, src: `${relPath}/${name}-${w}w.webp` });
        }
      }

      // Generate main version (capped at 1400px)
      const mainW = Math.min(origW, 1400);
      const mainH = origW > 1400 ? Math.round(origH * (1400 / origW)) : origH;
      let pipeline = sharp(img);
      if (origW > 1400) pipeline = pipeline.resize({ width: 1400 });
      await pipeline.webp({ quality: 80 }).toFile(join(imgDir, `${name}.webp`));
      srcsetParts.push({ w: mainW, h: mainH, src: `${relPath}/${name}.webp` });

      srcsetParts.sort((a, b) => a.w - b.w);
      imageMetadata.set(`${relPath}/${name}.webp`, {
        width: mainW,
        height: mainH,
        srcset: srcsetParts.length > 1
          ? srcsetParts.map(s => `${s.src} ${s.w}w`).join(', ')
          : null,
      });

      unlinkSync(img);
      converted++;
    } catch (err) {
      console.warn(`  ⚠ Failed to convert ${fileName}: ${err.message}`);
    }
  }
  return converted;
}

/** Update all <img> src attributes in HTML files to use .webp instead of .png/.jpg. */
function updateHtmlImageRefs() {
  const htmlFiles = collectFiles(OUT_DIR, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    html = html.replace(/(<img\s[^>]*src=["'][^"']*)\.(png|jpe?g)(["'])/gi, '$1.webp$3');
    writeFileSync(file, html, 'utf-8');
  }
}

/** Add responsive srcset, width, and height to all <img> tags. */
function addResponsiveImagesAndDimensions() {
  const htmlFiles = collectFiles(OUT_DIR, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    html = html.replace(/<img\s([^>]*)>/gi, (match, attrs) => {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/);
      if (!srcMatch) return match;
      const meta = imageMetadata.get(srcMatch[1]);
      if (!meta) return match;
      let a = attrs;
      if (!/\bwidth\s*=/.test(a)) a += ` width="${meta.width}"`;
      if (!/\bheight\s*=/.test(a)) a += ` height="${meta.height}"`;
      if (meta.srcset && !/\bsrcset\s*=/.test(a)) {
        a += ` srcset="${meta.srcset}"`;
        if (!/\bsizes\s*=/.test(a)) {
          a += ` sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"`;
        }
      }
      return `<img ${a}>`;
    });
    writeFileSync(file, html, 'utf-8');
  }
}

/** Download Google Fonts CSS + woff2 files and save locally. */
async function selfHostGoogleFonts() {
  const FONTS_DIR = join(OUT_DIR, 'fonts');
  const cachedCss = join(FONTS_DIR, 'fonts.css');

  // If fonts are already cached from a previous build, reuse them
  if (existsSync(cachedCss)) {
    const woff2s = existsSync(FONTS_DIR) ? readdirSync(FONTS_DIR).filter(f => f.endsWith('.woff2')) : [];
    if (woff2s.length > 0) {
      console.log(`  ✓ Using cached Google Fonts (${woff2s.length} files in fonts/)`);
      return woff2s.length;
    }
  }

  mkdirSync(FONTS_DIR, { recursive: true });
  const fontsUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
  try {
    const res = await fetch(fontsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let css = await res.text();
    const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
    let m;
    const urls = [];
    while ((m = urlRegex.exec(css)) !== null) urls.push(m[1]);
    for (const url of urls) {
      const filename = basename(new URL(url).pathname);
      const fontRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!fontRes.ok) continue;
      writeFileSync(join(FONTS_DIR, filename), Buffer.from(await fontRes.arrayBuffer()));
      css = css.split(url).join(`/fonts/${filename}`);
    }
    // Ensure font-display: swap in every @font-face
    css = css.replace(/@font-face\s*\{(?![^}]*font-display)/g, '@font-face {\n  font-display: swap;');
    writeFileSync(cachedCss, css, 'utf-8');
    return urls.length;
  } catch (err) {
    console.warn(`  ⚠ Could not self-host Google Fonts: ${err.message} (keeping external link)`);
    return 0;
  }
}

/** Replace external Google Fonts links with self-hosted version in all HTML. */
function updateFontReferences() {
  if (!existsSync(join(OUT_DIR, 'fonts', 'fonts.css'))) return;
  const htmlFiles = collectFiles(OUT_DIR, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    html = html.replace(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*>\n?/gi, '');
    html = html.replace(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*rel=["']preconnect["'][^>]*>\n?/gi, '');
    html = html.replace(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>\n?/gi, '');
    html = html.replace(/<link[^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*rel=["']preconnect["'][^>]*>\n?/gi, '');
    html = html.replace(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com\/css2[^"']*["'][^>]*>/gi,
      '<link rel="stylesheet" href="/fonts/fonts.css">');
    writeFileSync(file, html, 'utf-8');
  }
  // Remove @import from styles.css
  const cssPath = join(OUT_DIR, CSS_FILENAME);
  if (existsSync(cssPath)) {
    let css = readFileSync(cssPath, 'utf-8');
    css = css.replace(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com[^)]*['"]?\)\s*;?/gi, '');
    writeFileSync(cssPath, css, 'utf-8');
  }
}

/**
 * PurgeCSS is DISABLED — it cannot reliably handle Tailwind's arbitrary
 * value syntax (e.g. bg-[hsl(var(--ink))], w-[680px]) and strips critical
 * classes. The full production CSS (~186KB) is small enough for a marketing
 * site. Returns { before, after } sizes for logging.
 */
async function purgeProductionCss() {
  const cssPath = join(OUT_DIR, CSS_FILENAME);
  if (!existsSync(cssPath)) return null;
  const size = statSync(cssPath).size;
  // Append sr-only-focus utility if not already present
  const css = readFileSync(cssPath, 'utf-8');
  if (!css.includes('sr-only-focus')) {
    const srOnly = '\n.sr-only-focus{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.sr-only-focus:focus{position:static;width:auto;height:auto;padding:inherit;margin:inherit;overflow:visible;clip:auto;white-space:normal}';
    writeFileSync(cssPath, css + srOnly, 'utf-8');
  }
  return { before: size, after: statSync(cssPath).size };
}

/** Remove all .mp4 files from OUT_DIR. */
function removeMp4Files() {
  const mp4s = collectFiles(OUT_DIR, ['.mp4']);
  for (const f of mp4s) unlinkSync(f);
  return mp4s.length;
}

/** Fix non-descriptive links by adding aria-label attributes. */
function fixNonDescriptiveLinks() {
  const generic = ['learn more', 'read more', 'get started', 'start free trial', 'try it free', 'sign up', '→', ''];
  const htmlFiles = collectFiles(OUT_DIR, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    html = html.replace(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, content) => {
      if (/aria-label/i.test(attrs)) return match;
      const text = content.replace(/<[^>]+>/g, '').trim();
      if (!generic.includes(text.toLowerCase())) return match;
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
      if (!hrefMatch) return match;
      const href = hrefMatch[1];
      let label;
      if (href.startsWith('/features/')) label = `Learn more about ${href.replace('/features/', '').replace(/-/g, ' ')}`;
      else if (href.startsWith('/compare/')) label = `Read comparison: ${href.replace('/compare/', '').replace(/-/g, ' ')}`;
      else if (href.startsWith('/for/')) label = `Learn more about LessonLoop for ${href.replace('/for/', '').replace(/-/g, ' ')}`;
      else if (href.startsWith('/blog/')) label = 'Read blog post';
      else if (href.includes('signup') || href.includes('register')) label = 'Start your free trial of LessonLoop';
      else if (href.includes('login')) label = 'Sign in to LessonLoop';
      else if (href === '/pricing') label = 'View LessonLoop pricing';
      else if (href === '/features') label = 'Explore all LessonLoop features';
      else if (href === '/blog') label = 'Read the LessonLoop blog';
      else if (href === '/contact') label = 'Contact LessonLoop';
      else label = `Navigate to ${href.replace(/^\//,'').replace(/\//g, ' ').replace(/-/g, ' ') || 'page'}`;
      return `<a ${attrs} aria-label="${label}">${content}</a>`;
    });
    writeFileSync(file, html, 'utf-8');
  }
}

/** Clean up React artifacts from HTML. */
function cleanupHtml() {
  const htmlFiles = collectFiles(OUT_DIR, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    html = html.replace(/<ol[^>]*aria-label="Notifications"[^>]*>[\s\S]*?<\/ol>/gi, '');
    html = html.replace(/<div[^>]*aria-label="Notifications"[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/\s*data-radix-[a-z-]*="[^"]*"/gi, '');
    html = html.replace(/<style>\s*<\/style>/gi, '');
    html = html.replace(/<script>\s*<\/script>/gi, '');
    html = html.replace(/<meta[^>]*name=["']apple-mobile-web-app[^"]*["'][^>]*>\n?/gi, '');
    html = html.replace(/<meta[^>]*name=["']mobile-web-app[^"]*["'][^>]*>\n?/gi, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    writeFileSync(file, html, 'utf-8');
  }
}

/** Extract FAQ Q&A pairs from compare pages and inject FAQPage schema. */
function addFaqSchemaToComparePages() {
  const compareDir = join(OUT_DIR, 'compare');
  if (!existsSync(compareDir)) return;
  const htmlFiles = collectFiles(compareDir, ['.html']);
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    const pairs = [];
    const re = /<div[^>]*data-state="(?:open|closed)"[^>]*>\s*(?:<h3[^>]*>)?\s*<button[^>]*>([\s\S]*?)<\/button>[\s\S]*?<div[^>]*role="region"[^>]*>([\s\S]*?)<\/div>/gi;
    let fm;
    while ((fm = re.exec(html)) !== null) {
      const q = fm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const a = fm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (q.length > 5 && a.length > 5) pairs.push({ q, a });
    }
    if (pairs.length > 0) {
      const schema = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: pairs.map(p => ({
          '@type': 'Question', name: p.q,
          acceptedAnswer: { '@type': 'Answer', text: p.a },
        })),
      });
      html = html.replace('</head>', `<script type="application/ld+json">${schema}</script>\n</head>`);
      writeFileSync(file, html, 'utf-8');
    }
  }
}

/** Generate sitemap.xml. */
function generateSitemap(routes) {
  const legalPages = ['/privacy', '/terms', '/gdpr', '/cookies'];
  const entries = routes.map(route => {
    const loc = route === '/' ? SITE_DOMAIN + '/' : SITE_DOMAIN + route;
    let priority, changefreq;
    if (route === '/') { priority = '1.0'; changefreq = 'weekly'; }
    else if (['/features', '/pricing'].includes(route)) { priority = '0.9'; changefreq = 'weekly'; }
    else if (route.startsWith('/features/') || route.startsWith('/compare/') || route.startsWith('/for/')) { priority = '0.8'; changefreq = 'weekly'; }
    else if (route.startsWith('/blog')) { priority = '0.7'; changefreq = 'daily'; }
    else if (legalPages.includes(route)) { priority = '0.5'; changefreq = 'monthly'; }
    else { priority = '0.6'; changefreq = 'weekly'; }
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  writeFileSync(join(OUT_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, 'utf-8');
}

/** Generate robots.txt. */
function generateRobotsTxt() {
  writeFileSync(join(OUT_DIR, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_DOMAIN}/sitemap.xml\n`, 'utf-8');
}

/** Calculate total size of a directory recursively (bytes). */
function dirSizeBytes(dir) {
  let total = 0;
  if (!existsSync(dir)) return total;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) total += dirSizeBytes(full);
    else total += st.size;
  }
  return total;
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

// ─── 3a. Static nav dropdown + mobile menu HTML ──────────────────

// Navigation data (mirrors MarketingNavbar.tsx)
const FEATURE_COLUMNS = [
  { label: 'Core', items: [
    { name: 'Scheduling', href: '/features/scheduling', icon: 'calendar', desc: 'Lessons, terms &amp; timetables' },
    { name: 'Billing', href: '/features/billing', icon: 'credit-card', desc: 'Invoices &amp; online payments' },
    { name: 'Students', href: '/features/students', icon: 'graduation-cap', desc: 'Profiles &amp; progress tracking' },
    { name: 'Teachers', href: '/features/teachers', icon: 'users', desc: 'Staff management &amp; payroll' },
    { name: 'Attendance', href: '/features/attendance', icon: 'clipboard-check', desc: 'Registers &amp; make-ups' },
  ]},
  { label: 'Engage', items: [
    { name: 'Parent Portal', href: '/features/parent-portal', icon: 'house', desc: 'Self-serve for families' },
    { name: 'Messaging', href: '/features/messaging', icon: 'message-square', desc: 'In-app communication' },
    { name: 'Practice Tracking', href: '/features/practice-tracking', icon: 'music', desc: 'Assignments &amp; logs' },
    { name: 'Resources', href: '/features/resources', icon: 'folder-open', desc: 'Sheet music &amp; files' },
  ]},
  { label: 'Insights', items: [
    { name: 'Reports', href: '/features/reports', icon: 'chart-column', desc: 'Revenue &amp; analytics' },
    { name: 'Locations', href: '/features/locations', icon: 'map-pin', desc: 'Multi-venue management' },
    { name: 'LoopAssist AI', href: '/features/loopassist', icon: 'sparkles', desc: 'AI-powered assistant' },
  ]},
];

const USE_CASE_ITEMS = [
  { name: 'Music Academies', href: '/for/music-academies', icon: 'building2', desc: 'Multi-teacher schools' },
  { name: 'Solo Teachers', href: '/for/solo-teachers', icon: 'user', desc: 'Independent educators' },
  { name: 'Piano Schools', href: '/for/piano-schools', icon: 'piano', desc: 'Keyboard-focused studios' },
  { name: 'Guitar Schools', href: '/for/guitar-schools', icon: 'guitar', desc: 'String instrument studios' },
  { name: 'Performing Arts', href: '/for/performing-arts', icon: 'theater', desc: 'Dance, drama &amp; more' },
];

const COMPARE_ITEMS = [
  { name: 'vs My Music Staff', href: '/compare/lessonloop-vs-my-music-staff' },
  { name: 'vs Teachworks', href: '/compare/lessonloop-vs-teachworks' },
  { name: 'vs Opus 1', href: '/compare/lessonloop-vs-opus1' },
  { name: 'vs Jackrabbit Music', href: '/compare/lessonloop-vs-jackrabbit-music' },
  { name: 'vs Fons', href: '/compare/lessonloop-vs-fons' },
];

const DIRECT_LINKS = [
  { name: 'Pricing', href: '/pricing' },
  { name: 'Blog', href: '/blog' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

function iconSvg(name) {
  return `<svg class="h-4 w-4" aria-hidden="true"><use href="/icons.svg#i-${name}"></use></svg>`;
}

function menuItem(item) {
  return `<a href="${item.href}" class="group/item flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent">
    <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/item:bg-primary/10 group-hover/item:text-primary">${iconSvg(item.icon)}</div>
    <div class="min-w-0"><div class="text-sm font-medium leading-tight">${item.name}</div><div class="mt-0.5 text-xs text-muted-foreground leading-snug">${item.desc}</div></div>
  </a>`;
}

function buildFeaturesDropdown() {
  const cols = FEATURE_COLUMNS.map(col => {
    const items = col.items.map(menuItem).join('\n');
    return `<div><div class="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">${col.label}</div><div class="space-y-0.5">${items}</div></div>`;
  }).join('\n');
  return `<div class="nav-dropdown-panel" data-nav-panel="features"><div class="nav-dropdown-inner"><div class="w-[680px] p-5"><div class="grid grid-cols-3 gap-x-6">${cols}</div><div class="mt-4 border-t pt-3"><a href="/features" class="inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors">Explore all features ${iconSvg('arrow-right')}</a></div></div></div></div>`;
}

function buildSolutionsDropdown() {
  const useCases = USE_CASE_ITEMS.map(menuItem).join('\n');
  const compares = COMPARE_ITEMS.map(item =>
    `<a href="${item.href}" class="flex items-center justify-between rounded-lg px-2.5 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground">${item.name} ${iconSvg('chevron-right')}</a>`
  ).join('\n');
  return `<div class="nav-dropdown-panel" data-nav-panel="solutions"><div class="nav-dropdown-inner"><div class="w-[520px] p-5"><div class="grid grid-cols-2 gap-x-6">
    <div><div class="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Who it's for</div><div class="space-y-0.5">${useCases}</div><div class="mt-3 border-t pt-3"><a href="/uk" class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent">${iconSvg('flag')} Built for the UK</a></div></div>
    <div><div class="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Compare</div><div class="space-y-0.5">${compares}</div></div>
  </div></div></div></div>`;
}

function buildMobileMenu() {
  const featureItems = FEATURE_COLUMNS.map(col => {
    const items = col.items.map(item =>
      `<a href="${item.href}" class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">${iconSvg(item.icon)} <span class="text-sm font-medium">${item.name}</span></a>`
    ).join('\n');
    return `<div class="mb-3"><div class="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">${col.label}</div>${items}</div>`;
  }).join('\n');

  const useCaseItems = USE_CASE_ITEMS.map(item =>
    `<a href="${item.href}" class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">${iconSvg(item.icon)} <span class="text-sm font-medium">${item.name}</span></a>`
  ).join('\n');

  const compareItems = COMPARE_ITEMS.map(item =>
    `<a href="${item.href}" class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground">${item.name} ${iconSvg('chevron-right')}</a>`
  ).join('\n');

  const directItems = DIRECT_LINKS.map(link =>
    `<a href="${link.href}" class="flex items-center justify-between px-4 py-4 text-lg font-medium rounded-xl transition-colors text-foreground hover:bg-accent">${link.name} ${iconSvg('chevron-right')}</a>`
  ).join('\n');

  return `<div class="mobile-menu-backdrop"></div>
<div class="mobile-menu-panel">
  <div class="flex flex-col h-full px-2">
    <nav class="flex-1 space-y-0.5">
      <div>
        <button data-mobile-section="features" class="flex w-full items-center justify-between px-4 py-4 text-lg font-medium text-foreground">Features <svg class="h-5 w-5 opacity-40 chevron-rotate transition-transform" aria-hidden="true"><use href="/icons.svg#i-chevron-down"></use></svg></button>
        <div data-mobile-content="features" class="mobile-section-content"><div class="pb-3 pl-4 pr-4">${featureItems}<a href="/features" class="mt-1 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary">All features ${iconSvg('arrow-right')}</a></div></div>
      </div>
      <div>
        <button data-mobile-section="solutions" class="flex w-full items-center justify-between px-4 py-4 text-lg font-medium text-foreground">Solutions <svg class="h-5 w-5 opacity-40 chevron-rotate transition-transform" aria-hidden="true"><use href="/icons.svg#i-chevron-down"></use></svg></button>
        <div data-mobile-content="solutions" class="mobile-section-content"><div class="pb-3 pl-4 pr-4">
          <div class="mb-3"><div class="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Who it's for</div>${useCaseItems}<a href="/uk" class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">${iconSvg('flag')} <span class="text-sm font-medium">Built for the UK</span></a></div>
          <div><div class="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Compare</div>${compareItems}</div>
        </div></div>
      </div>
      ${directItems}
    </nav>
    <div class="space-y-3 pt-6 mx-2 border-t border-border">
      <a href="https://app.lessonloop.net/login" class="block"><button class="inline-flex items-center justify-center w-full h-12 rounded-md border border-input bg-background font-medium hover:bg-accent hover:text-accent-foreground">Sign in</button></a>
      <a href="https://app.lessonloop.net/signup" class="block"><button class="inline-flex items-center justify-center w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90">Start free trial ${iconSvg('chevron-right')}</button></a>
    </div>
  </div>
</div>`;
}

function injectNavAndMobile(html) {
  // The desktop nav ends with: </ul></div></nav>
  // The Puppeteer step already removed the empty Radix viewport wrapper.
  // We inject dropdown panels inside the position:relative wrapper (before </div></nav>).
  // Find the desktop nav by its aria-label, then locate the </ul></div></nav> ending.
  const desktopNavMarker = 'aria-label="Main"';
  const idx = html.indexOf(desktopNavMarker);
  if (idx !== -1) {
    // Find the closing </nav> after the marker
    const navClose = html.indexOf('</nav>', idx);
    if (navClose !== -1) {
      // The pattern before </nav> is: ...items...</ul></div></nav>
      // Insert dropdown panels before </div></nav> (inside the position:relative div)
      const insertPoint = html.lastIndexOf('</div>', navClose);
      if (insertPoint !== -1 && insertPoint > idx) {
        html = html.slice(0, insertPoint) +
          buildFeaturesDropdown() + buildSolutionsDropdown() +
          html.slice(insertPoint);
      }
    }
  }

  // Inject mobile menu after the header
  html = html.replace(/<\/header>/, `</header>\n${buildMobileMenu()}`);

  return html;
}

// ─── 3b. Post-process HTML ──────────────────────────────────────────

function postProcess(html, routePath, blogSlugs) {
  const canonical = routePath === '/'
    ? SITE_DOMAIN + '/'
    : SITE_DOMAIN + routePath;

  // Add SSG comment at top
  html = '<!-- Pre-rendered by LessonLoop SSG -->\n' + html;

  // Replace all lessonloop.co.uk → lessonloop.net
  html = html.replace(/lessonloop\.co\.uk/g, 'lessonloop.net');

  // Replace localhost dev-server URLs left behind by React (e.g. JSON-LD)
  html = html.replace(/http:\/\/localhost:\d+/g, SITE_DOMAIN);
  // Also handle URL-encoded variant (%3A = :, %2F = /)
  html = html.replace(/http%3A%2F%2Flocalhost%3A\d+/gi, encodeURIComponent(SITE_DOMAIN));

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

  // Remove all <script> tags (JS bundles) but KEEP ld+json and our SSG scripts
  html = html.replace(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])(?![^>]*data-ssg)[^>]*>[\s\S]*?<\/script>/gi, '');
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

  // Fix viewport: remove app-specific restrictions that Google penalises
  html = html.replace(
    /<meta\s+name=["']viewport["'][^>]*>/gi,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
  );

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

  // ── Safety-net: fix any remaining Framer Motion opacity:0 inline styles ──
  html = html.replace(/style="([^"]*)opacity:\s*0(?:;|\s|")([^"]*)"/g, (match, before, after) => {
    let fixed = before + 'opacity: 1;' + after;
    // Also neutralise animation transforms
    fixed = fixed.replace(/transform:\s*(?!none)[^;"]+/g, 'transform: none');
    return `style="${fixed}"`;
  });

  // ── Inject nav dropdown panels and mobile menu HTML ──
  // Radix renders dropdown content lazily (only on hover/click), so we build it
  // server-side from the known navigation data rather than trying to capture it
  // from Puppeteer (which crashes React state).
  html = injectNavAndMobile(html);

  // ── SEO: Hreflang tags ──
  const hreflangUrl = routePath === '/' ? SITE_DOMAIN + '/' : SITE_DOMAIN + routePath;
  html = html.replace('</head>',
    `  <link rel="alternate" hreflang="en-gb" href="${hreflangUrl}">\n` +
    `  <link rel="alternate" hreflang="en" href="${hreflangUrl}">\n` +
    `  <link rel="alternate" hreflang="x-default" href="${hreflangUrl}">\n</head>`);

  // ── SEO: DNS prefetch hints ──
  if (!html.includes('dns-prefetch')) {
    html = html.replace('</head>',
      '  <link rel="dns-prefetch" href="https://fonts.googleapis.com">\n' +
      '  <link rel="dns-prefetch" href="https://fonts.gstatic.com">\n' +
      '  <meta http-equiv="x-dns-prefetch-control" content="on">\n</head>');
  }

  // ── SEO: BreadcrumbList schema for nested pages ──
  const pathParts = routePath.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    const crumbs = [{ name: 'Home', item: SITE_DOMAIN + '/' }];
    let acc = '';
    for (let i = 0; i < pathParts.length; i++) {
      acc += '/' + pathParts[i];
      const isLast = i === pathParts.length - 1;
      let crumbName;
      if (isLast) {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        crumbName = titleMatch ? titleMatch[1].replace(/\s*[|–-]\s*LessonLoop\s*$/i, '').trim() : pathParts[i];
      } else {
        crumbName = pathParts[i].charAt(0).toUpperCase() + pathParts[i].slice(1).replace(/-/g, ' ');
      }
      crumbs.push({ name: crumbName, item: SITE_DOMAIN + acc });
    }
    const breadcrumbSchema = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, idx) => ({
        '@type': 'ListItem', position: idx + 1, name: c.name, item: c.item,
      })),
    });
    html = html.replace('</head>', `<script type="application/ld+json">${breadcrumbSchema}</script>\n</head>`);
  }

  // ── SEO: Blog post pagination (prev/next) ──
  if (routePath.startsWith('/blog/') && routePath !== '/blog' && blogSlugs) {
    const currentSlug = routePath.replace('/blog/', '');
    const slugIdx = blogSlugs.indexOf(currentSlug);
    if (slugIdx > 0) {
      html = html.replace('</head>', `  <link rel="prev" href="${SITE_DOMAIN}/blog/${blogSlugs[slugIdx - 1]}">\n</head>`);
    }
    if (slugIdx >= 0 && slugIdx < blogSlugs.length - 1) {
      html = html.replace('</head>', `  <link rel="next" href="${SITE_DOMAIN}/blog/${blogSlugs[slugIdx + 1]}">\n</head>`);
    }
  }

  // ── SEO: Blog listing page schema ──
  if (routePath === '/blog') {
    const blogSchemas = [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'LessonLoop', url: SITE_DOMAIN },
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'LessonLoop Blog',
        url: SITE_DOMAIN + '/blog', description: 'Tips, guides, and insights for music teachers and school owners.' },
    ];
    for (const s of blogSchemas) {
      html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(s)}</script>\n</head>`);
    }
  }

  // ── SEO: Cookies page schema ──
  if (routePath === '/cookies') {
    const cookieSchema = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebPage',
      name: 'Cookie Policy', url: SITE_DOMAIN + '/cookies',
      description: 'LessonLoop cookie policy and tracking information.',
    });
    html = html.replace('</head>', `<script type="application/ld+json">${cookieSchema}</script>\n</head>`);
  }

  // ── Inject CSS for scroll animations ──
  const animCSS = `<style data-ssg="animations">
.animate-on-scroll{opacity:0;transform:translateY(20px);transition:opacity .6s ease-out,transform .6s ease-out}
.animate-on-scroll.is-visible{opacity:1;transform:translateY(0)}
.nav-dropdown-panel{display:none;position:absolute;left:0;top:100%;z-index:50;padding-top:6px}
.nav-dropdown-panel.is-open{display:block}
.nav-dropdown-inner{background:hsl(var(--popover));color:hsl(var(--popover-foreground));border:1px solid hsl(var(--border));border-radius:calc(var(--radius) - 2px);box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);overflow:hidden;animation:navDropIn .15s ease-out}
@keyframes navDropIn{from{opacity:0;transform:scale(.96) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
.mobile-menu-backdrop{display:none;position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.mobile-menu-backdrop.is-open{display:block}
.mobile-menu-panel{position:fixed;right:0;top:0;bottom:0;width:85vw;max-width:24rem;background:hsl(var(--background));box-shadow:0 25px 50px -12px rgba(0,0,0,.25);transform:translateX(100%);transition:transform .3s ease;z-index:41;overflow-y:auto;padding-top:6rem;padding-bottom:2rem}
.mobile-menu-panel.is-open{transform:translateX(0)}
.mobile-section-content{display:none;overflow:hidden}
.mobile-section-content.is-open{display:block}
</style>`;
  html = html.replace('</head>', animCSS + '\n</head>');

  // ── Inject minimal vanilla JS for interactive elements ──
  const interactiveScript = `<script data-ssg="interactive">
(function(){
  /* ─── 1. Desktop Nav Dropdowns ─── */
  var navTriggers=document.querySelectorAll('[data-nav-trigger]');
  var navPanels=document.querySelectorAll('[data-nav-panel]');
  var openPanel=null;
  function closeAllDropdowns(){
    navTriggers.forEach(function(t){t.setAttribute('data-state','closed');t.setAttribute('aria-expanded','false')});
    navPanels.forEach(function(p){p.classList.remove('is-open')});
    openPanel=null;
  }
  navTriggers.forEach(function(trigger){
    trigger.addEventListener('click',function(e){
      e.stopPropagation();
      var id=this.getAttribute('data-nav-trigger');
      var panel=document.querySelector('[data-nav-panel="'+id+'"]');
      if(!panel)return;
      var wasOpen=panel.classList.contains('is-open');
      closeAllDropdowns();
      if(!wasOpen){
        panel.classList.add('is-open');
        this.setAttribute('data-state','open');
        this.setAttribute('aria-expanded','true');
        openPanel=id;
      }
    });
  });
  document.addEventListener('click',function(e){
    if(openPanel&&!e.target.closest('[data-nav-panel]'))closeAllDropdowns();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&openPanel)closeAllDropdowns();
  });

  /* ─── 2. Mobile Hamburger Menu ─── */
  var mobileBtn=document.querySelector('[data-mobile-toggle]');
  var backdrop=document.querySelector('.mobile-menu-backdrop');
  var mobilePanel=document.querySelector('.mobile-menu-panel');
  function closeMobile(){
    if(backdrop)backdrop.classList.remove('is-open');
    if(mobilePanel)mobilePanel.classList.remove('is-open');
    if(mobileBtn)mobileBtn.setAttribute('aria-expanded','false');
  }
  function openMobile(){
    if(backdrop)backdrop.classList.add('is-open');
    if(mobilePanel)mobilePanel.classList.add('is-open');
    if(mobileBtn)mobileBtn.setAttribute('aria-expanded','true');
  }
  if(mobileBtn){
    mobileBtn.addEventListener('click',function(){
      var isOpen=mobilePanel&&mobilePanel.classList.contains('is-open');
      if(isOpen)closeMobile();else openMobile();
    });
  }
  if(backdrop)backdrop.addEventListener('click',closeMobile);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMobile()});
  /* Mobile accordion sections */
  document.querySelectorAll('[data-mobile-section]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var target=this.getAttribute('data-mobile-section');
      var content=document.querySelector('[data-mobile-content="'+target+'"]');
      if(!content)return;
      var isOpen=content.classList.contains('is-open');
      /* Close all sections first */
      document.querySelectorAll('[data-mobile-content]').forEach(function(c){c.classList.remove('is-open')});
      document.querySelectorAll('[data-mobile-section]').forEach(function(b){
        var arrow=b.querySelector('.chevron-rotate');if(arrow)arrow.style.transform='rotate(0deg)';
      });
      if(!isOpen){
        content.classList.add('is-open');
        var arrow=this.querySelector('.chevron-rotate');if(arrow)arrow.style.transform='rotate(180deg)';
      }
    });
  });
  /* Close mobile on link click */
  if(mobilePanel)mobilePanel.querySelectorAll('a[href]').forEach(function(a){a.addEventListener('click',closeMobile)});

  /* ─── 3. ProductShowcase tab switching ─── */
  var panels=document.querySelectorAll('[data-showcase-panel]');
  var btns=document.querySelectorAll('[data-showcase-tab]');
  if(panels.length&&btns.length){
    var base='flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all flex-shrink-0';
    btns.forEach(function(b){
      b.addEventListener('click',function(){
        var t=this.getAttribute('data-showcase-tab');
        panels.forEach(function(p){p.style.display=p.getAttribute('data-showcase-panel')===t?'':'none'});
        btns.forEach(function(x){
          x.className=base+(x.getAttribute('data-showcase-tab')===t
            ?' bg-white text-ink shadow-xl'
            :' bg-white/10 text-white/70 hover:bg-white/15 hover:text-white');
        });
      });
    });
  }

  /* ─── 4. FAQ / Accordion toggle ─── */
  document.querySelectorAll('[data-orientation="vertical"] > [data-state]').forEach(function(item){
    var trigger=item.querySelector('button[data-state]');
    if(!trigger)return;
    trigger.addEventListener('click',function(){
      var open=item.getAttribute('data-state')==='open';
      item.setAttribute('data-state',open?'closed':'open');
      trigger.setAttribute('data-state',open?'closed':'open');
      var arrow=trigger.querySelector('.lucide-chevron-down');
      if(arrow)arrow.style.transform=open?'rotate(0deg)':'rotate(180deg)';
      var content=item.querySelector('[role="region"]');
      if(content){content.hidden=open;content.setAttribute('data-state',open?'closed':'open');content.style.display=open?'none':''}
    });
  });

  /* ─── 5. Scroll Animations (IntersectionObserver) ─── */
  var els=document.querySelectorAll('.animate-on-scroll');
  if(els.length&&'IntersectionObserver' in window){
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){obs.observe(el)});
  }else{
    /* Fallback: just show everything */
    els.forEach(function(el){el.classList.add('is-visible')});
  }
})();
</script>`;

  html = html.replace('</body>', interactiveScript + '\n</body>');

  // ── Force all animate-on-scroll elements visible in static HTML ──
  // Without JS, these elements are stuck at opacity:0. Mark them as
  // already-visible so the content is readable on first paint; the
  // IntersectionObserver script above will still re-animate on scroll.
  html = html.replace(/class="([^"]*)\banimate-on-scroll\b([^"]*)"/g, 'class="$1animate-on-scroll is-visible$2"');

  // Force inline opacity:0 (from Framer Motion) to opacity:1
  html = html.replace(/opacity:\s*0([;"])/g, 'opacity: 1$1');

  // Fix standalone style="opacity: 0" attributes
  html = html.replace(/style="opacity:\s*0;?\s*"/g, 'style="opacity: 1"');

  // Fix opacity:0 paired with transform
  html = html.replace(/opacity:\s*0;\s*transform:/g, 'opacity: 1; transform:');

  // Neutralise translateY(20px) left over from scroll-in animations
  html = html.replace(/transform:\s*translateY\(20px\)/g, 'transform: translateY(0)');

  // Fix scale(0) hidden states (step icons etc)
  html = html.replace(/transform:\s*scale\(0\)/g, 'transform: scale(1)');

  return html;
}

// ─── 4. Main pipeline ──────────────────────────────────────────────

async function main() {
  const routes = getAllRoutes();
  const blogSlugs = getBlogSlugs();
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

  // Clean output directory (preserve cached fonts)
  const fontsCache = join(OUT_DIR, 'fonts');
  let savedFonts = null;
  if (existsSync(fontsCache)) {
    savedFonts = join(ROOT, '.font-cache-tmp');
    const { cpSync, rmSync: rmTmp } = await import('fs');
    if (existsSync(savedFonts)) rmTmp(savedFonts, { recursive: true, force: true });
    cpSync(fontsCache, savedFonts, { recursive: true });
  }
  if (existsSync(OUT_DIR)) {
    const { rmSync } = await import('fs');
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });
  // Restore cached fonts
  if (savedFonts && existsSync(savedFonts)) {
    const { cpSync, rmSync: rmTmp } = await import('fs');
    cpSync(savedFonts, fontsCache, { recursive: true });
    rmTmp(savedFonts, { recursive: true, force: true });
  }

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

    // Set SSG flag BEFORE any scripts run so routes render marketing components
    await page.evaluateOnNewDocument(() => {
      window.__SSG_MODE__ = true;
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for React to finish rendering (Suspense / lazy)
      await page.waitForFunction(
        () => document.querySelector('#root')?.children.length > 0,
        { timeout: 10000 }
      );

      // Extra wait for animations / late-loading content
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      // ── Fix Framer Motion: make all opacity:0 elements visible ──
      await page.evaluate(() => {
        document.querySelectorAll('[style]').forEach(el => {
          const s = el.style;
          if (s.opacity === '0') {
            s.opacity = '1';
            s.transform = 'none';
          }
        });
      });

      // ── Prepare nav triggers for postProcess injection ──
      // Radix NavigationMenu renders dropdown content lazily, so we can't capture it
      // via Puppeteer clicks (it crashes React state). Instead, we tag the triggers
      // with data attributes and inject the dropdown HTML in postProcess().
      await page.evaluate(() => {
        const triggers = document.querySelectorAll('button[data-state="closed"][aria-expanded="false"][aria-controls]');
        triggers.forEach(b => {
          const text = b.textContent.trim().replace(/\s+/g, ' ');
          if (text.startsWith('Features')) b.setAttribute('data-nav-trigger', 'features');
          else if (text.startsWith('Solutions')) b.setAttribute('data-nav-trigger', 'solutions');
        });
        // Tag mobile toggle button
        const mobileBtn = document.querySelector('button[aria-label="Toggle menu"]');
        if (mobileBtn) mobileBtn.setAttribute('data-mobile-toggle', '');
        // Remove the empty Radix viewport wrapper
        const viewport = document.querySelector('div.absolute.left-0.top-full.flex.justify-center');
        if (viewport) viewport.remove();
      });

      // ── Capture ProductShowcase tab panels for static rendering ──
      await page.evaluate(async () => {
        const showcase = document.getElementById('product-showcase');
        if (!showcase) return;

        // Find tab buttons — look for the scrollable button container
        // It may use scrollbar-width:none style, or just be a flex container with buttons
        let btnContainer = showcase.querySelector('[style*="scrollbar-width"]');
        if (!btnContainer) {
          // Fallback: find button group by structure — div with multiple buttons inside a .relative wrapper
          const allDivs = showcase.querySelectorAll('.relative div');
          for (const div of allDivs) {
            const buttons = div.querySelectorAll(':scope > button');
            if (buttons.length >= 3) {
              btnContainer = div;
              break;
            }
          }
        }
        if (!btnContainer) {
          // Last resort: find any container with 3+ buttons that looks like tabs
          const candidates = showcase.querySelectorAll('div');
          for (const div of candidates) {
            const buttons = div.querySelectorAll(':scope > button');
            if (buttons.length >= 4 && div.className.includes('flex')) {
              btnContainer = div;
              break;
            }
          }
        }
        if (!btnContainer) return;

        const buttons = Array.from(btnContainer.querySelectorAll(':scope > button'));
        if (buttons.length < 2) return;

        // The content grid is the .grid sibling after the .relative wrapper
        const wrapperDiv = btnContainer.closest('.relative');
        if (!wrapperDiv) return;
        const contentGrid = wrapperDiv.nextElementSibling;
        if (!contentGrid || !contentGrid.className.includes('grid')) return;

        const gridClass = contentGrid.className;

        // Click through every tab and capture the rendered panel HTML
        const panels = [];
        for (let i = 0; i < buttons.length; i++) {
          buttons[i].click();
          await new Promise(r => setTimeout(r, 500));

          // Fix any new opacity:0 from entrance animations
          document.querySelectorAll('#product-showcase [style]').forEach(el => {
            if (el.style.opacity === '0') {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }
          });
          await new Promise(r => setTimeout(r, 200));

          panels.push(contentGrid.innerHTML);
        }

        // Reset to first tab so buttons have correct active/inactive classes
        buttons[0].click();
        await new Promise(r => setTimeout(r, 500));
        document.querySelectorAll('#product-showcase [style]').forEach(el => {
          if (el.style.opacity === '0') {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }
        });

        // Tag buttons with data attributes for JS switching
        buttons.forEach((btn, i) => btn.setAttribute('data-showcase-tab', String(i)));

        // Build a container with all panels (only first visible)
        const container = document.createElement('div');
        container.setAttribute('data-showcase-panels', '');

        panels.forEach((panelHtml, i) => {
          const panel = document.createElement('div');
          panel.className = gridClass;
          panel.setAttribute('data-showcase-panel', String(i));
          if (i !== 0) panel.style.display = 'none';
          panel.innerHTML = panelHtml;
          container.appendChild(panel);
        });

        // Replace the single-content grid with the multi-panel version
        contentGrid.replaceWith(container);
      });

      // ── Mark elements for scroll animation ──
      // Elements that had Framer Motion animations will have style="opacity: 1; transform: none;"
      // We mark them with .animate-on-scroll so the IntersectionObserver can reveal them
      await page.evaluate(() => {
        document.querySelectorAll('[style]').forEach(el => {
          const s = el.style;
          // Only target content elements, not layout/structural ones
          const tag = el.tagName.toLowerCase();
          const cls = el.className || '';

          // Skip nav, header, footer, mobile menu, decorative elements
          if (el.closest('header') || el.closest('footer') || el.closest('nav') ||
              el.closest('.mobile-menu-panel') || el.closest('.mobile-menu-backdrop') ||
              el.closest('[data-nav-panel]') || el.closest('[data-showcase-panels]') ||
              el.closest('.nav-dropdown-panel')) return;

          // Skip elements with background/filter (decorative blobs)
          if (s.background || s.backgroundImage || s.filter) return;

          // Target elements that had opacity:0 + transform animations (now fixed to opacity:1)
          if (s.opacity === '1' && s.transform === 'none') {
            // Only animate sizeable content blocks, not tiny inline elements
            const rect = el.getBoundingClientRect();
            if (rect.height < 10 || rect.width < 10) return;

            // Don't animate things in the first viewport (hero area) — they should be visible immediately
            if (rect.top < window.innerHeight * 0.8) return;

            el.classList.add('animate-on-scroll');
            // Clear the inline styles so CSS class takes over
            el.style.opacity = '';
            el.style.transform = '';
          }
        });
      });

      // ── Final sweep: fix any remaining opacity:0 and animation transforms ──
      await page.evaluate(() => {
        document.querySelectorAll('[style]').forEach(el => {
          const s = el.style;
          if (s.opacity === '0') {
            s.opacity = '1';
            s.transform = 'none';
          }
          // Clean mid-animation transforms (skip decorative blobs with background/filter)
          if (s.opacity !== '' && s.transform && s.transform !== 'none') {
            if (!s.background && !s.backgroundImage && !s.filter) {
              s.transform = 'none';
            }
          }
        });
      });

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
      finalHtml = postProcess(finalHtml, route, blogSlugs);

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

  // Shut down browser & dev server
  await browser.close();
  await vite.close();

  // ─── Optimization steps ─────────────────────────────────────────

  console.log('\n  Optimizing output...\n');

  // 1. Convert PNG/JPG → WebP + generate responsive sizes
  const imagesConverted = await convertImagesToWebP();
  console.log(`  ✓ Converted ${imagesConverted} images to WebP (with responsive variants)`);

  // 2. Update <img> src references in HTML to .webp
  updateHtmlImageRefs();
  console.log('  ✓ Updated HTML image references to .webp');

  // 3. Add responsive srcset + width/height to images
  addResponsiveImagesAndDimensions();
  console.log('  ✓ Added srcset, width, and height to images');

  // 4. Self-host Google Fonts
  const fontCount = await selfHostGoogleFonts();
  if (fontCount > 0) {
    updateFontReferences();
    console.log(`  ✓ Self-hosted ${fontCount} Google Font files`);
  }

  // 5. CSS (purge disabled — full production CSS is kept as-is)
  const cssStats = await purgeProductionCss();
  if (cssStats) {
    console.log(`  ✓ Production CSS: ${(cssStats.after / 1024).toFixed(1)} KB (no purge)`);
  }

  // 6. Remove unreferenced .mp4 files
  const mp4sRemoved = removeMp4Files();
  if (mp4sRemoved > 0) console.log(`  ✓ Removed ${mp4sRemoved} unreferenced .mp4 file(s)`);

  // 7. Fix non-descriptive links (add aria-labels)
  fixNonDescriptiveLinks();
  console.log('  ✓ Added aria-labels to non-descriptive links');

  // 8. Clean up React artifacts
  cleanupHtml();
  console.log('  ✓ Cleaned up React artifacts');

  // 9. FAQ schema for compare pages
  addFaqSchemaToComparePages();
  console.log('  ✓ Added FAQ schema to compare pages');

  // 10. Generate sitemap.xml and robots.txt
  generateSitemap(routes);
  generateRobotsTxt();
  console.log('  ✓ Generated sitemap.xml and robots.txt');

  // ─── Summary ────────────────────────────────────────────────────

  const pagesOk = results.filter(r => r.status === 'ok').length;
  const totalDirSize = dirSizeBytes(OUT_DIR);

  console.log('\n' + '─'.repeat(60));
  console.log('\n  Build Summary\n');
  console.log(`  Total pages generated:    ${pagesOk} / ${routes.length}`);
  console.log(`  Total size of output:     ${(totalDirSize / 1024 / 1024).toFixed(2)} MB`);
  if (cssStats) {
    console.log(`  styles.css before purge:  ${(cssStats.before / 1024).toFixed(1)} KB`);
    console.log(`  styles.css after purge:   ${(cssStats.after / 1024).toFixed(1)} KB`);
  }
  console.log(`  Images converted to WebP: ${imagesConverted}`);
  if (fontCount > 0) console.log(`  Google Fonts self-hosted: ${fontCount} files`);

  if (errors.length > 0) {
    console.log('\n  ⚠ Pages with errors:');
    for (const e of errors) console.log(`    ${e.route}: ${e.error}`);
  }

  // Detailed page table
  console.log('\n' + '─'.repeat(65));
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
  console.log(`${'Total HTML'.padEnd(55)} ${totalKB.toFixed(1)} KB\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
