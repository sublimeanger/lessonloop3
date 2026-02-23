# LessonLoop Functionality Standards

> These are the rules for how every feature should work. Read this before building or fixing any functionality.

## Error Handling

### API Calls (Supabase)
- Every Supabase query must handle the error case: `const { data, error } = await supabase...`
- Errors are passed to the centralised handler in `src/lib/error-handler.ts`
- User-facing errors show a toast with `variant: 'destructive'`
- Errors are logged via `src/lib/logger.ts` and reported to Sentry via `src/lib/sentry.ts`
- **Never** show raw database errors to users — map to friendly messages

### React Query
- All data fetching uses React Query (`@tanstack/react-query`) via custom hooks in `src/hooks/`
- Stale times are configured in `src/config/query-stale-times.ts` — respect these
- Loading states come from `isLoading` / `isPending`
- Error states come from `isError` / `error`
- Mutations use `useMutation` with `onSuccess` and `onError` handlers
- Optimistic updates via `onMutate` where the user expects instant feedback (e.g., toggling attendance)
- Invalidate relevant queries in `onSuccess` — never leave stale data visible

### Form Submission
- Disable the submit button during submission
- Show `Loader2` spinner inside the button during submission
- On success: show success toast, close modal/navigate, invalidate queries
- On error: show error toast, keep form open with data intact
- **Never** lose user input on error

## Validation

### Client-Side
- Use Zod schemas from `src/lib/schemas.ts` for all form validation
- Additional validation utilities in `src/lib/validation.ts`
- Validate on blur and on submit — not on every keystroke
- Show inline validation errors below the relevant field in `text-destructive text-sm`
- Required fields must be marked (asterisk or explicit label)

### Sanitisation
- All user text input goes through `src/lib/sanitize.ts` before storage
- File uploads validated via `src/lib/resource-validation.ts` (type, size, name)
- Never trust client-side validation alone — Supabase RLS is the real guard

### Common Validation Rules
- **Email:** Valid format, not empty
- **Names:** Not empty, reasonable length (2-100 chars), sanitised
- **Phone:** Optional but if provided, basic format check
- **Dates:** Valid date, logical ranges (end after start, not in past where inappropriate)
- **Currency:** Non-negative, reasonable amounts, stored in minor units (pence)
- **Files:** Max size enforced, allowed MIME types only

## Authentication & Authorisation

### Auth Context
- Auth state managed by `src/contexts/AuthContext.tsx`
- `useAuth()` provides: `user`, `profile`, `signOut`, `isLoading`
- Routes protected by `RouteGuard` component in `src/components/auth/RouteGuard.tsx`

### Organisation Context
- Multi-tenant state managed by `src/contexts/OrgContext.tsx`
- `useOrg()` provides: `currentOrg`, `currentRole`, `hasOrgs`, `isLoading`
- Roles: `owner`, `admin`, `teacher`, `finance`, `parent`
- **Every** data query must scope to `currentOrg.id` — never leak data across orgs

### Route Protection
- Admin pages → `AppLayout` + role check
- Parent pages → `PortalLayout` + parent role check
- Marketing pages → `MarketingLayout` (public)
- Feature-gated content → `FeatureGate` component from `src/components/subscription/`
- If a user doesn't have permission, show a clear message — don't silently hide or 404

### Permission Rules
| Role | Can Access |
|------|-----------|
| Owner | Everything |
| Admin | Everything except billing/subscription management |
| Teacher | Dashboard, Calendar, their own students, Register, Practice, Resources, Messages |
| Finance | Dashboard, Invoices, Reports, limited Student view |
| Parent | Portal only (PortalHome, PortalSchedule, PortalInvoices, PortalPractice, PortalResources, PortalMessages, PortalProfile) |

## Data Integrity

### Deletion
- All deletions use `DeleteValidationDialog` from `src/components/shared/DeleteValidationDialog.tsx`
- The `useDeleteValidation` hook checks dependencies before allowing deletion
- **Blocked deletions:** Entity has active dependencies that would break (e.g., teacher with future lessons)
- **Warned deletions:** Entity has historical data that will be affected (shows what will be impacted)
- **Never** allow cascade deletes without explicit user confirmation
- Soft deletes preferred where data has historical significance (e.g., students → inactive, not deleted)

### Recurring Events
- Editing recurring lessons always asks: "This event only" or "All future events" via `RecurringActionDialog` / `RecurringEditDialog`
- Deleting recurring lessons: same pattern
- Calendar sync must respect recurring event changes

### Currency
- All money stored in **minor units** (pence) as integers
- Display using `formatCurrencyMinor()` from `src/lib/utils.ts`
- Never use floating point for money calculations

### Dates & Times
- All dates stored in UTC in the database
- Display using org timezone from `useOrgTimezone` hook
- UK format: `dd/MM/yyyy`, `HH:mm` (24-hour)
- Use `date-fns` and `date-fns-tz` for all date manipulation
- `formatDateUK` and `formatTimeUK` from utils for consistent formatting

## Real-Time Features

- Invoice updates use `useRealtimeInvoices` for live status changes
- Internal messages update in real-time
- Calendar data refreshes on focus/reconnect via React Query
- Offline state detected by `useOnlineStatus` hook, shown via `OfflineBanner`
- **Never** assume connectivity — always handle the offline case

## Subscription & Feature Gating

- Subscription state managed by `useSubscription` hook
- Features gated by `useFeatureGate` hook and `FeatureGate` component
- Usage limits tracked by `useUsageCounts` hook
- When a user hits a limit: show `UpgradeBanner`, not a generic error
- Trial expiry handled by `TrialExpiredModal`
- **Never** silently fail on a gated feature — always explain why and how to upgrade

## Navigation & Routing

- Routes defined in `src/config/routes.ts` and `src/App.tsx`
- Auto-breadcrumbs via `AutoBreadcrumbs` component
- Scroll to top on navigation via `ScrollToTop` component
- Page metadata (title) set by `usePageMeta` hook
- Back navigation should work sensibly — never trap users
- 404 handled by `NotFound` page

## Audit Logging

- Security-sensitive actions logged via `src/lib/auditLog.ts`
- Viewable in Settings → Audit Log tab
- Actions to log: login, role changes, deletion of entities, settings changes, data exports
- Logs include: who, what, when, and relevant entity IDs

## Testing Standards

- Test files in `src/test/` mirror the feature structure
- Use test helpers from `src/test/helpers/` (mockAuth, mockOrg, mockSupabase, testWrappers)
- Every bug fix should include a verification step (test or manual checklist)
- Key areas with existing tests: auth flows, billing calculations, calendar operations, permissions, portal, practice streaks
