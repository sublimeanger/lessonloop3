#!/usr/bin/env node
/**
 * Optimize marketing-html/ static site (run AFTER prerender.mjs):
 * 1. Convert PNG/JPG → WebP (80% quality, max 1400px wide, target <100KB)
 * 2. Build SVG sprite sheet from inline Lucide icons, replace with <use>
 * 3. PurgeCSS — strip unused Tailwind classes
 * 4. Update HTML: WebP paths, preload hints, remove unused MP4
 */

import sharp from 'sharp';
import { PurgeCSS } from 'purgecss';
import {
  readdirSync, readFileSync, writeFileSync, statSync, existsSync, unlinkSync, mkdirSync
} from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MARKETING = join(ROOT, 'marketing-html');
const ASSETS_DIR = join(MARKETING, 'assets', 'marketing');

function walkHTML(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) result.push(...walkHTML(full));
    else if (entry.endsWith('.html')) result.push(full);
  }
  return result;
}

// ─── 1. Image optimisation ─────────────────────────────────────────

async function optimizeImages() {
  console.log('\n📸 Optimizing images...\n');
  if (!existsSync(ASSETS_DIR)) { console.log('  No assets directory\n'); return; }
  const files = readdirSync(ASSETS_DIR);
  const imageFiles = files.filter(f => /\.(png|jpg|jpeg)$/i.test(f));
  if (!imageFiles.length) { console.log('  No images to convert (already WebP?)\n'); return; }
  let totalBefore = 0, totalAfter = 0;

  for (const file of imageFiles) {
    const srcPath = join(ASSETS_DIR, file);
    const beforeSize = statSync(srcPath).size;
    totalBefore += beforeSize;

    const webpName = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const webpPath = join(ASSETS_DIR, webpName);

    try {
      const meta = await sharp(srcPath).metadata();
      let pipeline = sharp(srcPath);
      if (meta.width > 1400) pipeline = pipeline.resize(1400, null, { withoutEnlargement: true });

      await pipeline.webp({ quality: 80 }).toFile(webpPath);
      let afterSize = statSync(webpPath).size;

      // Retry with lower quality if still over 100KB
      if (afterSize > 100 * 1024) {
        const lowerQ = afterSize > 200 * 1024 ? 50 : 65;
        let retry = sharp(srcPath);
        if (meta.width > 1400) retry = retry.resize(1400, null, { withoutEnlargement: true });
        await retry.webp({ quality: lowerQ }).toFile(webpPath);
        afterSize = statSync(webpPath).size;
      }
      totalAfter += afterSize;
      console.log(`  ${file} → ${webpName}  ${(beforeSize/1024).toFixed(0)}KB → ${(afterSize/1024).toFixed(0)}KB`);
    } catch (err) {
      console.log(`  ✗ ${file}: ${err.message}`);
    }
  }
  console.log(`\n  Images: ${(totalBefore/1024).toFixed(0)}KB → ${(totalAfter/1024).toFixed(0)}KB (${totalBefore ? ((1 - totalAfter/totalBefore)*100).toFixed(0) : 0}% reduction)\n`);

  // Remove originals that have WebP replacements
  const allFiles = readdirSync(ASSETS_DIR);
  let removed = 0;
  for (const file of allFiles) {
    if (/\.(png|jpg|jpeg)$/i.test(file)) {
      const webpName = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
      if (allFiles.includes(webpName)) { unlinkSync(join(ASSETS_DIR, file)); removed++; }
    }
  }
  // Remove MP4 if present (not referenced by any HTML)
  const mp4 = join(ASSETS_DIR, 'lesson-creation-demo.mp4');
  if (existsSync(mp4)) { unlinkSync(mp4); console.log('  Deleted unreferenced lesson-creation-demo.mp4'); removed++; }
  if (removed) console.log(`  Removed ${removed} original files\n`);
}

// ─── 2. SVG sprite sheet ───────────────────────────────────────────

