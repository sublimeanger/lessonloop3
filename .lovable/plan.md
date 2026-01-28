

# Enterprise Audit: Critical Issues Identified

## Executive Summary

This audit uncovered **12 distinct issues** across the codebase, categorized by severity. The most critical finding is that the **LoopAssist "Complete Lessons" action is broken** because the frontend `ActionCard` component doesn't recognize the `complete_lessons` action type, causing the action to silently fail.

---

## Critical Issues (P0 - Must Fix)

### Issue 1: LoopAssist Complete Lessons Action Does Nothing

**Root Cause**: Type mismatch between backend and frontend

| Component | Supports `complete_lessons`? |
|-----------|------------------------------|
| Backend (`looopassist-execute/index.ts` line 114) | Yes |
| System Prompt (`looopassist-chat/index.ts` line 544) | Yes |
| Frontend (`ActionCard.tsx` line 16) | **NO** |

**The `ActionProposalData` interface is missing 4 action types:**

```typescript
// Current (broken):
action_type: 'generate_billing_run' | 'send_invoice_reminders' | 'reschedule_lessons' | 'draft_email';

// Should be:
action_type: 
  | 'generate_billing_run' 
  | 'send_invoice_reminders' 
  | 'reschedule_lessons' 
  | 'draft_email'
  | 'mark_attendance'      // MISSING
  | 'cancel_lesson'        // MISSING  
  | 'complete_lessons'     // MISSING - user reported this
  | 'send_progress_report'; // MISSING
```

**Also missing icons and labels:**

```typescript
// ACTION_ICONS needs:
mark_attendance: ClipboardCheck,
cancel_lesson: XCircle,
complete_lessons: CheckCircle2,
send_progress_report: FileText,

// ACTION_LABELS needs:
mark_attendance: 'Mark Attendance',
cancel_lesson: 'Cancel Lesson',
complete_lessons: 'Mark Lessons Complete',
send_progress_report: 'Send Progress Report',
```

**Files to Fix:**
- `src/components/looopassist/ActionCard.tsx`

---

## High Priority Issues (P1)

### Issue 2: X and + Buttons Too Close Together (Site-Wide)

This is a systemic UX issue affecting multiple components. The problem occurs in two patterns:

**Pattern A: Sheet/Dialog Close Button Collision**

In `src/components/ui/sheet.tsx` line 60:
```typescript
<SheetPrimitive.Close className="absolute right-4 top-4 ...">
```

This positions the built-in close button at `right-4 top-4` (16px from edges). When custom components add header actions like `LoopAssistDrawer.tsx` line 127:
```typescript
<Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
  <Plus className="h-4 w-4" />
</Button>
```

Both buttons end up at the same position, causing overlap/proximity issues.

**Pattern B: Icon-Only Buttons with Minimal Gap**

Multiple places use `gap-1` or `gap-2` for icon buttons which is too tight:

| Location | Current | Issue |
|----------|---------|-------|
| `DailyRegister.tsx` line 77 | `gap-1` | Navigation arrows touching calendar button |
| `ActionCard.tsx` line 120 | `gap-2` | Confirm/Cancel buttons cramped on mobile |
| `TeacherAvailabilityTab.tsx` line 212 | `ml-1` | Delete X inside badge, hard to tap |
| `LoopAssistDrawer.tsx` line 249 | `gap-2` | Send and input too close |

**Recommended Minimum Spacing:**
- Icon buttons: `gap-3` (12px)
- Touch targets: 44x44px minimum
- Badge inline actions: Separate button, not embedded

**Files to Fix:**
- `src/components/ui/sheet.tsx` - Remove built-in close OR add padding-right to content
- `src/components/looopassist/LoopAssistDrawer.tsx` - Increase header button spacing
- `src/pages/DailyRegister.tsx` - Change `gap-1` to `gap-2`
- `src/components/looopassist/ActionCard.tsx` - Increase footer `gap-2` to `gap-3`
- `src/components/settings/TeacherAvailabilityTab.tsx` - Move delete to separate button

---

### Issue 3: Dialog Close Button Conflicts with Custom Headers

The base `DialogContent` component in `src/components/ui/dialog.tsx` line 45 includes an automatic close button:

```typescript
<DialogPrimitive.Close className="absolute right-4 top-4 ...">
  <X className="h-4 w-4" />
</DialogPrimitive.Close>
```

Many dialogs add their own header content in the same area, causing visual collision.

**Solution Options:**
1. Add `pr-10` padding to DialogHeader to account for close button
2. Create `DialogContentWithoutClose` variant
3. Update all custom dialog headers to respect the reserved space

---

## Medium Priority Issues (P2)

### Issue 4: LoopAssist Proactive Alerts Not Fetching Correct Data

In `useUrgentActions.ts`, the "unmarked lessons" query may return lessons that are already completed because it checks `status = 'scheduled'` but doesn't account for lessons that were scheduled but later marked complete.

**Verify Query Logic:**
```typescript
// Should ensure we're getting PAST lessons that are STILL scheduled
.eq('status', 'scheduled')
.lt('end_at', now)
```

