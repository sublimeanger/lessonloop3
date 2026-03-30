-- Ensure payment plan columns exist on organisations table and refresh schema cache
-- These columns were added in 20260316350000_payment_plans_phase1.sql but may not
-- be visible to PostgREST if the schema cache is stale.

-- Idempotent column additions (IF NOT EXISTS)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS default_plan_threshold_minor INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_plan_installments INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_plan_frequency TEXT NOT NULL DEFAULT 'monthly';

-- Ensure constraints exist (drop first to avoid duplicate errors)
ALTER TABLE public.organisations
  DROP CONSTRAINT IF EXISTS chk_org_plan_frequency;
ALTER TABLE public.organisations
  ADD CONSTRAINT chk_org_plan_frequency
    CHECK (default_plan_frequency IN ('monthly', 'fortnightly', 'custom'));

ALTER TABLE public.organisations
  DROP CONSTRAINT IF EXISTS chk_org_plan_installments;
ALTER TABLE public.organisations
  ADD CONSTRAINT chk_org_plan_installments
    CHECK (default_plan_installments BETWEEN 2 AND 12);

-- Refresh PostgREST schema cache so columns appear in the schema cache
NOTIFY pgrst, 'reload schema';