function buildSpriteSheet() {
  console.log('🎨 Building SVG sprite sheet...\n');
  const htmlFiles = walkHTML(MARKETING);
  const icons = new Map(); // iconName → innerContent

  // Regex to match Lucide SVG icons
  const svgRe = /<svg([^>]*class="[^"]*lucide lucide-([a-z0-9-]+)[^"]*"[^>]*)>([\s\S]*?)<\/svg>/g;

  // Pass 1: collect unique icons
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8');
    let m;
    while ((m = svgRe.exec(html)) !== null) {
      const [, attrs, iconName, inner] = m;
      if (!icons.has(iconName)) {
        const vb = attrs.match(/viewBox="([^"]*)"/);
        icons.set(iconName, {
          viewBox: vb ? vb[1] : '0 0 24 24',
          inner: inner.trim(),
        });
      }
    }
  }

  // Ensure nav-dropdown icons are present (not found in page body since dropdowns are injected server-side)
  const navExtras = {
    'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
    'piano': '<path d="M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8"></path><path d="M2 14h20"></path><path d="M6 14v4"></path><path d="M10 14v4"></path><path d="M14 14v4"></path><path d="M18 14v4"></path>',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" x2="4" y1="22" y2="15"></line>',
  };
  for (const [name, inner] of Object.entries(navExtras)) {
    if (!icons.has(name)) {
      icons.set(name, { viewBox: '0 0 24 24', inner });
    }
  }

  // Build sprite file
  let sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n';
  for (const [name, { viewBox, inner }] of icons) {
    sprite += `<symbol id="i-${name}" viewBox="${viewBox}">${inner}</symbol>\n`;
  }
  sprite += '</svg>\n';
  writeFileSync(join(MARKETING, 'icons.svg'), sprite, 'utf-8');
  console.log(`  ${icons.size} unique icons → icons.svg (${(Buffer.byteLength(sprite)/1024).toFixed(1)} KB)\n`);

  // Pass 2: replace inline SVGs with <use> references
  let totalSaved = 0;
  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    const before = html.length;

    html = html.replace(svgRe, (match, attrs, iconName, inner) => {
      return `<svg${attrs}><use href="/icons.svg#i-${iconName}"></use></svg>`;
    });

    totalSaved += before - html.length;
    writeFileSync(file, html, 'utf-8');
  }
  console.log(`  Saved ${(totalSaved/1024).toFixed(1)} KB across ${htmlFiles.length} pages\n`);
}

// ─── 3. PurgeCSS ───────────────────────────────────────────────────

async function purgeCSS() {
  console.log('🧹 Purging unused CSS...\n');
  const cssPath = join(MARKETING, 'styles.css');
  if (!existsSync(cssPath)) { console.log('  No styles.css found\n'); return; }
  const beforeSize = statSync(cssPath).size;
  const htmlFiles = walkHTML(MARKETING);

  // Collect all class names actually used in HTML (exact matches only)
  const usedTokens = new Set();
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8');
    const classAttrs = html.matchAll(/class="([^"]*)"/g);
    for (const [, val] of classAttrs) {
      for (const cls of val.split(/\s+/)) {
        if (cls) usedTokens.add(cls);
      }
    }
    // Also extract data-attribute values that CSS might target
    const dataAttrs = html.matchAll(/data-\w+="([^"]*)"/g);
    for (const [, val] of dataAttrs) {
      if (val) usedTokens.add(val);
    }
  }

  const result = await new PurgeCSS().purge({
    content: htmlFiles.map(f => ({ raw: readFileSync(f, 'utf-8'), extension: 'html' })),
    css: [{ raw: readFileSync(cssPath, 'utf-8') }],
    safelist: {
      standard: [
        // CSS reset & base selectors
        /^:root$/, /^\*/, /^html$/, /^body$/,
        /^::before$/, /^::after$/, /^::backdrop$/,
        /^::placeholder$/, /^::-webkit/,
      ],
      deep: [
        // Attribute selectors in CSS that match HTML data attributes
        /\[data-state/, /\[data-side/, /\[data-orientation/,
        /\[data-radix/, /\[role=/,
      ],
    },
    defaultExtractor: content => {
      // ONLY extract tokens from class="..." attributes — nothing else.
      // This prevents PurgeCSS from false-matching URL paths, attribute
      // values, etc. as class names.
      const tokens = new Set();
      const classRegex = /class="([^"]*)"/g;
      let m;
      while ((m = classRegex.exec(content)) !== null) {
        for (const cls of m[1].split(/\s+/)) {
          if (cls) tokens.add(cls);
        }
      }
      // Also keep data-attribute values (for CSS [data-state="open"] selectors)
      const dataRegex = /data-[\w-]+="([^"]*)"/g;
      while ((m = dataRegex.exec(content)) !== null) {
        if (m[1]) tokens.add(m[1]);
      }
      // Keep HTML tags (for tag selectors like h1, body, etc.)
      const tagRegex = /<([\w-]+)[\s>]/g;
      while ((m = tagRegex.exec(content)) !== null) {
        tokens.add(m[1]);
      }
      return [...tokens];
    },
  });

  if (result.length > 0 && result[0].css) {
    writeFileSync(cssPath, result[0].css, 'utf-8');
    const afterSize = statSync(cssPath).size;
    console.log(`  styles.css: ${(beforeSize/1024).toFixed(1)}KB → ${(afterSize/1024).toFixed(1)}KB (${((1 - afterSize/beforeSize)*100).toFixed(0)}% reduction)\n`);
  } else {
    console.log('  ⚠ PurgeCSS returned no output\n');
  }
}

