
# Rock-Steady System Hardening Plan

## Research Summary: What Goes Wrong in Music School Software

Based on extensive research into My Music Staff, TutorBird, Fons, and teacher forums, here are the critical failure points that cause real damage to music businesses:

### The Big Five Pain Points

1. **Invoicing That Doesn't Add Up** - Balance brought forward is wrong, credits get lost, teachers are out of pocket
2. **Makeup Credit Chaos** - Credits expire silently, get misapplied, or are simply forgotten
3. **Rescheduling Friction** - Parents can't self-serve, back-and-forth messages waste everyone's time
4. **Parent Portal Invisibility** - Parents feel like they're "paying into a void" with no visibility into progress
5. **Multi-Family Confusion** - Divorced parents, multiple guardians, unclear who gets billed vs who gets notified

---

## Part 1: Scheduling & Calendar Hardening

### 1.1 Conflict Detection Gaps to Fix

**Current State:** Good basic detection for teacher/room/student conflicts

**Missing Edge Cases:**
- Student has a lesson at School A, parent tries to book at School B at same time (different org but same student)
- Buffer time between lessons (teacher needs 15 min to travel between locations)
- Room capacity for group lessons (room fits 6, group has 8 students)
- Holiday pattern warnings (every Monday in August is bank holiday but user is booking full term)

**Hardening Actions:**
| Gap | Fix |
|-----|-----|
| Travel buffer | Add `buffer_minutes_between_locations` to org settings; if teacher has lesson at Location A ending at 10:00 and new lesson at Location B starts at 10:15, warn if buffer is 30 min |
| Room capacity | Add `max_capacity` to rooms table; validate group lesson student count against room capacity |
| Closure pattern detection | When creating recurring series, check each date against closures and surface warnings upfront ("3 of your 12 lessons fall on closure dates") |

### 1.2 Recurring Lesson Robustness

**Current State:** Basic weekly recurrence with end date

**Missing:**
- Fortnightly/bi-weekly patterns (very common for beginners)
- "Every Monday and Wednesday" patterns (multi-day per week)
- Skip specific dates without breaking series
- Term-based recurrence (lessons during term time only)

**Hardening Actions:**
| Feature | Implementation |
|---------|----------------|
| Interval weeks | Add `interval_weeks` option (1=weekly, 2=fortnightly) to recurrence UI |
| Multi-day | Already supported in schema (`days_of_week` array) but UI only allows one day - enable multi-select |
| Skip dates | Add `exception_dates` array to recurrence_rules; skip generation for those dates |
| Term-aware | Use closure dates as exclusions when generating series |

### 1.3 Cancellation Flow Hardening

**Current State:** Basic cancel with optional makeup credit

**Missing:**
- Cancellation reason tracking (needed for disputes)
- Differentiate teacher vs student vs school cancellation (affects credit policy)
- Late cancellation warning before commit ("This is within 24 hours - no makeup credit will be issued")
- Automatic parent notification on teacher cancellation

**Hardening Actions:**
| Feature | Implementation |
|---------|----------------|
| Cancellation reason | Add `cancellation_reason` and `cancelled_by` columns to lessons table |
| Policy enforcement | Show clear warning in UI: "Cancelling with less than 24 hours notice - your cancellation policy means no credit will be issued" |
| Auto-notify | When teacher cancels, trigger notification to all participants' guardians |

---

## Part 2: Invoicing & Payment Hardening

### 2.1 The "Ledger Never Lies" Principle

The #1 complaint is invoices that don't match what actually happened. The fix is event-based ledger tracking.

**Current State:** Invoices created manually or via billing run, credits tracked separately

**Missing:**
- No "audit trail" showing exactly how a total was calculated
- Credits can be redeemed without linking to specific invoice line
- Partial payments don't show remaining balance clearly
- Mid-term enrollments cause pro-rata confusion

**Hardening Actions:**
| Issue | Solution |
|-------|----------|
| Audit trail | Add `line_item_audit` field to invoice_items storing source lesson_id, rate_card_id, and calculation method |
| Credit linkage | Already storing `credit_applied_minor` on invoice - ensure this links to specific credit IDs in metadata |
| Balance visibility | Add `amount_paid_minor` and `balance_due_minor` computed fields to invoice queries |
| Pro-rata | When billing run encounters mid-term start, calculate pro-rata with clear notes: "5 of 10 lessons (started mid-term)" |

