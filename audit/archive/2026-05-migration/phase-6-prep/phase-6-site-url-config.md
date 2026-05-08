# Phase 6 — Site URL + Redirect Whitelist

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Target config (D4: production URLs + localhost)

| Setting | Current | Target |
|---|---|---|
| `site_url` | `http://localhost:3000` | `https://app.lessonloop.net` |
| `uri_allow_list` | empty | 10 entries below |

---

## Redirect URLs whitelist (10 entries)

```
https://app.lessonloop.net
https://app.lessonloop.net/*
https://www.lessonloop.net
https://www.lessonloop.net/*
https://lessonloop.net
https://lessonloop.net/*
http://localhost:5173
http://localhost:5173/*
http://localhost:3000
http://localhost:3000/*
```

---

## Setup

**Dashboard:**
1. [Auth → URL Configuration](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/url-configuration)
2. Site URL: `https://app.lessonloop.net`
3. Redirect URLs: paste each line

**Or programmatic via Mgmt API:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{
    "site_url": "https://app.lessonloop.net",
    "uri_allow_list": "https://app.lessonloop.net,https://app.lessonloop.net/*,https://www.lessonloop.net,https://www.lessonloop.net/*,https://lessonloop.net,https://lessonloop.net/*,http://localhost:5173,http://localhost:5173/*,http://localhost:3000,http://localhost:3000/*"
  }'
```

`uri_allow_list` is a comma-separated string in the API.

---

## Domain typo flagged

`android/app/src/main/AndroidManifest.xml` has:
```xml
<data android:scheme="https" android:host="app.lessonloop.com" />   <!-- TYPO: should be .net -->
```

Everywhere else uses `lessonloop.net`. Fix when you next touch the Android build.

---

## Verify (post-config)

```bash
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "
import json,sys
d = json.load(sys.stdin)
print('site_url:', d['site_url'])
print('uri_allow_list:')
for u in (d.get('uri_allow_list','') or '').split(','):
    print(f'  {u}')
"
```

Expected: `site_url` = `https://app.lessonloop.net`; whitelist = 10 entries.
