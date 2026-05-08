# calendar-oauth-callback picked Holidays calendar (maxResults=1 bug)

**Severity:** high
**Status:** fixed
**Area:** calendar
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 6ad1179
**Affected components:** supabase/functions/calendar-oauth-callback/index.ts

## Symptom

After OAuth completed successfully, `calendar_connections.calendar_id` was set to `en.uk#holiday@group.v.calendar.google.com` ("Holidays in United Kingdom") — Google's read-only system calendar — instead of the user's actual primary. Lesson-to-calendar sync silently failed because the holidays calendar is read-only.

## Root cause

Function fetched `calendarList?maxResults=1`. With only one entry returned, the `.find(c => c.primary)` search ran over a single (often non-primary) item and fell through to `items[0]`. Google's calendarList ordering isn't guaranteed primary-first. Bug exists on source too — the 1 google `calendar_connections` row migrated from source is also pointed at the holidays calendar.

## Fix

Removed the `?maxResults=1` query param. Default Google API page size is 100 — more than enough.

## Verification

- Re-ran OAuth; `calendar_id = jamie@searchflare.co.uk` (primary), tokens populated
- Audit log entry recorded

## Lessons / follow-ups

`maxResults=1` combined with `.find()` lookups is almost always wrong. Audit other Google API list calls in the codebase for similar arbitrary caps.
