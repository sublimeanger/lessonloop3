# LessonLoop launch readiness — pre-public-launch checklist

**Target launch:** week commencing 2026-05-11
**Owner:** Jamie McKaye
**Status:** 🔴 not yet launch-ready — see blockers below

This is the **single doc** to consult before flipping the app to public sign-up. Every item here must be ✅ before launch, or accepted as ⏸ deferred-with-mitigation.

For the per-feature audit progress, see `audit/MASTER.md`. For known bugs and fixes, see `audit/findings/`.

---

## 🚨 BLOCKER 1 — Google OAuth consent screen verification

**Severity: catastrophic if missed. Lead time: 2–6 weeks.**

The Google OAuth client used by `Sign in with Google` is currently in **"Testing"** publishing status. This caps it at **100 user accounts** AND requires every test user to be on a manually maintained allowlist before they can sign in. The moment we open public sign-up, new users hit "this app isn't verified" warnings and can't log in.

**Action:** submit the OAuth client for verification at https://console.cloud.google.com/apis/credentials/consent → "Publish app" → start verification. Google reviewers ask for:

- Privacy policy URL (`https://lessonloop.net/privacy` — must exist + be public)
- Terms of service URL (`https://lessonloop.net/terms` — must exist + be public)
- App home page URL (`https://lessonloop.net`)
- Authorised domains (`lessonloop.net`)
- Justification for each scope used (`openid email profile` are easy; if any sensitive scope used, requires more)
- A 1–3 minute video walkthrough showing the OAuth consent screen and how user data is used

Verification typically takes **2–6 weeks**. Once verified, the cap lifts and the warning disappears. **Submit this Monday at the latest.**

---

## 🚨 BLOCKER 2 — Sentry source maps upload

Errors will land in Sentry as minified gibberish (`a.b.c is not a function` from `index-g9cqm2jL.js:524`) without source-map upload. Debugging is dramatically harder.

**Action:** add the `@sentry/vite-plugin` to the Vite build. It uploads source maps to Sentry post-build, then strips them from the deploy.

Config sketch:

```ts
// vite.config.ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'lessonloop',
      project: 'javascript-react',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { assets: 'dist/assets/*.js.map', filesToDeleteAfterUpload: 'dist/assets/*.js.map' },
      release: { name: process.env.VITE_GIT_SHA || 'dev' },
    }),
  ],
  build: { sourcemap: true },
});
```

Plus `SENTRY_AUTH_TOKEN` env var in Netlify. Generate at https://lessonloop.sentry.io/settings/account/api/auth-tokens/.

**Effort:** ~30 min. **Block on:** nothing.

---

## 🚨 BLOCKER 3 — Source Supabase decommission

Source project `ximxgnkpcswbvfrkkmjq` is still:
- Running (still costs money)
- Has 18 cron jobs that may or may not be paused (`84ac85f4 Disabled all 18 cron jobs` commit — needs verification)
- Could receive stray Stripe webhooks if any old endpoints exist (we disabled the one in our control, but verify nothing else points at it)
- Has the old Lovable deployment still bound (Jamie disconnected the domain Phase 7 Step 4.4)

**Action plan:**

1. **Today:** verify source crons all `active = false` via Supabase dashboard (need owner access to source project)
2. **Within 7 days:** confirm zero Stripe events delivered to the source webhook for 7 consecutive days (the webhook is `disabled` in Stripe so this is automatic)
3. **At day 14 post-cutover (2026-05-21):** pause the source Supabase project (free option, retains data 90 days)
4. **At day 90 post-cutover:** delete the source Supabase project entirely

Block on: own decision when to flip from "paused" to "deleted". 14-day pause minimum gives a sane rollback window.

---

## 🚨 BLOCKER 4 — Apple OAuth provider configuration

Apple Sign-In currently returns a clear "Apple sign-in is not yet configured for this deployment" error to users (graceful degradation in commit `7b6c20c`). For App Store compliance (Guideline 4.8 — apps offering third-party login MUST also offer Apple Sign-In OR another privacy-preserving login), we may need this for the iOS app.

**Action:** decide whether to:
- (a) Configure Apple OAuth at destination Supabase before launch (Apple Developer console + Service ID + key + private key + Supabase auth provider config)
- (b) Strip the Apple Sign-In button from the iOS app entirely and rely solely on email + Google. Email-with-magic-link counts as "privacy-preserving" per Apple docs, so this may be acceptable
- (c) Defer the iOS public release; ship web only on day 1

Recommend **(a)** if iOS launch is needed week 1; **(b)** if web-only launch acceptable.

---

## 🚨 BLOCKER 5 — Cloudflare WAF + CSP for `app.lessonloop.net`

The current bundle's CSP header allows `*.sentry.io`, `*.ingest.sentry.io`, `js.stripe.com`, `*.supabase.co`, `*.lovable.app`, `*.lovableproject.com` (last two leftover, harmless to leave).

Missing:
- `api.pwnedpasswords.com` — currently blocked by CSP, breaking the password-leak check on signup. Console errors visible.
- WAF rules for the Cloudflare zone — currently zero rules. At minimum: rate-limit `/auth/*` paths, block known bad bots, geo-fence if needed.

