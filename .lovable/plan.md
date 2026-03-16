

# Payment Plans — Phase 2: Full UI Implementation

## Current State

**Already built (backend + basic UI):**
- `invoice_installments` table with RLS
- `generate_installments` RPC (equal + custom schedule)
- `record_payment_and_update_status` RPC (allocates to installments)
- `installment-overdue-check` cron
- `PaymentPlanSetup` sheet (create/view/remove plan on existing invoice)
- `InstallmentTimeline` component (on invoice detail page)
- `PaymentPlansDashboard` (tab on Invoices page with health/progress)
- `PaymentPlanInvoiceCard` (parent portal card with pay next installment)
- Org columns: `default_plan_threshold_minor`, `default_plan_installments`, `default_plan_frequency`
- Student column: `payment_plan_preference` (default/always/never)
- `create-billing-run` edge function accepts plan params and auto-generates installments

**Not yet built (this phase):**
1. Payment plan toggle in CreateInvoiceModal
2. Payment plan step in BillingRunWizard
3. Org settings UI for default plan config
4. Student detail plan preference UI
5. Overdue installments in urgent actions
6. Invoice email template showing installment schedule
7. Various polish items

---

## Implementation Plan

### Task 1: CreateInvoiceModal — Payment Plan Toggle

**File:** `src/components/invoices/CreateInvoiceModal.tsx`

- Add state: `planEnabled`, `planCount` (default 3), `planFrequency` ('monthly'|'fortnightly'), `planStartDate` (defaults to due date)
- Below the total/credits section, add a collapsible "Payment Plan" section with:
  - Switch toggle "Split into installments"
  - When ON: installment count select (2,3,4,6, custom input), frequency select, first due date picker
  - Live preview table showing computed installments (amount = remaining / count, last gets remainder)
- On submit: after `createInvoice.mutateAsync` succeeds, if `planEnabled`, call `generateInstallments.mutateAsync` with the new invoice ID
- Use `formatCurrencyMinor` with org currency throughout
- Mobile: stack controls vertically, preview table becomes card layout

### Task 2: BillingRunWizard — Payment Plan Step

**File:** `src/components/invoices/BillingRunWizard.tsx`

- Add a "Payment Plans" section to the **config** step (not a separate step — keeps wizard simple)
- Add state for: `planEnabled` (bool), `planThreshold` (number, pre-filled from org `default_plan_threshold_minor`), `planInstallments` (pre-filled from org `default_plan_installments`), `planFrequency` (pre-filled from org `default_plan_frequency`)
- UI: Checkbox "Enable payment plans for this run", when checked show threshold/installment/frequency inputs
- Pass `plan_threshold_minor`, `plan_installments`, `plan_frequency` in the `create-billing-run` body (the edge function already accepts these)
- In preview step: show a badge on invoices that exceed the threshold indicating they'll get a plan
- Fetch org defaults via the existing org query (add the 3 plan columns to the select)
- **Student overrides**: Skip for now — the backend already checks `payment_plan_preference` per student. Add a note that student-level overrides are respected automatically.

### Task 3: Invoice Detail — Enhanced Installments Display

**File:** `src/pages/InvoiceDetail.tsx`

The `InstallmentTimeline` component already shows installments when a plan exists. Enhancements:
- Show installment timeline for **parents too** (currently hidden with `!isParent` guard on line 530) — parents should see their plan progress on the detail page
- Add expandable payment details per installment (payment ref, date) — extend `InstallmentTimeline` to accept payments array and match by `payment_id`
- Keep existing "Set Up Payment Plan" and "Edit Plan" buttons for staff

### Task 4: Org Settings — Default Plan Configuration

**File:** `src/components/settings/InvoiceSettingsTab.tsx`

- Add a "Default Payment Plan" section after the reminder schedule:
  - "Auto-offer plans for invoices over" — currency input (maps to `default_plan_threshold_minor`, stored in minor units)
  - "Default installments" — number select (2-12)
  - "Default frequency" — select (Monthly/Fortnightly/Weekly)
- Fetch and save these 3 columns alongside existing invoice settings
- Add them to the `select` query (line 30) and `update` mutation (line 80)

### Task 5: Student Detail — Plan Preference

**File:** `src/components/students/StudentTabsSection.tsx` (or the billing/guardian sub-tab)

- Add a "Payment Plan Preference" select to the student's billing section:
  - Options: "Use default" / "Always offer plan" / "Never offer plan"
  - Maps to `payment_plan_preference` column on students table
- Simple select + save button or auto-save on change

### Task 6: Urgent Actions — Overdue Installments

**File:** `src/hooks/useUrgentActions.ts`

- Add a new query for overdue installments (admin/finance roles):
  ```sql
  SELECT count(*) FROM invoice_installments 
  WHERE org_id = ? AND status = 'overdue'
  ```
- Push to urgentActions array with type `'overdue_installments'`, severity `'warning'`, href `/invoices?tab=plans&filter=overdue`

### Task 7: Invoice Email — Installment Schedule

**File:** `supabase/functions/send-invoice-email/index.ts`

- When building the email body, check if invoice has `payment_plan_enabled`
- If yes, fetch installments and include a schedule table in the email HTML
- "Pay Now" link should reference the first unpaid installment amount
- Use org currency for formatting

### Task 8: Mobile Responsive Polish

Apply across all new UI:
- Installment preview tables → card layout on mobile (< sm breakpoint)
- Pay Now buttons full-width on mobile with min-h-[48px]
- Plan config inputs stack vertically on mobile
- All dialogs/sheets use `pt-safe pb-safe` for iOS Capacitor

---

## Technical Notes

- **No database migrations needed** — all columns and tables already exist from Phase 1
- **No new edge functions** — `create-billing-run` already accepts plan params; `send-invoice-email` just needs template updates
- The `generate_installments` RPC is already used by `useGenerateInstallments` hook — reuse in CreateInvoiceModal
- Currency is always from `currentOrg.currency_code`, never hardcoded
- All amounts in minor units throughout

