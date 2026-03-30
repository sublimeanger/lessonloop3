

# P2: Parent Portal Interactivity Fixes — 4 Bugs

## Bug 1: Lesson cards feel unclickable

**Current state**: `PortalSchedule.tsx` LessonCard (line 253) already shows teacher, location, attendance, and notes inline. Cards have `hover:shadow-elevated` but no expand/collapse interaction.

**Fix in `src/pages/portal/PortalSchedule.tsx`**:
- Add `expandedLessonId` state to PortalSchedule component
- Make LessonCard accept `isExpanded` and `onToggle` props
- Add `cursor-pointer` and `hover:bg-accent/5` to the Card
- On click, toggle expanded state
- Move attendance (lines 315-327) and notes (lines 329-337) into a collapsible section that only renders when expanded
- Keep the top section (title, time, location, teacher, students) always visible
- Add a subtle `ChevronDown`/`ChevronUp` indicator

## Bug 2: Invoice cards lack line item details

**Current state**: `useParentInvoices` query (line 364) does NOT fetch `invoice_items`. InvoiceCard shows number, date, total, status, PDF, and Pay buttons only.

**Fix**:
- **`src/hooks/useParentPortal.ts`** (~line 364): Add `invoice_items(description, quantity, unit_price_minor, amount_minor)` to the select
- **`src/pages/portal/PortalInvoices.tsx`**: 
  - Add `expandedInvoiceId` state
  - Make InvoiceCard clickable (not on action buttons — use `e.stopPropagation()` on PDF/Pay buttons)
  - When expanded, show line items list below the existing content: description, qty × unit price, line total
  - Add `cursor-pointer` to the card wrapper
  - Update `InvoiceCardProps` to include `invoice_items` array, `isExpanded`, `onToggle`

## Bug 3: Welcome message doesn't show child's name

**Current state**: Line 329 says `Hi {firstName}! 👋` and line 332 says `Here's what's happening with your family's lessons.`

**Fix in `src/pages/portal/PortalHome.tsx`**:
- Derive selected child's first name from `filteredChildren` (already computed at line 259)
- Update subtitle (line 332):
  - If a child is selected: `Here's how {childFirstName} is doing.`
  - If no child selected (all children): `Here's what's happening with your family's lessons.` (keep as-is)

## Bug 4: Weak password accepted during signup

**Current state**: `Signup.tsx` line 107 only checks `password.length < PASSWORD_MIN_LENGTH` (8 chars). `getPasswordScore` returns 0-4 based on length, case mix, numbers/symbols. A password like `abcdefgh` gets score 1 ("Weak") but passes validation.

**Fix in `src/pages/Signup.tsx`**:
- Import `getPasswordScore` from `PasswordStrengthIndicator`
- After the length check (line 107-114), add a score check:
  ```
  if (getPasswordScore(password) < 2) → toast "Password too weak — add uppercase letters, numbers, or special characters"
  ```
- Score ≥ 2 means "Fair" or better (requires length ≥ 8 AND at least one of: mixed case or number/symbol)
- `abcdefgh` → score 1 (blocked). `Abcd1234` → score 3 (allowed).

## Files Modified

| File | Bug |
|------|-----|
| `src/pages/portal/PortalSchedule.tsx` | #1 (expandable lesson cards) |
| `src/hooks/useParentPortal.ts` | #2 (fetch invoice_items) |
| `src/pages/portal/PortalInvoices.tsx` | #2 (expandable invoice cards) |
| `src/pages/portal/PortalHome.tsx` | #3 (child name in greeting) |
| `src/pages/Signup.tsx` | #4 (block weak passwords) |

