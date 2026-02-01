

# World-Class Messaging System Plan

## ✅ Phase 1: COMPLETE - Bulk Messaging with Smart Filters

### What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| **message_log table** | Complete | Tracks all sent messages with status, channel, recipient info |
| **message_templates table** | Complete | Reusable templates with subject/body |
| **message_requests table** | Complete | Parent portal inquiries (reschedule, cancellation, general) |
| **send-message edge function** | Complete | Sends individual emails via Resend, logs to message_log |
| **ComposeMessageModal** | Basic | Single recipient only, template selection |
| **Messages page** | Basic | View sent messages + parent requests |
| **Parent portal messages** | Complete | Parents can submit requests and see responses |
| **Automated reminders** | Complete | overdue-reminders, send-notes-notification, trial emails |
| **Email delivery (Resend)** | Configured | RESEND_API_KEY is active |

### Current Gaps

1. **No mass/bulk messaging** - Can only message one guardian at a time
2. **No recipient filtering/tagging** - Cannot filter by location, teacher, or student status
3. **No internal staff messaging** - Teachers cannot message owners/admins
4. **No inbox view** - Only sent messages visible, no received messages
5. **No read receipts for staff** - Only parent read_at tracking exists
6. **No bidirectional threading** - Messages are one-way broadcasts

---

## Proposed Architecture

### Phase 1: Bulk Messaging with Smart Filters (Owner/Admin Only)

Add ability for owners and admins to send messages to filtered groups of guardians.

#### Database Changes

```text
+---------------------------+
|  message_log              |
+---------------------------+
| (existing columns)        |
| + batch_id uuid           |  -- Links messages sent in same bulk operation
+---------------------------+

+---------------------------+
|  message_batches          |
+---------------------------+
| id uuid PK                |
| org_id uuid FK            |
| name text                 |  -- "September fees reminder"
| filter_criteria jsonb     |  -- {"location_ids": [...], "status": "active"}
| recipient_count int       |
| sent_count int            |
| failed_count int          |
| created_by uuid FK        |
| created_at timestamptz    |
+---------------------------+
```

#### Filter Options for Bulk Send

| Filter | Description |
|--------|-------------|
| Location | Students at specific school(s)/venue(s) |
| Teacher | Students assigned to specific teacher(s) |
| Status | Active, inactive, or all students |
| Invoice status | Guardians with overdue invoices |
| All | Send to all guardians in organisation |

#### UI: Enhanced ComposeMessageModal

```text
+---------------------------------------------+
| Send Message                                |
+---------------------------------------------+
| Recipients:                                 |
| [ ] All guardians (247)                     |
| [ ] Filter by location:                     |
|     [x] Oakwood Primary (52)                |
|     [ ] St Mary's Academy (89)              |
| [ ] Filter by teacher:                      |
|     [x] James Wilson (34)                   |
| [ ] Only active students                    |
|                                             |
| Preview: 52 recipients                      |
+---------------------------------------------+
| Template: [Select template v]               |
| Subject: [________________________]         |
| Message: [________________________]         |
|          [________________________]         |
|                                             |
| [Cancel]              [Preview] [Send (52)] |
+---------------------------------------------+
```

#### Edge Function: send-bulk-message

- Accepts filter criteria + message content
- Queries guardians matching filters (deduped)
- Creates batch record
- Loops through recipients and sends via Resend
- Rate limiting (500 emails/hour via Resend free tier)
- Progress tracking in batch record

---

### Phase 2: Internal Staff Messaging

Teachers working for an agency need to communicate with owners/admins. This requires a separate "internal" channel.

#### Database Changes

```text
+---------------------------+
|  internal_messages        |
+---------------------------+
| id uuid PK                |
| org_id uuid FK            |
| sender_user_id uuid FK    |
| sender_type text          |  -- 'teacher', 'admin', 'owner'
| recipient_user_id uuid FK |
| recipient_type text       |  -- 'teacher', 'admin', 'owner'
| subject text              |
| body text                 |
| read_at timestamptz       |
| created_at timestamptz    |
+---------------------------+
```

