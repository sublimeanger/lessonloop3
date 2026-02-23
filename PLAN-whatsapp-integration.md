# WhatsApp Business Integration Plan — LessonLoop

## Overview

Integrate WhatsApp Business Cloud API as a second messaging channel alongside Resend email. Parents receive lesson reminders, payment confirmations, attendance updates, and can reply — all via WhatsApp. Teachers/admins manage WhatsApp from the existing messaging UI.

---

## Phase 1: Foundation (Database + Config)

### 1.1 Database migrations

**New table: `org_whatsapp_settings`**
```sql
create table org_whatsapp_settings (
  org_id uuid primary key references organisations(id),
  enabled boolean default false,
  waba_id text,                    -- WhatsApp Business Account ID
  phone_number_id text,            -- Meta phone number ID
  access_token_encrypted text,     -- System User permanent token (encrypted)
  webhook_verify_token text,       -- For Meta webhook verification
  display_phone_number text,       -- Human-readable e.g. "+44 7700 900123"
  business_name text,
  default_language text default 'en_GB',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**New table: `whatsapp_templates`** (local mirror of Meta-approved templates)
```sql
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id),
  meta_template_name text not null,    -- Name in Meta dashboard
  category text not null,              -- 'utility' | 'marketing' | 'authentication'
  language text default 'en_GB',
  purpose text not null,               -- 'lesson_reminder' | 'payment_confirmation' | 'attendance_update' | 'invoice_reminder' | 'general'
  body_template text,                  -- Local copy of body text with {{1}} placeholders
  status text default 'pending',       -- 'approved' | 'pending' | 'rejected'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, meta_template_name, language)
);
```

**Alter existing tables:**
```sql
-- Add WhatsApp phone to guardians
alter table guardians add column whatsapp_phone text;
alter table guardians add column whatsapp_opted_in boolean default false;
alter table guardians add column whatsapp_opted_in_at timestamptz;

-- Extend message_log channel enum
-- (message_log.channel currently allows 'email' and 'inapp')
alter table message_log
  drop constraint if exists message_log_channel_check;
alter table message_log
  add constraint message_log_channel_check
  check (channel in ('email', 'inapp', 'whatsapp'));

-- Add WhatsApp-specific fields to message_log
alter table message_log add column wa_message_id text;  -- Meta's message ID for delivery tracking

-- Extend notification_preferences
alter table notification_preferences add column whatsapp_lesson_reminders boolean default true;
alter table notification_preferences add column whatsapp_invoice_reminders boolean default true;
alter table notification_preferences add column whatsapp_payment_receipts boolean default true;
```

**RLS policies** — mirror existing message_log/guardian policies, scoped to org_id.

### 1.2 Shared utilities

**`supabase/functions/_shared/whatsapp-client.ts`** — Thin wrapper around Meta Cloud API:
- `sendTemplateMessage(phoneNumberId, accessToken, recipientPhone, templateName, language, components)`
- `sendTextMessage(phoneNumberId, accessToken, recipientPhone, text)` (for session replies)
- Uses `fetch()` to `https://graph.facebook.com/v21.0/{phoneNumberId}/messages`
- Returns Meta message ID (`wamid`) for delivery tracking

### 1.3 Rate limiting

Extend `supabase/functions/_shared/rate-limit.ts`:
```typescript
"send-whatsapp-message": { maxRequests: 30, windowMinutes: 60 },
"whatsapp-webhook": { maxRequests: 200, windowMinutes: 1 },
```

---

## Phase 2: Outbound Messaging (Edge Functions)

### 2.1 `send-whatsapp-message` edge function

Core outbound function. Accepts:
```typescript
{
  org_id: string,
  guardian_id: string,
  template_purpose: 'lesson_reminder' | 'payment_confirmation' | 'invoice_reminder' | 'attendance_update' | 'general',
  template_params: Record<string, string>,  // e.g. { "1": "Piano", "2": "Monday 3pm" }
  // OR for session replies:
  text?: string
}
```

Flow:
1. Auth check (JWT)
2. Verify org has WhatsApp enabled (`org_whatsapp_settings`)
3. Look up guardian's `whatsapp_phone` + `whatsapp_opted_in`
4. Check notification preferences
5. Resolve template from `whatsapp_templates` by purpose
6. Call Meta Cloud API via shared client
7. Log to `message_log` with `channel = 'whatsapp'`, store `wa_message_id`
8. Return success/error

### 2.2 `whatsapp-lesson-reminder` edge function (cron-triggered)

