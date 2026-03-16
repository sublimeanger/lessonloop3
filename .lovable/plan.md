PLEASE DO NOT TOUCH ANYTHING TO DO WITH PAYMENT PLANS, I WILL DO THIS LATER, PLEASE PROCEED WITH WORLD CLASS POLISH THOUGH AS BELOW.  
  
Issues Identified -

### 1. Create Invoice Modal on Mobile/iOS

The `CreateInvoiceModal` already has full-screen mobile styling (`h-screen w-screen max-w-none rounded-none border-0 p-4`), but it's missing:

- **Safe area padding** (`pt-safe pb-safe`) for iOS Capacitor — content will hide behind status bar and home indicator
- The dialog base component uses `fixed left-4 right-4` which conflicts with the modal's own `h-screen w-screen` — the base insets create a gap on mobile

### 2. InvoiceStatsWidget boxes unstyled on mobile/iOS

The stats widget renders fine structurally but needs safe-area awareness and tighter mobile polish. The grid `grid-cols-2 gap-3` with `p-3` cards is reasonable, but on iOS the cards may lack visual definition. No actual broken styling found — this likely looks worse on iOS Capacitor due to the overall page lacking safe-area padding

## Plan

### 1. Fix CreateInvoiceModal safe-area for iOS Capacitor

- Add `pt-safe pb-safe` to the mobile full-screen `DialogContent` class
- Override the base dialog's `left-4 right-4` with `left-0 right-0 sm:left-4 sm:right-4` on mobile to make it truly full-screen

### 2. Add "Create with Payment Plan" option to CreateInvoiceModal

Add a toggle/checkbox at the bottom of the Create Invoice form: **"Set up payment plan after creating"**. When checked, after invoice creation succeeds, automatically open the PaymentPlanSetup sheet for the newly created invoice. This makes the flow: create → immediately configure installments → then send.

### 4. Polish InvoiceStatsWidget for mobile

- Ensure cards have consistent minimum height on mobile
- Add subtle shadow for visual definition on iOS
- The stats are already using `grid-cols-2` on mobile which is correct

### Technical Details

**CreateInvoiceModal.tsx line 258** — Update DialogContent className:

```
h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 pt-safe pb-safe
sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:border sm:p-6
```

**dialog.tsx line 39** — Update base DialogContent to allow full-screen overrides on mobile by ensuring `left-4 right-4` doesn't fight with `w-screen` overrides.

**CreateInvoiceModal.tsx** — Add state `openPlanAfterCreate` and after successful `createInvoice.mutateAsync`, if toggled, open `PaymentPlanSetup` with the new invoice ID.

**InvoiceStatsWidget.tsx** — Add `shadow-card` class to stat cards for iOS visual definition.