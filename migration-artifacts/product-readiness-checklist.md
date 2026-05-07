# Product Readiness Checklist

**Scope:** items that don't block the source→destination migration but DO block onboarding paying customers / public launch / unrestricted user signup. Tracked separately from `migration-journal.md` so the migration story stays clean.

---

## Auth providers

### Google OAuth verification status

**Current state:** Google OAuth client is in **"Testing" publishing status** (per Google Cloud Console → APIs & Services → OAuth consent screen). Only accounts on the "Test users" list can authenticate.

**Surfaced during:** Phase 6 Tier 3.3 smoke test, when `JamieMckaye@gmail.com` (not on test list) hit `Error 403: access_denied`.

**Constraint:** restricts public sign-up. Real customers can't sign in via Google or use Google Calendar integration unless added to the test users list. Ceiling on test users (100 in dev mode).

**To resolve:**
1. Open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click "Publish App" — moves status to "In production"
3. Google starts a verification review for sensitive scopes (`calendar.events` + `calendar.readonly` are sensitive). May require:
   - Privacy policy URL (must be live and accessible)
   - Terms of service URL
   - Authorized domains list
   - Demo video showing the OAuth flow + how the calendar scopes are used
   - Justification text for each sensitive scope
4. Verification typically takes **2-6 weeks**. Status visible in OAuth consent screen.
5. Until verification completes, the app shows "unverified app" warning to non-test users (unless restricted scopes are minimal).

**Recommended timing:** start the verification submission ~3 weeks before public-launch target. Source's OAuth client is the same client (D1 — reuse), so this verification is shared between source and destination.

**Workaround for limited testing:** add specific accounts to "Test users" list (up to 100). Same dashboard.

---

## Stripe

### Webhook secret + endpoint registration
Tracked in `cutover-runbook.md` Step 5. Phase 7 work, not a separate readiness item.

### Stripe verification status / mode
Account already in **live mode** (`acct_1SrzbkAzPfYm94ux`, `livemode: true` confirmed via webhook list). All 6 subscription price IDs are valid live-mode prices. No additional verification needed.

---

## Email deliverability (Resend)

### Domain verification
Already verified for `lessonloop.net` (verified earlier in T6.2). `RESEND_API_KEY` set on destination. No outstanding work.

### Bounce / complaint webhook
Not configured. Without bounce handling, repeated sends to bad addresses don't trigger automatic suppression. Resend dashboard shows individual bounces; programmatic handling needs a webhook → store in destination (e.g., `email_bounces` table).

**Recommended:** configure post-cutover. Low priority unless seeing high bounce rates.

---

## Apple OAuth (deferred per D2)

Per D2: Apple Sign-In is being removed. 3-file code cleanup pass scheduled for Phase 7:
- `src/pages/Login.tsx` line 73 — `signInWithOAuth('apple', …)` button
- `src/pages/Signup.tsx` line 67 — same
- `src/integrations/lovable/index.ts` lines 15, 81 — drop `'apple'` from union types

No Apple Developer account / verification work needed. Apple iCal calendar integration (separate feature) is unaffected.

---

## iOS / Android cutover items (deferred to Phase 7)

- **Android intent filter typo:** `android/app/src/main/AndroidManifest.xml` uses `app.lessonloop.com` (should be `.net`)
- **Bundle ID inconsistency:** `capacitor.config.ts` says `net.lessonloop.app` but Xcode says `com.lessonloop.app`. Reconcile against actual App Store value before next iOS release.
- **Push notifications dormant:** `APNS_KEY_ID` and `FCM_SERVER_KEY` not set on destination; `push_tokens` table has 0 rows. Deferred until iOS push capability needs to be active.

---

## Cosmetic / UX bugs flagged during migration testing (defer)

### Xero invoice Reference duplicates "LL-" prefix
- Function builds `Reference: \`LL-${invoice.invoice_number}\`` but `invoice_number` already starts with `LL-`. All synced Xero invoices show `Reference=LL-LL-2026-XXXXX`.
- Source has the same bug — fixing would be a behaviour change for historical Xero data.
- Defer to a post-cutover code-cleanup pass (NOT urgent).

---

## Pre-public-launch checklist (consolidated)

- [ ] **Google OAuth:** publish app + complete verification review (~3 weeks lead time)
- [ ] **Resend bounce webhook:** configure if needed
- [ ] **Apple Sign-In code removal:** 3-file cleanup pass
- [ ] **Android manifest typo:** `.com` → `.net`
- [ ] **Bundle ID reconciliation:** Capacitor / Xcode / App Store Connect agreement
- [ ] **iOS push:** if/when in-app push notifications go live, fetch APNS_KEY_ID + FCM_SERVER_KEY
- [ ] **Xero `LL-LL-` cosmetic fix:** post-cutover code cleanup
