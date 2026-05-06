# Phase 6 — Email Configuration Audit

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Two distinct email pipelines in LessonLoop

### Pipeline 1: Supabase Auth emails (signup confirmation, password reset, magic link, email change)
- Sent by Supabase Auth service itself
- Default delivery: Supabase's built-in low-throughput SMTP (rate-limited, OK only for development; **not production-suitable**)
- Production delivery: SMTP relay (in our case, **Resend SMTP**)
- Templates: stored in Auth config (see audit below)

### Pipeline 2: App-driven emails (invites, invoice deliveries, lesson reminders, etc.)
- Sent from edge functions via the **Resend HTTP API** directly (`https://api.resend.com/emails`)
- 24+ functions use this pattern (see inventory below)
- Auth: each function reads `RESEND_API_KEY` from secrets

Both pipelines use the same Resend account, but they're configured separately.

---

## Pipeline 1 audit — Supabase Auth SMTP

### Current destination state (from Mgmt API `/config/auth`)
| Setting | Current | Target |
|---|---|---|
| `smtp_host` | None | `smtp.resend.com` |
| `smtp_port` | None | `465` |
| `smtp_user` | None | `resend` (literal — Resend's SMTP username for all accounts) |
| `smtp_pass` | None | `<RESEND_API_KEY>` (the same value used for the HTTP API) |
| `smtp_admin_email` | None | `noreply@lessonloop.net` |
| `smtp_sender_name` | None | `LessonLoop` |
| `smtp_max_frequency` | 60 (sec) | leave as-is (1/min per recipient — adequate) |
| `mailer_otp_length` | 8 | leave as-is |
| `mailer_otp_exp` | 3600 (sec = 1hr) | leave as-is |

> **Note:** Resend's SMTP creds are documented at [https://resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp). The username is literally `resend`; the password is your Resend API key. Port 465 (TLS) or 587 (STARTTLS) — use 465 for compatibility with Supabase's SMTP client.

### Setup steps (manual, after `RESEND_API_KEY` is set)

1. Go to [Supabase Dashboard → xmrhmxizpslhtkibqyfy → Authentication → Settings → SMTP Settings](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/templates)
2. Enable "Custom SMTP server"
3. Fill in:
   - Sender email: `noreply@lessonloop.net`
   - Sender name: `LessonLoop`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: paste your `RESEND_API_KEY` (starts with `re_…`)
4. Save
5. Click "Send test email" → enter your own address → confirm receipt

### Email templates audit

Destination currently has all **9 default Supabase templates** (`Confirm Your Signup`, `Reset Your Password`, `Your Magic Link`, etc.), with stock `<h2>…</h2>` HTML bodies — no LessonLoop branding.

**Source's templates:** not captured in the migration dump (Auth config isn't part of the `pg_dump`-style export). To replicate, you have two options:

