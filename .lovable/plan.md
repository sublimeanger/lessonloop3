

## Solo Teacher Journey Audit

I traced the full solo teacher path — from signup through daily use. Here's what's in place and what's not.

### What's Working Well

1. **Onboarding wizard** — Fully tailored. Solo teachers get a streamlined "About Your Teaching" step (student count + instrument chips, no org name field). Plan recommendation correctly maps to the Teacher plan.

2. **Dashboard** — Dedicated `SoloTeacherDashboard` component with solo-appropriate stats (Today's Lessons, Active Students, Revenue MTD, Outstanding). Quick Actions are solo-specific (New Lesson, Record Attendance, Create Invoice, Send Message).

3. **First-run checklist** — Solo-specific 2-step path: "Add your first student" then "Schedule a lesson". Simpler than academy/agency paths. Auto-advances when queries are invalidated (fixed in prior session).

4. **Onboarding checklist (persistent)** — Has a solo_teacher config with 4 items: add student, schedule lesson, add location, create invoice. Progress ring, celebration on completion.

5. **Feature gating** — Solo teachers get access to most features (reports, billing runs, practice tracking, resource library, lead pipeline, calendar sync, parent portal). Multi-location and custom branding are correctly gated to academy+.

6. **Pricing/billing** — £12/mo Teacher plan correctly mapped through all layers (frontend config, Stripe webhook, checkout edge function, plan limits).

### Issues Found

**Issue 1: Sidebar shows multi-tenant features to solo teachers**
The `AppSidebar` uses `ownerAdminGroups` for both solo teachers (owner role) and academy owners. This means solo teachers see:
- **Teachers** — links to `/teachers` (managing a team). A solo teacher doesn't have a team.
- **Locations** — links to `/locations`. While useful, it's not a priority item.
- **Batch Attendance** — designed for multi-teacher orgs.
- **Leads**, **Waiting List**, **Make-Ups**, **Continuation** — advanced business features that may overwhelm a solo teacher.

The nav has **15+ items** visible to a solo teacher owner, which is the same as an academy owner managing 20 teachers. There's no simplification.

**Issue 2: Bottom nav (mobile/native) also ignores org type**
`StaffBottomNav` switches based on `currentRole` (owner/admin/teacher/finance) but never checks `org_type`. A solo teacher owner sees the same bottom nav as an academy owner — including "Teachers" in the More menu.

**Issue 3: Onboarding checklist inconsistency**
The persistent `OnboardingChecklist` asks solo teachers to "Add a teaching location" (step 3) and "Create your first invoice" (step 4), but the `FirstRunExperience` hook only has 2 steps (add student, schedule lesson). These are two separate checklist systems with different step counts for the same user type.

**Issue 4: No solo-specific nav simplification anywhere**
The sidebar, bottom nav, header, and route structure are entirely role-based, never org-type-aware. A solo teacher sees the exact same navigation complexity as a 50-teacher academy owner.

### Recommended Fix Plan

**Change 1: Create a solo-teacher sidebar nav group** in `AppSidebar.tsx`
- New `soloOwnerGroups` that shows: Dashboard, Calendar, Students, Register, Practice, Resources, Notes | Invoices, Messages | Settings, Help
- Remove: Teachers, Locations, Batch Attendance, Leads, Waiting List, Make-Ups, Continuation, Reports (or simplify to a single "Revenue" link)
- In `getNavGroups()`, check both `role` AND `org_type` — if `role === 'owner' && org_type === 'solo_teacher'`, use the simplified nav

**Change 2: Create solo-teacher bottom nav** in `StaffBottomNav.tsx`
- New `soloOwnerTabs` with Home, Calendar, Students, Messages (same 4 tabs)
- New `soloOwnerMore` without Teachers link — just Invoices, Register, Settings
- Pass `org_type` to `getTabsForRole()` or create a new selector

**Change 3: Align the two checklist systems**
- Update `OnboardingChecklist` solo_teacher config to match `FirstRunExperience` (2 core steps: add student, schedule lesson) — or keep 4 steps but make them the same in both systems
- The location step is debatable for solo teachers — many teach from home and don't need a formal location record

**Change 4: (Optional) Contextual quick actions**
- The `QuickActionsGrid` solo variant is already good — no changes needed there

### Impact Assessment

These are UX polish issues, not functional bugs. A solo teacher *can* use the app today — they just see an intimidating amount of navigation meant for larger organisations. For your biggest user segment, reducing cognitive load in the nav is high-impact.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Add `soloOwnerGroups`, update `getNavGroups` to accept org_type |
| `src/components/layout/StaffBottomNav.tsx` | Add solo-specific tabs/more, update selector |
| `src/components/shared/OnboardingChecklist.tsx` | Optionally trim solo_teacher steps to match FirstRunExperience |

Estimated scope: ~100 lines of changes across 3 files.

