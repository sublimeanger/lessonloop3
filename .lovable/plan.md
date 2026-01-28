
# Full Audit and Testing Plan: Recent Implementations

## Executive Summary

This plan covers comprehensive testing of the following recent implementations:
1. **LessonModal conflict detection** (screen bounce issue)
2. **FirstRunExperience** (archetype-specific onboarding)
3. **UrgentActionsBar** (time-sensitive alerts)
4. **ContextualHints** (replacement for janky tours)
5. **OnboardingChecklist** (org-type awareness)
6. **LoopAssist ProactiveWelcome** (first-run messages)
7. **ParentReschedulePolicySetting** (scheduling policy management)
8. **EmptyState preview images** (visual previews)

---

## Issue 1: Screen Bounce in LessonModal

### Root Cause Analysis

The screen bounce occurs due to the conflict detection effect in `LessonModal.tsx` (lines 157-181):

```typescript
useEffect(() => {
  if (!open || !teacherUserId || !selectedDate) return;

  const timeoutId = setTimeout(async () => {
    setIsCheckingConflicts(true);  // ← This triggers re-render
    // ... async conflict checks
    setConflicts(results);         // ← Another re-render
    setIsCheckingConflicts(false); // ← Third re-render
  }, 500);
  // ...
}, [open, teacherUserId, selectedDate, startTime, durationMins, roomId, selectedStudents, lesson?.id, checkConflicts]);
```

**Problems identified:**
1. Multiple state updates cause layout shifts
2. The `Loader2` spinner appears/disappears causing content jump (line 823-827)
3. Conflicts Alert components have variable heights that push content around (lines 830-850)

### Proposed Fixes

| Issue | Fix |
|-------|-----|
| Layout shift on loading | Reserve fixed height for conflict section |
| Multiple re-renders | Batch state updates using `unstable_batchedUpdates` or combine states |
| Content jump | Use `min-h` on conflict area to prevent collapse |
| Debounce too short | Increase from 500ms to 800ms to reduce flicker |

### Files to Modify

- `src/components/calendar/LessonModal.tsx`

---

## Test Plan: FirstRunExperience

### Component: `src/components/dashboard/FirstRunExperience.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Solo teacher path | Sign up as solo teacher, no students | Shows "Add your first student" step |
| Solo teacher progression | Add a student | Shows "Schedule a lesson" step |
| Studio path | Sign up as studio, no locations | Shows "Set up your studio" step |
| Academy path | Sign up as academy | Shows "Set up locations" step |
| Agency path | Sign up as agency | Shows "Add client schools" step |
| Skip button | Click "Skip setup" | Marks first_run_completed = true |
| Dismiss button | Click X | Hides overlay (temporary) |
| Step indicators | Complete steps | Progress bar fills correctly |

### Files to Test

- `src/hooks/useFirstRunExperience.ts`
- `src/components/dashboard/FirstRunExperience.tsx`
- Database: `profiles.first_run_completed`, `profiles.first_run_path`

---

## Test Plan: UrgentActionsBar

### Component: `src/components/dashboard/UrgentActionsBar.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| No urgent actions | Fresh org with no data | Bar doesn't render |
| Unmarked lessons | Create lesson in past, don't mark | Shows "X unmarked lessons" |
| Overdue invoices | Create invoice 8+ days past due | Shows "X overdue invoices" (error severity) |
| Pending requests | Have pending message_request | Shows "X pending requests" |
| Unreviewed practice | Have practice_log without reviewed_at | Shows "X practice logs to review" |
| Dismiss button | Click X | Bar hides for session |
| Link navigation | Click action chip | Navigates to correct page |
| Role filtering | Login as teacher | Only sees teacher-relevant actions |
| Role filtering | Login as finance | Only sees finance-relevant actions |

### Files to Test

- `src/hooks/useUrgentActions.ts`
- `src/components/dashboard/UrgentActionsBar.tsx`

---

## Test Plan: ContextualHints

### Component: `src/components/shared/ContextualHint.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| First visit | Open Calendar page first time | Shows hint for calendar-grid |
| Dismiss on click | Click hint | Hint disappears, saved to localStorage |
| Not shown twice | Reload Calendar page | Hint doesn't reappear |
| Position accuracy | Hint on Students page | Positioned correctly near target |
| Auto-dismiss | Wait 5 seconds | Hint fades out automatically |
| Reset in Settings | Reset hints in Settings > Help | All hints reset |
| Multiple hints | Pages with multiple hints | Only one shows at a time |

### Files to Test

- `src/hooks/useContextualHints.ts`
- `src/components/shared/ContextualHint.tsx`
- `src/pages/CalendarPage.tsx` (integration)
- `src/pages/Students.tsx` (integration)
- `src/pages/Invoices.tsx` (integration)

---

## Test Plan: OnboardingChecklist

### Component: `src/components/shared/OnboardingChecklist.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Solo checklist items | Sign up as solo_teacher | Shows: Add student → Schedule lesson → Add location → Create invoice |
| Studio checklist items | Sign up as studio | Shows: Set up studio → Invite teacher → Add students → Run billing |
| Academy checklist items | Sign up as academy | Shows: Set up locations → Invite team → Enrol students → Schedule lessons |
| Agency checklist items | Sign up as agency | Shows: Add client schools → Invite teachers → Set scheduling policy → Add students |
| Progress tracking | Complete one step | Progress ring updates, item marked complete |
| Celebration | Complete all steps | Shows celebration animation, auto-dismisses |
| Dismiss button | Click X | Hides checklist |
| Timeout protection | Slow network | Doesn't hang indefinitely (5s timeout) |

