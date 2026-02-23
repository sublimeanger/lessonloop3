/**
 * Standardised staleTime tiers for TanStack Query.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Tier              │ staleTime │  Use for                           │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  VOLATILE          │   30 s    │  Lessons, attendance, messages,    │
 * │                    │           │  calendar events, real-time data   │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  SEMI_STABLE       │    2 min  │  Students, teachers, invoices,     │
 * │  (DEFAULT)         │           │  terms, student details            │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  STABLE            │    5 min  │  Locations, rate cards, closure    │
 * │                    │           │  dates, org settings, members      │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  REPORT            │   10 min  │  Expensive report aggregations     │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  SIGNED_URL        │   55 min  │  Signed URLs (refresh before       │
 * │                    │           │  1-hour expiry)                     │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * The QueryClient default is SEMI_STABLE (2 min).
 * Only override when a query falls into a different tier.
 */

/** Volatile data: lessons, attendance, messages, calendar events */
export const STALE_VOLATILE = 30_000; // 30 seconds

/** Semi-stable data: students, teachers, invoices, terms (DEFAULT) */
export const STALE_SEMI_STABLE = 2 * 60_000; // 2 minutes

/** Stable reference data: locations, rate cards, closure dates, org settings */
export const STALE_STABLE = 5 * 60_000; // 5 minutes

/** Expensive report aggregations */
export const STALE_REPORT = 10 * 60_000; // 10 minutes

/** Signed storage URLs – refresh 5 min before 1-hour expiry */
export const STALE_SIGNED_URL = 55 * 60_000; // 55 minutes

/** Default gcTime for most queries */
export const GC_DEFAULT = 10 * 60_000; // 10 minutes

/** Longer gcTime for reports */
export const GC_REPORT = 15 * 60_000; // 15 minutes

/** Longer gcTime for signed URLs */
export const GC_SIGNED_URL = 60 * 60_000; // 60 minutes
