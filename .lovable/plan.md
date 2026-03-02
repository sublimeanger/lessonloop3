

# CSV Import — World-Class Upgrade & Fixes

## Bugs Found

### Bug 1: Onboarding mapping fails with 400 (Critical)
**File:** `supabase/functions/csv-import-mapping/index.ts` line 159
The mapping edge function requires `orgId` (`if (!orgId || !headers ...)`), but the onboarding `MigrationStep.tsx` (line 242) intentionally omits `orgId` because the org doesn't exist yet. This causes a 400 error — the entire onboarding CSV import is broken.

**Fix:** Make `orgId` optional in the mapping function. It's only needed for the execute step (org membership check), not for header-to-field mapping. Remove `!orgId` from the validation check and skip the org membership verification when `orgId` is absent (mapping is a read-only operation on the CSV data itself).

### Bug 2: CSV parser doesn't handle escaped quotes (High)
**Files:** `useStudentsImport.ts` line 99-117, `MigrationStep.tsx` line 43-62
Both parsers treat `""` (escaped quote inside a quoted field) as toggling in/out of quote mode twice, which works by accident for simple cases but breaks when a field value contains `""` mid-field (e.g., `"She said ""hello"""`). Excel exports from MMS commonly produce this pattern for names with apostrophes or notes fields.

**Fix:** Replace the `if (char === '"') { inQuotes = !inQuotes; }` logic with proper RFC 4180 handling: when inside quotes, if we see `""`, treat it as a literal `"` character and advance past both. When we see a single `"`, close the quoted field.

### Bug 3: `transformedRows` index alignment assumption (Medium)
**File:** `useStudentsImport.ts` line 223 and `Onboarding.tsx` line 240
The code iterates `mappings.forEach((mapping, idx)` and uses `row[idx]` assuming mappings are in the same order as CSV columns. This works when mappings come from the heuristic path (which preserves header order), but the AI path can return mappings in any order. If the AI reorders mappings, data maps to wrong columns.

**Fix:** Use `headers.indexOf(mapping.csv_header)` to find the correct column index instead of using the mapping array index.

### Bug 4: `combine_with` header lookup fragile to BOM/whitespace (Low)
**File:** `useStudentsImport.ts` line 232, `Onboarding.tsx` line 254
`headers.indexOf(mapping.combine_with)` does an exact string match, but CSV headers from Excel often have invisible BOM characters or trailing whitespace. If the mapping function cleaned the header but the raw `headers` array wasn't cleaned, the lookup fails silently and guardians get empty last names.

**Fix:** Strip BOM (`\uFEFF`) and trim whitespace from all headers during parse, before they're stored in state.

## Improvements

### 1. Unified RFC 4180 CSV parser
Extract a single robust `parseCSVRow` function used by both `useStudentsImport` and `MigrationStep`. Handles: escaped quotes (`""`), newlines within quoted fields, BOM stripping, trailing commas.

### 2. Header normalisation layer
After parsing, normalize all headers: strip BOM, trim whitespace, collapse multiple spaces. This eliminates the class of bugs where header lookups fail due to invisible characters.

### 3. Safer column index resolution in `transformedRows`
Replace `row[idx]` with `row[headers.indexOf(mapping.csv_header)]` in both `useStudentsImport.ts` and `Onboarding.tsx`.

## Files to Change

| File | What |
|------|------|
| `supabase/functions/csv-import-mapping/index.ts` | Make `orgId` optional, skip membership check when absent |
| `src/hooks/useStudentsImport.ts` | Fix CSV parser (RFC 4180), fix `transformedRows` index, strip BOM from headers |
| `src/components/onboarding/MigrationStep.tsx` | Fix CSV parser (RFC 4180), strip BOM from headers |
| `src/pages/Onboarding.tsx` | Fix `transformedRows` index alignment (use header lookup) |

No database changes needed. No new edge functions.