---

### Issue 5: FirstRunExperience Path Detection Edge Cases

The `useFirstRunExperience.ts` hook uses `org_type` to determine the onboarding path, but there's no fallback if `org_type` is null or undefined, which could happen during org creation.

**Add Fallback:**
```typescript
const orgType = currentOrg?.org_type || 'solo_teacher';
```

---

### Issue 6: OnboardingChecklist TypeScript Warning

Line 162 in `OnboardingChecklist.tsx`:
```typescript
// @ts-ignore - new column
hasPolicyConfigured: currentOrg.parent_reschedule_policy !== 'request_only',
```

This indicates the types aren't synced. The `parent_reschedule_policy` column was added in the migration but the TypeScript types haven't updated.

**Note**: This may auto-resolve after types regeneration, but should be verified.

---

### Issue 7: ContextualHint Target Selector Missing on Some Pages

The Calendar page uses:
```typescript
targetSelector="[data-hint='calendar-grid']"
```

But need to verify the actual grid component has this attribute applied.

---

## Low Priority Issues (P3)

### Issue 8: Sheet Close Button Hidden Behind Custom Content

In LoopAssistDrawer, the `SheetContent` has a custom header at line 109 that uses `px-4 py-3`. The built-in close button from Sheet component is also rendered, but since the drawer has `p-0` override, positioning may be off.

---

### Issue 9: UrgentActionsBar Role Filtering Not Fully Implemented

The `useUrgentActions.ts` hook filters actions based on role, but the filtering logic for "practice logs to review" doesn't check if the current user is the assigned teacher for those students.

---

### Issue 10: EmptyState Preview Images Lack Loading States

The SVG previews in `EmptyState.tsx` are loaded synchronously. On slow connections, there may be a flash.

---

### Issue 11: Missing Keyboard Navigation on Some Interactive Elements

The Calendar lesson cards are navigable (fixed in recent audit), but:
- LoopAssist conversation list items lack keyboard focus styling
- ActionCard entity badges should have proper focus indicators

---

### Issue 12: Inconsistent Button Size for Touch Targets

Some icon buttons use `size="icon"` (40x40) while others use `size="icon-sm"` (32x32). For mobile, 32x32 is below the recommended 44x44 minimum touch target.

---

## Technical Implementation Plan

### Phase 1: Critical Fix (LoopAssist Actions)

**File: `src/components/looopassist/ActionCard.tsx`**

1. Update `ActionProposalData` interface to include all 8 action types
2. Add missing icons: `ClipboardCheck`, `XCircle`, `CheckCircle2`
3. Add missing labels for all action types
4. Add missing entity color for `lesson` type

### Phase 2: Button Spacing Standardization

1. Create design system constants for button spacing:
   - `ICON_BUTTON_GAP = 'gap-3'` (12px)
   - `TOUCH_SAFE_SIZE = 'h-10 w-10'` (40px minimum)

2. Update affected components:
   - `LoopAssistDrawer.tsx` header: Add `gap-3` between title and + button
   - `DailyRegister.tsx`: Change `gap-1` to `gap-2`
   - `ActionCard.tsx` footer: Change `gap-2` to `gap-3`
   - `TeacherAvailabilityTab.tsx`: Move delete button outside badge

3. Sheet component options:
   - Option A: Remove automatic close button, require explicit SheetClose
   - Option B: Add `hideCloseButton` prop to SheetContent
   - Option C: Add `pr-12` to all custom sheet headers

### Phase 3: Type Safety

1. Verify TypeScript types are regenerated from Supabase
2. Remove all `@ts-ignore` comments once types are correct

### Phase 4: Verification

1. Test all 8 LoopAssist action types end-to-end
2. Verify touch targets on mobile devices
3. Visual regression test button spacing on all affected pages

---

## Files Requiring Changes

| File | Changes | Priority |
|------|---------|----------|
| `src/components/looopassist/ActionCard.tsx` | Add 4 missing action types, icons, labels | P0 |
| `src/components/ui/sheet.tsx` | Add `hideCloseButton` prop or increase spacing | P1 |
| `src/components/looopassist/LoopAssistDrawer.tsx` | Increase header button gap, fix close collision | P1 |
| `src/pages/DailyRegister.tsx` | Change `gap-1` to `gap-2` | P1 |
| `src/components/settings/TeacherAvailabilityTab.tsx` | Move delete button outside badge | P1 |
| `src/components/ui/dialog.tsx` | Add padding to account for close button | P2 |
| `src/components/shared/OnboardingChecklist.tsx` | Remove @ts-ignore after types sync | P2 |

---

## Expected Outcomes

After implementing these fixes:

1. **LoopAssist actions will work** - Users can confirm "mark lessons complete" and other actions
2. **Consistent button spacing** - 12px minimum gap between icon buttons
3. **No close button collisions** - Clear separation between dismiss and action buttons
4. **Touch-friendly UI** - 40px minimum touch targets on mobile
5. **Type-safe code** - No @ts-ignore hacks for database columns

