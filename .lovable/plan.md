

# Production Readiness Audit — Feature 3: Roles & Permissions (UI/UX)

## Sidebar & Navigation Per Role

| Role | Sidebar Groups | Items |
|------|---------------|-------|
| **Owner/Admin** (multi-staff) | Dashboard, Calendar; Teaching (Students, Teachers, Register, Batch Attendance, Practice, Resources, Notes); Business (Invoices, Reports, Locations, Messages); Pipeline (Leads, Waiting List, Make-Ups, Continuation) | Full access |
| **Solo-teacher owner** | Dashboard, Calendar; Teaching (Students, Register, Practice, Resources, Notes); Business (Invoices, Messages, Reports) | Simplified — no Teachers, Locations, Leads, Pipeline |
| **Teacher** | Dashboard, My Calendar; Teaching (My Students, Register, Batch Attendance, Practice, Resources, Notes); Communication (Messages) | Correct |
| **Finance** | Dashboard; Business (Invoices, Reports); Communication (Messages) | Correct |
| **Parent** | Home, Schedule, Practice, Resources, Invoices & Payments, Messages | Portal only — correct |

**Teacher mobile bottom nav:** 4 primary tabs (Today, Schedule, Students, Messages) + More menu with 6 items (Register, Attendance, Practice, Resources, Notes, Settings). Correct.

## Issues Found

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **HIGH** | `AppSidebar.tsx:339` | LoopAssist shown for finance role. Code: `currentRole && currentRole !== 'parent'`. Should match Header which uses `['owner', 'admin', 'teacher'].includes(currentRole)`. |
| 2 | **HIGH** | `AppLayout.tsx:41` | Same issue — LoopAssist drawer rendered for finance. Same fix needed. |
| 3 | **MEDIUM** | `Settings.tsx:128` | `adminTabs` array is missing `'organisation'` and `'branding'`. A teacher/finance user navigating to `/settings?tab=organisation` or `/settings?tab=branding` sees admin-only content. |
| 4 | **LOW** | `OrgContext.tsx` | No realtime subscription on `org_memberships` — role changes require page refresh. Acceptable for now (rare admin action). No fix needed. |

All other areas verified as correct:
- Header: notification bell and LoopAssist correctly restricted to `['owner', 'admin', 'teacher']`
- RouteGuard: all routes have correct `allowedRoles` in `routes.ts`; unauthorized roles get redirected
- Member management: owners/admins can add/change/remove members; owner role protected from demotion via RLS + client guards
- Role display: shown in sidebar footer via `getRoleLabel()`
- Role badges: color-coded in `OrgMembersTab` with distinct styles per role
- Parent portal: fully isolated with portal-only routes and sidebar
- Invite dialog: role selector with Admin/Teacher/Finance options and descriptions
- No `/payroll` route exists (it's `/reports/payroll`) — correctly scoped to owner/admin/teacher/finance
- Page access matrix matches `routes.ts` definitions exactly

## Plan — 3 Code Changes

**FIX 1 (HIGH):** `src/components/layout/AppSidebar.tsx` line 339
Change `currentRole && currentRole !== 'parent'` to `currentRole && ['owner', 'admin', 'teacher'].includes(currentRole)`.

**FIX 2 (HIGH):** `src/components/layout/AppLayout.tsx` line 41
Same change — restrict LoopAssist drawer rendering to owner/admin/teacher only.

**FIX 3 (MEDIUM):** `src/pages/Settings.tsx` line 128
Add `'organisation'` and `'branding'` to the `adminTabs` array so non-admin roles are redirected to profile when accessing these tabs via URL.

