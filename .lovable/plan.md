

# Messaging System Stress Test: Seed Data + Bug Fixes

## Overview

After a deep audit of the messaging system, I'll create an edge function to seed comprehensive test data covering all messaging scenarios, and fix the bugs discovered during the audit.

---

## Bugs and Issues Found

### Bug 1: No messages have `related_id` (student context) set
All 15 existing messages in `message_log` have `related_id = NULL`. The EntityChip feature we built (clickable student links in threads) has zero data to work with. The seeder never populated this field, and the compose modal only sets it when `studentId` is passed as a prop (which only happens from the Student Detail page, not from the Messages page compose flow).

### Bug 2: No messages use threading (`thread_id` is always NULL)
All 15 existing messages have `thread_id = NULL`. The entire threaded view feature shows every message as a standalone thread with 1 message each. Users cannot see conversation flow.

### Bug 3: Internal message threading has `parent_message_id` always NULL
Despite the seeder creating "Re:" replies in internal messages, it never sets `thread_id` or `parent_message_id`, so replies appear as standalone messages rather than grouped threads.

### Bug 4: EntityChip click propagation conflict in ThreadCard
When a user clicks the EntityChip (student link) inside a `CollapsibleTrigger`, the click both navigates to the student page AND toggles the collapsible. The `onClick` on EntityChip doesn't call `e.stopPropagation()`.

### Bug 5: MessageList `onReply` callback is never wired
On the Messages page, `MessageList` accepts an `onReply` prop to open the compose modal pre-filled, but the Messages page never passes this prop. The "Reply" button in list view does nothing because `onReply` is undefined.

### Bug 6: Compose modal cannot attach student context from Messages page
When composing a message from the Messages page (not from Student Detail), there's no way to link a student to the message. The `related_id` field is only populated when `studentId` is passed as a prop, which only happens from the Student Detail page.

### Bug 7: All seeded messages share the same timestamp
All 15 messages in `message_log` have identical `created_at` timestamps (`2026-02-07 11:41:00`), making it impossible to distinguish ordering in the UI.

---

## Implementation Plan

### Step 1: Create `seed-messaging-stress-test` edge function

Creates a new edge function that seeds ~80+ messages across all 4 subsystems with realistic, varied data:

**Parent Messages (message_log) -- ~30 messages:**
- 6 standalone messages to different guardians with `related_id` set to their linked students
- 4 multi-message threads (3-4 messages each) with proper `thread_id` chaining, demonstrating conversations about lesson progress, billing queries, schedule changes, and practice concerns
- Each message has unique timestamps spread across the past 2 weeks
- Mix of statuses: `sent`, `pending`, `failed`
- Mix of message types: `manual`, `invoice_reminder`, `lesson_confirmation`, `practice_update`

**Internal Messages -- ~20 messages:**
- 3 threaded conversations (2-4 messages each) between owner and different teachers
- Topics: room booking conflicts, student progress reports, term planning, holiday cover
- Proper `thread_id` and `parent_message_id` set on replies
- Mix of read/unread states (some `read_at` set, some NULL)

**Parent Requests (message_requests) -- ~8 requests:**
- 2 pending cancellation requests with student and lesson IDs linked
- 1 pending reschedule request  
- 1 pending general enquiry
- 2 approved requests (with `admin_response` filled)
- 1 declined request
- 1 resolved request

**Bulk Message Batch -- 1 batch:**
- Create a `message_batch` entry
- Link 5 messages from `message_log` to it via `batch_id`

### Step 2: Fix EntityChip click propagation (ThreadCard.tsx)

Add `e.stopPropagation()` wrapper around the EntityChip inside the `CollapsibleTrigger` in `ThreadCard.tsx`, so clicking the student chip navigates without toggling the thread open/closed.

### Step 3: Wire up `onReply` in Messages page

In `Messages.tsx`, pass an `onReply` callback to `MessageList` that opens the compose modal pre-filled with the recipient's details.

### Step 4: Add student selector to compose modal

Add an optional "Related Student" dropdown to `ComposeMessageModal` that lets users link a message to a student. When a guardian is selected, auto-populate the dropdown with their linked students.

---

## Technical Details

### New Edge Function: `supabase/functions/seed-messaging-stress-test/index.ts`
- Accepts `{ org_id }` in body
- Requires JWT auth, verifies caller is org owner
- Uses service role to insert data directly into:
  - `message_log` (30+ rows with varied timestamps, threading, related_id)
  - `internal_messages` (20+ rows with threading)
  - `message_requests` (8 rows with varied statuses and linked lessons)
  - `message_batches` (1 row)
- Returns summary counts of all seeded data
- All timestamps are staggered across the past 14 days for realistic ordering
- Uses actual guardian IDs, student IDs, and lesson IDs from the org's existing data

### ThreadCard.tsx fix:
- Wrap EntityChip in a `<span onClick={e => e.stopPropagation()}>` inside the CollapsibleTrigger area

### Messages.tsx changes:
- Add state for reply target: `const [replyTarget, setReplyTarget] = useState<MessageLogEntry | null>(null)`
- Pass `onReply={setReplyTarget}` to `MessageList`
- When `replyTarget` is set, open `ComposeMessageModal` with pre-filled guardian

### ComposeMessageModal.tsx changes:
- Add a "Related Student" `Select` field that queries `student_guardians` for the selected guardian
- Auto-populate when guardian changes
- Pass the selected student ID as `related_id` to `useSendMessage`

