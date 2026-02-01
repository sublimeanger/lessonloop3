
# Comprehensive System Fixes Required

## Summary

The comprehensive walkthrough revealed several critical data integrity issues and UI bugs that need to be fixed before the system can be considered production-ready.

---

## Critical Issues to Fix

### Issue 1: Missing Student-Guardian Links in Seed Function

**Problem**: The `seed-demo-data` edge function creates students and guardians but the `student_guardians` junction records are not being persisted. This affects billing payer resolution.

**Fix**: Review and fix the seed function's student_guardians insertion logic. The issue is likely:
- RLS blocking the insert (service role key should bypass this)
- Transaction isolation issue
- Error being silently swallowed

**Files to modify**:
- `supabase/functions/seed-demo-data/index.ts`

---

### Issue 2: Blog Markdown `##` Headers Not Rendering

**Problem**: The first heading (`## Introduction`) and potentially other headings are displaying as raw text with the `##` visible.

**Root Cause**: The content starts with a newline before `## Introduction`. When split on `\n\n`, the first block might be empty or include leading whitespace, causing the `startsWith("## ")` check to fail.

**Fix**: Update `formatContent` in `BlogPost.tsx` to:
1. Trim whitespace from blocks before processing
2. Handle the case where blocks have leading newlines

**Files to modify**:
- `src/pages/marketing/BlogPost.tsx` - Update the `formatContent` function

---

### Issue 3: Sitemap Domain Mismatch

**Problem**: Sitemap uses `lessonloop.net` but the published URL is `lessonloop3.lovable.app`.

**Fix**: Update sitemap to use the correct production domain. Since the final domain will be `lessonloop.net`, we should keep this but note it will only work correctly when DNS is configured.

**Files to modify** (optional):
- `public/sitemap.xml` - Update domain if needed

---

### Issue 4: Payment Data Missing for Some Orgs

**Problem**: Premier Music Education Agency has £480 in paid invoices but £0 in payments recorded. This creates inconsistent financial reports.

**Fix**: This is a data issue rather than code issue. The seed function for this org (if it exists) didn't create payment records.

**Resolution**: Run SQL migration to create missing payment records or clean up test data.

---

## Secondary Fixes

### Fix 5: Add Demo Account with Known Password

To enable future E2E testing, create a documented test account with a known password.

---

## Implementation Order

1. **Fix blog markdown rendering** (Quick fix, high visibility)
2. **Fix seed function student_guardians** (Critical for data integrity)
3. **Verify sitemap domain** (Low priority, SEO)

---

## Estimated Changes

| File | Type | Change |
|------|------|--------|
| `src/pages/marketing/BlogPost.tsx` | Edit | Fix formatContent block trimming |
| `supabase/functions/seed-demo-data/index.ts` | Edit | Debug student_guardians insertion |
| `public/sitemap.xml` | Optional | Update domain if deploying to lessonloop3.lovable.app |

---

## Technical Details

### BlogPost.tsx Fix
```typescript
// In formatContent, add trimming:
const blocks = post.content
  .split(/\n\n+/)
  .map(block => block.trim())  // Add trim
  .filter(block => block.length > 0);  // Filter empty blocks
```

### Seed Function Debug
Add logging to verify the student_guardians insert is working:
```typescript
console.log('Inserting student_guardians:', linkInserts.length);
const { data: linkData, error: linkError } = await supabase
  .from('student_guardians')
  .insert(linkInserts)
  .select();  // Add select to verify

if (linkError) {
  console.error('student_guardians error:', linkError);
  throw linkError;
}
console.log('Created student_guardians:', linkData?.length);
```
