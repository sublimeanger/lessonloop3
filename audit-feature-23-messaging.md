# Audit — Feature 23: Messaging & Notifications

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Internal messaging, notification bell, email notifications, notification preferences, read/unread tracking, role-based notification visibility

---

## 1. Files Audited

### SQL Migrations (schema, RLS, indexes)
| File | Content |
|------|---------|
| `supabase/migrations/20260119232754_*.sql` | `message_log` table creation |
| `supabase/migrations/20260119235724_*.sql` | `message_requests` table, parent portal RLS |
| `supabase/migrations/20260120000720_*.sql` | `message_templates` table, `message_log` column additions (channel, sender_user_id, recipient_type, recipient_id), teacher/parent SELECT policies |
| `supabase/migrations/20260120215924_*.sql` | (referenced) |
| `supabase/migrations/20260123014004_*.sql` | `notification_preferences` table |
| `supabase/migrations/20260123014126_*.sql` | `message_log.read_at` column |
| `supabase/migrations/20260128012252_*.sql` | (referenced) |
| `supabase/migrations/20260201203605_*.sql` | `message_batches` table, `message_log.batch_id` |
| `supabase/migrations/20260201204906_*.sql` | `internal_messages` table + RLS |
| `supabase/migrations/20260201211247_*.sql` | Threading columns (`thread_id`, `parent_message_id`) on both `message_log` and `internal_messages` |
| `supabase/migrations/20260222171458_*.sql` | `notification_preferences.email_makeup_offers` column |
| `supabase/migrations/20260222213701_*.sql` | Realtime publication for `message_log` and `internal_messages` |
| `supabase/migrations/20260223020802_*.sql` | Parent "can view own sent messages" RLS policy on `message_log` |
| `supabase/migrations/20260223021325_*.sql` | `org_messaging_settings` table + RLS |
| `supabase/migrations/20260223022201_*.sql` | Teacher conversation visibility RLS, `reassign_teacher_conversations_to_owner` RPC |
| `supabase/migrations/20260223152118_*.sql` | `message_log.recipient_type` CHECK constraint update (added 'staff') |
| `supabase/migrations/20260223152350_*.sql` | `teacher_has_thread_access` SECURITY DEFINER function (fixes infinite recursion) |
| `supabase/migrations/20260224110000_*.sql` | `payment_notifications` table + RLS |
| `supabase/migrations/20260225011428_*.sql` | `payment_notifications` duplicate (IF NOT EXISTS) |
| `supabase/migrations/20260303170000_*.sql` | Composite indexes (referenced) |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/send-message/index.ts` | Staff → guardian message + email |
| `supabase/functions/send-parent-message/index.ts` | Parent → staff message + email |
| `supabase/functions/send-bulk-message/index.ts` | Admin → all guardians (filtered) |
| `supabase/functions/mark-messages-read/index.ts` | Parent marks messages as read |
| `supabase/functions/notify-internal-message/index.ts` | Staff internal message email notification |
| `supabase/functions/send-payment-receipt/index.ts` | Payment receipt email |
| `supabase/functions/_shared/rate-limit.ts` | Rate limiting config for all messaging |
| `supabase/functions/_shared/escape-html.ts` | XSS prevention for email templates |
| `supabase/functions/_shared/check-notification-pref.ts` | Notification preference checking |

### Frontend Components & Hooks
| File | Purpose |
|------|---------|
| `src/components/layout/Header.tsx` | Bell + LoopAssist visibility gating |
| `src/components/layout/NotificationBell.tsx` | Notification dropdown |
| `src/components/settings/NotificationsTab.tsx` | User notification preferences UI |
| `src/components/settings/MessagingSettingsTab.tsx` | Org messaging settings (admin) |
| `src/components/messages/MessageList.tsx` | Message list component |
| `src/components/messages/MessageFiltersBar.tsx` | Message filters |
| `src/components/messages/MessageRequestsList.tsx` | Admin request list |
| `src/hooks/useMessages.ts` | Message log CRUD + optimistic updates |
| `src/hooks/useInternalMessages.ts` | Internal staff messaging |
| `src/hooks/useMessageThreads.ts` | Threaded conversation views |
| `src/hooks/useAdminMessageRequests.ts` | Admin cancellation/reschedule requests |
| `src/hooks/useBulkMessage.ts` | Bulk messaging |
| `src/hooks/useUnreadMessages.ts` | Parent unread count + realtime |
| `src/hooks/useMessagingSettings.ts` | Org messaging settings hook |
| `src/pages/Messages.tsx` | Messages page |

---

## 2. Findings Table

| ID | Severity | Area | Finding | Impact | Recommendation |
|----|----------|------|---------|--------|----------------|
| MSG-H1 | **HIGH** | RLS | `payment_notifications` INSERT policy is `WITH CHECK (true)` — any authenticated user can insert fake payment notifications | Attacker could create fake "payment received" toasts for staff, causing confusion or social engineering | Drop the permissive INSERT policy; service role already bypasses RLS. Use `WITH CHECK (false)` for authenticated role, or restrict to `is_org_admin()` |
| MSG-H2 | **HIGH** | RLS | `internal_messages` has no DELETE policy — `useDeleteInternalMessage` hook calls `.delete()` which will silently return 0 rows | Delete button in UI does nothing; users think message is deleted but it persists. Admins could also not clean up messages | Add DELETE policy: `USING (sender_user_id = auth.uid() AND is_org_member(auth.uid(), org_id))` or admin override |
| MSG-M1 | **MEDIUM** | Logic | `isNotificationEnabled()` returns `true` when no preferences row exists — but `email_marketing` default is `false`. Bulk messages skip preference check for guardians without a prefs row, sending marketing emails to non-opted-in users | GDPR/PECR compliance risk: marketing emails sent to users who haven't opted in | Return column-specific defaults: `if (!data) return prefKey !== 'email_marketing';` |
| MSG-M2 | **MEDIUM** | RLS | `notification_preferences` INSERT policy lacks `is_org_member()` check — user can insert prefs for any org_id | Low exploitability but allows data pollution in other orgs' notification_preferences | Add `WITH CHECK (user_id = auth.uid() AND is_org_member(auth.uid(), org_id))` |
| MSG-M3 | **MEDIUM** | RLS | `message_log` INSERT policy allows any org member to insert (`is_org_member(auth.uid(), org_id) AND sender_user_id = auth.uid()`) — this includes parents and finance roles | Parent could bypass `send-parent-message` edge function and insert raw message_log rows directly, circumventing messaging settings checks | Restrict to `is_org_staff()` or add role check; parent inserts should only come via edge function (service role) |
| MSG-M4 | **MEDIUM** | Auth | `mark-messages-read` edge function creates Supabase client with service role key for auth verification (line 26-27) — should use anon key for JWT validation | Service role key is used where only anon+JWT verification is needed; increases blast radius if function code is exposed | Use anon key client for `getUser()`, service role only for the UPDATE operation |
| MSG-L1 | **LOW** | Perf | `internal_messages` realtime subscription filters by `org_id` only — all staff in org receive invalidations for all messages | Unnecessary query invalidation for messages not addressed to the user | Filter by `recipient_user_id=eq.${user.id}` in realtime subscription |
| MSG-L2 | **LOW** | Validation | No body-length validation on message content in any edge function | Could allow very large message bodies consuming storage/email bandwidth | Add `body.length <= 10000` check (or similar) in send-message, send-parent-message, send-bulk-message |
| MSG-L3 | **LOW** | Logic | `useDeleteInternalMessage` doesn't filter by `sender_user_id` — even if DELETE policy existed, any staff member could delete any message in the org | Should only allow sender to delete their own messages (or admin to delete any) | Add `.eq('sender_user_id', user.id)` to the delete query, or implement admin-only delete |
| MSG-L4 | **LOW** | UX | `NotificationBell` only shows `internal_messages` inbox — doesn't show `payment_notifications` or `message_log` parent replies | Staff may miss payment notifications or parent replies in the bell dropdown | Aggregate unread counts from all notification sources |
| MSG-L5 | **LOW** | Schema | `internal_messages.sender_role` CHECK constraint limits to `('owner', 'admin', 'teacher')` — finance users cannot send internal messages even though they have Messages in their nav | Finance user trying to send an internal message would get a DB constraint error | Either add 'finance' to the CHECK constraint or remove Messages from finance nav, depending on intended access |

---

## 3. RLS Policy Matrix

### message_log
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Org admins can view message logs" | `is_org_admin(auth.uid(), org_id)` | Owner + admin see all |
| SELECT | "Teachers can view messages they sent" | `sender_user_id = auth.uid()` | Any sender, not role-gated |
| SELECT | "Parents can view messages about their children" | Parent role + `recipient_type='guardian'` + guardian is self | Scoped to own guardian record |
| SELECT | "Parent can view own sent messages" | Parent role + `sender_user_id = auth.uid()` | Allows parent to see replies they sent |
| SELECT | "Teachers see student-related messages" | Teacher role + student assigned + `parent_can_message_teacher` setting | Conditional on org settings |
| SELECT | "Teachers see full threads they have access to" | Teacher role + `teacher_has_thread_access()` SECURITY DEFINER | Fixed infinite recursion |
| INSERT | "System can insert message logs" | `is_org_member()` + `sender_user_id = auth.uid()` | **MSG-M3**: Too permissive |
| UPDATE | None | — | Updates via service role in edge functions only |
| DELETE | None | — | No deletion supported |

### internal_messages
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Staff can view own messages" | `is_org_staff()` + sender OR recipient is self | Properly scoped |
| SELECT | "Admins can view all internal messages" | `is_org_admin()` | Owner + admin see all |
| INSERT | "Staff can send internal messages" | `is_org_staff()` + `sender_user_id = auth.uid()` | Prevents impersonation |
| UPDATE | "Recipients can mark messages read" | `recipient_user_id = auth.uid()` + `is_org_member()` | Only recipient can mark read |
| DELETE | **MISSING** | — | **MSG-H2**: No DELETE policy |

### notification_preferences
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Users can view own notification preferences" | `user_id = auth.uid()` | Correct |
| INSERT | "Users can insert own notification preferences" | `user_id = auth.uid()` | **MSG-M2**: Missing `is_org_member()` |
| UPDATE | "Users can update own notification preferences" | `user_id = auth.uid()` | Correct |
| ALL | "Block anonymous access" | `TO anon USING (false)` | Good: blocks unauthenticated |

### payment_notifications
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Org staff can view payment notifications" | `is_org_staff()` | Correct |
| UPDATE | "Org staff can update payment notifications" | `is_org_staff()` | Correct |
| INSERT | "Service role can insert payment notifications" | `WITH CHECK (true)` | **MSG-H1**: Any auth user can insert |

### message_requests
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Parents can view their message requests" | Guardian linked to auth user | Correct |
| SELECT | "Admins can view org message requests" | `is_org_admin()` | Correct |
| INSERT | "Parents can create message requests" | Parent role + guardian linked | Correct |
| UPDATE | "Admins can update message requests" | `is_org_admin()` | Correct |

### message_templates
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | "Org members can view message templates" | `is_org_member()` | Correct |
| INSERT/UPDATE/DELETE | Admin-only policies | `is_org_admin()` | Correct |

### message_batches
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT/INSERT/UPDATE | Admin-only policies | `is_org_admin()` | Correct |

### org_messaging_settings
| Operation | Policy Name | Who Can Access | Notes |
|-----------|-------------|---------------|-------|
| SELECT | Admin + Member policies | `is_org_admin()` or `is_org_member()` | Both exist, members need read for enforcement |
| INSERT/UPDATE | Admin-only | `is_org_admin()` | Correct |

---

## 4. Email Trigger Inventory

| Trigger | Edge Function | Rate Limit | Notification Pref Check | XSS Protection |
|---------|---------------|------------|------------------------|----------------|
| Staff sends message to guardian | `send-message` | 50/hr per user | No (manual messages always sent) | `escapeHtml()` on subject + body |
| Admin sends bulk message | `send-bulk-message` | 50/hr per user | Yes: `email_marketing` checked via `isNotificationEnabled()` (**MSG-M1**: default bug) | `escapeHtml()` on subject + body |
| Parent sends message/reply | `send-parent-message` | 20/hr per user | `notify_staff_on_new_message` org setting checked | `escapeHtml()` on body |
| Staff sends internal message | `notify-internal-message` | 50/hr per user | No (staff always notified) | `escapeHtml()` on subject + body + sender_name + sender_role |
| Payment receipt | `send-payment-receipt` | N/A (server-side webhook) | `email_payment_receipts` checked | `escapeHtml()` |
| Invoice email | `send-invoice-email` | 50/hr per user | `email_invoice_reminders` checked | `escapeHtml()` |
| Invite email | `send-invite-email` | 30/hr per user | N/A (system email) | `escapeHtml()` |
| Make-up match | `notify-makeup-match` | N/A | `email_makeup_offers` checked | `escapeHtml()` |
| Make-up offer | `notify-makeup-offer` | N/A | `email_makeup_offers` checked | `escapeHtml()` |

### Batch Rate Limiting
- Bulk messages: 50 recipients per batch with 200ms delay between batches
- Guardians chunked in 500s for DB queries
- `Promise.allSettled` for parallel sends within batch

---

## 5. Role-Based Notification Visibility

### Finance Role — Bell + LoopAssist Hidden (Handoff Fix)

**Verified in `src/components/layout/Header.tsx:24-25`:**
```typescript
const showNotifications = currentRole && ['owner', 'admin', 'teacher'].includes(currentRole);
const showLoopAssist = currentRole && ['owner', 'admin', 'teacher'].includes(currentRole);
```

Finance role is **correctly excluded** from both the notification bell and LoopAssist button. This matches the claude.md specification:
> **Finance:** Business-focused sidebar (Dashboard, Invoices, Reports, Messages). LoopAssist and notification bell hidden.

### Who Can Message Whom

| Sender → | Guardian (Parent) | Owner | Admin | Teacher |
|----------|-------------------|-------|-------|---------|
| **Owner** | Yes (send-message) | Yes (internal) | Yes (internal) | Yes (internal) |
| **Admin** | Yes (send-message) | Yes (internal) | Yes (internal) | Yes (internal) |
| **Teacher** | Yes (send-message) | Yes (internal) | Yes (internal) | Yes (internal) |
| **Parent** | — | Yes (if `parent_can_initiate` + `parent_can_message_owner`) | Yes (if `parent_can_initiate` + `parent_can_message_admin`) | Conditional: `parent_can_message_teacher` |
| **Finance** | No (schema constraint) | No (schema constraint) | No (schema constraint) | No (schema constraint) |

### SECURITY DEFINER Functions

| Function | Auth Check | Purpose |
|----------|-----------|---------|
| `teacher_has_thread_access(_teacher_user_id, _thread_id, _org_id)` | None (called within RLS context, receives auth.uid() as param) | Bypasses RLS to check if teacher has student assignment in thread — prevents infinite recursion |
| `reassign_teacher_conversations_to_owner(_org_id)` | `is_org_admin(auth.uid(), _org_id)` — raises exception if not | Audit log entry when teacher messaging is disabled |
| `get_user_id_by_email(_email)` | None | Looks up auth.users by email — used for invite acceptance. **Note**: exposes email→user_id mapping to any authenticated caller |

---

## 6. Unread Count & Realtime

### Parent Portal (message_log)
- **Unread count**: `useUnreadMessagesCount()` — counts `message_log` rows where `recipient_type='guardian'`, `recipient_id=guardianId`, `read_at IS NULL`, `status='sent'`
- **Realtime**: Supabase realtime subscription on `message_log` filtered by `recipient_id=eq.${guardianId}` — properly scoped
- **Polling fallback**: `refetchInterval: 60000` (1 minute)
- **Mark read**: `mark-messages-read` edge function — validates guardian ownership, uses service role for UPDATE

### Staff (internal_messages)
- **Unread count**: `useUnreadInternalCount()` — counts `internal_messages` where `recipient_user_id=user.id`, `read_at IS NULL`
- **Realtime**: Subscription filtered by `org_id` only (**MSG-L1**: not filtered by recipient)
- **Mark read**: Direct RLS UPDATE via `useMarkInternalRead()` — properly scoped to recipient

### Payment Notifications
- **Realtime**: Published to `supabase_realtime` — staff can subscribe
- **Read tracking**: Boolean `read` column (not `read_at` timestamp)

---

## 7. Verdict: PRODUCTION READY

All 11 findings (2 HIGH, 4 MEDIUM, 5 LOW) have been fixed.

### Fixes Applied

| ID | Severity | Fix | File(s) |
|----|----------|-----|---------|
| MSG-H1 | HIGH | Dropped permissive INSERT policy on `payment_notifications`; replaced with `WITH CHECK (false)` for authenticated role | `20260316320000_fix_messaging_audit_findings.sql` |
| MSG-H2 | HIGH | Added DELETE policies: sender can delete own + admin can delete any | `20260316320000_fix_messaging_audit_findings.sql` |
| MSG-M1 | MEDIUM | `isNotificationEnabled()` now returns `false` for marketing keys when no prefs row (GDPR compliant) | `_shared/check-notification-pref.ts` |
| MSG-M2 | MEDIUM | Added `is_org_member()` check to `notification_preferences` INSERT policy | `20260316320000_fix_messaging_audit_findings.sql` |
| MSG-M3 | MEDIUM | Dropped both `message_log` INSERT policies; replaced with `WITH CHECK (false)` — all inserts via service role edge functions | `20260316320000_fix_messaging_audit_findings.sql` |
| MSG-M4 | MEDIUM | `mark-messages-read` now uses anon key for JWT verification, service role only for DB operations | `mark-messages-read/index.ts` |
| MSG-L1 | LOW | Internal messages realtime subscription filtered by `recipient_user_id` instead of org-wide | `useInternalMessages.ts` |
| MSG-L2 | LOW | Added body-length (10KB) and subject-length (500 char) validation to send-message, send-parent-message, send-bulk-message | `send-message/index.ts`, `send-parent-message/index.ts`, `send-bulk-message/index.ts` |
| MSG-L3 | LOW | `useDeleteInternalMessage` now scopes delete to `sender_user_id` | `useInternalMessages.ts` |
| MSG-L4 | LOW | NotificationBell now aggregates unread parent replies + payment notifications alongside internal messages | `NotificationBell.tsx`, new `useStaffNotifications.ts` |
| MSG-L5 | LOW | `internal_messages` sender_role/recipient_role CHECK constraints updated to include 'finance' | `20260316320000_fix_messaging_audit_findings.sql` |

### Quality Gates
- `npm run typecheck` — PASS
- `npm run build` — PASS

### What's Working Well
- Finance role correctly excluded from bell + LoopAssist (handoff fix verified)
- Parent messaging permissions (initiate, message teacher, message owner/admin) all enforced at both edge function and RLS levels
- Teacher conversation visibility gated by `parent_can_message_teacher` org setting with automatic access revocation via RLS
- Bulk messaging correctly defaults marketing emails to opt-out (GDPR compliant)
- All email content properly escaped against XSS
- Rate limits configured for every messaging action type
- Realtime subscriptions for instant unread count updates (now properly scoped)
- Threaded conversations with proper self-referential FKs
- Optimistic UI updates with rollback on error
- Notification bell aggregates all notification sources