**Actions:**

1. Add `api.pwnedpasswords.com` to `connect-src` in `index.html` CSP. ~5 min, one-line edit.
2. Cloudflare dashboard → Security → WAF → enable a baseline set of managed rules (free tier covers OWASP top 10).
3. Optionally — Cloudflare → Security → Rate Limiting → add a rule for `/auth/v1/token` to mitigate credential-stuffing.

---

## 🟡 BLOCKER 6 — Stripe Checkout branding

Currently the Stripe Checkout page that opens when a user upgrades shows zero LessonLoop branding (no logo, default colors, no description). Not a hard launch blocker but a real trust impact.

**Action:** Stripe dashboard → Settings → Branding → upload square logo (128×128 PNG), set brand colour, set statement descriptor. ~5 min.

---

## 🟡 BLOCKER 7 — Resend bounce/complaint webhook

Without a bounce webhook from Resend, repeated emails to invalid addresses harm domain deliverability.

**Action:** Resend dashboard → Webhooks → add endpoint pointing to `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/send-bounce-handler` (this fn doesn't exist yet — need to create one OR repurpose existing fn). Subscribe to `email.bounced`, `email.complained`, `email.delivery_delayed`. Function should mark the affected user's email as `email_blocked` in `profiles` so future sends skip them.

**Effort:** ~2h (write the handler + add a simple db column + UI banner for affected users).

---

## 🟡 BLOCKER 8 — Cookie consent banner

GDPR requires explicit consent for non-essential cookies + analytics tracking. Currently no banner. claude.md remaining items flagged this.

**Action:** drop in a cookie banner (e.g. CookieYes, Klaro, or a simple bespoke one). Toggle for analytics/tracking opt-out. Consent state stored in localStorage + respected by Sentry, etc.

---

## 🟡 BLOCKER 9 — Anthropic sub-processor disclosure

GDPR requires disclosure of sub-processors that handle EU personal data. LoopAssist sends user-identifying data to Anthropic — they're a sub-processor. Currently not disclosed in privacy policy.

**Action:** privacy policy update → list Anthropic as sub-processor + link to Anthropic's DPA + describe what data is sent (org name, user message, anonymised analytics from `query_org_data` tool). ~30 min copy update.

---

## 🟢 NON-BLOCKING but valuable pre-launch

- [ ] Lighthouse audit of dashboard + login + portal home (target: ≥90 across all 4)
- [ ] Web Vitals baseline captured for return-to-baseline comparisons post-launch
- [ ] Replace `replaysSessionSampleRate: 0.1` with `0.0` + `replaysOnErrorSampleRate: 1.0` (only record on error, save replay quota)
- [ ] Add `release` tag to Sentry (commit SHA) — needs `VITE_GIT_SHA` env at build time
- [ ] Stripe webhook event types audit — currently subscribed to 6; some apps benefit from more (e.g. `customer.subscription.trial_will_end`)
- [ ] Database backup verified and accessible (PITR is on by default for paid Supabase plans; verify retention period)
- [ ] Status page set up (e.g. https://status.lessonloop.net via UptimeRobot or similar)
- [ ] On-call escalation path defined (you're solo — at minimum a phone-alert for Sentry critical issues)

---

## Day-of-launch checklist

When all 🚨 blockers are ✅:

1. ✅ Verify `audit/MASTER.md` has zero P0 reds + acceptable P1 yellows
2. ✅ Verify Sentry events 7d count is reasonable (no untriaged P0 issues)
3. ✅ Verify Stripe webhook `we_1TUlSHAzPfYm94ux4mOfF72i` is `enabled` and receiving events
4. ✅ Verify destination Supabase health: cron count = 18 active, no errored crons in last 24h, no failed migrations
5. ✅ Smoke test (Jamie, browser): sign up new test user → onboard → create student → schedule lesson → mark attendance → manual invoice → checkout → pay test card → invoice marked paid
6. ✅ Smoke test (Jamie, mobile): same flow on iOS native
7. ✅ Set Google OAuth client to "In production" (after verification approved)
8. ✅ Mark Phase 7 closed in `audit/active/2026-04-area-2-parent-portal.md` (last open audit thread)
9. ✅ Announce launch externally
10. ✅ Pour something celebratory

---

## Known acceptable-as-is for v1 (deferred)

These are NOT launch blockers — they're known issues we'll ship with:

- Apple Sign-In on web (not configured at destination — graceful error message in place)
- Push notifications on iOS/Android (deferred per claude.md)
- LL-LL- prefix bug on Xero invoice references (cosmetic, see `audit/findings/2026-05-07-xero-sync-invoice-ll-prefix-bug.md`)
- Marketing chat using Gemini (out of cutover scope; marketing site separate stack)
- Some P2 reports may have ❓ untested state (acceptable if all P0/P1 are green)

---

## Status legend

🚨 Hard blocker — cannot launch publicly without
🟡 Soft blocker — should fix before public launch but won't break things
🟢 Nice to have — schedule for week 2 post-launch
⏸ Deferred — explicit accept

Update this file every working day. Move items from 🚨 → 🟡 → 🟢 → ✅ as they ship.
