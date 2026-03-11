

## Plan: Add Parent Visible Toggle + Re-run Tests

### Fix: Parent Visible Toggle

**File:** `src/components/calendar/LessonNotesForm.tsx`, lines 249-250

Insert the "Visible to parents" Switch toggle between the Private Notes textarea (line 248) and the closing `</div>` (line 250). The `Users` icon and `Switch` are already imported.

```tsx
{/* Parent Visible Toggle */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2 text-sm">
    <Users className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium">Visible to parents</span>
  </div>
  <Switch
    checked={form.parentVisible}
    onCheckedChange={(checked) => updateField(key, 'parentVisible', checked)}
  />
</div>
```

No other changes needed — `parentVisible` state, `updateField`, and the save logic already handle this field.

### Testing

After the fix, use browser automation to re-run all remaining tests in order:
- **Stage 5.2–5.6:** Notes on Register, Notes Explorer, Student Detail, parent shared/private visibility
- **Stage 3.5:** Mobile notes popover as bottom sheet (390px)
- **Stage 4.2, 4.7:** Notes explorer data display and stats accuracy
- **Stage 6.1, 6.3, 6.4:** Open slots on register, bulk edit isolation, quick create time
- **Stage 7.5:** Parent login redirect to `/portal/home`
- **Stage 8.1–8.5:** All mobile tests at 390px

Results will be documented without fixes.

