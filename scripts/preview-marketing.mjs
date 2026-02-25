#!/usr/bin/env node
/**
 * Simple static-file server for previewing the pre-rendered marketing pages.
 *
 * Usage:  node scripts/preview-marketing.mjs
 * Serves marketing-html/ on http://localhost:4000
 */

import { createServer } from 'http';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STATIC_DIR = join(ROOT, 'marketing-html');
const PUBLIC_DIR = join(ROOT, 'public');
const PORT = 4000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Recursively list all index.html files to show available pages. */
function listPages(dir, prefix = '') {
  const pages = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      pages.push(...listPages(full, prefix + '/' + entry));
    } else if (entry === 'index.html') {
      pages.push(prefix || '/');
    }
  }
  return pages;
}

if (!existsSync(STATIC_DIR)) {
  console.error('❌ marketing-html/ directory not found. Run "npm run prerender" first.');
  process.exit(1);
}

const server = createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // 1. Try to serve from marketing-html (clean URLs)
  let filePath;

  // Direct file (e.g., /favicon.svg)
  filePath = join(STATIC_DIR, urlPath);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
    return;
  }

  // Clean URL → /path/index.html
  const indexPath = join(STATIC_DIR, urlPath, 'index.html');
  if (existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(indexPath));
    return;
  }

  // Strip trailing slash and retry
  if (urlPath.endsWith('/') && urlPath.length > 1) {
    const trimmed = join(STATIC_DIR, urlPath.slice(0, -1), 'index.html');
    if (existsSync(trimmed)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(readFileSync(trimmed));
      return;
    }
  }

  // 2. Fall back to public/ for static assets (images, favicon, etc.)
  const publicFile = join(PUBLIC_DIR, urlPath);
  if (existsSync(publicFile) && statSync(publicFile).isFile()) {
    const ext = extname(publicFile);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(readFileSync(publicFile));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<html><body><h1>404 — Not Found</h1><p><a href="/">← Home</a></p></body></html>');
});

server.listen(PORT, () => {
  const pages = listPages(STATIC_DIR).sort();
  console.log(`\n📄 Marketing preview server running on http://localhost:${PORT}\n`);
  console.log(`Available pages (${pages.length}):\n`);
  for (const p of pages) {
    console.log(`  http://localhost:${PORT}${p}`);
  }
  console.log(`\nPress Ctrl+C to stop.\n`);
});
