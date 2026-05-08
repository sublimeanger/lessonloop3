# Netlify deep links 404 — SPA fallback missing

**Severity:** high
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** 344a4ad
**Affected components:** public/_redirects

## Symptom

Visiting `/login` (or any non-root SPA route) on the Netlify deploy returned a Netlify-default 404 page. Only `/` worked. Any deep link, OAuth callback, or page-refresh on a non-root route broke the app.

## Root cause

Netlify's default behaviour is to return 404 for any path that doesn't match a static file. Single-page apps need all non-root paths served by `index.html` so React Router can take over client-side. Source ran on Lovable's hosted environment which handled SPA fallback automatically.

## Fix

Added `public/_redirects` containing `/* /index.html 200`. Vite copies `public/` verbatim into `dist/`.

## Verification

- `/login`, `/dashboard`, `/auth/callback` directly return 200 with SPA shell
- Page refresh on any route preserves the route
- OAuth callback (paired fix 7b6c20c) now reachable

## Lessons / follow-ups

Every static-host migration needs SPA fallback configured. Equivalent files: Netlify `_redirects`, Vercel `vercel.json` rewrites, Cloudflare Pages `_redirects`, S3+CloudFront error-document. Add to standard pre-deploy checklist for any SPA migration.
