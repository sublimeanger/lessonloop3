

# Termly Invoicing and Term Management

## What the best competitors do

After researching TutorBird, MyMusicStaff, Opus1, and Teachworks, here's the industry standard approach:

1. **Named terms with dates** -- Teachers define terms like "Autumn 2025: 1 Sep - 19 Dec". This is universal across all competitors.
2. **Two billing modes per term:**
   - **Upfront (in advance):** Count all *scheduled* lessons in the term, multiply by rate, invoice at term start. Adjustments/credits applied later for cancellations.
   - **Retrospective (in arrears):** After the term ends, invoice only for *completed/attended* lessons. This is what the current billing run already does.
3. **Automatic invoicing schedules** -- MMS/TutorBird let you auto-generate invoices on a recurring basis (weekly, monthly, per-term). This is a later enhancement.

## What LessonLoop needs

The org already has a `billing_approach` enum (`monthly`, `termly`, `custom`) and the billing run has a `term` type -- but there is **no `terms` table** to actually define term periods. The billing run wizard currently just has manual date pickers for "term" mode, which is clunky and error-prone.

---

## Changes

### 1. New database table: `terms`

Stores named term periods per organisation.

```text
terms
  id           uuid PK
  org_id       uuid FK -> organisations
  name         text  (e.g. "Autumn Term 2025")
  start_date   date
  end_date     date
  created_at   timestamptz
  created_by   uuid

Unique constraint: (org_id, name)
Index on (org_id, start_date)
RLS: org staff can CRUD
```

### 2. New settings UI: Term Management (in Settings > Scheduling)

Add a "Terms" card to the existing Scheduling Settings tab:
- List of defined terms with name, date range, and lesson count
- "Add Term" button opens a simple form: Name, Start Date, End Date
- Quick-add presets for standard UK academic year (3 terms)
- Edit and delete existing terms
- Visual indicator showing which term is "current" based on today's date

### 3. Upgrade the Billing Run Wizard

When billing type is "Termly":
- Replace the manual date pickers with a term selector dropdown (populated from the `terms` table)
- Selecting a term auto-fills the start and end dates
- Add a billing mode toggle: **"Bill for delivered lessons"** vs **"Bill upfront for scheduled lessons"**
  - Delivered: queries `lessons` where `status = 'completed'` (current behaviour)
  - Upfront: queries `lessons` where `status IN ('scheduled', 'confirmed', 'completed')` -- counts all lessons in the term regardless of completion status
- Preview step shows which mode was selected

### 4. Invoices page -- Term filter

Add an optional "Term" filter to the invoice filters bar so users can see all invoices generated for a specific term.

### 5. Invoice record -- Term link

Add an optional `term_id` column to the `invoices` table so each invoice can be linked back to the term it was generated for. This enables filtering and reporting by term.

---

## Technical Detail

### Database migration

```text
-- New terms table
CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_terms_org_dates ON public.terms(org_id, start_date);

-- RLS policies for terms
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view terms"
  ON public.terms FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Admin can manage terms"
  ON public.terms FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

-- Add term_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL;

-- Add billing_mode to billing_runs
ALTER TABLE public.billing_runs
  ADD COLUMN billing_mode text NOT NULL DEFAULT 'delivered'
  CHECK (billing_mode IN ('delivered', 'upfront'));

ALTER TABLE public.billing_runs
  ADD COLUMN term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL;
```

### New hook: `useTerms.ts`

- `useTerms()` -- fetch all terms for current org, ordered by start_date desc
- `useCreateTerm()` -- insert a new term
- `useUpdateTerm()` -- edit name/dates
- `useDeleteTerm()` -- remove a term
- `useCurrentTerm()` -- derived: find the term where today falls between start_date and end_date

### Settings UI changes (`SchedulingSettingsTab.tsx`)

Add a new "Terms" Card below the existing Closure Dates card:
- Table/list of terms with columns: Name, Start Date, End Date, Status (past/current/upcoming)
- "Add Term" dialog with name, start date, end date fields
- UK preset button: generates Autumn/Spring/Summer terms for the selected academic year
- Edit/delete actions per term

### Billing Run Wizard changes (`BillingRunWizard.tsx`)

When `runType === 'term'`:
- Show a `Select` dropdown of defined terms instead of raw date pickers
- Add a billing mode toggle (delivered vs upfront)
- Upfront mode: change the unbilled lessons query to include `scheduled` and `confirmed` lessons, not just `completed`
- Pass `term_id` and `billing_mode` through to the created billing run and resulting invoices

### Invoice Filters changes (`InvoiceFiltersBar.tsx`)

- Add an optional "Term" select filter
- When selected, filter invoices by `term_id`

### Files Created
- `src/hooks/useTerms.ts` -- CRUD hook for terms

### Files Modified
- `src/components/settings/SchedulingSettingsTab.tsx` -- Add Terms management card
- `src/components/invoices/BillingRunWizard.tsx` -- Term selector and billing mode toggle
- `src/components/invoices/InvoiceFiltersBar.tsx` -- Add term filter
- `src/hooks/useInvoices.ts` -- Support term_id filter
- `src/hooks/useBillingRuns.ts` -- Pass term_id and billing_mode

### Database Changes
- New table: `terms` with RLS
- New columns: `invoices.term_id`, `billing_runs.billing_mode`, `billing_runs.term_id`

