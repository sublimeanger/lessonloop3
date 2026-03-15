# Audit Report: Feature 6 — Locations

**Date:** 2026-03-15
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Location CRUD, rooms, assignments, archival, deletion, timezone, tier limits, cascade effects, RLS, parent/public exposure

---

## 1. Files Audited

### Database / Migrations
| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/migrations/20260119231833_…932.sql` | `locations` table, RLS policies, `updated_at` trigger, index |
| 2 | `supabase/migrations/20260119232402_…419.sql` | `location_type` enum, `rooms` table (FK to locations), RLS for rooms |
| 3 | `supabase/migrations/20260119233145_…b75.sql` | `lessons` table — `location_id` FK (`ON DELETE SET NULL`), `room_id` FK (`ON DELETE SET NULL`) |
| 4 | `supabase/migrations/20260119233724_…b83.sql` | `closure_dates` table — `location_id` FK (`ON DELETE CASCADE`) |
| 5 | `supabase/migrations/20260126115938_…819.sql` | `students.default_location_id` FK (`ON DELETE SET NULL`) |
| 6 | `supabase/migrations/20260128083806_…609.sql` | `rooms.max_capacity`, `organisations.buffer_minutes_between_locations` |
| 7 | `supabase/migrations/20260128111419_…be8.sql` | `locations.parent_reschedule_policy_override` with CHECK constraint |
| 8 | `supabase/migrations/20260222164345_…946.sql` | `make_up_waitlist` — `location_id` FK (**no ON DELETE clause**) |
| 9 | `supabase/migrations/20260222210005_…e3d.sql` | `locations.is_archived` column |
| 10 | `supabase/migrations/20260227120000_…sql` | `enrolment_waitlist` — `preferred_location_id` FK (`ON DELETE SET NULL`), `offered_location_id` FK (no ON DELETE) |

### Frontend — Hooks
| # | File | Purpose |
|---|------|---------|
| 11 | `src/hooks/useDeleteValidation.ts` | Pre-deletion checks for locations and rooms |
| 12 | `src/hooks/useConflictDetection.ts` | Buffer-between-locations, room capacity check, closure date check |
| 13 | `src/hooks/useCalendarData.ts` | Location/room query for calendar, filter by location |
| 14 | `src/hooks/useUsageCounts.ts` | Location count (not used for tier gating) |
| 15 | `src/hooks/useFeatureGate.ts` | `multi_location` feature gate (academy+agency+custom) |
| 16 | `src/hooks/useParentPortal.ts` | Parent schedule — includes `location:locations(name)` |
| 17 | `src/hooks/useClosureDateSettings.ts` | Closure dates per location |

### Frontend — Pages & Components
| # | File | Purpose |
|---|------|---------|
| 18 | `src/pages/Locations.tsx` | Main locations + rooms management page |
| 19 | `src/components/calendar/CalendarFiltersBar.tsx` | Location filter on calendar |
| 20 | `src/components/calendar/LessonModal.tsx` | Location/room selection for lessons |
| 21 | `src/components/calendar/SlotGeneratorWizard.tsx` | Bulk slot generation with location |
| 22 | `src/components/settings/SchedulingSettingsTab.tsx` | `buffer_minutes_between_locations` setting |
| 23 | `src/components/students/TeachingDefaultsCard.tsx` | Student default location |
| 24 | `src/lib/pricing-config.ts` | Pricing tiers (no location limits defined) |

### Edge Functions
| # | File | Purpose |
|---|------|---------|
| 25 | `supabase/functions/seed-demo-data/index.ts` | Seeds locations and rooms |
| 26 | `supabase/functions/csv-import-execute/index.ts` | CSV import creates locations |
| 27 | `supabase/functions/looopassist-chat/index.ts` | LoopAssist — `check_room_availability` tool |
| 28 | `supabase/functions/create-continuation-run/index.ts` | Checks closure_dates by location |
| 29 | `supabase/functions/notify-makeup-offer/index.ts` | Includes location name in notification |

---

## 2. Schema

### 2.1 `locations` Table

```sql
CREATE TABLE public.locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  location_type   location_type NOT NULL DEFAULT 'studio',  -- 'school'|'studio'|'home'|'online'
  address_line_1  text,
  address_line_2  text,
  city            text,
  postcode        text,
  country_code    text NOT NULL DEFAULT 'GB',
  is_primary      boolean NOT NULL DEFAULT false,
  is_archived     boolean NOT NULL DEFAULT false,
  notes           text,
  parent_reschedule_policy_override text DEFAULT NULL
    CHECK (... IN ('self_service', 'request_only', 'admin_locked')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

**Key observations:**
- No `timezone` column — locations use org timezone universally
- No UNIQUE constraint on `(org_id, name)` at DB level (enforced client-side only)
- `is_primary` is a boolean per-row — no DB enforcement of single-primary constraint
- `is_archived` for soft-delete archival
- No `capacity` on locations (capacity is on rooms only)
- RLS, `updated_at` trigger, and `org_id` index present

### 2.2 `rooms` Table

```sql
CREATE TABLE public.rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  capacity     integer,          -- nullable
  max_capacity integer DEFAULT 10,  -- added later, nullable
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

**Key observations:**
- Two capacity columns: `capacity` (original, nullable) and `max_capacity` (added later, DEFAULT 10)
- No CHECK constraint on either capacity (allows 0 or negative values)
- No UNIQUE constraint on `(location_id, name)` at DB level (enforced client-side only)

---

## 3. Findings

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|----------------|
| LOC-01 | **HIGH** | **`make_up_waitlist.location_id` FK has no ON DELETE clause.** Default is `NO ACTION` (RESTRICT). Deleting a location referenced by any make-up waitlist entry will fail with a FK violation, even though the deletion validation check doesn't test for this. The `confirmDeleteLocation` function will error unexpectedly. | `migrations/…164345…sql:15` | Add `ON DELETE SET NULL` to `make_up_waitlist.location_id` FK. This matches the pattern used by `enrolment_waitlist.preferred_location_id`. |
| LOC-02 | **HIGH** | **`enrolment_waitlist.offered_location_id` FK has no ON DELETE clause.** Same issue as LOC-01 — deleting a location that has been offered via the enrolment waitlist will fail with FK violation. | `migrations/…120000…sql:53` | Add `ON DELETE SET NULL` to `enrolment_waitlist.offered_location_id` FK. |
| LOC-03 | **HIGH** | **No DB UNIQUE constraint on `(org_id, name)` for locations.** Duplicate name prevention is client-side only via `ilike()` check before insert. Direct API calls or concurrent requests can create duplicate names. | `src/pages/Locations.tsx:315-327` | Add `CREATE UNIQUE INDEX idx_locations_unique_name ON locations(org_id, lower(name)) WHERE is_archived = false`. Case-insensitive, excludes archived. |
| LOC-04 | **HIGH** | **No DB UNIQUE constraint on `(location_id, name)` for rooms.** Same issue — room name uniqueness per location is client-side only. | `src/pages/Locations.tsx:472-484` | Add `CREATE UNIQUE INDEX idx_rooms_unique_name ON rooms(location_id, lower(name))`. |
| LOC-05 | **MEDIUM** | **`handleSetPrimary` has race condition — two non-atomic updates.** First clears all `is_primary=false`, then sets one to `true`. If the second update fails, the org has no primary location. There's a rollback attempt, but if that also fails, the state is inconsistent. | `src/pages/Locations.tsx:562-600` | Use a single SQL update or RPC that atomically clears and sets. Alternatively, wrap in a Supabase transaction (not available via client API — consider an RPC). |
| LOC-06 | **MEDIUM** | **No DB constraint enforcing single primary location per org.** Multiple locations can have `is_primary=true` via direct API calls or race conditions. | `locations` schema | Add a partial unique index: `CREATE UNIQUE INDEX idx_locations_single_primary ON locations(org_id) WHERE is_primary = true AND is_archived = false`. This guarantees at most one primary per org. |
| LOC-07 | **MEDIUM** | **Room `capacity` and `max_capacity` allow zero or negative values.** No CHECK constraint prevents nonsensical capacity values. The UI validates `>= 1` on the client side but it's bypassable. | `rooms` schema | Add `CHECK (capacity IS NULL OR capacity > 0)` and `CHECK (max_capacity IS NULL OR max_capacity > 0)` to the rooms table. |
| LOC-08 | **MEDIUM** | **Room has dual capacity columns (`capacity` and `max_capacity`) with unclear semantics.** `useConflictDetection.ts` uses `max_capacity ?? capacity`, while `Locations.tsx` sets both to the same value. The `max_capacity` column was added later with `DEFAULT 10`, creating phantom capacity values for existing rooms that never set it. | `rooms` schema, `src/hooks/useConflictDetection.ts:359` | Either: (a) drop `capacity` and use `max_capacity` only, or (b) document the distinction (e.g., `capacity` = current configuration, `max_capacity` = physical limit). At minimum, update `DEFAULT 10` to `DEFAULT NULL` to avoid phantom values. |
| LOC-09 | **MEDIUM** | **`checkLocationDeletion` doesn't check `make_up_waitlist` or `enrolment_waitlist` references.** If either has a reference to the location being deleted, the actual DELETE will fail with a FK violation (LOC-01/02), but the pre-check will have said "ok to delete". User gets a confusing error. | `src/hooks/useDeleteValidation.ts:195-265` | Add checks for `make_up_waitlist.location_id` and `enrolment_waitlist.offered_location_id` (after fixing LOC-01/02, these become warnings rather than blocks). |
| LOC-10 | **MEDIUM** | **Location address exposed to all org members including parents via RLS.** The SELECT policy uses `is_org_member` which includes parents. For home-based teachers, this exposes their home address to all parents in the org, not just those with lessons at that location. | `locations` RLS: `"Members can view org locations"` | Consider: (a) for `location_type = 'home'`, restrict address fields to staff only (create a view or RPC), or (b) accept and document that parents can see location names/addresses (needed for drop-off directions). This is a business decision, not strictly a bug. |
| LOC-11 | **MEDIUM** | **Archived locations can still be assigned to new lessons.** The calendar `location` dropdown fetches from `locations` without filtering `is_archived`. A teacher or admin could schedule a lesson at an archived location. | `src/hooks/useCalendarData.ts:257` | Filter locations query: `.eq('is_archived', false)` in the `teachers-and-locations` query, or filter in the UI dropdown. Keep archived locations visible on existing lessons for history. |
| LOC-12 | **LOW** | **No DB-level enforcement of `location_type` validation for online locations.** Online locations can have address fields set, and non-online locations can have empty addresses. The client validates address requirement but DB doesn't. | `src/pages/Locations.tsx:299-303` | Consider a CHECK constraint or trigger: `CHECK (location_type = 'online' OR address_line_1 IS NOT NULL OR city IS NOT NULL)`. Low priority since client validates. |
| LOC-13 | **LOW** | **`canAddLocation` check counts all locations including archived.** `locations.length >= 1` counts archived locations toward the multi_location gate. A solo_teacher org that archives its only location cannot add a new one without upgrading. | `src/pages/Locations.tsx:602` | Change to `locations.filter(l => !l.is_archived).length >= 1` to only count active locations. |
| LOC-14 | **LOW** | **No location limit tracked in `useUsageCounts`.** While locations are counted, there's no `maxLocations` or `canAddLocation` in the usage status — the multi-location gate uses `useFeatureGate` instead. This works but is inconsistent with how students/teachers limits are tracked. | `src/hooks/useUsageCounts.ts` | Informational — current design is functional. Consider aligning with student/teacher pattern if location limits are ever added to plans. |
| LOC-15 | **LOW** | **No audit trail on location changes.** Unlike `teachers` (which has an audit trigger), the `locations` table only has `updated_at`. No record of who changed what. | `locations` schema | Add the standard audit trigger if available, or accept for now. Low priority — addresses/names rarely change. |
| LOC-16 | **INFO** | **Locations have no timezone column.** All time-related logic uses the org timezone (`organisations.timezone`). This is correct for single-timezone orgs but would need rethinking for orgs spanning timezones (e.g., a franchise with locations in London and New York). | `locations` schema | Acceptable for current use case. Document that multi-timezone support would require a `timezone` column on locations. No action needed now. |
| LOC-17 | **INFO** | **`buffer_minutes_between_locations` is org-wide, not per-location-pair.** A 15-minute buffer between locations A and B also applies between A and A (same location), which is incorrect — the buffer is only meant for different locations. | `src/hooks/useConflictDetection.ts:324` | Already handled correctly: line 324 checks `l.location_id !== locationId` before applying buffer. No issue. |
| LOC-18 | **INFO** | **Lessons can exist without a location.** `lessons.location_id` is nullable (`ON DELETE SET NULL`). This correctly supports online lessons and scenarios where a location is deleted. Location-less lessons display correctly on the calendar. | `lessons` schema | By design. No action needed. |

---

## 4. RLS Policy Matrix

### `locations` Table

| Operation | owner | admin | teacher | finance | parent |
|-----------|-------|-------|---------|---------|--------|
| SELECT | via `is_org_member` | via `is_org_member` | via `is_org_member` | via `is_org_member` | via `is_org_member` |
| INSERT | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |
| UPDATE | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |
| DELETE | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |

**Note:** All org members (including parents, finance, teachers) can see all locations and their full address details. This is intentional for scheduling purposes but has privacy implications for home-based teachers (LOC-10).

### `rooms` Table

| Operation | owner | admin | teacher | finance | parent |
|-----------|-------|-------|---------|---------|--------|
| SELECT | via `is_org_member` | via `is_org_member` | via `is_org_member` | via `is_org_member` | via `is_org_member` |
| INSERT | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |
| UPDATE | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |
| DELETE | via `is_org_admin` | via `is_org_admin` | **DENIED** | **DENIED** | **DENIED** |

### `closure_dates` Table

| Operation | owner/admin | teacher | finance | parent |
|-----------|-------------|---------|---------|--------|
| SELECT | Allowed | Allowed | Allowed | Allowed |
| INSERT | Allowed | **DENIED** | **DENIED** | **DENIED** |
| UPDATE | Allowed | **DENIED** | **DENIED** | **DENIED** |
| DELETE | Allowed | **DENIED** | **DENIED** | **DENIED** |

---

## 5. CASCADE Impact Map — Location Deletion

When a location is **hard-deleted** from the `locations` table:

```
locations.id DELETED
  ├── lessons.location_id              → SET NULL  (lesson survives, loses location ref)
  ├── lessons.room_id                  → n/a (rooms CASCADE first, then room_id SET NULL)
  ├── rooms                            → CASCADE   (all rooms at this location deleted)
  │   └── lessons.room_id             → SET NULL  (lessons in deleted rooms lose room ref)
  ├── closure_dates.location_id        → CASCADE   (location-specific closure dates deleted)
  ├── students.default_location_id     → SET NULL  (students lose default location)
  ├── enrolment_waitlist.preferred_location_id → SET NULL
  ├── enrolment_waitlist.offered_location_id   → ⚠️ NO ACTION (BLOCKS DELETE — LOC-02)
  └── make_up_waitlist.location_id     → ⚠️ NO ACTION (BLOCKS DELETE — LOC-01)
```

**Current behavior:** The `confirmDeleteLocation` function in Locations.tsx:
1. Manually deletes rooms at this location (defensive — CASCADE would handle it)
2. Manually deletes closure_dates (defensive — CASCADE would handle it)
3. Deletes the location
4. Auto-promotes another location to primary if the deleted one was primary

**Gap:** Steps 1-2 handle rooms and closure dates, but `make_up_waitlist` and `enrolment_waitlist.offered_location_id` are not cleaned up, and their FK constraints will block the delete (LOC-01, LOC-02).

---

## 6. Timezone Interaction Assessment

### Current Design
- **No timezone per location.** All locations use the org-level timezone (`organisations.timezone`).
- **Lesson times** are stored as `timestamptz` (UTC), displayed in org timezone.
- **Availability blocks** use `TIME` columns interpreted in org timezone (documented via COMMENTs in TCH-15 fix).
- **Closure dates** are stored as `DATE` (no timezone component).

### Assessment
The single-timezone design is **correct for current use cases** (single-city music academies). The 5 timezone fixes from the handoff (Wave 1 bugs) are intact — `fromZonedTime`/`toZonedTime` are used correctly throughout calendar and scheduling code.

### Multi-timezone Considerations (future)
If LessonLoop ever supports multi-timezone orgs (e.g., a franchise in London + New York):
- Locations would need a `timezone` column
- Lesson display would need to use `location.timezone || org.timezone`
- Availability blocks would need per-location timezone interpretation
- Calendar would need a timezone selector
- **Not needed now.** Current customers are single-city operations.

---

## 7. Verdict

### **PRODUCTION READY — with recommended fixes**

No **critical** issues found. The locations feature is well-built with proper RLS, deletion validation, feature gating, and archive support.

**2 HIGH findings that should be fixed before production:**

1. **LOC-01 + LOC-02:** Missing `ON DELETE` clauses on `make_up_waitlist.location_id` and `enrolment_waitlist.offered_location_id` will cause unexpected FK errors when deleting locations. These are silent failures — the user sees "Error deleting location" with a Postgres FK violation message.

2. **LOC-03 + LOC-04:** No DB-level uniqueness on location/room names. Client-side duplicate checks are bypassable via concurrent requests or direct API access.

**MEDIUM fixes recommended before production:**

3. **LOC-05 + LOC-06:** Primary location set operation is non-atomic; no single-primary constraint at DB level.
4. **LOC-07 + LOC-08:** Room capacity allows invalid values; dual capacity columns are confusing.
5. **LOC-09:** Delete validation doesn't check waitlist references.
6. **LOC-11:** Archived locations still selectable for new lessons.

**LOW/INFO items acceptable as-is:**
- LOC-10: Address visibility to parents — business decision (needed for drop-off).
- LOC-12, LOC-13, LOC-14, LOC-15: Minor polish items.
- LOC-16, LOC-17, LOC-18: Informational — current design is correct.

---

*End of audit report.*
