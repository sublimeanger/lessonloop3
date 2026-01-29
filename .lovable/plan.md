

# Fix OAuth Redirects, Calendar Connection Feedback & Demo Data Population

## Summary

This plan addresses three distinct issues:
1. **OAuth Signup Redirect Bug** - Google/Apple sign-up redirects to homepage instead of onboarding
2. **Calendar Connection Feedback** - No success confirmation when connecting Google Calendar
3. **Demo Data Population** - Create comprehensive data for `jamie@searchflare.co.uk` to showcase calendar sync

---

## Issue 1: OAuth Signup Redirects to Homepage

### The Problem
When a new user signs up with Google or Apple, the OAuth redirect is set to `window.location.origin` (the homepage `/`). After authentication, the user lands on `/` which is the marketing homepage, not a protected route, so no redirect logic kicks in to send them to `/onboarding`.

### Root Cause
In `Login.tsx` and `Signup.tsx`:
```typescript
const { error } = await lovable.auth.signInWithOAuth('google', {
  redirect_uri: window.location.origin, // Returns to "/"
});
```

The homepage (`/`) is a public marketing page (`MarketingHome`), not wrapped in `PublicRoute`. When a newly authenticated user lands there, there's no guard to redirect them to `/onboarding`.

### Solution
Change the redirect URI to explicitly target `/login` (which IS wrapped in `PublicRoute`). After OAuth completes and the user is authenticated, `PublicRoute` will detect:
- User is authenticated
- Profile is missing or `has_completed_onboarding` is false
- Redirect to `/onboarding`

### Files to Modify
- `src/pages/Login.tsx`: Lines 28-29 and 44-45
- `src/pages/Signup.tsx`: Lines 29-30 and 45-46

### Code Changes
```typescript
// Change from:
redirect_uri: window.location.origin,

// To:
redirect_uri: `${window.location.origin}/login`,
```

---

## Issue 2: No Success Feedback for Google Calendar Connection

### The Problem
After completing Google Calendar OAuth, the user is redirected to `/settings?calendar_connected=google` but there's no visible feedback - they're just on the settings page.

### Root Cause
The `useCalendarConnections` hook handles the query parameter and shows a toast, but this happens ONLY if the user lands on a page that uses this hook. The Settings page must be on the Calendar Integrations tab for this to work.

Looking at the callback edge function, it redirects to:
```typescript
return Response.redirect(`${redirectUri}?calendar_connected=google`);
```

The issue is that `redirectUri` comes from the OAuth start state, which uses `/settings?tab=calendar`. The query parameter handling in `useCalendarConnections` then shows the toast, but the UX still feels abrupt.

### Solution
1. Enhance the callback flow to show a dedicated success toast
2. Ensure the Settings page opens on the correct tab
3. Add a brief "Connected!" badge animation to the calendar card

### Files to Modify
- `src/hooks/useCalendarConnections.ts`: Enhance the URL parameter handling to show a more prominent success message
- `src/components/settings/CalendarIntegrationsTab.tsx`: Add a "just connected" animation state

### Code Changes

**In `useCalendarConnections.ts`** (lines 152-165):
```typescript
if (calendarConnected) {
  toast({ 
    title: 'Google Calendar connected successfully!', 
    description: 'Your lessons will now sync automatically. You can manage this connection below.',
    duration: 5000,
  });
  // Clean up URL and ensure we stay on calendar tab
  const url = new URL(window.location.href);
  url.searchParams.delete('calendar_connected');
  url.searchParams.set('tab', 'calendar'); // Ensure tab stays visible
  window.history.replaceState({}, '', url.toString());
  refetch();
}
```

**In `CalendarIntegrationsTab.tsx`**:
Add a state to detect "just connected" and show a subtle highlight/animation on the Google Calendar card for a few seconds.

---

## Issue 3: Demo Data Population for jamie@searchflare.co.uk

### Account Details
- **User ID**: `29ae9f1e-c528-40ea-b9e8-84c2f03b15a9`
- **Org ID**: `ab483977-e53b-450a-ab1b-b64c921cae9b`
- **Email**: `jamie@searchflare.co.uk`
- **Name**: Jamie McKaye
- **Current Data**: 0 students, 0 lessons, 0 invoices