**Option A (recommended): visually copy from source dashboard**
1. Open [source's auth templates dashboard](https://supabase.com/dashboard/project/ximxgnkpcswbvfrkkmjq/auth/templates)
2. For each of the 9 template tabs, copy the Subject + HTML body
3. Paste into [destination's matching tab](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/templates)
4. Save each one

**Option B: programmatic copy via Mgmt API**
```bash
# Fetch source's auth config (you must have a Mgmt API token with access to source)
curl -sS -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/config/auth" > /tmp/source_auth_config.json

# Extract template subjects + bodies
python3 -c "
import json
with open('/tmp/source_auth_config.json') as f:
    d = json.load(f)
templates = {k: v for k, v in d.items() if 'mailer_subjects_' in k or 'mailer_templates_' in k}
print(json.dumps(templates, indent=2))
" > /tmp/source_email_templates.json

# Then PATCH destination with the same values
# (built into the cutover runbook — see T6.5)
```

### Templates Supabase Auth sends (9 total)

Per the destination config audit, the 9 templates in scope are:
1. **Confirmation** (signup) — `mailer_subjects_confirmation` + `mailer_templates_confirmation_content`
2. **Email change** — `mailer_subjects_email_change` + `mailer_templates_email_change_content`
3. **Email changed notification** — `mailer_subjects_email_changed_notification` + `mailer_templates_email_changed_notification_content`
4. **Identity linked** — `mailer_subjects_identity_linked_notification` + `mailer_templates_identity_linked_notification_content`
5. **Identity unlinked** — `mailer_subjects_identity_unlinked_notification` + …
6. **Invite** — `mailer_subjects_invite` + `mailer_templates_invite_content`
7. **Magic link** — `mailer_subjects_magic_link` + `mailer_templates_magic_link_content`
8. **Password changed notification** — `mailer_subjects_password_changed_notification` + …
9. **Recovery (password reset)** — `mailer_subjects_recovery` + `mailer_templates_recovery_content`
10. **Reauthentication** — `mailer_subjects_reauthentication` + …

(Plus a few MFA/phone-change ones that LessonLoop probably doesn't customise.)

---

## Pipeline 2 audit — Resend HTTP API (app emails)

### Functions using Resend (24 inventoried)

```
admin-backfill-default-pm        ical-expiry-reminder
auto-pay-final-reminder          notify-internal-message
auto-pay-upcoming-reminder       notify-makeup-match
batch-invite-guardians           notify-makeup-offer
credit-expiry-warning            overdue-reminders
cron-health-watchdog             send-auto-pay-alert
installment-overdue-check        send-auto-pay-failure-notification
installment-upcoming-reminder    send-cancellation-notification
invoice-overdue-check            send-contact-message
                                 send-dispute-notification
                                 send-enrolment-offer
                                 send-invite-email
                                 send-invoice-email
                                 send-invoice-email-internal
                                 send-lesson-reminders
                                 send-message
                                 send-parent-enquiry
                                 send-recurring-billing-alert
                                 send-refund-notification
                                 streak-notification
                                 trial-* (winback, expired, reminders)
```

### Sender addresses used (you'll need DNS records for each domain/sub-domain)

All emails use the `lessonloop.net` domain, with multiple specific from-addresses:
- `noreply@lessonloop.net` — most app-system emails
- `notifications@lessonloop.net` — user-facing app notifications (lesson reminders, etc.)
- `billing@lessonloop.net` — invoice / payment emails (often `${orgName} <billing@…>` format)
- `hello@lessonloop.net` — outreach / contact responses

### Resend setup checklist (you, the user)

1. **Confirm the sending domain is verified in Resend.** Visit [https://resend.com/domains](https://resend.com/domains).
   - The domain `lessonloop.net` must show "Verified" status.
   - If not, you'll need to add the SPF/DKIM/DMARC DNS records Resend specifies.
   - This is likely already done from source's setup — just verify.
2. **Confirm the API key has `Full access`** (or at least `Sending access`). Visit [https://resend.com/api-keys](https://resend.com/api-keys).
   - You can either reuse the existing key (also provisioned for source — both projects use the same one) or create a new key for destination.
   - Key starts with `re_…`.
3. **Set the secret on destination** (already in `secret-fetch-checklist.md`):
   ```bash
   supabase secrets set --project-ref xmrhmxizpslhtkibqyfy RESEND_API_KEY=re_PASTE_HERE
   ```
4. **Optionally also configure Pipeline 1** (SMTP) at this point — same key.

### Reply-to + bounce handling

Spot-checking the function code, none use `reply_to:` headers — replies go back to the from-address. The bounce-management is via Resend's webhook system; not in scope for cutover prep (we'll set up bounce webhooks post-cutover if needed).

---

## Verification queries (post-config, pre-Phase 7)

```bash
# Verify destination SMTP config is populated
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "
import json,sys
d = json.load(sys.stdin)
print('smtp_host:', d.get('smtp_host'))
print('smtp_port:', d.get('smtp_port'))
print('smtp_user:', d.get('smtp_user'))
print('smtp_admin_email:', d.get('smtp_admin_email'))
print('smtp_sender_name:', d.get('smtp_sender_name'))
print('smtp_pass:', '<set>' if d.get('smtp_pass') else 'EMPTY')
"

# Verify RESEND_API_KEY secret is set (should NOT match the placeholder digest)
supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep RESEND_API_KEY
```

---

## Outstanding questions / decisions

- [ ] Will you reuse the existing source Resend API key, or create a new one for destination? (Either works; new key is cleaner for audit.)
- [ ] Are all 4 sender addresses (`noreply@`, `notifications@`, `billing@`, `hello@`) configured in DNS/Resend? (The verified-domain wildcard usually covers them all, but verify.)
- [ ] Bounce/complaint webhooks: defer to post-cutover, or set up at cutover time?
