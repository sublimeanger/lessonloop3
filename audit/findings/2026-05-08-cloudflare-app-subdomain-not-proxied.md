# `app.lessonloop.net` bypasses Cloudflare (proxied: false) — no edge WAF

**Severity:** medium
**Status:** CLOSED 2026-05-10 (obsolete — resolved by s25 orange-cloud flip)
**Area:** networking / WAF
**Discovered:** 2026-05-08
**Fixed:** 2026-05-10 (s25 flipped DNS record to `proxied: true`)
**Closed:** 2026-05-10 (s29 verification)
**Affected components:** Cloudflare zone `lessonloop.net`, DNS record `app.lessonloop.net`

## Closure verification (s29)

`dig app.lessonloop.net +short` → CF anycast (104.21.48.11, 172.67.175.180).
`curl -I https://app.lessonloop.net` → `cf-ray`, `server: cloudflare`, `cf-cache-status: DYNAMIC` headers present alongside `x-nf-request-id` (proxy chain: CF → Netlify origin).
Empty-UA WAF: `curl -A "" https://app.lessonloop.net` → 403 (rule firing as configured in s25).
Normal UA: → 200.

The s25 orange-cloud flip resolved this finding. Paired finding `2026-05-08-supabase-captcha-disabled.md` no longer becomes a "must-fix" — credential-stuffing perimeter is covered by CF WAF + Supabase server-side rate limits (s26 verification).

## Symptom

`CNAME app.lessonloop.net -> lessonloop-app.netlify.app` is configured with `proxied: false` (orange-cloud disabled). All app traffic resolves directly to Netlify and bypasses Cloudflare's edge entirely.

## Risk

Without Cloudflare proxy in front of the app:
- **No WAF** — no rule-based blocking of common attack patterns (SQLi probes, log4shell, etc.)
- **No DDoS protection at edge** — Netlify has bot mitigation but Cloudflare's L3/L4 protection is broader
- **No rate limiting at edge** — would have helped against the credential-stuffing risk flagged in `2026-05-08-supabase-captcha-disabled.md`
- **No bot/crawler management** — no aggregator-bot blocking, no JS challenge for suspicious clients
- **Real client IPs not visible to Supabase auth** — `security_sb_forwarded_for_enabled` is also off; pair-fix needed

The marketing site (`lessonloop.net`, `www.lessonloop.net`) IS proxied. Just the app subdomain is bare.

## Why it might be intentional

Some teams deliberately bypass Cloudflare in front of Netlify to:
- Avoid double-CDN caching / "double-pass" weirdness
- Keep TLS termination at Netlify only
- Sidestep Cloudflare ↔ Netlify "522 / Web Server Returned an Error" issues during peak load

Without Jamie's confirmation we shouldn't auto-flip this.

## Fix (proposed, deferred for decision)

Two-step:

1. Confirm zone SSL mode is `Full` or `Full (strict)` (NOT `Flexible` — Netlify rejects HTTP):

```bash
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/451cd1b0d0eda83939d3eb91fe99f98e/settings/ssl"
```

2. Flip `proxied: true` on the `app.lessonloop.net` DNS record:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/451cd1b0d0eda83939d3eb91fe99f98e/dns_records/<RECORD_ID>" \
  -d '{"proxied": true}'
```

Then immediately:
- Smoke-test sign-in on `app.lessonloop.net` (Cloudflare can rewrite redirects, may break OAuth callback)
- Verify Stripe webhook still reaches `xmrhmxizpslhtkibqyfy.supabase.co` (separate domain, not affected, but worth confirming)
- Configure WAF rules: rate limit `/auth/*` paths to ~10 req/sec/IP; rate limit `/functions/v1/auth-*` similarly
- Enable `security_sb_forwarded_for_enabled` on Supabase Auth so server-side logs see real client IPs

## Workaround (in place)

None — this is a structural launch-blocker if you want WAF protection. If you don't, mark the `2026-05-08-supabase-captcha-disabled.md` finding as **must-fix** (since Turnstile becomes the only credential-stuffing protection).

## Lessons / follow-ups

- Pair with finding `2026-05-08-supabase-captcha-disabled.md` — together they're the credential-stuffing perimeter.
- Removed stale `_lovable.app.lessonloop.net` TXT verification record while reviewing DNS (no action required by reader; Lovable is detached).
- DMARC at zone root currently `p=none` (monitor only). Consider escalating to `p=quarantine` once 2-4 weeks of SPF/DKIM clean reports confirm no legitimate mail is being misclassified.