### 2.2 Overdue Invoice Escalation

**Current State:** Invoice status changes to "overdue" but no automatic action

**Missing:**
- Configurable reminder schedule (7 days overdue, 14 days, 30 days)
- Escalation actions (email at 7d, text at 14d, pause lessons at 30d)
- Late fee calculation option

**Hardening Actions:**
| Feature | Implementation |
|---------|----------------|
| Reminder schedule | Add `overdue_reminder_days` array to org settings (e.g., [7, 14, 30]) |
| Scheduled job | Create edge function triggered by cron to send reminders at configured intervals |
| Auto-pause option | Add `auto_pause_lessons_after_days` setting; if set, mark student as inactive when threshold reached |

### 2.3 Payment Reconciliation Safety

**Current State:** Manual payments recorded, Stripe payments via webhook

**Potential Failure Points:**
- Webhook fails, payment recorded in Stripe but not in LessonLoop
- Double payment recorded (webhook retry)
- Partial payment leaves invoice in ambiguous state

**Hardening Actions:**
| Issue | Solution |
|-------|----------|
| Webhook reliability | Already using idempotent `stripe_session_id` key - add retry logic and dead-letter logging |
| Double payment guard | Check for existing payment with same `provider_reference` before inserting |
| Partial payment clarity | Ensure invoice status remains "sent" until fully paid, add `partially_paid` badge in UI when payments < total |

---

## Part 3: Parent Portal Hardening

### 3.1 What Parents Actually Need (In Order of Priority)

Based on research, parents want:
1. **Next lesson at a glance** - When, where, with whom
2. **Pay outstanding balance** - One tap, no hunting
3. **See what to practice** - Clear assignments from teacher
4. **Request changes** - Cancel/reschedule without email back-and-forth
5. **Track progress** - Visual evidence of improvement

**Current State Assessment:**
| Need | Current | Gap |
|------|---------|-----|
| Next lesson | ChildCard shows next_lesson | Good |
| Pay invoice | Stripe checkout flow exists | Need prominent "Pay Now" button on home |
| Practice | PracticeTimer + assignments exist | Need clearer "This Week's Focus" section |
| Request changes | RequestModal for messages | Need one-tap "Request Reschedule" on each lesson |
| Progress | Practice streak badges | Need visual progress indicator (lessons completed, level progression) |

### 3.2 Self-Service Rescheduling

**Current State:** Parent sends message request, admin responds manually

**The Problem:** Too much friction - parents just don't show up instead

**Hardening Solution:**
1. When parent clicks "Request Reschedule" on a lesson:
   - System checks makeup credit eligibility automatically
   - If eligible, show available slots (filtered by same teacher, same duration)
   - Parent picks new slot
   - System validates conflicts
   - Request submitted with proposed new time
   - Admin can approve with one click (lesson moved automatically)

2. If within cancellation window but no credit:
   - Show clear message: "Cancelling now means no makeup credit per [Studio] policy"
   - Still allow request but mark as "late cancellation"

### 3.3 Payment Visibility & Urgency

**Current State:** Invoices page exists, but parents may not check it

**Missing:**
- Outstanding balance prominently displayed on home
- "Pay Now" button on summary strip
- Overdue indicator with urgency styling
- Payment history for disputes

**Hardening Actions:**
| Feature | Implementation |
|---------|----------------|
| Prominent balance | Already in PortalSummaryStrip - add "Pay Now" button directly next to balance |
| Overdue styling | If overdueInvoices > 0, change balance badge to destructive red with "OVERDUE" label |
| Payment history | Add "Payments" tab showing all historical payments with dates and methods |

### 3.4 Multi-Guardian Support

**Current State:** Primary payer designated, but only one guardian gets communications

**The Problem:** Divorced parents, grandparents who pay - need flexible notification

