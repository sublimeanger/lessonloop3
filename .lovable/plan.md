

# Fix: Lesson Click Not Opening Detail Panel

## Root Cause

There is an **infinite render loop** in `LessonModal` that is flooding React's state update queue. Even though the LessonModal is closed (its `open` prop is `false`), it is still mounted on the page and its internal `useEffect` is stuck in an infinite cycle. This blocks React from processing other state updates -- including the one that opens the lesson detail panel when you click a lesson card.

### The Loop (step by step)

```text
1. LessonModal renders
2. useConflictDetection() returns a NEW checkConflicts function (not memoised)
3. The conflict-check useEffect fires because checkConflicts changed
4. conflictCheckKey is null (modal closed), so it calls:
   setConflictState({ isChecking: false, conflicts: [] })  <-- new object every time
5. New object triggers re-render --> back to step 1
```

## Fix (3 changes)

### 1. Memoise `checkConflicts` in `useConflictDetection.ts`

Wrap the `checkConflicts` function in `useCallback` so it keeps the same reference between renders. This is the **root cause** fix -- stops the dependency array from changing on every render.

**File:** `src/hooks/useConflictDetection.ts`
- Import `useCallback` from React
- Wrap the `checkConflicts` function in `useCallback` with `[currentOrg]` as the dependency (the only external value it reads)

### 2. Guard against no-op state updates in `LessonModal.tsx`

In the conflict-check `useEffect`, when `conflictCheckKey` is null, avoid calling `setConflictState` if the state is already in its default shape. This adds a defensive layer so even if something else triggers re-renders, the effect won't unnecessarily set state.

**File:** `src/components/calendar/LessonModal.tsx`  
- Change the early return block (around line 194) from:
  ```
  setConflictState({ isChecking: false, conflicts: [] });
  ```
  to a functional update that only changes state if it differs:
  ```
  setConflictState(prev => 
    prev.isChecking || prev.conflicts.length > 0 
      ? { isChecking: false, conflicts: [] } 
      : prev
  );
  ```

### 3. Remove `checkConflicts` from the useEffect dependency array

Since `checkConflicts` is now stable (memoised), it technically won't cause issues. But as a belt-and-braces approach, the dependency array at line 278 should rely on `conflictCheckKey` as the primary trigger (which already encodes all the relevant field values). Remove `checkConflicts` and the redundant field-level dependencies (`startTime`, `selectedDate`, etc.) that are already captured in the memoised key.

**File:** `src/components/calendar/LessonModal.tsx`
- Simplify the dependency array from:
  ```
  [conflictCheckKey, checkConflicts, startTime, selectedDate, orgTimezone, durationMins, teacherId, roomId, locationId, selectedStudents, lesson?.id]
  ```
  to:
  ```
  [conflictCheckKey]
  ```
  (Store `checkConflicts` in a ref instead, since it is used inside the effect but should not trigger re-runs.)

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useConflictDetection.ts` | Wrap `checkConflicts` in `useCallback` |
| `src/components/calendar/LessonModal.tsx` | Guard no-op setState + simplify useEffect deps |

## No database changes. No new files.

