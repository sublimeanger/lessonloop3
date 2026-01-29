
# Fix OAuth Redirect Issues, Sign Out, and Google Calendar Connection

## Summary
This plan addresses three interconnected authentication and OAuth issues:
1. **Random Dashboard Redirects** - Authenticated users on public pages get redirected unexpectedly
2. **Sign Out Not Working with Google OAuth** - Session persists after signing out
3. **Google Calendar Connection Has No Feedback** - After connecting, user is redirected without clear success confirmation

---

## Root Cause Analysis

### Issue 1: OAuth Redirects to Dashboard Instead of Onboarding

**Problem**: After Google/Apple OAuth sign-in, users land on the dashboard even when they should be directed to onboarding.

**Root Cause**: Two problems:
1. The OAuth `redirect_uri` is set to `/login`, which is a `PublicRoute`
2. `PublicRoute` redirects authenticated users to `/dashboard` (line 149) by default
3. If the profile hasn't loaded yet or `has_completed_onboarding` check fails, the user goes to wrong place

**Impact**: New users skip onboarding; existing users may see unexpected redirects.

### Issue 2: Sign Out Doesn't Fully Log Out

**Problem**: After clicking "Sign out", the user appears to still be logged in when using Google OAuth.

**Root Cause**: 
1. `supabase.auth.signOut()` clears the Supabase session but doesn't clear browser localStorage immediately on all browsers
2. The `onAuthStateChange` listener may not fire consistently
3. The Lovable OAuth bridge (`@lovable.dev/cloud-auth-js`) may have its own session state
4. After sign out, no explicit navigation to `/login` occurs - user stays on current page

**Impact**: Users can't fully log out; leads to confusion about account state.

### Issue 3: Google Calendar No Success Feedback

**Problem**: After connecting Google Calendar, there's no visible confirmation - just a redirect to settings.

**Root Cause**:
1. The edge function callback redirects to `/settings?tab=calendar&calendar_connected=google`
2. The Settings page `Tabs` component uses `defaultValue="profile"`, ignoring the `tab` URL param
3. The toast in `useCalendarConnections` fires correctly, but user may not see it if the tab isn't visible

**Impact**: User has no confirmation their calendar is connected.

---

## Technical Implementation Plan

### Fix 1: Improve Sign Out Robustness

**File**: `src/contexts/AuthContext.tsx`

**Changes**:
```typescript
const signOut = async () => {
  setIsLoading(true);
  
  // Clear all local state first
  setUser(null);
  setSession(null);
  setProfile(null);
  setRoles([]);
  
  // Sign out from Supabase
  await supabase.auth.signOut({ scope: 'global' });
  
  // Clear localStorage auth tokens explicitly
  localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_PROJECT_ID + '-auth-token');
  
  // Invalidate all React Query cache
  // (This will be handled by the calling component)
  
  setIsLoading(false);
};
```

**Navigation After Sign Out**: Update all sign out button handlers to explicitly navigate to `/login` after sign out completes.

**Files to Update**:
- `src/components/layout/AppSidebar.tsx` - Add `navigate('/login')` after signOut
- `src/components/layout/PortalSidebar.tsx` - Add `navigate('/login')` after signOut

### Fix 2: Settings Page Tab Parameter Handling

**File**: `src/pages/Settings.tsx`

**Current Issue**: The `Tabs` component uses `defaultValue="profile"` which ignores URL params.

**Changes**:
```typescript
// Add at the top of the component
const [searchParams] = useSearchParams();
const initialTab = searchParams.get('tab') || 'profile';

// Change Tabs component
<Tabs defaultValue={initialTab} className="space-y-6">
```

**Import Required**: Add `useSearchParams` from `react-router-dom`

### Fix 3: Enhance Calendar Connection Success Feedback

**File**: `src/hooks/useCalendarConnections.ts`

**Current Toast**: Already shows a toast, but timing may be off.

**Improvements**:
1. Show the toast more prominently with a longer duration
2. Ensure the toast fires after the component mounts properly
3. Add a "just connected" state that can trigger UI animations

**Code Changes** (lines 210-227):
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const calendarConnected = params.get('calendar_connected');
  const calendarError = params.get('calendar_error');

  if (calendarConnected) {
    // Slight delay to ensure toast system is ready
    setTimeout(() => {
      toast({ 
        title: '✓ Google Calendar connected!', 
        description: 'Your lessons will now sync automatically.',
        duration: 8000,
      });
    }, 500);
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('calendar_connected');
    window.history.replaceState({}, '', url.toString());
    refetch();
  }
  // ... error handling
}, []);
```

### Fix 4: OAuth Redirect Flow Improvement

**Files**: `src/pages/Login.tsx`, `src/pages/Signup.tsx`

**Issue**: Current redirect to `/login` causes `PublicRoute` to redirect to `/dashboard`.

**Solution**: Keep the redirect to `/login` but ensure `PublicRoute` properly handles the profile loading race condition.

**File**: `src/components/auth/RouteGuard.tsx`

**Changes to `PublicRoute`** (lines 122-150):
```typescript
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading, isInitialised } = useAuth();
  const { currentRole } = useOrg();
  const location = useLocation();

  // Still loading - show loading state
  if (!isInitialised || isLoading) {
    return <AuthLoading />;
  }

  // Not authenticated - show public page
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated - check if we have profile data yet
  // Give a small grace period for profile to load after OAuth
  if (profile === undefined) {
    return <AuthLoading />;
  }

  // Authenticated but no profile or not onboarded - go to onboarding
  if (!profile || !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Authenticated and onboarded - redirect to appropriate dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
```

**Note**: The profile state uses `undefined` vs `null` distinction:
- `undefined` = still loading
- `null` = loaded but no profile exists (needs onboarding)

This requires a small change in AuthContext to distinguish these states.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Enhance signOut to use global scope, clear localStorage explicitly, add navigation callback |
| `src/components/auth/RouteGuard.tsx` | Fix PublicRoute profile loading race condition |
| `src/components/layout/AppSidebar.tsx` | Navigate to /login after signOut |
| `src/components/layout/PortalSidebar.tsx` | Navigate to /login after signOut |
| `src/pages/Settings.tsx` | Read tab from URL params |
| `src/hooks/useCalendarConnections.ts` | Add delay to toast, ensure clean URL handling |

---

## Testing Plan

After implementation, test the following scenarios:

1. **Fresh Google OAuth Signup**:
   - Sign out completely
   - Click "Continue with Google" on signup page
   - Use a Google account that has never used the app
   - Should land on `/onboarding`

2. **Existing User Google Login**:
   - Sign out completely
   - Click "Continue with Google" on login page
   - Use an existing account
   - Should land on `/dashboard`

3. **Sign Out Flow**:
   - Sign in to the app
   - Click sign out
   - Should redirect to `/login`
   - Navigating to `/dashboard` should redirect back to `/login`

4. **Google Calendar Connection**:
   - Go to Settings → Calendar Sync tab
   - Click "Connect" on Google Calendar
   - Complete Google OAuth
   - Should return to Settings with Calendar Sync tab visible
   - Should see success toast

---

## Technical Notes for Implementation

### Session Storage Key Pattern
The Supabase auth token is stored with the key pattern:
```
sb-{project_id}-auth-token
```
For this project: `sb-ximxgnkpcswbvfrkkmjq-auth-token`

### Query Client Cache Clearing
On sign out, the React Query cache should be cleared to prevent stale data:
```typescript
queryClient.clear();
```

This should be called from the component that handles sign out, not from AuthContext.
