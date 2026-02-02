
# Plan: Create Test Accounts and Test Bidirectional Messaging

## Overview
This plan creates test accounts for each role type (Owner/Admin, Teacher, Parent) and tests the messaging system's bidirectional capabilities across all communication channels.

---

## Messaging System Architecture Summary

Based on the codebase analysis, LessonLoop has **four distinct messaging channels**:

| Channel | Direction | Participants |
|---------|-----------|--------------|
| **Outbound to Parents** | Staff -> Guardian | Owner/Admin sends to parent email (via Resend API) |
| **Bulk Messages** | Staff -> Many Guardians | Owner/Admin only, filtered by location/teacher/status |
| **Internal Messages** | Staff <-> Staff | Owner, Admin, Teacher can message each other |
| **Parent Requests** | Parent -> Staff | Parent submits request, Admin responds (triggers email) |

---

## Phase 1: Create Test Accounts

### 1.1 Create Test Organisation and Owner
Use an existing demo organisation or create a new one via the standard signup flow.

**Recommended approach:** Use Jamie's existing test org (`ab483977-e53b-450a-ab1b-b64c921cae9b`) which already has:
- 15 students with demo data
- 15 guardians (with example.com emails)
- Rate cards, lessons, and invoices

### 1.2 Create Test Teacher Account
Create an invite for a teacher role and accept it with a new user account.

**Steps:**
1. Create invite record in `invites` table for teacher role
2. Create auth user for test teacher
3. Accept invite via `invite-accept` edge function
4. This creates `org_memberships`, `teachers`, and `teacher_profiles` records

**Test Teacher credentials to create:**
- Email: `test-teacher-messaging@lessonloop.test`
- Role: `teacher`

### 1.3 Create Test Parent Account  
Create an invite for a parent role linked to an existing student.

**Steps:**
1. Get a student ID from the demo data
2. Create invite with `related_student_id`
3. Create auth user for test parent
4. Accept invite via `invite-accept` edge function
5. This creates `guardians` record with `user_id` linked

**Test Parent credentials to create:**
- Email: `test-parent-messaging@lessonloop.test`
- Role: `parent`
- Linked to student: Oliver Thompson

---

## Phase 2: Test Messaging Flows

### 2.1 Staff to Parent Messaging (Outbound)
**Test scenario:** Owner sends individual message to parent

1. Login as Owner (Jamie)
2. Navigate to `/messages`
3. Click "New Message" -> "Message Parent"
4. Select test parent guardian
5. Send message with subject and body
6. Verify:
   - Message appears in `message_log` table
   - Status shows "sent" (or "failed" if RESEND_API_KEY not configured)
   - Message appears in threaded view

### 2.2 Bulk Messaging (Owner/Admin only)
**Test scenario:** Owner sends bulk message to all parents

1. Login as Owner
2. Navigate to `/messages`
3. Click "New Message" -> "Bulk Message"
4. Apply filters (or leave default for all active students)
5. Send bulk message
6. Verify:
   - `message_batches` record created
   - Individual `message_log` entries for each guardian
   - Recipient count matches

### 2.3 Internal Staff Messaging
**Test scenario:** Teacher sends message to Owner, Owner replies

1. Login as Test Teacher
2. Navigate to `/messages` -> "Internal" tab
3. Click "New Message" -> "Internal Message"
4. Select Owner as recipient
5. Send message
6. Verify:
   - `internal_messages` record created
   - Unread badge appears for Owner
7. Login as Owner
8. Navigate to "Internal" tab
9. View message, verify "mark as read" works
10. Reply to teacher
11. Login as Teacher, verify reply received

### 2.4 Parent Request Flow (Bidirectional)
**Test scenario:** Parent submits cancellation request, Admin responds

1. Login as Test Parent
2. Navigate to `/portal/messages`
3. Click "New Request"
4. Submit cancellation request for a lesson
5. Verify:
   - `message_requests` record created with status "pending"
6. Login as Owner/Admin
7. Navigate to `/messages` -> "Parent Requests" tab
8. View pending request
9. Click "Approve" or "Decline" with response
10. Verify:
   - Status updated in `message_requests`
   - Email notification sent to parent (via send-message edge function)
   - Message logged in `message_log`
11. Login as Parent
12. Navigate to `/portal/messages`
13. Verify response visible with admin_response text

---

## Phase 3: Implementation Steps

### Step 1: Create Edge Function for Test Account Setup
Create `supabase/functions/create-test-messaging-accounts/index.ts` that:
- Creates auth users with test credentials
- Creates invites for teacher and parent roles
- Accepts invites programmatically
- Links parent to existing student
- Returns credentials for manual testing

### Step 2: Seed Test Data
Add to the edge function:
- Pre-populate some internal messages
- Pre-populate some message requests
- Pre-populate some outbound messages in message_log

### Step 3: Manual Testing Checklist
After running the setup function:

**Owner/Admin Tests:**
- [ ] Send individual message to parent
- [ ] Send bulk message
- [ ] Send internal message to teacher
- [ ] Respond to parent request

**Teacher Tests:**
- [ ] View Messages page (should see "Sent to Parents" and "Internal" tabs)
- [ ] Should NOT see "Parent Requests" tab (admin only)
- [ ] Should NOT see "Bulk Message" option (admin only)
- [ ] Send internal message to owner
- [ ] Receive and read internal message

**Parent Tests:**
- [ ] View portal messages page
- [ ] Submit new request (general, cancellation, reschedule)
- [ ] View request status and admin response

---

## Technical Implementation Details

### Database Changes Required
None - all tables already exist:
- `profiles`, `org_memberships`, `guardians`, `invites`
- `message_log`, `internal_messages`, `message_requests`, `message_batches`

### Edge Function: create-test-messaging-accounts

```text
Location: supabase/functions/create-test-messaging-accounts/index.ts

Inputs:
- org_id: Target organisation UUID
- owner_user_id: Existing owner to verify permissions

Outputs:
- teacher_credentials: { email, password, user_id }
- parent_credentials: { email, password, user_id, guardian_id, student_id }
- seeded_data: { internal_messages_count, message_requests_count }
```

### Test Credentials (Recommended)

| Role | Email | Password |
|------|-------|----------|
| Teacher | `test-teacher-msg@lessonloop.test` | `TestTeacher2026!` |
| Parent | `test-parent-msg@lessonloop.test` | `TestParent2026!` |

---

## Validation Criteria

### Success Metrics
1. All four messaging channels function bidirectionally
2. Role-based access controls enforce:
   - Teachers cannot send bulk messages
   - Teachers cannot view/respond to parent requests
   - Parents can only access portal routes
3. Email notifications sent (or logged as failed if no RESEND_API_KEY)
4. All messages properly logged in respective tables
5. Unread counts update correctly

### Edge Cases to Test
- Send to guardian with no email (should fail gracefully)
- Rate limiting on bulk messages
- Threading works for reply chains
- Read receipts update unread counts
