

# Fix: Audit Log "Dead Link" in Settings

## Root Cause

The `AuditLogTab` component has two `Select` dropdowns (Entity Type and Action) where the "All" option uses `value=""` (empty string):

```text
ENTITY_TYPES = [
  { value: '', label: 'All Entities' },   <-- INVALID for Radix Select
  ...
]

ACTIONS = [
  { value: '', label: 'All Actions' },    <-- INVALID for Radix Select
  ...
]
```

Radix UI's `SelectItem` requires a **non-empty string** for its `value` prop. An empty string causes the component to crash or fail silently, which prevents the entire Audit Log tab from rendering -- making it appear as a "dead link" when clicked.

## Fix

**File:** `src/components/settings/AuditLogTab.tsx`

1. Change the "All" option values from `''` to `'all'`
2. Update the `useState` defaults from `''` to `'all'`
3. Convert `'all'` back to `undefined` when passing to the `useAuditLog` hook

This is a 3-line logic change with no new dependencies or database modifications.

## Technical Detail

```text
Before:
  { value: '', label: 'All Entities' }
  useState('')
  entityType: entityType || undefined   // '' is falsy, so maps to undefined -- BUT Select crashes before we get here

After:
  { value: 'all', label: 'All Entities' }
  useState('all')
  entityType: entityType === 'all' ? undefined : entityType   // explicit check, Select works correctly
```

Same pattern applied for the Action filter.
