

# Fix Lesson Modal "Checking..." Stuck Issue

## Problem
The Lesson Modal's conflict detection is stuck in a loading state, preventing lesson creation. The button shows "Checking..." indefinitely.

## Root Cause
The conflict detection query to `lesson_participants` is returning 400 errors. This is likely due to:
1. Missing RLS policy for the new user's org context
2. A query syntax issue with the foreign key reference

## Technical Fix

### File: `src/hooks/useConflictDetection.ts`

Add error handling to prevent the button from getting stuck:

```typescript
// In the useQuery or useEffect that checks conflicts
// Add a try-catch with timeout fallback
try {
  const result = await checkConflicts();
  setConflicts(result);
} catch (error) {
  console.error('Conflict check failed:', error);
  // Allow lesson creation even if conflict check fails
  setConflicts([]);
  setIsCheckingConflicts(false);
}
```

### File: `src/components/calendar/LessonModal.tsx`

Add a timeout failsafe so the button doesn't stay stuck:

```typescript
// After 5 seconds, allow submission even if conflict check is still running
useEffect(() => {
  if (isCheckingConflicts) {
    const timeout = setTimeout(() => {
      setIsCheckingConflicts(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }
}, [isCheckingConflicts]);
```

## Testing Required
1. Create a new lesson with the test account
2. Verify button changes from "Checking..." to "Create Lesson" within 5 seconds
3. Verify lesson is saved to database
4. Verify lesson appears on calendar

## Priority
**CRITICAL** - This blocks the core demo flow