// ─── 4. HTML updates ───────────────────────────────────────────────

function updateHTML() {
  console.log('📝 Updating HTML files...\n');
  const htmlFiles = walkHTML(MARKETING);
  let totalBefore = 0, totalAfter = 0;

  for (const file of htmlFiles) {
    let html = readFileSync(file, 'utf-8');
    totalBefore += html.length;

    // 4a. Swap .png/.jpg paths to .webp where file exists
    html = html.replace(
      /\/assets\/marketing\/([^"']+)\.(png|jpg|jpeg)/g,
      (match, name) => {
        if (existsSync(join(ASSETS_DIR, name + '.webp'))) return `/assets/marketing/${name}.webp`;
        return match;
      }
    );

    // 4b. Add preload hints (CSS + hero image)
    if (!html.includes('rel="preload" href="/styles.css"')) {
      const heroMatch = html.match(/<img[^>]*src="([^"]+\.webp)"[^>]*>/);
      let preloads = '  <link rel="preload" href="/styles.css" as="style">\n';
      if (heroMatch) {
        preloads += `  <link rel="preload" href="${heroMatch[1]}" as="image" type="image/webp">\n`;
      }
      html = html.replace('</head>', preloads + '  </head>');
    }

    totalAfter += html.length;
    writeFileSync(file, html, 'utf-8');
  }
  console.log(`  ${htmlFiles.length} files updated`);
  console.log(`  HTML total: ${(totalBefore/1024).toFixed(1)}KB → ${(totalAfter/1024).toFixed(1)}KB\n`);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Optimizing marketing-html/ static site...');

  await optimizeImages();
  buildSpriteSheet();
  await purgeCSS();
  updateHTML();

  // Final report
  console.log('═'.repeat(60));
  console.log('\n📊 FINAL SIZES:\n');
  const cssSize = existsSync(join(MARKETING, 'styles.css')) ? statSync(join(MARKETING, 'styles.css')).size : 0;
  const indexSize = existsSync(join(MARKETING, 'index.html')) ? statSync(join(MARKETING, 'index.html')).size : 0;
  const spriteSize = existsSync(join(MARKETING, 'icons.svg')) ? statSync(join(MARKETING, 'icons.svg')).size : 0;
  console.log(`  styles.css:  ${(cssSize/1024).toFixed(1)} KB`);
  console.log(`  index.html:  ${(indexSize/1024).toFixed(1)} KB`);
  console.log(`  icons.svg:   ${(spriteSize/1024).toFixed(1)} KB`);

  let total = 0;
  function walkSize(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkSize(full);
      else total += statSync(full).size;
    }
  }
  walkSize(MARKETING);
  console.log(`  Total:       ${(total/1024/1024).toFixed(2)} MB\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
