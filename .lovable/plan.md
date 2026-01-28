
# Complete First-Run Experience & Daily Usage Overhaul

## The Problem We're Solving

The current onboarding has these issues:
1. **Tours are janky and intrusive** - react-joyride approach disrupts rather than guides
2. **Generic onboarding** - Solo teachers and agencies get the same experience
3. **No "Time-to-First-Value" focus** - Users complete setup but don't immediately DO something
4. **Checklist is passive** - Shows tasks but doesn't guide through them
5. **Daily usage isn't differentiated** - Dashboard actions are similar for all org types despite very different daily workflows

---

## Research Findings: What Works

Based on Notion, Slack, Linear, Calendly patterns:

| Principle | Application |
|-----------|-------------|
| **Jobs-to-be-Done survey** | Ask "What do you need most?" during onboarding to branch the experience |
| **Minimal Path to Activation** | Get users to complete ONE meaningful action in under 5 minutes |
| **Actionable empty states** | Show what the page WILL look like, with unmissable CTA |
| **Progressive disclosure** | Hide complexity until needed, based on org type |
| **No forced tours** | Replace with contextual hints that appear once per feature |

---

## The New User Journey (By Archetype)

### Solo Teacher Journey

```text
Signup → Org Type Selection → Plan Selection → Dashboard
                                                   ↓
                                        "Quick Start" overlay:
                                        "Let's add your first student"
                                                   ↓
                                        Student Wizard opens
                                                   ↓
                                        Success → "Now schedule their first lesson"
                                                   ↓
                                        Calendar opens, pre-filtered to student
                                                   ↓
                                        Done! Checklist shows 2/4 complete
```

**Key insight**: Solo teachers want to be TEACHING, not configuring. Get them from signup to "lesson scheduled" in under 5 minutes.

### Studio/Academy Journey

```text
Signup → Org Type Selection → Plan Selection → Dashboard
                                                   ↓
                                        "Quick Start" overlay:
                                        "First, add your teaching locations"
                                                   ↓
                                        Locations page with guided creation
                                                   ↓
                                        "Now invite your first teacher"
                                                   ↓
                                        Teachers page with invite flow
                                                   ↓
                                        "Great! Add students when ready"
                                                   ↓
                                        Dashboard with academy-specific checklist
```

**Key insight**: Academies need STRUCTURE first (locations, teachers), then content (students, lessons).

### Agency Journey

```text
Signup → Org Type Selection → Plan Selection → Dashboard
                                                   ↓
                                        "Quick Start" overlay:
                                        "Agency Mode: Set up your client schools"
                                                   ↓
                                        Locations page (frame as "client sites")
                                                   ↓
                                        "Invite your first teacher"
                                                   ↓
                                        Teachers page
                                                   ↓
                                        Scheduling Policy prompt:
                                        "How should parents request changes?"
                                                   ↓
                                        Dashboard with agency-specific focus
```

**Key insight**: Agencies need to understand that locations = clients, and policy control is critical from day one.

---

## Technical Implementation

### Phase 1: Enhanced Onboarding Flow

**New Component: `FirstRunExperience.tsx`**

A lightweight, non-modal overlay that appears on first dashboard visit:
- Detects `has_completed_onboarding` + no students/lessons
- Shows org-type-specific "quick start" card
- Single prominent CTA: "Add your first student" / "Set up locations" / etc.
- Dismissible, but persistent until first action completed
- NOT a modal - appears inline on dashboard

**New Database Column:**
```sql
ALTER TABLE profiles 
ADD COLUMN first_run_completed BOOLEAN DEFAULT false,
ADD COLUMN first_run_path TEXT; -- stores which path they took
```

**Updates to `src/pages/Dashboard.tsx`:**
- Add conditional rendering of `FirstRunExperience` based on org_type and completion status
- Track first-run path in profile when user completes it

### Phase 2: Contextual Hints (Replace Tours)

**New Component: `ContextualHint.tsx`**

A lightweight tooltip system that:
- Appears ONCE per feature, on first visit
- Stores seen hints in localStorage (not localStorage spam - single JSON object)
- Minimal, non-blocking design
- Dismisses on click or after 5 seconds
- Can be re-triggered from Settings > Help

**Implementation:**
```typescript
// Example usage in Calendar
<ContextualHint 
  id="calendar-create-lesson"
  message="Click any time slot to create a lesson"
  position="bottom"
  targetSelector="[data-hint='calendar-grid']"
/>
```

**Files to create:**
- `src/components/shared/ContextualHint.tsx`
- `src/hooks/useContextualHints.ts`

### Phase 3: Smart Empty States

