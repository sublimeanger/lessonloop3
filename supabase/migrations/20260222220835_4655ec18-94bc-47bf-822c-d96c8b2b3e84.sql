
-- Track when an org entered past_due status for grace period enforcement
ALTER TABLE public.organisations
  ADD COLUMN past_due_since TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.organisations.past_due_since IS 'Timestamp when subscription entered past_due. Used to enforce a 7-day grace period in feature gating.';
