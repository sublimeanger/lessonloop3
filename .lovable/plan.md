

# Enhanced CSV Import System - Complete Plan

## Overview

This plan upgrades the existing CSV import flow with four major enhancements to make migrating from other platforms bulletproof:

1. **Confidence Highlighting** - Visual indicators for uncertain AI mappings
2. **Duplicate Detection** - Check both within CSV and against existing database records
3. **Dry-Run Preview Mode** - Show exactly what will happen before committing
4. **Error Row Export** - Download failed rows for quick fixes and re-import

---

## Current System Summary

The existing system already has:
- AI-powered column mapping (Gemini via Lovable AI)
- Heuristic fallback if AI unavailable
- Guardian deduplication by email
- Confidence scores returned by AI
- Basic preview showing counts

What's missing:
- No visual distinction for low-confidence mappings
- No duplicate student detection (within CSV or database)
- Preview shows counts only, not validation issues
- No way to export/re-import failed rows

---

## Implementation Plan

### Phase 1: Confidence Highlighting

**Goal**: Make low-confidence mappings visually obvious so users know which columns to double-check.

**Changes to `src/pages/StudentsImport.tsx`**:

| Line Range | Change |
|------------|--------|
| ~432-437 | Update the confidence Badge to show amber/destructive variants for low confidence |

**Logic**:
- Confidence ≥ 80%: Green badge (default variant)
- Confidence 50-79%: Amber/warning badge with "Needs Review" tooltip
- Confidence < 50%: Red badge with exclamation icon

**UI Enhancement**:
```text
+---------------------------+-------------+-----------------+------------+
| CSV Column                | Sample Data | Map To          | Confidence |
+---------------------------+-------------+-----------------+------------+
| Student Name              | John Doe    | first_name ▼    | [95%] ✓    |
| Parent Contact            | jane@...    | guardian_email ▼| [62%] ⚠    | <- Amber with warning icon
| Misc Notes                | Piano...    | — Skip —        | [—]        |
+---------------------------+-------------+-----------------+------------+
```

---

### Phase 2: Duplicate Detection (Within CSV + Database)

**Goal**: Before import, detect students that already exist (by name/email match) and rows that are duplicates within the CSV itself.

#### Backend Changes

**Update `supabase/functions/csv-import-execute/index.ts`**:

Add a new optional parameter `dryRun: boolean`. When true:
- Perform all validation (including duplicate checks)
- Return detailed results without committing any data
- Include duplicate detection results

Add duplicate detection logic:
1. Fetch existing students from database for the org (name + email combinations)
2. For each CSV row, check:
   - Does a student with same `first_name + last_name` exist?
   - Does a student with same `email` exist?
   - Is this row a duplicate of another row in the CSV?

**New Response Fields**:
```json
{
  "dryRun": true,
  "validation": {
    "valid": 42,
    "duplicatesInCsv": [
      { "row": 5, "duplicateOf": 2, "name": "John Doe" }
    ],
    "duplicatesInDatabase": [
      { "row": 8, "existingStudentId": "uuid", "name": "Jane Smith", "matchType": "name" }
    ],
    "errors": [
      { "row": 12, "error": "Invalid email format" }
    ]
  },
  "preview": {
    "studentsToCreate": 40,
    "studentsToSkip": 5,
    "guardiansToCreate": 35,
    "lessonsToCreate": 40
  }
}
```

#### Frontend Changes

**Update `src/pages/StudentsImport.tsx`**:

1. Add new state for dry-run results
2. When user clicks "Continue to Preview", call `csv-import-execute` with `dryRun: true`
3. Display validation results in the preview step with clear categories:
   - Ready to import (green)
   - Duplicate in CSV (amber) - with option to skip
   - Already exists in database (amber) - with option to skip or update
   - Invalid data (red) - must fix

