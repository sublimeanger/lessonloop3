
# Fix: Add Custom Domain to CORS Allowlist

## Problem

The signup flow works, but the onboarding wizard fails at the "Start Free Trial" step when accessed from `lessonloop.net` (the custom published domain).

**Why it fails:**
- The `onboarding-setup` edge function uses a strict CORS policy
- The allowlist only includes Lovable preview/published URLs
- `lessonloop.net` is not in the allowlist
- The browser blocks the POST request after the preflight check

## Solution

Add `lessonloop.net` (and `www.lessonloop.net`) to the CORS allowlist.

### File: `supabase/functions/_shared/cors.ts`

**Current:**
```typescript
const DEFAULT_ORIGINS = [
  "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app",
  "https://lessonloop3.lovable.app",
  "*.lovable.app",
  "*.lovableproject.com",
];
```

**Updated:**
```typescript
const DEFAULT_ORIGINS = [
  "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app",
  "https://lessonloop3.lovable.app",
  "https://lessonloop.net",
  "https://www.lessonloop.net",
  "*.lovable.app",
  "*.lovableproject.com",
];
```

---

## Technical Details

| Item | Detail |
|------|--------|
| Root cause | CORS policy missing custom domain |
| Fix location | `supabase/functions/_shared/cors.ts` |
| Impact | All edge functions use this shared file |
| Deployment | Automatic on save |

## After Approval

1. Update the CORS file with the new origins
2. Edge functions will redeploy automatically
3. You can retry signup from `lessonloop.net`

---

**One-line change, full fix.**
