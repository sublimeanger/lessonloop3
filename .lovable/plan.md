

## Separate Zoom Meetings into its own Settings tab

### Problem
Zoom Meetings is currently buried inside the "Calendar Sync" tab alongside Google Calendar and Apple Calendar. This is poor discoverability -- Zoom is a video conferencing tool, not a calendar, and users looking for Zoom settings wouldn't intuitively navigate to "Calendar Sync".

### Changes

**1. Add "Zoom Meetings" nav item to SettingsNav.tsx**
- Add a new entry `{ value: 'zoom', label: 'Zoom Meetings', icon: Video }` in the **Teaching** group, placed after "Calendar Sync"
- Import `Video` from lucide-react

**2. Create a new `ZoomIntegrationTab.tsx` component**
- Extract the Zoom section (lines ~366-513) from `CalendarIntegrationsTab.tsx` into its own standalone component
- Reuse the same `useCalendarConnections` hook (which already provides `zoomConnection`, `connectZoom`, `disconnectCalendar`)
- Wrap in its own `Card` with a proper header, keeping the same connect/disconnect/toggle UI
- Gate behind `FeatureGate` with the appropriate feature flag

**3. Remove Zoom from CalendarIntegrationsTab.tsx**
- Delete the Zoom section and its separator from the Calendar Sync tab
- Remove the `Video` icon import if no longer needed
- The tab becomes purely about calendar sync (Google + Apple) which is much cleaner

**4. Wire up the new tab in Settings.tsx**
- Import `ZoomIntegrationTab`
- Add `case 'zoom': return <ZoomIntegrationTab />;` to the `SettingsContent` switch

**5. Update CalendarSyncBanner reference** (if any links point to `?tab=calendar` for Zoom issues, they stay as-is since Zoom errors are separate from calendar sync errors)

### Result
- Settings nav: Scheduling | Availability | Calendar Sync | **Zoom Meetings** | Music
- Calendar Sync becomes focused on Google + Apple calendars only
- Zoom gets first-class visibility as its own integration