#### RLS Policies

- Teachers can send to admins/owners only
- Teachers can read messages where they are sender OR recipient
- Admins/owners can read all internal messages in org

#### UI: Messages Page Enhancement

```text
+--------------------------------------------------+
| Messages                     [+ New Message]      |
+--------------------------------------------------+
| [Sent to Parents] [Inbox] [Internal] [Requests]  |
+--------------------------------------------------+
```

- **Sent to Parents**: Current view (outbound to guardians)
- **Inbox**: Messages received from parents/internal staff
- **Internal**: Staff-to-staff communication
- **Requests**: Parent portal requests (existing)

---

### Phase 3: Email Notification for All Messages

Ensure every message reaches the recipient's inbox, not just in-app.

#### Current Email Coverage

| Message Type | Email Sent? |
|--------------|-------------|
| Manual message to guardian | Yes |
| Invoice email | Yes |
| Overdue reminder | Yes |
| Lesson notes shared | Yes |
| Parent request response | **No** |
| Internal staff message | **No** |

#### New Edge Functions

1. **notify-request-response**: When admin responds to a parent request, email the guardian
2. **notify-internal-message**: When internal message sent, email the recipient

#### Email Template for Parent Request Response

```html
Subject: Update on your request - {request_subject}

Dear {guardian_name},

Your request "{request_subject}" has been {approved/declined/resolved}.

{admin_response if provided}

View details in your parent portal.

Thank you,
{org_name}
```

---

### Phase 4: Message Threading (Future)

Allow reply chains for ongoing conversations. This is more complex and could be Phase 2 of a later iteration.

#### Concept

```text
message_log
+ parent_message_id uuid  -- Links to original message for threading
+ thread_id uuid          -- Groups all messages in a conversation
```

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P1** | Bulk messaging with location/teacher filters | High | Critical for agencies |
| **P1** | Email notification for request responses | Low | Quick win |
| **P2** | Internal staff messaging | Medium | Agency teacher communication |
| **P3** | Unified inbox view | Medium | Better UX |
| **P4** | Message threading | High | Nice-to-have |

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-bulk-message/index.ts` | Bulk email sending with filters |
| `supabase/functions/notify-request-response/index.ts` | Email parents on request updates |
| `src/components/messages/BulkComposeModal.tsx` | Multi-recipient compose UI |
| `src/components/messages/RecipientFilter.tsx` | Filter by location/teacher/status |
| `src/hooks/useBulkMessage.ts` | Bulk send mutation + filter queries |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Messages.tsx` | Add tabs for inbox/internal, bulk compose button |
| `src/hooks/useAdminMessageRequests.ts` | Trigger email on status update |
| `src/components/messages/ComposeMessageModal.tsx` | Add "switch to bulk" option |

### Database Migrations

1. Add `batch_id` column to `message_log`
2. Create `message_batches` table with RLS
3. Create `internal_messages` table with RLS (Phase 2)

---

## Role-Based Access

| Feature | Owner | Admin | Teacher | Finance | Parent |
|---------|-------|-------|---------|---------|--------|
| Bulk message all parents | Yes | Yes | No | No | No |
| Filter by location/teacher | Yes | Yes | No | No | No |
| Send to individual guardian | Yes | Yes | Yes* | No | No |
| View sent messages | Yes | Yes | Own | No | Received |
| Internal messaging | Yes | Yes | Yes | No | No |
| Respond to requests | Yes | Yes | No | No | No |

*Teachers can only message guardians of their assigned students

---

## Success Criteria

1. Owner can send "Term fees reminder" to all 247 guardians in one action
2. Owner can filter to "Students at Oakwood Primary" and message just those 52 guardians
3. Every message lands in the guardian's email inbox (not just in-app)
4. Teachers can message admin/owner for support
5. All communications logged with status tracking

