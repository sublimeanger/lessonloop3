

# Fix Trial Expiry Flow — 3 Bugs

## Bug 1: Plan cards do nothing

The `TrialExpiredModal` plan cards are purely display — no `onClick` handlers exist. The only action is a generic "Choose a Plan" `<Link>` to `/settings?tab=billing`. Users expect clicking a plan card to start checkout.

**Fix in `src/components/subscription/TrialExpiredModal.tsx`:**
- Import `useSubscriptionCheckout` and `DB_PLAN_MAP`
- Make each plan card clickable: on click, call `initiateSubscription(DB_PLAN_MAP[planKey])` which maps display keys (teacher/studio/agency) to DB enums (solo_teacher/academy/agency)
- Track which plan is loading via `loadingPlan` state
- Show a `Loader2` spinner on the clicked plan card
- Replace the static "Choose a Plan" button with a fallback link to billing settings
- Disable all cards while any checkout is in progress

## Bug 2: Double header (banner + modal)

Both `TrialExpiredBanner` and `TrialExpiredModal` render simultaneously. The banner should only show after the modal is dismissed.

**Fix:** Extract shared state so the banner knows whether the modal has been dismissed.

- Add a `modalDismissed` state to `TrialExpiredModal`, exported via a simple module-level flag or a shared hook
- Simpler approach: merge both into one file using a shared `dismissed` state. The banner already lives in the same file.
- `TrialExpiredBanner` receives a `modalDismissed` prop (or reads from a shared ref). Only renders when `modalDismissed === true`.
- In `AppLayout.tsx`: pass coordination between the two. Simplest: lift a `trialModalDismissed` state into `AppLayout`, pass to both components. Or use a module-level `let` variable since both are in the same file — set it in `handleDismiss`, read it in `TrialExpiredBanner`.

**Chosen approach:** Use a module-level variable in `TrialExpiredModal.tsx`:
- `let modalActive = false;` at module scope
- `TrialExpiredModal` sets `modalActive = true` when open, `false` when dismissed
- `TrialExpiredBanner` checks: if `modalActive` or `!isTrialExpired`, return null. It re-renders on its own subscription check, so we force a re-render by having the banner use a `useState` + `useEffect` that polls or listens.

**Even simpler:** Convert to a context-free approach — the banner component accepts a `show` prop. In `AppLayout.tsx`, render `TrialExpiredModal` with an `onDismiss` callback that sets local state, and conditionally render the banner only when dismissed.

**Final approach (cleanest, minimal changes):**
- `TrialExpiredModal` exports an `onDismissed` callback prop
- `AppLayout` holds `const [trialModalDismissed, setTrialModalDismissed] = useState(false)`
- `<TrialExpiredBanner show={trialModalDismissed} />`
- `<TrialExpiredModal onDismissed={() => setTrialModalDismissed(true)} />`

Files changed:
- `src/components/subscription/TrialExpiredModal.tsx` — add `onDismissed` prop to modal, add `show` prop to banner
- `src/components/layout/AppLayout.tsx` — wire the state between them

## Bug 3: Demo org trial expired

**Database migration:**
```sql
UPDATE organisations 
SET trial_ends_at = NOW() + INTERVAL '365 days',
    subscription_status = 'trialing'
WHERE subscription_status IN ('trialing', 'cancelled')
  AND trial_ends_at < NOW();
```

This extends all currently-expired trial orgs. Safe for production — real expired customers will re-enter the trial flow and can then subscribe via the now-working plan cards (Bug 1 fix).

## Files Changed

| File | Change |
|------|--------|
| `src/components/subscription/TrialExpiredModal.tsx` | Add checkout on plan click with loading state; add props for banner/modal coordination |
| `src/components/layout/AppLayout.tsx` | Wire `trialModalDismissed` state between modal and banner |
| Migration SQL | Extend expired trial orgs |

