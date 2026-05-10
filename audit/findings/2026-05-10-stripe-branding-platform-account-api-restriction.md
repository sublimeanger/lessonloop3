# Stripe branding update blocked at platform-account API level

**Severity:** low (partial-shipped)
**Status:** open (Jamie Dashboard paste required)
**Area:** stripe / launch readiness
**Discovered:** 2026-05-10 (s25 Track 2.5)
**Affected components:** Stripe platform account `acct_1SrzbkAzPfYm94ux`

## Symptom

Attempted to update Stripe Checkout branding (icon/logo/colors/support_email/support_url) via `POST /v1/account` using the platform's own secret key. Stripe rejects with:

```
"You cannot use this method on your own account: you may only use it on connected accounts."
```

This is an intentional Stripe API guardrail — `POST /v1/account` is only writable for connected accounts (Stripe Connect platforms updating their connected merchants). The platform's own account branding is editable only via the Stripe Dashboard with an authenticated team member.

## Pre-flight state (read via `GET /v1/account` with platform secret key)

```
business_profile.name           = "LessonLoop"           ✓
business_profile.url            = "https://lessonloop.net" ✓
business_profile.support_email  = null                   ✗
business_profile.support_url    = null                   ✗
business_profile.support_phone  = "+447376047118"        ✓
settings.branding.icon          = null                   ✗
settings.branding.logo          = null                   ✗
settings.branding.primary_color = null                   ✗
settings.branding.secondary_color = null                 ✗
settings.payments.statement_descriptor = "LESSONLOOP"    ✓
country = "GB", default_currency = "gbp"                 ✓
```

## What s25 prepared (agent half)

Two files uploaded to Stripe Files API using the platform secret key (this works; only `POST /v1/account` is restricted):

- **Business icon**: `file_1TVakiAzPfYm94uxOZBBtM41`
  - Source: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024x1024 PNG — same icon Apple shows in App Store)
  - Purpose: `business_icon`
- **Business logo**: `file_1TVakkAzPfYm94uxtYgddioT`
  - Same source PNG
  - Purpose: `business_logo`

## Action required (Jamie) — ~5 minute Dashboard paste

**Stripe Dashboard → Settings → [Branding](https://dashboard.stripe.com/settings/branding):**

1. **Icon**: paste file ID `file_1TVakiAzPfYm94uxOZBBtM41` (the LessonLoop iOS app icon, 1024x1024 PNG, already on Stripe's CDN — the upload UI should list it under "previously uploaded files" or accept the file_id directly).
2. **Logo**: paste file ID `file_1TVakkAzPfYm94uxtYgddioT` (same source asset; if you have a horizontal wordmark PNG variant, use that instead — but the icon works for both fields).
3. **Brand colour (primary)**: paste `#00c2b8` (LessonLoop teal — matches `iconColor` in `capacitor.config.ts`).
4. **Brand accent (secondary)**: paste `#0a1628` (LessonLoop ink/dark navy — matches `backgroundColor` in `capacitor.config.ts`).

**Stripe Dashboard → Settings → [Public details](https://dashboard.stripe.com/settings/public):**

5. **Support email**: `jamie@searchflare.co.uk` (or `support@lessonloop.net` if/when MX is set up).
6. **Support URL**: `https://lessonloop.net/contact`.

**(Already done by agent in s26 via API):**
- Stripe Billing Portal Configuration `bpc_1TUPRXAzPfYm94uxnkflag2b` updated with:
  - headline "Manage your LessonLoop subscription"
  - privacy_policy_url https://lessonloop.net/privacy
  - terms_of_service_url https://lessonloop.net/terms
  - default_return_url https://app.lessonloop.net/settings?tab=billing
- Statement descriptor "LESSONLOOP" already set (read via GET /v1/account)
- Support phone +44... already set (per pre-flight)
- Both files (icon + logo) uploaded to Stripe Files API in s25 — they're discoverable in the Dashboard upload picker by file ID.

## Verification

After Jamie's paste:

1. Check via `GET /v1/account` — `branding.icon`, `branding.logo`, both `*_color` fields should be populated.
2. Create a test-mode Stripe Checkout session (via `POST /v1/checkout/sessions` with platform key + price) and visit the returned URL — assert logo + brand color visible + business name in header.
3. Promote audit row "Stripe Checkout branding" 🔴 → 🟢.

## Lessons / follow-ups

When wrapping a Stripe-using SaaS, treat platform-own-account settings as Dashboard-only. Connected-account settings (per-org Stripe Connect) are API-writable; that distinction is Stripe's security model.
