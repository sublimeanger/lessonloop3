# zoom-sync-lesson created duplicate Zoom meetings on action='create'

**Severity:** high
**Status:** fixed
**Area:** zoom
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 9c72ca3
**Affected components:** supabase/functions/zoom-sync-lesson/index.ts

## Symptom

Same shape as calendar-sync-lesson: `action='create'` always created a new Zoom meeting even when a mapping row existed. Subsequent mapping update silently re-pointed at the new meeting id.

## Root cause

Identical pattern to calendar-sync-lesson. Function branched on caller-supplied `action` rather than mapping existence. Found via sibling-scan after fixing calendar-sync-lesson.

## Fix

Collapsed update/create paths. Mapping exists → always update. No mapping → POST-create. Same fix shape as calendar-sync-lesson.

## Verification

Preemptive fix; full Zoom E2E deferred to cutover (Phase 6 Tier 3.2 was server-side validated only).

## Lessons / follow-ups

When fixing a sync-function bug, scan all sibling sync functions for the same anti-pattern. Three sibling functions (calendar/zoom/xero-payment) all had related bugs.