### Data to Create

#### Students (15 students - mix of ages and instruments)
| First Name | Last Name | Instrument | Age Range | Status |
|------------|-----------|------------|-----------|--------|
| Oliver | Thompson | Piano | 8-10 | active |
| Sophie | Williams | Violin | 12-14 | active |
| Jack | Brown | Guitar | 10-12 | active |
| Emily | Davies | Piano | 14-16 | active |
| Harry | Wilson | Drums | 11-13 | active |
| Amelia | Taylor | Flute | 9-11 | active |
| George | Anderson | Piano | 7-9 | active |
| Isabella | Thomas | Cello | 13-15 | active |
| Noah | Roberts | Guitar | 15-17 | active |
| Mia | Johnson | Violin | 10-12 | active |
| Oscar | Evans | Saxophone | 12-14 | active |
| Charlotte | Lewis | Piano | 8-10 | active |
| Alfie | Walker | Drums | 14-16 | active |
| Lily | Hall | Clarinet | 11-13 | active |
| Freddie | Green | Guitar | 9-11 | active |

#### Guardians (one per student for simplicity)
Create 15 guardians with realistic UK names, linking each to their respective student.

#### Lessons (40+ lessons)
- **Past lessons** (20): Spread over the last 4 weeks, all marked `completed`
- **Today's lessons** (3-4): For demo timeline
- **Future lessons** (15-20): Next 3 weeks
- All lessons assigned to Jamie (the teacher/owner)
- Mix of 30-minute and 45-minute slots
- Spread across Monday-Friday, 3pm-7pm (typical after-school slots)

#### Invoices (8-10 invoices)
- 3-4 **paid** invoices (for past lessons)
- 2-3 **sent** invoices (pending payment)
- 1-2 **overdue** invoices (for demo of outstanding reports)
- 1 **draft** invoice

#### Rate Cards
- Piano: £35/30min, £50/45min
- Guitar: £32/30min, £45/45min
- Violin/Cello: £38/30min, £55/45min
- Drums: £40/45min
- Wind instruments: £35/30min, £50/45min

### Database Migration Approach
Create an edge function `seed-demo-data` that can be called to populate this data, OR use a direct SQL migration. The edge function approach is safer as it can be re-run without creating duplicates.

### Files to Create
- `supabase/functions/seed-demo-data/index.ts`: Edge function to populate demo data

### Implementation Notes
- All data will be scoped to org_id `ab483977-e53b-450a-ab1b-b64c921cae9b`
- The teacher_user_id for all lessons will be `29ae9f1e-c528-40ea-b9e8-84c2f03b15a9` (Jamie)
- Use realistic UK phone numbers and email patterns
- Lesson times in Europe/London timezone

---

## Google Verification Clarification

You're correct that the Google verification video does **NOT** need to show:
- The Google Login button for app authentication (uses non-sensitive scopes)

The video **MUST** show:
1. **Settings > Calendar Integrations** page
2. Click "Connect" on Google Calendar
3. The Google OAuth consent screen (showing sensitive scopes: calendar.events, calendar.readonly)
4. Successful redirect back showing "Connected" status
5. Creating/editing a lesson and seeing it sync to Google Calendar
6. External calendar events appearing as busy blocks

The populated demo data will make this flow look professional with actual lessons to sync.

---

## Technical Implementation Order

1. **Fix OAuth redirect** (quick win - 5 minutes)
2. **Enhance calendar connection feedback** (10 minutes)
3. **Create and run demo data population** (30 minutes)

---

## Testing Checklist

After implementation:
- [ ] Sign up with a new Google account - should land on /onboarding
- [ ] Sign up with a new Apple account - should land on /onboarding
- [ ] Connect Google Calendar - should see success toast and badge
- [ ] Verify demo data appears in jamie@searchflare.co.uk account
- [ ] Dashboard shows today's lessons
- [ ] Calendar shows 4+ weeks of lessons
- [ ] Invoices page shows mix of statuses
- [ ] Reports show meaningful data