Automated lesson reminders — runs on cron schedule (e.g. daily at 8am):
1. Query upcoming lessons in next 24h
2. For each lesson, find linked guardians with `whatsapp_opted_in = true`
3. Check `notification_preferences.whatsapp_lesson_reminders`
4. Send template message: "Hi {{1}}, just a reminder that {{2}}'s {{3}} lesson is tomorrow at {{4}}."
5. Log all sends to `message_log`

### 2.3 Integration with existing send flows

**Invoice emails** (`send-invoice-email`): After sending email, also send WhatsApp if guardian has opted in. Use utility template: "Hi {{1}}, a new invoice of {{2}} for {{3}} is ready. Please check your portal for details."

**Payment receipts** (`stripe-webhook`): On `payment_intent.succeeded`, send WhatsApp confirmation: "Hi {{1}}, we've received your payment of {{2}}. Thank you!"

**Attendance** (lesson completion): Send "{{1}} attended their {{2}} lesson today. Practice streak: {{3}} days!"

> Implementation: Add a `maybeNotifyWhatsApp()` helper called from existing edge functions, keeping the logic DRY.

---

## Phase 3: Inbound — Webhook Handler

### 3.1 `whatsapp-webhook` edge function

Handles Meta's webhook callbacks:

**GET** — Verification handshake:
```typescript
// Meta sends: hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
// Verify token matches org_whatsapp_settings.webhook_verify_token
// Return challenge string
```

**POST** — Incoming events:
```typescript
// Parse webhook payload
for (const entry of body.entry) {
  for (const change of entry.changes) {
    if (change.field === 'messages') {
      for (const message of change.value.messages) {
        // Incoming parent message — store in message_log,
        // route to staff via existing thread system
      }
      for (const status of change.value.statuses) {
        // Delivery receipts — update message_log.status
        // 'sent' -> 'delivered' -> 'read'
      }
    }
  }
}
// Return 200 immediately, process async
```

**Incoming message routing:**
1. Look up guardian by phone number
2. Find or create a message thread (reuse `message_log.thread_id` pattern)
3. Insert into `message_log` with `channel = 'whatsapp'`
4. Notify assigned teacher/admin (existing `notify-internal-message` pattern)

### 3.2 Delivery status tracking

Update `message_log` status based on webhook status events:
- `sent` — Message accepted by Meta
- `delivered` — Delivered to recipient device
- `read` — Recipient opened the message
- `failed` — With error code and description

---

## Phase 4: Admin UI

### 4.1 WhatsApp Settings page (org settings)

New section in org settings: **Messaging > WhatsApp**

- Enable/disable WhatsApp for org
- Connect WhatsApp Business Account (guided setup)
  - Enter WABA ID, Phone Number ID, System User Token
  - Test connection button (sends test message)
- View connected phone number
- View template sync status

**File: `src/pages/settings/WhatsAppSettings.tsx`**

### 4.2 Guardian WhatsApp opt-in

**Edit guardian form** — add fields:
- WhatsApp phone number (with country code picker, default +44)
- Opt-in checkbox + timestamp
- "Send test message" button

**Parent portal profile** — allow parents to:
- Add/update their WhatsApp number
- Opt in/out of WhatsApp notifications
- Granular preferences (lesson reminders, invoices, payments)

**File changes:**
- `src/components/guardians/GuardianForm.tsx` — add phone + opt-in fields
- `src/components/portal/PortalProfile.tsx` — add WhatsApp preferences
- `src/components/settings/NotificationsTab.tsx` — add WhatsApp toggles

### 4.3 Message composer integration

Extend the existing staff message composer to support WhatsApp:
- Channel selector: Email | WhatsApp | Both
- When WhatsApp selected, show template picker (from `whatsapp_templates`)
- Fill in template parameters from context (student name, lesson details, etc.)
- Preview formatted message before sending

### 4.4 Conversation view

Extend `PortalMessages` and admin message views:
- Show WhatsApp messages alongside email in unified thread view
- WhatsApp icon indicator on messages
- Delivery status badges (sent / delivered / read)
- Reply to WhatsApp messages (uses session messaging within 24h window)

---

## Phase 5: WhatsApp Template Setup

### Pre-approved templates to create in Meta Business Manager

