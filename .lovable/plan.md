

# Messaging System: Deep Audit and Enhancement Plan

## Current Architecture

The messaging system has **4 separate subsystems** that don't talk to each other well:

1. **Parent Messages (message_log table)** -- outbound emails from staff to guardians via Resend
2. **Internal Messages (internal_messages table)** -- private staff-to-staff messages
3. **Parent Requests (message_requests table)** -- inbound requests from parents (cancellation, reschedule, general)
4. **Bulk Messages (message_batches + message_log)** -- mass emails to filtered guardian groups

---

## Issues Found

### Issue 1: No clickable context links in messages
Messages have a `related_id` field (stores student ID) and `recipient_id` (stores guardian ID), but **none of this is surfaced as clickable links** in the thread or list views. When reading a thread about "Emma's lesson on Tuesday", you can't click through to Emma's profile, the lesson, or any related invoice. The `EntityChip` component exists in LoopAssist but is never used in the messaging UI.

### Issue 2: Thread view shows no context about WHO or WHAT the message is about
The `ThreadCard` shows subject and recipient name, but doesn't show:
- Which student the message relates to (even though `related_id` stores the student ID)
- Any linked lesson or invoice
- The guardian's linked students for quick reference

### Issue 3: Messages in the flat list view are not clickable/expandable
The `MessageList` component renders each message as a static card with a truncated body (`line-clamp-2`). There's no way to expand a message to read the full content, and no way to reply from the list view.

### Issue 4: Parent Portal "Messages" page only shows requests, not received messages
`PortalMessages.tsx` only fetches from `message_requests` -- it completely ignores emails sent TO the parent (from `message_log`). A parent who receives a message from their teacher has no way to see it in their portal. The `useParentMessages` hook exists but is never used by the portal messages page.

### Issue 5: Internal messages have no threading
Despite `internal_messages` having `thread_id` and `parent_message_id` columns, the `InternalMessageList` renders messages as a flat accordion list with no reply functionality. Staff cannot reply to an internal message -- they must compose a new one.

### Issue 6: No way to reply to messages from the parent portal
Parents can only submit new requests. They cannot reply to admin responses or to messages sent to them. There's no bidirectional conversation.

### Issue 7: Search is disabled in threaded view
On the Messages page, the search input is explicitly `disabled={viewMode === 'threaded'}`. There's no way to search through threaded conversations.

### Issue 8: Thread grouping is fragile
The `useMessageThreads` hook groups by `thread_id`, falling back to using the message's own `id` as a thread. But when a reply is sent, the `thread_id` is set AFTER the message is created (two-step: create via edge function, then update). If the update fails, the reply becomes an orphaned standalone thread.

---

## Enhancement Plan

### Step 1: Add context chips to thread messages
- Import and use the existing `EntityChip` component in `ThreadMessageItem` and `ThreadCard`
- Look up the `related_id` to resolve student name and make it clickable (links to `/students/{id}`)
- Show a "Related Student" chip on the thread header when `related_id` is present
- Show recipient type badge (e.g., "Guardian" chip)

### Step 2: Make the flat MessageList expandable with context
- Convert `MessageList` cards to be expandable (click to show full body)
- Add clickable student link when `related_id` is present
- Add a "Reply" button that opens the compose modal pre-filled with recipient

### Step 3: Fix Parent Portal Messages to show both requests AND received messages
- Update `PortalMessages.tsx` to use tabs: "Inbox" (messages received via `useParentMessages`) and "Requests" (existing request list)
- Add a way for parents to reply to received messages (simple text reply that creates a `message_request` of type "general" or calls the `send-message` edge function if their user has permissions)
- Mark messages as read when viewed (using the existing `useMarkMessagesAsRead` hook which is built but never wired up)

### Step 4: Add threading to internal messages
- Add a "Reply" button to each internal message in the accordion
- When replying, set `thread_id` and `parent_message_id` on the new message
- Group internal messages by thread (similar to how `useMessageThreads` works)

### Step 5: Enable search in threaded view
- Add client-side search filtering to `ThreadedMessageList` that filters threads by subject, recipient name, or message body content
- Remove the `disabled` prop from the search input when in threaded mode

### Step 6: Improve thread reliability
- Update the `send-message` edge function to accept `thread_id` and `parent_message_id` as optional fields, setting them at insert time instead of requiring a second update call
- Remove the two-step pattern from `useReplyToMessage`

---

## Technical Details

### ThreadCard.tsx and ThreadMessageItem.tsx changes:
- Import `EntityChip` from `@/components/looopassist/EntityChip`
- In `ThreadCard`, check if any message in the thread has a `related_id` -- if so, fetch the student name via a lightweight query and render a clickable student chip in the thread header
- Add a new hook `useRelatedEntity(relatedId)` that resolves a UUID to a student name (cached via React Query) for display in chips
- In `ThreadMessageItem`, render a small "context bar" below the header showing related entities

### MessageList.tsx changes:
- Wrap each card in a `Collapsible` component
- When expanded, show full message body (not truncated)
- Add "Reply" and "View Student" action buttons in the expanded state
- Add a "View Student" link using `related_id` when present

### PortalMessages.tsx changes:
- Add `Tabs` with "Inbox" and "My Requests" sections
- Inbox tab: use `useParentMessages()` hook (already exists, never used)
- Wire up `useMarkMessagesAsRead()` in a `useEffect` when inbox messages are displayed
- Add simple reply capability (compose reply that goes through `send-message` edge function)

### InternalMessageList.tsx changes:
- Add a "Reply" button inside each accordion content area
- When replying, include `thread_id` and `parent_message_id` in the insert
- Group messages by thread for visual coherence (show reply chains indented)

### send-message edge function changes:
- Accept optional `thread_id` and `parent_message_id` in the request body
- Include them in the `message_log` insert so threading is atomic (no second update needed)
- This is a one-line change to the insert object

### New hook: useRelatedStudent.ts
- Small hook that takes a `related_id` (student UUID) and returns `{ name, id }` via a cached query
- Used by thread cards and message list items to show "Re: Student Name" context

### Messages.tsx (page) changes:
- Remove `disabled` from search input for threaded mode
- Pass `searchQuery` to `ThreadedMessageList` component
- `ThreadedMessageList` filters threads client-side by matching against subject, recipient name, and message bodies

