
# LoopAssist World-Class Upgrade Plan

## Executive Summary

LoopAssist is currently a solid AI assistant, but has significant room to become truly world-class. This plan addresses immediate issues (markdown formatting) and introduces substantial capability upgrades to make it a genuine differentiator.

---

## Current State Assessment

### What Works Well
- Context-aware (detects current page, student, invoice)
- Streaming responses for fast feedback
- Action proposals with confirm/cancel workflow
- Entity citations that link to records
- Rate limiting and security controls

### Critical Gaps Identified

1. **Formatting Issue**: Responses use markdown bold (`**text**`) when plain text is preferred
2. **Limited Actions**: Only 4 actions implemented (billing run, reminders, reschedule, draft email) vs 6+ documented
3. **No Metrics Persistence**: Feedback (thumbs up/down) shows toast but doesnt save to database
4. **Shallow Context**: Misses attendance history, practice streaks, rate cards, cancellations
5. **No Proactive Insights**: User must always ask; AI never surfaces issues unprompted
6. **No Quick Actions from Chat**: Cant execute common one-liners without full action proposal
7. **Limited Student Intelligence**: Misses practice data, lesson history, notes for student pages

---

## Implementation Plan

### Phase 1: Fix Formatting + Enhanced Context

**Goal**: Plain text responses and richer data for smarter answers

#### 1.1 Update System Prompt
File: `supabase/functions/looopassist-chat/index.ts`

Add formatting directive to SYSTEM_PROMPT:
- NEVER use markdown formatting (no `**bold**`, `_italic_`, `#headings`, bullet points with `-`)
- Write in plain conversational text
- Use line breaks for separation, not special characters
- Keep responses natural and readable

#### 1.2 Expand Data Context
File: `supabase/functions/looopassist-chat/index.ts`

Add to `buildDataContext` function:
- Recent cancellations (last 7 days) with reasons
- Attendance summary (completion rate this month)
- Rate cards (default rates for context)
- Payment summary (received this week, methods)
- Practice streaks for student context
- Teacher workload summary (lesson counts)

---

### Phase 2: Implement Missing Actions

**Goal**: Complete the action toolkit so LoopAssist can do more

#### 2.1 Add `mark_attendance` Action
File: `supabase/functions/looopassist-execute/index.ts`

New function `executeMarkAttendance`:
- Accept lesson_id and attendance records
- Mark individual students as present/absent/late
- Update lesson status if all marked
- Log to audit trail

#### 2.2 Add `cancel_lesson` Action
New action type for cancelling lessons:
- Accept lesson_ids and reason
- Update lesson status to cancelled
- Optionally notify participants
- Issue make-up credits if configured

#### 2.3 Add `complete_lessons` Action
Bulk completion for end-of-day:
- Accept lesson_ids
- Mark all as completed
- Great for "Mark all today's lessons as complete"

#### 2.4 Add `send_progress_report` Action
Student progress communication:
- Accept student_id, guardian_id
- Generate summary of recent lessons, attendance, practice
- Create draft or send directly

#### 2.5 Update System Prompt
Add these new action types to the SYSTEM_PROMPT with proper parameters and trigger phrases.

---

### Phase 3: Metrics + Learning

**Goal**: Track what works and improve over time

#### 3.1 Create `ai_interaction_metrics` Table
Migration to create:
- id (uuid)
- org_id (uuid)
- message_id (uuid, references ai_messages)
- conversation_id (uuid)
- user_id (uuid)
- feedback (text: helpful/not_helpful)
- response_time_ms (integer)
- action_proposed (boolean)
- action_executed (boolean)
- created_at (timestamptz)

#### 3.2 Update MessageFeedback Component
File: `src/components/looopassist/MessageFeedback.tsx`

Persist feedback to database:
- Insert into ai_interaction_metrics on thumbs click
- Track which messages get positive/negative feedback
- Optional: free-text feedback for "not helpful"

#### 3.3 Log Response Metrics
File: `src/hooks/useLoopAssist.ts`

Track performance:
- Measure time from message send to first chunk
- Log whether action was proposed
- Log whether proposed action was executed or cancelled

---

### Phase 4: Proactive Intelligence

**Goal**: LoopAssist surfaces issues without being asked

#### 4.1 Opening Message Intelligence
File: `src/components/looopassist/LoopAssistDrawer.tsx`