### Files to Test

- `src/components/shared/OnboardingChecklist.tsx`

---

## Test Plan: LoopAssist ProactiveWelcome

### Component: `src/components/looopassist/ProactiveWelcome.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Solo teacher message | Open LoopAssist as new solo teacher | Shows "Help me add my first student" prompts |
| Studio message | Open LoopAssist as new studio | Shows "Help me set up my studio location" prompts |
| Academy message | Open LoopAssist as new academy | Shows "Help me set up multiple locations" prompts |
| Agency message | Open LoopAssist as new agency | Shows "Configure parent scheduling permissions" prompts |
| Dismiss functionality | Click X or use prompt | Message dismissed, stored in localStorage |
| Not shown again | Reopen LoopAssist | Welcome message doesn't reappear |
| With existing data | Org has students + locations | No proactive message shown |
| Prompt click | Click suggested prompt | Input populated, message dismissed |

### Files to Test

- `src/hooks/useLoopAssistFirstRun.ts`
- `src/components/looopassist/ProactiveWelcome.tsx`
- `src/components/looopassist/LoopAssistDrawer.tsx`

---

## Test Plan: Parent Reschedule Policy

### Component: `src/components/settings/SchedulingSettingsTab.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Default value | New org | Shows "Request only" selected |
| Solo teacher default | Signup as solo_teacher | Default is "Self-service" |
| Agency default | Signup as agency | Default is "Disabled" |
| Change policy | Select "Self-service" | Saves to DB, shows success toast |
| Change policy | Select "Disabled" | Saves to DB, shows success toast |
| Loading state | Click option | Shows loader on selected option |
| Error handling | Network error | Reverts to previous value, shows error toast |
| UI responsiveness | On mobile | Radio options stack properly |

### Files to Test

- `src/components/settings/SchedulingSettingsTab.tsx`
- `supabase/functions/onboarding-setup/index.ts` (default setting)

---

## Test Plan: EmptyState Preview Images

### Component: `src/components/shared/EmptyState.tsx`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Students preview | Open Students page with no students | Shows students-preview.svg |
| Calendar preview | Open Calendar with no lessons | Shows calendar-preview.svg |
| Invoices preview | Open Invoices with no invoices | Shows invoices-preview.svg |
| Fallback | Remove image | Still shows icon-based empty state |
| Accessibility | Screen reader | Alt text read correctly |
| Image loading | Slow network | Graceful loading/fallback |

### Files to Test

- `src/components/shared/EmptyState.tsx`
- `public/previews/students-preview.svg`
- `public/previews/calendar-preview.svg`
- `public/previews/invoices-preview.svg`

---

## Priority Fixes Required

### Critical (Must Fix)

1. **LessonModal screen bounce** - User-facing UX issue
   - Add fixed min-height to conflict section
   - Batch state updates to reduce re-renders
   - Increase debounce timeout

### High Priority

2. **ContextualHint positioning** - Verify hints appear in correct positions on all viewport sizes
3. **FirstRunExperience edge cases** - Test all org types thoroughly
4. **UrgentActionsBar role filtering** - Ensure proper role-based visibility

### Medium Priority

5. **OnboardingChecklist timeout** - Verify 5s timeout works correctly
6. **LoopAssist proactive message persistence** - Verify localStorage handling
7. **EmptyState image loading** - Add loading states for slow networks

---

## Technical Implementation for Screen Bounce Fix

```typescript
// LessonModal.tsx - Line 157-181 replacement

const [conflictState, setConflictState] = useState<{
  isChecking: boolean;
  conflicts: ConflictResult[];
}>({ isChecking: false, conflicts: [] });

useEffect(() => {
  if (!open || !teacherUserId || !selectedDate) return;

  const timeoutId = setTimeout(async () => {
    setConflictState(prev => ({ ...prev, isChecking: true }));
    
    const results = await checkConflicts({...params});
    
    // Single state update instead of three
    setConflictState({ isChecking: false, conflicts: results });
  }, 800); // Increased from 500ms

  return () => clearTimeout(timeoutId);
}, [dependencies]);
```

```typescript
// Add fixed height container for conflicts section
<div className="min-h-[80px]"> {/* Reserve space */}
  {conflictState.isChecking && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Checking for conflicts...
    </div>
  )}
  {/* Error/Warning alerts */}
</div>
```

---

## Test Execution Order

1. **Screen bounce fix** - Implement and verify
2. **FirstRunExperience** - All org type paths
3. **ContextualHints** - Positioning and persistence
4. **UrgentActionsBar** - Role-based filtering
5. **OnboardingChecklist** - Org-type specific items
6. **LoopAssist ProactiveWelcome** - Message display and dismissal
7. **ParentReschedulePolicySetting** - Save/load functionality
8. **EmptyState previews** - Image rendering

---

## Manual Testing Checklist

### Desktop (1920x1080)
- [ ] LessonModal opens without bounce
- [ ] FirstRunExperience shows correct path
- [ ] UrgentActionsBar displays when actions exist
- [ ] ContextualHints appear once per feature
- [ ] OnboardingChecklist shows org-specific items
- [ ] LoopAssist shows proactive welcome
- [ ] Settings policy selector works

### Mobile (390x844)
- [ ] LessonModal scrollable, no bounce
- [ ] FirstRunExperience readable on small screen
- [ ] UrgentActionsBar chips wrap correctly
- [ ] ContextualHints positioned correctly
- [ ] OnboardingChecklist responsive
- [ ] LoopAssist drawer full-width
- [ ] Settings radio buttons stacked

---

## Browser Testing

Test in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)
