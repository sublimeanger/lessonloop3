
# Google Calendar and Apple Calendar Integration

## Overview
Add bidirectional calendar synchronization allowing LessonLoop users to sync their lessons with Google Calendar and Apple Calendar (via iCal/CalDAV). This is a tier-gated feature (listed in pricing config for Teacher plan and above).

---

## Architecture Decision

### Sync Strategy: Two-Way with Primary Source
- **LessonLoop is the primary source of truth** for lesson data
- **Push to external calendars**: When lessons are created/updated/deleted in LessonLoop, changes push to connected calendars
- **Pull for free/busy only**: External calendar events create "blocked" time slots for conflict detection, but don't create lessons

### Why This Approach?
1. Prevents data corruption from external edits
2. Maintains billing and attendance integrity
3. Simpler conflict resolution
4. Users can still see their personal commitments when scheduling

---

## Database Schema Changes

### New Table: `calendar_connections`
Stores OAuth tokens and sync metadata per user.

```text
┌─────────────────────────────────────────────────────────────┐
│ calendar_connections                                        │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ user_id         UUID REFERENCES auth.users(id)              │
│ org_id          UUID REFERENCES organisations(id)           │
│ provider        TEXT ('google' | 'apple')                   │
│ calendar_id     TEXT (external calendar identifier)         │
│ calendar_name   TEXT                                        │
│ access_token    TEXT (encrypted)                            │
│ refresh_token   TEXT (encrypted)                            │
│ token_expires_at TIMESTAMPTZ                                │
│ sync_enabled    BOOLEAN DEFAULT true                        │
│ last_sync_at    TIMESTAMPTZ                                 │
│ sync_status     TEXT ('active'|'error'|'disconnected')      │
│ created_at      TIMESTAMPTZ                                 │
│ updated_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘
```

### New Table: `calendar_event_mappings`
Links LessonLoop lessons to external calendar events for sync tracking.

```text
┌─────────────────────────────────────────────────────────────┐
│ calendar_event_mappings                                     │
├─────────────────────────────────────────────────────────────┤
│ id                UUID PRIMARY KEY                          │
│ connection_id     UUID REFERENCES calendar_connections(id)  │
│ lesson_id         UUID REFERENCES lessons(id)               │
│ external_event_id TEXT                                      │
│ sync_status       TEXT ('synced'|'pending'|'failed')        │
│ last_synced_at    TIMESTAMPTZ                               │
│ error_message     TEXT                                      │
│ created_at        TIMESTAMPTZ                               │
└─────────────────────────────────────────────────────────────┘
```

### New Table: `external_busy_blocks`
Stores free/busy data pulled from external calendars for conflict detection.

