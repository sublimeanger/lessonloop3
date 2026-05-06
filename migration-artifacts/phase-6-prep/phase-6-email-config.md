# Phase 6 — Email Configuration

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Two email pipelines in LessonLoop

### Pipeline 1 — Supabase Auth emails (signup, password reset, magic link)
- Sent by Supabase Auth itself
- Default delivery: Supabase's built-in SMTP (rate-limited, dev-only)
- Production: SMTP relay via Resend
- Templates: stored in Auth config

### Pipeline 2 — App-driven emails (invites, invoice deliveries, reminders)
- Sent from edge functions via Resend HTTP API directly
- 24+ functions use this pattern
- Auth: each reads `RESEND_API_KEY` from secrets

Both use the same Resend account.

---

## Pipeline 1 — Supabase Auth SMTP setup

### Target SMTP config
| Setting | Value |
|---|---|
| `smtp_host` | `smtp.resend.com` |
| `smtp_port` | `465` |
| `smtp_user` | `resend` (literal — Resend's SMTP username) |
| `smtp_pass` | `<RESEND_API_KEY>` (D3: same source key) |
| `smtp_admin_email` | `noreply@lessonloop.net` |
| `smtp_sender_name` | `LessonLoop` |

Resend SMTP docs: [https://resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp). Username is literally `resend`; password is the API key. Port 465 (TLS).

### Steps (after `RESEND_API_KEY` is set)

1. [Auth → SMTP Settings](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/templates)
2. Enable "Custom SMTP server"
3. Fill in the values from the table above
4. Save → "Send test email" → confirm receipt

### Email templates — copy from source

Destination has all 9 default Supabase templates with stock HTML. Source has LessonLoop branding. Copy the templates over:

**Recommended: visual copy from dashboard**
1. Open [source's Auth → Email Templates](https://supabase.com/dashboard/project/ximxgnkpcswbvfrkkmjq/auth/templates)
2. For each tab — Subject + HTML body — paste into [destination's matching tab](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/templates)
3. Save each

**Alternative: programmatic copy via Mgmt API**
```bash
# Fetch source's auth config (need source Mgmt API token)
curl -sS -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/config/auth" | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
out = {k: v for k, v in d.items() if 'mailer_subjects_' in k or 'mailer_templates_' in k}
print(json.dumps(out, indent=2))
" > /tmp/source_email_templates.json

# PATCH destination with the same values
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d @/tmp/source_email_templates.json
```

### 9 templates in scope
1. Confirmation (signup)
2. Email change
3. Email changed notification
4. Identity linked / unlinked notifications
5. Invite
6. Magic link
7. Password changed notification
8. Recovery (password reset)
9. Reauthentication

---

## Pipeline 2 — Resend HTTP API

### Functions using Resend (24)

```
admin-backfill-default-pm        notify-internal-message
auto-pay-final-reminder          notify-makeup-match
auto-pay-upcoming-reminder       notify-makeup-offer
batch-invite-guardians           overdue-reminders
credit-expiry-warning            send-auto-pay-alert
cron-health-watchdog             send-auto-pay-failure-notification
ical-expiry-reminder             send-cancellation-notification
installment-overdue-check        send-contact-message
installment-upcoming-reminder    send-dispute-notification
invoice-overdue-check            send-enrolment-offer
                                 send-invite-email
                                 send-invoice-email / send-invoice-email-internal
                                 send-lesson-reminders
                                 send-message
                                 send-parent-enquiry
                                 send-recurring-billing-alert
                                 send-refund-notification
                                 streak-notification
                                 trial-* (winback, expired, reminders 1/3/7-day)
```

### Sender addresses in use
- `noreply@lessonloop.net` — most app-system emails
- `notifications@lessonloop.net` — user-facing notifications (lesson reminders)
- `billing@lessonloop.net` — invoice / payment emails
- `hello@lessonloop.net` — outreach / contact responses

### Resend setup (D3: reuse source's API key)

1. Visit [https://resend.com/domains](https://resend.com/domains) — confirm `lessonloop.net` is "Verified"
2. The same `RESEND_API_KEY` from source goes into destination's secrets:
   ```bash
   supabase secrets set --project-ref xmrhmxizpslhtkibqyfy RESEND_API_KEY=<source's re_… key>
   ```
3. Same key powers both Pipeline 1 (SMTP) and Pipeline 2 (HTTP API).

---

## Verify (post-config, pre-Phase 7)

```bash
# Confirm SMTP populated
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "
import json,sys
d = json.load(sys.stdin)
for k in ('smtp_host','smtp_port','smtp_user','smtp_admin_email','smtp_sender_name'):
    print(f'{k}: {d.get(k)}')
print(f'smtp_pass: {\"<set>\" if d.get(\"smtp_pass\") else \"EMPTY\"}')
"

# Confirm RESEND_API_KEY no longer matches placeholder digest
supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep RESEND_API_KEY
```