| Purpose | Category | Template Name | Body |
|---------|----------|---------------|------|
| Lesson reminder | Utility | `lesson_reminder_v1` | Hi {{1}}, just a reminder that {{2}}'s {{3}} lesson is on {{4}} at {{5}}. |
| Payment confirmation | Utility | `payment_received_v1` | Hi {{1}}, we've received your payment of {{2}} for {{3}}. Thank you! |
| Invoice issued | Utility | `invoice_issued_v1` | Hi {{1}}, a new invoice of {{2}} for {{3}} has been issued. View it in your parent portal. |
| Invoice overdue | Utility | `invoice_overdue_v1` | Hi {{1}}, a friendly reminder that your invoice of {{2}} for {{3}} is now overdue. Please check your portal. |
| Attendance update | Utility | `attendance_update_v1` | Hi {{1}}, {{2}} attended their {{3}} lesson today. Current practice streak: {{4}} days! |
| Lesson cancelled | Utility | `lesson_cancelled_v1` | Hi {{1}}, {{2}}'s {{3}} lesson on {{4}} has been cancelled. Please check your portal for details. |
| Make-up offered | Utility | `makeup_offered_v1` | Hi {{1}}, a make-up lesson is available for {{2}}: {{3}} on {{4}} at {{5}}. Reply YES to confirm. |

All templates use **Utility** category (lower cost, transactional). UK English (`en_GB`).

---

## Phase 6: Meta Account Setup (Non-code)

Prerequisites for go-live:
1. **Meta Business Account** — verify business identity
2. **Meta Developer App** — create app, add WhatsApp product
3. **Phone number** — dedicated number not on personal WhatsApp
4. **System User Token** — permanent token (not temporary 24h token)
5. **Webhook URL** — point to `https://<supabase-url>/functions/v1/whatsapp-webhook`
6. **Template submission** — submit all 7 templates for Meta approval
7. **Business verification** — unlocks higher messaging limits (1K → 10K → 100K/day)

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────┐
│  Parent Portal   │     │   Admin/Teacher UI    │
│  (React SPA)     │     │   (React SPA)         │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         │  REST API calls         │
         ▼                         ▼
┌─────────────────────────────────────────────┐
│          Supabase Edge Functions             │
│                                             │
│  send-whatsapp-message                      │
│  whatsapp-webhook                           │
│  whatsapp-lesson-reminder (cron)            │
│  + existing: send-invoice-email, etc.       │
│                                             │
│  Uses: _shared/whatsapp-client.ts           │
└──────────────────┬──────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
┌──────────────┐   ┌───────────────────┐
│  Supabase DB │   │  Meta Cloud API   │
│              │   │  graph.facebook   │
│  message_log │   │  .com/v21.0/...   │
│  guardians   │   │                   │
│  whatsapp_*  │   │  ◄── Webhooks ──► │
└──────────────┘   └───────────────────┘
```

---

## Estimated Costs (UK)

| Item | Cost |
|------|------|
| Utility template (per message, UK) | ~£0.02–0.04 |
| Service conversation (user-initiated) | Free |
| Marketing template (per message, UK) | ~£0.08–0.12 |
| Meta platform fee | Free (Cloud API) |
| Phone number | ~£1/month (virtual) |

For a tutoring org with 50 students, ~200 utility messages/month ≈ **£4–8/month**.

---

## Implementation Order

| Step | Description | Effort |
|------|-------------|--------|
| 1 | Database migrations (tables, columns, RLS) | Small |
| 2 | `_shared/whatsapp-client.ts` utility | Small |
| 3 | `send-whatsapp-message` edge function | Medium |
| 4 | `whatsapp-webhook` edge function | Medium |
| 5 | WhatsApp Settings page (admin UI) | Medium |
| 6 | Guardian form + opt-in fields | Small |
| 7 | Notification preferences (WhatsApp toggles) | Small |
| 8 | `whatsapp-lesson-reminder` cron function | Medium |
| 9 | Integrate with invoice/payment/attendance flows | Medium |
| 10 | Message composer WhatsApp channel | Medium |
| 11 | Unified conversation view (WhatsApp + email) | Medium |
| 12 | Parent portal WhatsApp preferences | Small |
| 13 | Meta account setup + template submission | Non-code |
| 14 | Testing with Meta test number | Small |

---

## Key Decisions to Confirm

1. **Direct Meta API vs BSP (e.g. Twilio, MessageBird)?** — Plan assumes direct Meta Cloud API (cheaper, no middleman). A BSP adds cost but gives a dashboard, better error handling, and support.

2. **Webhook hosting** — Supabase Edge Functions can handle webhooks, but Meta requires HTTPS + fast 200 response. May need a lightweight proxy or queue if volume grows.

3. **Two-way messaging scope** — Should parents be able to send free-form WhatsApp messages to staff, or just receive notifications + use quick-reply buttons?

4. **Per-org vs platform-wide WABA** — Should each org connect their own WhatsApp number, or use a single LessonLoop number for all orgs?

5. **Encryption for access tokens** — System User tokens are sensitive. Need to decide on encryption approach (Supabase Vault, environment variable, or encrypted column).