```text
┌─────────────────────────────────────────────────────────────┐
│ external_busy_blocks                                        │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ connection_id   UUID REFERENCES calendar_connections(id)    │
│ user_id         UUID                                        │
│ org_id          UUID                                        │
│ start_at        TIMESTAMPTZ                                 │
│ end_at          TIMESTAMPTZ                                 │
│ title           TEXT (optional, for display)                │
│ source_event_id TEXT                                        │
│ fetched_at      TIMESTAMPTZ                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Edge Functions (Backend)

### 1. `calendar-oauth-start`
Initiates OAuth flow for Google Calendar.
- Generates state token, stores in session
- Redirects to Google OAuth consent screen
- Scopes: `calendar.events`, `calendar.readonly`

### 2. `calendar-oauth-callback`
Handles OAuth callback from Google.
- Exchanges code for tokens
- Stores encrypted tokens in `calendar_connections`
- Fetches user's calendar list for selection

### 3. `calendar-sync-lesson`
Pushes lesson changes to connected calendars.
- Called via database trigger on `lessons` INSERT/UPDATE/DELETE
- Creates/updates/deletes events in external calendar
- Updates `calendar_event_mappings`

### 4. `calendar-fetch-busy`
Pulls free/busy data from external calendars.
- Scheduled job (every 15 minutes) or on-demand
- Fetches next 14 days of events
- Stores in `external_busy_blocks` table
- Used by conflict detection

### 5. `calendar-disconnect`
Revokes OAuth tokens and removes connection.
- Deletes all synced events from external calendar (optional)
- Cleans up mapping records

### 6. `calendar-ical-feed`
Generates a read-only iCal (.ics) feed URL for Apple Calendar.
- Token-based authentication (unique URL per user)
- Returns all lessons in iCal format
- Enables Apple Calendar subscription

---

## Apple Calendar Strategy

Apple Calendar doesn't have a simple OAuth API like Google. Two approaches:

### Option A: iCal Feed (Read-Only) - Recommended for MVP
- Generate a unique iCal feed URL per user
- Users subscribe to this URL in Apple Calendar
- One-way sync (LessonLoop → Apple Calendar)
- No push notifications, relies on calendar app refresh (typically 15-60 min)

### Option B: CalDAV Integration (Full Sync) - Future
- Requires users to provide Apple ID app-specific password
- More complex to implement
- Full two-way sync possible

**MVP Recommendation**: Implement iCal feed for Apple Calendar.

---

## Frontend Components

### 1. `CalendarIntegrationsTab.tsx` (Settings)
New tab in Settings page:
- "Connect Google Calendar" button with OAuth flow
- "Get Apple Calendar Link" for iCal subscription URL
- Connected calendar status display
- Sync toggle and last sync timestamp
- Disconnect button

### 2. Update Conflict Detection Hook
Modify `useConflictDetection.ts`:
- Query `external_busy_blocks` table
- Add "External calendar conflict" as a new conflict type
- Display as warning (not blocking error)

### 3. Calendar Grid Enhancement
Optional visual indicator for external busy blocks:
- Render as semi-transparent overlay on calendar grid
- Tooltip: "Busy (Personal Calendar)"

---

## Security Considerations

1. **Token Encryption**: Store OAuth tokens encrypted at rest using Supabase Vault
2. **RLS Policies**: Users can only access their own calendar connections
3. **iCal Feed Security**: Use long random tokens in feed URLs, allow regeneration
4. **Scope Limitation**: Request minimum necessary Google scopes
5. **Token Refresh**: Implement automatic token refresh before expiration

---

## API Keys Required

### Google Calendar API
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

These will need to be added as secrets and the Google Cloud Console project configured with:
- Calendar API enabled
- OAuth consent screen configured
- Authorized redirect URI set

---

## Implementation Phases

### Phase 1: Database & iCal Feed (Apple Calendar)
1. Create database tables with migrations
2. Implement `calendar-ical-feed` edge function
3. Add CalendarIntegrationsTab to Settings
4. Display iCal subscription URL for users

### Phase 2: Google Calendar OAuth
1. Configure Google Cloud Console project
2. Implement OAuth start/callback edge functions
3. Store tokens securely
4. Add Google Calendar connect UI

### Phase 3: Push Sync (LessonLoop → Google)
1. Implement `calendar-sync-lesson` edge function
2. Create database trigger on lessons table
3. Handle recurring lesson series

### Phase 4: Free/Busy Pull
1. Implement `calendar-fetch-busy` edge function
2. Create scheduled cron job
3. Integrate with conflict detection
4. Add visual indicators to calendar grid

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/settings/CalendarIntegrationsTab.tsx` | Settings UI for calendar connections |
| `src/hooks/useCalendarConnections.ts` | Hook for managing calendar connections |
| `supabase/functions/calendar-ical-feed/index.ts` | iCal feed generation |
| `supabase/functions/calendar-oauth-start/index.ts` | Google OAuth initiation |
| `supabase/functions/calendar-oauth-callback/index.ts` | OAuth callback handler |
| `supabase/functions/calendar-sync-lesson/index.ts` | Push lesson changes to Google |
| `supabase/functions/calendar-fetch-busy/index.ts` | Pull free/busy data |
| `supabase/functions/calendar-disconnect/index.ts` | Revoke and cleanup |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Settings.tsx` | Add "Calendar Sync" tab |
| `src/hooks/useConflictDetection.ts` | Query external_busy_blocks |
| `src/components/calendar/CalendarGrid.tsx` | Optional busy block overlay |
| `src/lib/pricing-config.ts` | Already lists "Calendar sync" as feature |

---

## Technical Notes

- **Timezone Handling**: All external events converted to UTC, then to org timezone for display
- **Rate Limiting**: Google Calendar API has quotas; implement exponential backoff
- **Graceful Degradation**: If sync fails, lessons still work; show sync error badge
- **Audit Logging**: Log all calendar sync actions to audit_log table

