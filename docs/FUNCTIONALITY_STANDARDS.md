# LessonLoop Functionality Standards — World-Class Standard

> These are the rules for how every feature must work. Read before building or fixing any functionality. Every interaction must be predictable, fast, and graceful.

---

## 1. Error Handling

### Supabase API Calls
```tsx
const { data, error } = await supabase.from('students').select('*');
if (error) {
  logger.error('Failed to load students:', error);
  Sentry.captureException(error);
  toast({ title: 'Failed to load students', description: 'Please try again.', variant: 'destructive' });
  return;
}
```
- Every query: destructure `{ data, error }`, check error case
- Errors → `src/lib/error-handler.ts` → `src/lib/logger.ts` → `src/lib/sentry.ts`
- User-facing: friendly toast, NEVER raw database errors
- Log original error for debugging

### React Query
- ALL data fetching via custom hooks in `src/hooks/` using `@tanstack/react-query`
- Stale times from `src/config/query-stale-times.ts` — never override without reason
- `isLoading` / `isPending` → drives skeleton/loading UI
- `isError` → drives error UI
- Mutations use `useMutation` with `onSuccess`, `onError`, and `onMutate` (for optimistic)
- `onSuccess` → invalidate relevant queries, show success toast, close modal
- `onError` → show error toast, keep form open with user data intact
- **NEVER leave stale data visible after a mutation**

### Form Submission Pattern
```tsx
const [saving, setSaving] = useState(false);

async function handleSubmit() {
  setSaving(true);
  try {
    await mutation.mutateAsync(formData);
    toast({ title: 'Student created' });
    onClose();
  } catch (err) {
    toast({ title: 'Failed to create student', variant: 'destructive' });
    // Form stays open, data preserved
  } finally {
    setSaving(false);
  }
}

<Button disabled={saving}>
  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
  Save
</Button>
```

---

## 2. Validation

### Client-Side
- Zod schemas from `src/lib/schemas.ts` for all form validation
- Additional utils in `src/lib/validation.ts`
- Validate on **blur** AND on **submit** — not on every keystroke
- Inline errors below the field: `<p className="text-sm text-destructive mt-1">Name is required</p>`
- Required fields marked with visual indicator

### Sanitisation
- All user text → `src/lib/sanitize.ts` before storage
- File uploads → `src/lib/resource-validation.ts` (type, size, name)
- Never trust client-side only — Supabase RLS is the real guard

### Common Rules
| Field | Validation |
|-------|-----------|
| Email | Valid format, not empty |
| Names | 2-100 chars, sanitised, not whitespace-only |
| Phone | Optional, basic format if provided |
| Dates | Valid date, logical ranges (end > start) |
| Currency | Non-negative, stored in minor units (pence) |
| Files | Max size enforced, allowed MIME types only |

---

## 3. Authentication & Authorisation

### Auth System
- State: `src/contexts/AuthContext.tsx` → `useAuth()` provides `user`, `profile`, `signOut`, `isLoading`
- Routes: `RouteGuard` in `src/components/auth/RouteGuard.tsx`
- Multi-tenant: `src/contexts/OrgContext.tsx` → `useOrg()` provides `currentOrg`, `currentRole`, `hasOrgs`
- **EVERY data query MUST scope to `currentOrg.id`** — zero tolerance for data leakage

### Roles & Access
| Role | Access |
|------|--------|
| `owner` | Everything |
| `admin` | Everything except billing/subscription management |
| `teacher` | Dashboard, Calendar, their students, Register, Practice, Resources, Messages |
| `finance` | Dashboard, Invoices, Reports, limited Student view |
| `parent` | Portal only (Home, Schedule, Invoices, Practice, Resources, Messages, Profile) |

### Route Protection Rules
- Admin pages → `AppLayout` + role check in component
- Portal pages → `PortalLayout` + parent role check
- Marketing → `MarketingLayout` (public)
- Feature-gated → `FeatureGate` component
- No permission → clear message explaining why, never silent hide or 404
- Parent accessing admin route → redirect to `/portal/home`

---

## 4. Data Integrity

### Deletion
- ALL deletions → `DeleteValidationDialog` → `useDeleteValidation` hook
- **Blocked:** Active dependencies that would break (teacher with future lessons)
- **Warned:** Historical data affected (shows impact before confirming)
- **NEVER** cascade delete without explicit confirmation
- Soft deletes preferred: students → inactive, not deleted

### Recurring Events
- Edit/delete → ALWAYS ask: "This event only" or "All future events"
- Via `RecurringActionDialog` / `RecurringEditDialog`
- Calendar sync must respect recurring changes

### Currency
- Stored in **minor units** (pence) as integers — NEVER float
- Display via `formatCurrencyMinor()` from `src/lib/utils.ts`
- Format: `new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`

### Dates & Timezones
- Database: UTC always
- Display: org timezone from `useOrgTimezone` hook
- Format: `formatDateUK()`, `formatTimeUK()`, `formatDateTimeForOrg()` from utils
- UK format: dd/MM/yyyy, HH:mm (24-hour)
- Libraries: `date-fns` + `date-fns-tz` only

---

## 5. Real-Time & Connectivity

- Invoice updates: `useRealtimeInvoices` for live status changes
- Internal messages: real-time updates
- Calendar: refreshes on focus/reconnect via React Query
- Offline: `useOnlineStatus` hook → `OfflineBanner` component
- **NEVER assume connectivity** — handle offline gracefully

---

## 6. Subscription & Feature Gating

- State: `useSubscription` hook
- Feature checks: `useFeatureGate` hook, `FeatureGate` component
- Usage limits: `useUsageCounts` hook
- Hit limit → `UpgradeBanner` with clear explanation — NOT a generic error
- Trial expiry → `TrialExpiredModal`
- **NEVER silently fail on a gated feature**

---

## 7. Navigation

- Routes: `src/config/routes.ts` + `src/App.tsx`
- Breadcrumbs: `AutoBreadcrumbs` component
- Scroll reset: `ScrollToTop` component
- Page title: `usePageMeta` hook → format: `[Page] | LessonLoop`
- Back nav: always works sensibly, never traps users
- 404: `NotFound` page
- Deep links: every page loads correctly on direct URL visit

---

## 8. Audit Logging

- Via `src/lib/auditLog.ts`
- View in Settings → Audit Log tab
- Log: login, role changes, deletions, settings changes, data exports
- Format: who, what, when, entity IDs

---

## 9. Testing

- Tests in `src/test/` mirror feature structure
- Helpers: `src/test/helpers/` (mockAuth, mockOrg, mockSupabase, testWrappers)
- Every bug fix → verification step (test or manual checklist)
- Key test areas: auth, billing calculations, calendar ops, permissions, portal, practice streaks

---

## 10. Performance

- React Query caching prevents redundant fetches
- Lazy loading for heavy pages (already in App.tsx with `React.lazy`)
- Images: `loading="lazy"` attribute
- Lists with >50 items: pagination or virtual scrolling
- Bundle: code-split by route
- No console.log spam in production
- No unnecessary re-renders from unstable references
