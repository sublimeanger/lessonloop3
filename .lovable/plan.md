
# Scheduling System Critical Issues - Audit Report

## Executive Summary

Through hands-on browser testing and code analysis, I identified **7 critical bugs** in the scheduling system that make it fundamentally broken for production use.

---

## Critical Issues Found

### Issue 1: Calendar Click Position Is Completely Wrong (P0)

**Evidence from Testing:**
- Clicked at ~10:00 AM on Wednesday → Modal showed **09:00** (wrong time)
- Clicked at ~15:00 on Tuesday Jan 27 → Modal showed **29 Jan at 13:00** (wrong date AND time!)
- Duration defaulted to **90 min** instead of expected 60 min

**Root Cause:** `CalendarGrid.tsx` line 207 - The `timeGridRef` wraps BOTH the time labels column AND day columns:
```typescript
<div className="flex" ref={timeGridRef}>  // Problem: includes time gutter in bounding rect
  <div className="w-16 shrink-0">  // Time labels column (64px)
    ...
  </div>
  {days.map((day) => ...)}  // Day columns
```

When calculating `y = e.clientY - rect.top`, the rect includes the time gutter which shifts calculations. Also, scrolling causes the sticky header offset to corrupt Y calculations.

**Fix Required:**
- Move `timeGridRef` to wrap ONLY the day columns container, not the time labels
- Account for scroll position in Y calculations
- Account for sticky header height (approx 60-70px)

---

### Issue 2: Conflict Detection Shows Then Disappears (P0)

**Evidence:** When changing date/time in the lesson modal:
1. Conflict message appeared: "Teacher already has a lesson at this time: Lesson – Sophie Richards"
2. After scrolling or interacting with the modal, the conflict **disappeared**
3. "Create Lesson" button remained enabled

**Root Cause:** The 800ms debounce in `LessonModal.tsx` line 164 re-triggers conflict checks on ANY form field change. When the user scrolls or interacts, the conflict state gets reset to `{ isChecking: false, conflicts: [] }` before the new check completes.

**Fix Required:**
- Don't reset conflicts until NEW results arrive
- Replace line 165: `setConflictState(prev => ({ ...prev, isChecking: true }));` should NOT clear existing conflicts while checking

---

### Issue 3: Conflicts Don't Block Lesson Creation (P0)

**Evidence:** Despite seeing "Teacher already has a lesson at this time" error, clicking "Create Lesson" succeeded and created the lesson.

**Code Analysis:** `LessonModal.tsx` lines 275-283 checks for blocking conflicts:
```typescript
const blockingConflicts = conflictState.conflicts.filter(c => c.severity === 'error');
if (blockingConflicts.length > 0) {
  toast({ ... });
  return;
}
```

This SHOULD work, but because Issue #2 causes conflicts to disappear, `conflictState.conflicts` is empty at save time.

**Fix Required:** Fix Issue #2, and also disable the Create button when `conflictState.isChecking` is true to prevent race conditions.

---

### Issue 4: Teacher Conflict Type Missing from ConflictResult (P1)

**Code:** `types.ts` line 45:
```typescript
type: 'teacher' | 'room' | 'student' | 'time_off' | 'closure';
```

But `useConflictDetection.ts` uses `'availability'` at line 84 which isn't in the union type, causing TypeScript issues.

**Fix:** Add `'availability'` to the ConflictResult type union.

---

### Issue 5: Date/Time Calculation Uses Local Time Incorrectly (P1)

**Evidence from DB:** Lesson created with:
- UI showed: Jan 27, 17:00
- Database stored: `2026-01-28 01:00:00+00` (wrong!)

**Root Cause:** `LessonModal.tsx` line 289:
```typescript
const startAt = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
```

`startOfDay` and `setHours` work in local browser time, but `toISOString()` converts to UTC. If the browser is in a non-UTC timezone, the stored time is wrong.

**Fix Required:** Use timezone-aware date handling with the org's configured timezone (`Europe/London`).

---

### Issue 6: Grid Click Fires Both onMouseDown AND onClick (P1)

**Code:** `CalendarGrid.tsx` lines 236-237:
```typescript
onMouseDown={(e) => handleMouseDown(e, day)}
onClick={(e) => handleSlotClick(e, day)}
```

Both handlers fire on a simple click, causing duplicate behavior and potential race conditions.

**Fix:** Only call `handleSlotClick` in the onClick handler if it wasn't a drag operation.

---

### Issue 7: Conflict Check Has No Timeout/Error Handling (P2)

**Code:** The `checkConflicts` function makes 5-6 sequential database queries with no timeout or error handling. If any query hangs, the UI shows loading forever.

**Fix:** Add Promise.race with timeout, and wrap in try/catch.

---

## Implementation Plan

### Phase 1: Fix CalendarGrid Click Position (Critical)

**File: `src/components/calendar/CalendarGrid.tsx`**

1. Create separate ref for day columns container only
2. Calculate Y position accounting for:
   - Scroll position of the ScrollArea
   - Time gutter width (64px) for X
   - Sticky header height offset

### Phase 2: Fix Conflict Detection Stability

**File: `src/components/calendar/LessonModal.tsx`**

1. Don't clear conflicts while checking - only replace when new results arrive
2. Disable "Create Lesson" button while conflict check is in progress
3. Add loading indicator during conflict checks

### Phase 3: Fix Timezone Handling

**File: `src/components/calendar/LessonModal.tsx`**

1. Use org timezone for date/time calculations
2. Store dates in UTC but display in org timezone
3. Use `date-fns-tz` for timezone-aware operations

### Phase 4: Fix Type Definitions

**File: `src/components/calendar/types.ts`**

1. Add `'availability'` to ConflictResult type union

---

## Files Requiring Changes

| File | Changes | Priority |
|------|---------|----------|
| `src/components/calendar/CalendarGrid.tsx` | Fix click position calculation, separate refs | P0 |
| `src/components/calendar/LessonModal.tsx` | Fix conflict state management, add loading states | P0 |
| `src/components/calendar/LessonModal.tsx` | Fix timezone handling in date calculations | P1 |
| `src/components/calendar/types.ts` | Add 'availability' to ConflictResult type | P1 |
| `src/hooks/useConflictDetection.ts` | Add timeout/error handling | P2 |

---

## Expected Outcomes

After implementing these fixes:

1. **Clicking on calendar will open modal at correct date/time** - Accurate to within 15-minute intervals
2. **Conflicts will persist and block saves** - No more disappearing warnings
3. **Timezone handling will be correct** - Lessons stored and displayed in org timezone
4. **Type safety** - No more `as any` casts for conflict types
