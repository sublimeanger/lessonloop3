

## Plan: Add "Send Login Invite" Toggle to Teacher Creation

### Problem
When creating teachers (both during onboarding and from the /teachers page), there's no option to send them a login invite. The teacher gets created as an unlinked profile record with no system access.

### Key Finding: No "Add Teachers" Onboarding Step Exists
The onboarding wizard has 4 steps: Welcome → About You → Your Data → Plan. There is **no teacher-adding step** in onboarding. Teachers are only added from the `/teachers` page. The request to add this to onboarding would require creating an entirely new onboarding step, which is a significant scope change.

### What I'll Implement

**1. Add "Send login invite" checkbox to the Create Teacher dialog on `/teachers`**

In `src/pages/Teachers.tsx`:
- Add a `sendInvite` state (default: `true`) to the create teacher flow
- Add a styled checkbox below the form fields: "Send login invite" with helper text
- When email is empty, show a muted note: "No email — you can invite them later from Settings → Members"
- When `sendInvite` is on and email is provided, after the teacher is created successfully, automatically create an invite record via the same `supabase.from('invites').insert(...)` + `supabase.functions.invoke('send-invite-email', ...)` pattern used in `InviteMemberDialog.tsx`
- Show toast: "Invite sent to [email]"

**2. Reuse the existing invite mechanism**
The invite flow from `InviteMemberDialog.tsx` will be extracted into a reusable function (or called inline) that:
1. Inserts into the `invites` table with `role: 'teacher'` and the org ID
2. Calls the `send-invite-email` edge function with the invite ID
3. Shows appropriate toasts

**3. Styling (mobile + desktop)**
- The checkbox uses the existing `Checkbox` component with the `min-h-11` touch target pattern
- On mobile: full-width layout, checkbox row has adequate padding (`p-3 sm:p-4`)
- Conditional note for missing email styled as `text-xs text-muted-foreground` with an info icon

**4. Fix pre-existing build errors**
The 26 build errors shown are all in edge functions and pre-date this change. They involve TypeScript casting issues and null checks. I'll fix them in the same pass:
- `notify-makeup-match/index.ts`: Fix array-to-object type casts (use `[0]` accessor)
- `overdue-reminders/index.ts`: Add null guards for `guardian`, fix Supabase client type
- `stripe-billing-history/index.ts`: Add type annotation for `inv` parameter
- `stripe-create-checkout/index.ts` & `stripe-create-payment-intent/index.ts`: Add null guard for `orgConnect`
- `stripe-list-payment-methods/index.ts`: Add type annotation for `pm`
- `zoom-sync-lesson/index.ts`: Fix type casts and Supabase client type

### Files to Modify
- `src/pages/Teachers.tsx` — Add sendInvite toggle + post-create invite logic
- `supabase/functions/notify-makeup-match/index.ts` — Fix type casts
- `supabase/functions/overdue-reminders/index.ts` — Fix null checks + client type
- `supabase/functions/stripe-billing-history/index.ts` — Fix implicit any
- `supabase/functions/stripe-create-checkout/index.ts` — Fix null check
- `supabase/functions/stripe-create-payment-intent/index.ts` — Fix null check
- `supabase/functions/stripe-list-payment-methods/index.ts` — Fix implicit any
- `supabase/functions/zoom-sync-lesson/index.ts` — Fix type casts + client type

