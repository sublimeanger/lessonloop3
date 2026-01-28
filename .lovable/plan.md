

# Scheduling System Testing Audit - Critical Issues Found

## Executive Summary

Through comprehensive browser testing and code analysis, I identified **6 critical bugs** that are making the scheduling system unreliable.

---

## Critical Issues Discovered

### Issue 1: Time Labels Show Current Minutes Instead of :00 (P0)

**Evidence**: Calendar grid shows "08:29", "09:29", "10:29" instead of "08:00", "09:00", "10:00"

**Root Cause**: `CalendarGrid.tsx` line 250:
```typescript
{format(setHours(new Date(), hour), 'HH:mm')}
```

`setHours(new Date(), hour)` preserves the current minute from `new Date()`. If it's 13:29 right now, every hour label shows `:29`.

**Fix**: Use `setMinutes(setHours(new Date(), hour), 0)` or just format directly:
```typescript
{`${hour.toString().padStart(2, '0')}:00`}
```

---

### Issue 2: Conflict Detection Runs in Infinite Loop (P0)

**Evidence**: Network tab showed 100+ repeated conflict check queries (closure_dates, availability_blocks, lessons, etc.)

**Root Cause**: `LessonModal.tsx` line 222 has a dependency array that includes `conflictState.lastCheckKey` and `conflictState.isChecking`:
```typescript
}, [open, teacherUserId, selectedDate, startTime, durationMins, roomId, selectedStudents, lesson?.id, checkConflicts, orgTimezone, conflictState.lastCheckKey, conflictState.isChecking]);
```

Every time `setConflictState` runs, it changes these values, which re-triggers the effect, creating an infinite loop.

**Fix**: Remove `conflictState.lastCheckKey` and `conflictState.isChecking` from the dependency array. Use a ref to track the last check key instead:
```typescript
const lastCheckKeyRef = useRef<string>('');
// ...in effect:
if (checkKey === lastCheckKeyRef.current) return;
lastCheckKeyRef.current = checkKey;
```

---

### Issue 3: Button Stuck in "Checking..." State (P0)

**Consequence of Issue 2**: Because conflict checks run forever, the button never leaves the "Checking..." state, making it impossible to save lessons.

**Fix**: Fixing Issue 2 will resolve this.

---

### Issue 4: Conflict State Gets Cleared During Race Conditions (P1)

**Code Analysis**: Line 192 sets `isChecking: true` but the way React state updates work with the infinite loop means conflicts flicker in and out.

**Fix**: Use refs for all conflict tracking state to avoid triggering re-renders that re-trigger the effect.

---

### Issue 5: Student Conflicts Show as Warning, Should Block Save (P1)

**Evidence**: "George Twilley has another lesson at this time" appears as a warning (amber), not an error (red). Warnings don't block saves.

**Current Behavior**: Student overlaps are `severity: 'warning'`, allowing double-booking.

**Policy Decision**: For music schools, student double-booking should be an error, not a warning. A student physically cannot be in two lessons at once.

**Fix**: In `useConflictDetection.ts`, change student conflicts from `severity: 'warning'` to `severity: 'error'`.

---

### Issue 6: Time Label Display Bug in Calendar Grid

**Already Identified**: Time labels use `new Date()` which includes current minutes.

---

## Implementation Plan

### Phase 1: Fix Infinite Loop (Critical)

**File: `src/components/calendar/LessonModal.tsx`**

1. Move `lastCheckKey` to a ref instead of state
2. Remove `conflictState.lastCheckKey` and `conflictState.isChecking` from useEffect dependencies
3. Use the ref to short-circuit duplicate checks
4. Only update state once when results arrive

### Phase 2: Fix Time Labels

**File: `src/components/calendar/CalendarGrid.tsx`**

1. Change line 250 from:
   ```typescript
   {format(setHours(new Date(), hour), 'HH:mm')}
   ```
   To:
   ```typescript
   {`${hour.toString().padStart(2, '0')}:00`}
   ```

### Phase 3: Harden Conflict Severity

**File: `src/hooks/useConflictDetection.ts`**

1. Change student conflicts from `severity: 'warning'` to `severity: 'error'`
2. Students cannot physically be in two places at once

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/components/calendar/LessonModal.tsx` | Fix infinite loop by using refs for check tracking | P0 |
| `src/components/calendar/CalendarGrid.tsx` | Fix time label display (use :00 not current minute) | P0 |
| `src/hooks/useConflictDetection.ts` | Change student conflicts to error severity | P1 |

---

## Expected Outcomes

After implementing these fixes:

1. **Conflict checks run once per change** - No more infinite loops or 100+ network requests
2. **Create Lesson button works** - No longer stuck in "Checking..." state
3. **Time labels display correctly** - Shows "09:00", "10:00" not "09:29", "10:29"
4. **Student double-booking is blocked** - Error-level conflicts prevent saves