**New UI Section in Preview Step**:
```text
┌─────────────────────────────────────────────────────────────┐
│ 📊 Validation Results                                        │
├─────────────────────────────────────────────────────────────┤
│ ✓ Ready to import:           42 students                    │
│ ⚠ Duplicates in CSV:          2 (will skip)                 │
│ ⚠ Already in database:        3 (will skip)                 │
│ ✗ Invalid data:               1 (see errors below)          │
├─────────────────────────────────────────────────────────────┤
│ ☐ Import duplicates anyway (create new records)             │
│ ☐ Update existing students with new data                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Enhanced Dry-Run Preview

**Goal**: Show exactly what will be created/updated before committing, with row-level validation status.

**Update Preview Table in `src/pages/StudentsImport.tsx`**:

Add a "Status" column showing validation result for each row:

```text
+----+----------------+----------------+----------------+------------+
| #  | Name           | Email          | Guardian       | Status     |
+----+----------------+----------------+----------------+------------+
| 1  | John Doe       | john@test.com  | Jane Doe       | ✓ Ready    |
| 2  | Jane Smith     | jane@test.com  | —              | ⚠ Exists   |
| 3  | Bob Wilson     | invalid-email  | —              | ✗ Invalid  |
| 4  | John Doe       | john2@test.com | —              | ⚠ Dup of #1|
+----+----------------+----------------+----------------+------------+
```

**Add Tabs to Preview**:
- "All Records" - full list with status
- "Issues Only" - filtered to show problems
- "Ready to Import" - filtered to show clean records

---

### Phase 4: Error Row Export

**Goal**: Allow users to download failed/problem rows as a new CSV for fixing and re-import.

**Add to Complete Step in `src/pages/StudentsImport.tsx`**:

1. Store the original CSV headers and rows that failed
2. Add "Download Failed Rows" button that generates a CSV with:
   - Original column headers
   - Only the rows that had errors
   - An additional "Error" column explaining what went wrong

**Implementation**:
```typescript
const downloadFailedRows = () => {
  const failedRows = importResult.details
    .filter(d => d.status === 'error')
    .map(d => {
      const originalRow = rows[d.row - 1];
      return [...originalRow, d.error];
    });
  
  const csv = [
    [...headers, 'Import Error'],
    ...failedRows
  ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  // ... download logic
};
```

**UI**:
```text
┌────────────────────────────────────────────────────────────────┐
│ ⚠ 3 Errors                                                     │
│                                                                │
│ • Row 5: Invalid email format                                  │
│ • Row 12: Missing required field: last_name                    │
│ • Row 18: Invalid date format for DOB                          │
│                                                                │
│ [📥 Download Failed Rows]  [📥 Download Full Report]           │
└────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/StudentsImport.tsx` | Add confidence highlighting, dry-run state, validation UI, error export |
| `supabase/functions/csv-import-execute/index.ts` | Add dry-run mode, duplicate detection logic |

---

## User Flow After Implementation

```text
1. Upload CSV
   ↓
2. Review AI Mappings
   • Low-confidence mappings highlighted in amber
   • User adjusts as needed
   ↓
3. Click "Continue to Preview"
   • System performs dry-run validation
   • Checks for duplicates (in CSV and database)
   • Validates all data formats
   ↓
4. Review Validation Results
   • See which rows are ready, duplicates, or invalid
   • Toggle "skip duplicates" or "import anyway"
   • Switch between All/Issues/Ready tabs
   ↓
5. Click "Confirm Import"
   • Only valid, non-duplicate rows are imported
   ↓
6. View Results
   • See success counts
   • Download failed rows as CSV for fixing
   • Re-import failed rows after correction
```

---

## Technical Details

### Duplicate Detection Algorithm

```typescript
// In csv-import-execute edge function

async function detectDuplicates(rows: ImportRow[], orgId: string, supabase: any) {
  // 1. Fetch existing students
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // 2. Build lookup maps
  const nameMap = new Map<string, string>(); // "john|doe" -> studentId
  const emailMap = new Map<string, string>(); // "john@test.com" -> studentId
  
  existingStudents?.forEach(s => {
    const nameKey = `${s.first_name?.toLowerCase()}|${s.last_name?.toLowerCase()}`;
    nameMap.set(nameKey, s.id);
    if (s.email) emailMap.set(s.email.toLowerCase(), s.id);
  });

  // 3. Check each CSV row
  const csvNamesSeen = new Map<string, number>(); // nameKey -> first row index
  const results = rows.map((row, idx) => {
    const nameKey = `${row.first_name?.toLowerCase()}|${row.last_name?.toLowerCase()}`;
    
    // Check database duplicates
    const dbMatchById = nameMap.get(nameKey);
    const dbMatchByEmail = row.email ? emailMap.get(row.email.toLowerCase()) : null;
    
    // Check CSV duplicates
    const csvDuplicateOf = csvNamesSeen.get(nameKey);
    if (csvDuplicateOf === undefined) {
      csvNamesSeen.set(nameKey, idx);
    }
    
    return {
      row: idx + 1,
      isDbDuplicate: !!(dbMatchById || dbMatchByEmail),
      dbMatchType: dbMatchById ? 'name' : dbMatchByEmail ? 'email' : null,
      existingStudentId: dbMatchById || dbMatchByEmail,
      isCsvDuplicate: csvDuplicateOf !== undefined,
      csvDuplicateOf: csvDuplicateOf !== undefined ? csvDuplicateOf + 1 : null,
    };
  });
  
  return results;
}
```

### Confidence Badge Styling

```tsx
<Badge 
  variant={
    mapping.confidence >= 0.8 ? "default" : 
    mapping.confidence >= 0.5 ? "secondary" : 
    "destructive"
  }
  className={mapping.confidence < 0.7 ? "animate-pulse" : ""}
>
  {mapping.confidence < 0.7 && <AlertTriangle className="h-3 w-3 mr-1" />}
  {Math.round(mapping.confidence * 100)}%
</Badge>
```

---

## Expected Outcome

After implementation, users migrating from other platforms will:

1. **Trust the AI mappings** - Clear visual feedback on which columns need review
2. **Avoid accidental duplicates** - System catches duplicates before import
3. **Know exactly what will happen** - Detailed preview with per-row validation
4. **Quickly fix errors** - Download problem rows, fix in Excel, re-import

This makes the CSV import truly "bulletproof" for migration scenarios.

