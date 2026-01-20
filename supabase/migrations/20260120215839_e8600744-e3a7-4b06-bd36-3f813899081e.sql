-- ============================================
-- B7) INVOICES TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can view org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Parents can view their invoices" ON public.invoices;

-- SELECT: Finance team or payer
CREATE POLICY "Finance team can view all invoices"
ON public.invoices FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Parent can view own invoices"
ON public.invoices FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_invoice_payer(auth.uid(), id)
);

-- INSERT/UPDATE: Finance team only
CREATE POLICY "Finance team can create invoices"
ON public.invoices FOR INSERT
WITH CHECK (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can update invoices"
ON public.invoices FOR UPDATE
USING (is_org_finance_team(auth.uid(), org_id));

-- DELETE: Admin only
CREATE POLICY "Admin can delete invoices"
ON public.invoices FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B8) INVOICE_ITEMS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admins can delete invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admins can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Members can view org invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Parents can view their invoice items" ON public.invoice_items;

-- SELECT: Finance team or payer
CREATE POLICY "Finance team can view all invoice items"
ON public.invoice_items FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Parent can view own invoice items"
ON public.invoice_items FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_invoice_payer(auth.uid(), invoice_id)
);

-- INSERT/UPDATE/DELETE: Finance team
CREATE POLICY "Finance team can create invoice items"
ON public.invoice_items FOR INSERT
WITH CHECK (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can update invoice items"
ON public.invoice_items FOR UPDATE
USING (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can delete invoice items"
ON public.invoice_items FOR DELETE
USING (is_org_finance_team(auth.uid(), org_id));

-- ============================================
-- B9) PAYMENTS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Members can view org payments" ON public.payments;
DROP POLICY IF EXISTS "Parents can view their payments" ON public.payments;

-- SELECT: Finance team or payer
CREATE POLICY "Finance team can view all payments"
ON public.payments FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Parent can view own payments"
ON public.payments FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_invoice_payer(auth.uid(), invoice_id)
);

-- INSERT/UPDATE: Finance team
CREATE POLICY "Finance team can create payments"
ON public.payments FOR INSERT
WITH CHECK (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can update payments"
ON public.payments FOR UPDATE
USING (is_org_finance_team(auth.uid(), org_id));

-- DELETE: Admin only
CREATE POLICY "Admin can delete payments"
ON public.payments FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B10) BILLING_RUNS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create billing runs" ON public.billing_runs;
DROP POLICY IF EXISTS "Admins can delete billing runs" ON public.billing_runs;
DROP POLICY IF EXISTS "Admins can update billing runs" ON public.billing_runs;
DROP POLICY IF EXISTS "Members can view org billing runs" ON public.billing_runs;

-- SELECT: Finance team
CREATE POLICY "Finance team can view billing runs"
ON public.billing_runs FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

-- INSERT/UPDATE: Finance team
CREATE POLICY "Finance team can create billing runs"
ON public.billing_runs FOR INSERT
WITH CHECK (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can update billing runs"
ON public.billing_runs FOR UPDATE
USING (is_org_finance_team(auth.uid(), org_id));

-- DELETE: Admin only
CREATE POLICY "Admin can delete billing runs"
ON public.billing_runs FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B11) RATE_CARDS TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Admins can delete rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Admins can update rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Members can view org rate cards" ON public.rate_cards;

-- SELECT: Finance team (for billing context)
CREATE POLICY "Finance team can view rate cards"
ON public.rate_cards FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

-- INSERT/UPDATE/DELETE: Admin only
CREATE POLICY "Admin can create rate cards"
ON public.rate_cards FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update rate cards"
ON public.rate_cards FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete rate cards"
ON public.rate_cards FOR DELETE
USING (is_org_admin(auth.uid(), org_id));