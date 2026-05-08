# calendar-sync-lesson created duplicate Google events on action='create'

**Severity:** high
**Status:** fixed
**Area:** calendar
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 9c72ca3
**Affected components:** supabase/functions/calendar-sync-lesson/index.ts

## Symptom

Calling with `action='create'` always POSTed a new Google Calendar event, even when a mapping row already existed. Mapping was then silently re-pointed at the new event id, leaving the original orphaned in the user's calendar.

## Root cause

Function branched on caller-supplied `action` instead of on whether a mapping row existed. Verified empirically: first sync created event `08rc...`; second sync (identical payload) created `9fg2...`; mapping pointed at `9fg2...`; both events visible.

## Fix

Collapsed update/create paths. Mapping exists → always PATCH-update existing event regardless of caller's `action`. Only POST-create when no mapping found.

## Verification

- 3-sync sequence (create/create/update) returned identical `external_event_id` for all three calls
- 1 mapping row, 1 Google event after the run
- Orphan event from broken-state test deleted via Google API

## Lessons / follow-ups

Caller-supplied `action` is unreliable as an idempotency signal. State-of-the-database (mapping exists or not) is the only safe branch point. Same anti-pattern existed in `zoom-sync-lesson`, fixed preemptively in same commit.