**Enhanced `EmptyState.tsx`:**

Add visual preview capability:
```typescript
interface EmptyStateProps {
  // ...existing props
  previewImage?: string; // Path to preview image showing populated state
  previewAlt?: string;
}
```

**Create preview illustrations for:**
- Students list (showing 3 example student cards)
- Calendar (showing a day with lessons)
- Invoices (showing invoice list with badges)

These would be simple, stylized SVG illustrations that give users a sense of what to expect.

### Phase 4: Org-Type-Specific Checklists

**Update `OnboardingChecklist.tsx`:**

Different checklist items based on org_type:

| Org Type | Checklist Items |
|----------|-----------------|
| Solo Teacher | Add student → Schedule lesson → Add location → Create invoice |
| Studio | Add location → Invite teacher → Add student → Run billing |
| Academy | Set up locations → Configure rooms → Invite team → Import students |
| Agency | Add client sites → Invite teachers → Set scheduling policy → Add students |

**Implementation:**
Add `org_type` awareness to checklist and swap item arrays dynamically.

### Phase 5: Daily Usage Optimization

**Dashboard Quick Actions by Role:**

Already partially implemented, but enhance with:

1. **"What's urgent" section** (top of dashboard):
   - Unmarked lessons from yesterday
   - Overdue invoices > 7 days
   - Pending reschedule requests
   - Practice assignments not reviewed

2. **Contextual smart actions** based on time of day:
   - Morning: "Today's Schedule" prominent
   - Evening: "End of Day" (mark attendance, notes)
   - End of month: "Run Billing" highlighted

**New Component: `UrgentActionsBar.tsx`**

A horizontal bar that appears ONLY when there are urgent items:
```text
⚠️ 3 items need attention: 2 unmarked lessons • 1 overdue invoice → View
```

Clicking expands to show details or navigates to appropriate page.

### Phase 6: LoopAssist as Configuration Helper

**Enhance LoopAssist first-use experience:**

When drawer opens for first time for a new org:
1. Show intro modal (already exists)
2. After dismissal, LoopAssist proactively says:

For solo teacher:
> "Welcome! I see you're just getting started. Want me to walk you through adding your first student?"

For agency:
> "As an agency, you'll want to set up how parents request reschedules. Would you like me to configure that now?"

**Implementation:**
Add `first_open_org_id` check in `LoopAssistDrawer.tsx`
Add proactive message logic based on org_type + completion status

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/components/dashboard/FirstRunExperience.tsx` | Inline first-run guidance overlay |
| `src/components/dashboard/UrgentActionsBar.tsx` | Time-sensitive action alerts |
| `src/components/shared/ContextualHint.tsx` | One-time feature hints |
| `src/hooks/useContextualHints.ts` | Hint state management |
| `public/previews/students-preview.svg` | Empty state illustration |
| `public/previews/calendar-preview.svg` | Empty state illustration |
| `public/previews/invoices-preview.svg` | Empty state illustration |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add FirstRunExperience, UrgentActionsBar |
| `src/components/shared/OnboardingChecklist.tsx` | Make org-type-aware |
| `src/components/shared/EmptyState.tsx` | Add preview image support |
| `src/components/looopassist/LoopAssistDrawer.tsx` | Add first-org-open proactive message |
| `src/components/tours/TourTrigger.tsx` | Keep disabled, replace with hints |
| `src/components/tours/TourProvider.tsx` | Keep for manual tours from Settings |

## Database Migration

```sql
-- Track first-run completion and path
ALTER TABLE profiles 
ADD COLUMN first_run_completed BOOLEAN DEFAULT false,
ADD COLUMN first_run_path TEXT;

-- Scheduling policy for parent portal (from previous plan)
ALTER TABLE organisations 
ADD COLUMN parent_reschedule_policy TEXT DEFAULT 'request_only' 
CHECK (parent_reschedule_policy IN ('self_service', 'request_only', 'admin_locked'));

ALTER TABLE locations 
ADD COLUMN parent_reschedule_policy_override TEXT DEFAULT NULL
CHECK (parent_reschedule_policy_override IN ('self_service', 'request_only', 'admin_locked'));
```

---

## Expected Outcomes

1. **Time-to-first-value under 5 minutes** for all org types
2. **No more janky tours** - replaced with subtle, contextual hints
3. **Org-type-specific guidance** that makes users feel understood
4. **Daily workflows optimized** with urgent actions surfaced automatically
5. **LoopAssist as configuration helper** rather than just Q&A tool
6. **Progressive disclosure** - complexity hidden until needed

This transforms the experience from "functional but confusing" to "guides me exactly where I need to go."
