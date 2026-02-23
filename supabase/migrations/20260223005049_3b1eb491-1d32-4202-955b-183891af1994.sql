
-- Create an authoritative view for available credits
CREATE OR REPLACE VIEW public.available_credits AS
SELECT
  *,
  CASE
    WHEN redeemed_at IS NOT NULL THEN 'redeemed'
    WHEN expired_at IS NOT NULL THEN 'expired'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
    ELSE 'available'
  END AS credit_status
FROM public.make_up_credits;

-- RLS on views follows the base table's policies automatically in Postgres
-- but we need to ensure security_invoker is set
ALTER VIEW public.available_credits SET (security_invoker = on);
