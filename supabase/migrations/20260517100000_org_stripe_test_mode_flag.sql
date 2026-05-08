-- Org-scoped Stripe test-mode flag (J24-A — §24 prerequisite infra).
--
-- Why
-- ---
-- §24 Stripe E2E tests need to drive Stripe in TEST mode (real money
-- moves obviously won't work for parent-pays-invoice flows). Running
-- the platform globally in test mode would break live payments for
-- every customer, so we route Stripe key selection per-org.
--
-- Default `false` means every existing org — including all live paying
-- customers — keeps using the live `STRIPE_SECRET_KEY` with no
-- behavioural change vs pre-migration state. Edge functions consume
-- the flag via `supabase/functions/_shared/stripe-client.ts`:
-- `getStripeClient(orgId, supabase)` reads this column and returns a
-- Stripe SDK instance keyed by `STRIPE_TEST_SECRET_KEY` when true.
--
-- The helper is defensive: missing column, null value, lookup failure,
-- or absent test key all fall back to live. There is intentionally no
-- way for `stripe_test_mode = false` (the default) to use the test key.
--
-- E2E test org `25b57950-6c4e-42d8-8089-4942d2bba959` is set `true`
-- in a separate data step after this DDL ships, so any operator
-- inspecting the migration sees only the schema change.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- Reversible: the column has no consumers prior to the helper landing,
-- so DROP COLUMN is safe pre-refactor; post-refactor, drop the column
-- only after all stripe edge fns have been reverted.

BEGIN;

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS stripe_test_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organisations.stripe_test_mode IS
  'When true, Stripe edge functions resolve STRIPE_TEST_SECRET_KEY for this org '
  'instead of STRIPE_SECRET_KEY. Default false: every org behaves identically '
  'to pre-2026-05-17 (live mode). Set true ONLY on the e2e test org. '
  'Toggling for a real customer would break their live Stripe integration.';

COMMIT;