**Hardening Solution:**
| Role | Receives |
|------|----------|
| Primary Payer | Invoices, payment reminders, billing communications |
| All Linked Guardians | Lesson notes, practice reminders, schedule changes |
| Student (if email exists) | Practice reminders, lesson notes (age-appropriate) |

Add `notification_preferences` to student_guardians table:
- `receives_billing: boolean`
- `receives_schedule: boolean`
- `receives_practice: boolean`

---

## Part 4: Data Integrity Guards

### 4.1 Prevent Orphaned Records

**Potential Issues:**
- Delete student but lessons still reference them
- Delete guardian but they're the primary payer on open invoices
- Delete teacher but they have future lessons

**Hardening Actions:**
| Scenario | Guard |
|----------|-------|
| Delete student | Check for future lessons, unpaid invoices - block with message if exist |
| Delete guardian | Check if primary payer on unpaid invoices - require reassignment first |
| Delete teacher | Check for future lessons - require reassignment first |
| Delete location | Check for future lessons at that location - require move first |

These should be soft-deletes with validation, not hard blocks. UI should guide user through resolution.

### 4.2 Audit Trail Completeness

**Current State:** Basic audit_log table exists

**Missing Logged Events:**
- Invoice sent (currently just created)
- Payment recorded
- Lesson rescheduled (old time, new time)
- Student status changed
- Guardian removed from student

**Hardening:** Ensure all state-changing operations log to audit trail with before/after values.

---

## Implementation Priority

### Phase 1: Critical Safety (Week 1)
1. Cancellation reason tracking on lessons
2. Double payment guard in webhook
3. Prominent "Pay Now" on portal home
4. Overdue badge styling

### Phase 2: Friction Reduction (Week 2)
1. Self-service reschedule request with slot picker
2. Multi-guardian notification preferences
3. "This Week's Focus" practice section on portal

### Phase 3: Advanced Robustness (Week 3)
1. Travel buffer warnings in conflict detection
2. Room capacity validation
3. Closure pattern warnings for recurring series
4. Overdue reminder automation

---

## Technical Changes Summary

### Database Migrations Needed

```text
1. lessons table:
   - Add: cancellation_reason TEXT
   - Add: cancelled_by UUID (references profiles)
   - Add: cancelled_at TIMESTAMPTZ

2. rooms table:
   - Add: max_capacity INTEGER DEFAULT 10

3. organisations table:
   - Add: buffer_minutes_between_locations INTEGER DEFAULT 0
   - Add: overdue_reminder_days INTEGER[] DEFAULT '{7, 14, 30}'
   - Add: auto_pause_lessons_after_days INTEGER

4. student_guardians table:
   - Add: receives_billing BOOLEAN DEFAULT true (for primary payer only)
   - Add: receives_schedule BOOLEAN DEFAULT true
   - Add: receives_practice BOOLEAN DEFAULT true

5. recurrence_rules table:
   - Add: exception_dates DATE[]
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useConflictDetection.ts` | Add travel buffer check, room capacity validation |
| `src/components/calendar/LessonDetailPanel.tsx` | Add cancellation reason prompt, parent notification trigger |
| `src/pages/portal/PortalHome.tsx` | Add "Pay Now" button to summary, overdue styling |
| `src/pages/portal/PortalSchedule.tsx` | Add one-tap reschedule with slot picker |
| `src/components/portal/PortalSummaryStrip.tsx` | Overdue urgency styling |
| `supabase/functions/stripe-webhook/index.ts` | Add double payment guard |
| New: `src/components/portal/RescheduleSlotPicker.tsx` | Self-service slot selection |
| New: `supabase/functions/overdue-reminders/index.ts` | Scheduled reminder emails |

---

## Expected Outcome

After implementation:

1. **No more "my books don't balance"** - Every charge linked to a lesson or explicit fee event
2. **Cancellations are crystal clear** - Who cancelled, when, why, and what credits were issued
3. **Parents can self-serve** - Reschedule requests with proposed times, not open-ended messages
4. **Payments are impossible to miss** - Prominent balance + one-tap pay + urgency styling
5. **Multi-family scenarios work** - Right person gets right notification
6. **Nothing breaks when deleting** - Validation prevents orphaned records

This transforms the system from "works most of the time" to "rock solid for real-world UK music teaching."