When drawer opens with no active conversation:
- Fetch quick stats (overdue count, today's lessons, cancellations)
- Show proactive alert cards:
  - "3 invoices are overdue - want me to send reminders?"
  - "2 lessons were cancelled this week without rescheduling"
  - "Lesson with [Student] is in 30 minutes"

#### 4.2 Context-Aware Suggestions
File: `src/components/looopassist/LoopAssistDrawer.tsx`

Improve `getSuggestedPrompts` function:
- On student page with overdue invoice: "Send payment reminder for this student"
- On calendar with past lessons unmarked: "Mark yesterday's lessons as complete"
- On invoices page: "Show me aging report" or "What's our collection rate?"

#### 4.3 Smart Alerts Badge
File: `src/components/layout/Header.tsx` (or sidebar)

Show badge on LoopAssist button when issues exist:
- Red dot if critical (overdue invoices 30+ days)
- Number badge for action items

---

### Phase 5: Enhanced Student Context

**Goal**: When viewing a student, LoopAssist knows everything

#### 5.1 Deep Student Context Fetch
File: `supabase/functions/looopassist-chat/index.ts`

When `context.type === 'student'`:
- Lesson history (last 10 lessons with attendance)
- Practice streaks and recent logs
- All linked guardians with contact info
- All invoices (paid, outstanding, overdue)
- Teacher assignments
- Notes and flags
- Make-up credits available

#### 5.2 Student-Specific Actions
Enable natural requests like:
- "Draft a progress update for [Student]'s parents"
- "How many lessons has [Student] had this term?"
- "What's [Student]'s practice streak?"
- "Issue a make-up credit for the missed lesson"

---

### Phase 6: Quick Commands

**Goal**: One-liner commands that execute instantly (no action card needed)

#### 6.1 Implement Quick Command Recognition
File: `supabase/functions/looopassist-chat/index.ts`

Detect simple commands that can be answered immediately:
- "How many students do I have?" - just answer
- "What's outstanding?" - summarise without action card
- "Total revenue this month?" - calculate and respond

Criteria for quick response (no action card):
- Read-only query
- Single number or short list answer
- No user confirmation needed

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/looopassist-chat/index.ts` | Update SYSTEM_PROMPT (plain text), expand buildDataContext, deep student context |
| `supabase/functions/looopassist-execute/index.ts` | Add mark_attendance, cancel_lesson, complete_lessons, send_progress_report |
| `src/components/looopassist/MessageFeedback.tsx` | Persist feedback to ai_interaction_metrics |
| `src/components/looopassist/LoopAssistDrawer.tsx` | Proactive alerts, smarter suggested prompts, alert badge |
| `src/hooks/useLoopAssist.ts` | Track response time, action metrics |
| New migration | Create ai_interaction_metrics table |

---

## Technical Details

### Updated SYSTEM_PROMPT (Key Addition)

```text
RESPONSE FORMATTING:
- Write in plain text only
- NEVER use markdown syntax: no **, no _, no #, no - bullets
- Use natural paragraph breaks for readability
- Entity citations [Invoice:X] are the only special syntax allowed
- Be conversational and direct
```

### New Actions for SYSTEM_PROMPT

```text
5. mark_attendance - Record attendance for a lesson
   params: { "lesson_id": "...", "records": [{"student_id": "...", "status": "present|absent|late"}] }

6. cancel_lesson - Cancel scheduled lessons
   params: { "lesson_ids": ["..."], "reason": "...", "notify": true|false, "issue_credit": true|false }

7. complete_lessons - Mark lessons as completed
   params: { "lesson_ids": ["..."] }

8. send_progress_report - Generate and send progress report
   params: { "student_id": "...", "period": "week|month|term", "send_immediately": true|false }
```

### Proactive Alerts Data Structure

```typescript
interface ProactiveAlert {
  type: 'overdue' | 'cancellation' | 'upcoming' | 'unmarked';
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  suggestedAction?: string;
  count?: number;
}
```

---

## Expected Outcome

After implementation, LoopAssist will:

1. Respond in clean, readable plain text (no markdown symbols)
2. Execute 8+ action types covering full workflow
3. Track user feedback to identify improvement areas
4. Proactively alert users to issues when they open the drawer
5. Know everything about a student when viewing their profile
6. Answer simple questions instantly without action cards

This transforms LoopAssist from "helpful chatbot" to "indispensable AI operations manager" that genuinely saves time and catches issues before they become problems.
