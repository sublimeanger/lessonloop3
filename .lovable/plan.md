

## Advanced Message Filtering for Admins

### Overview
Add a rich filter bar to the Conversations tab so org admins can quickly narrow correspondence by guardian, student, teacher (sender), channel, and date range. The filters sit between the search/view toggle row and the thread list, using a collapsible panel pattern consistent with the existing `InvoiceFiltersBar` and `RecipientFilter` components.

### What Changes

**1. New Component: `MessageFiltersBar`** (`src/components/messages/MessageFiltersBar.tsx`)
- Collapsible filter panel toggled by the existing Filter icon area
- Filter chips/controls for:
  - **Guardian** -- searchable combobox (Command-based) populated from guardians table
  - **Student** -- searchable combobox populated from students table
  - **Teacher / Sender** -- searchable combobox populated from org staff (teachers + admins)
  - **Channel** -- pill toggle: All | Email | In-App
  - **Date range** -- "From" and "To" date pickers
- Active filter count badge on the filter toggle button
- "Clear all" button when any filter is active
- Only visible to admin/owner roles

**2. New Hook: `useFilteredMessageThreads`** (extend `src/hooks/useMessageThreads.ts`)
- Add a new query function that accepts filter parameters and builds the Supabase query dynamically:
  - `guardian_id` -- filters by `recipient_id` where `recipient_type = 'guardian'`
  - `student_id` -- filters by `related_id` (the linked student on message_log)
  - `sender_user_id` -- filters by `sender_user_id` (for teacher/staff filtering)
  - `channel` -- filters by `channel` column (`email` or `inapp`)
  - `date_from` / `date_to` -- filters by `created_at` range
- Reuse existing `groupMessagesIntoThreads` for thread grouping
- Falls back to unfiltered `useMessageThreads` when no filters are active

**3. Update `ThreadedMessageList`** (`src/components/messages/ThreadedMessageList.tsx`)
- Accept filter state as props
- Pass filters to the new filtered query hook
- Show active filter summary/tags above results

**4. Update `Messages` page** (`src/pages/Messages.tsx`)
- Add filter state management (`useState` for each filter dimension)
- Render `MessageFiltersBar` between the search row and thread list (Conversations tab only)
- Pass filter state down to `ThreadedMessageList`

**5. Data sources for filter dropdowns**
- Guardians: reuse existing guardians query (already fetched for compose)
- Students: use `useStudents` hook
- Teachers/Staff: use `useOrgMembers` hook filtered to staff roles

### Technical Details

**Filter State Shape:**
```text
interface MessageFilters {
  guardian_id?: string;
  student_id?: string;
  sender_user_id?: string;
  channel?: 'email' | 'inapp';
  date_from?: string;    // ISO date
  date_to?: string;      // ISO date
}
```

**Query Building (in useMessageThreads.ts):**
```text
When filters are active, build a separate useInfiniteQuery with:
  - .eq('recipient_id', guardian_id)        if guardian_id set
  - .eq('related_id', student_id)           if student_id set
  - .eq('sender_user_id', sender_user_id)   if sender set
  - .eq('channel', channel)                 if channel set
  - .gte('created_at', date_from)           if date_from set
  - .lte('created_at', date_to)             if date_to set
```

**Combobox Pattern:**
Uses the existing `Command` component (cmdk) inside a `Popover` for searchable dropdowns -- same pattern as other entity selectors in the app.

**Responsive Design:**
- On desktop: filters render inline as a horizontal bar with popovers
- On mobile: filters collapse into a "Filters" button that opens a sheet/drawer with stacked controls

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/messages/MessageFiltersBar.tsx` | Create -- filter bar component |
| `src/hooks/useMessageThreads.ts` | Modify -- add filtered query hook |
| `src/components/messages/ThreadedMessageList.tsx` | Modify -- accept and pass filter props |
| `src/pages/Messages.tsx` | Modify -- add filter state and render filter bar |

