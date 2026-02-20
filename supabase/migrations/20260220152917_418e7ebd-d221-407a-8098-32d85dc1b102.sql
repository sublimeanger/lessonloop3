
-- Create a restricted view exposing only parent-relevant org columns
CREATE VIEW public.parent_org_info AS
SELECT id, name, bank_account_name, bank_sort_code, bank_account_number,
       bank_reference_prefix, online_payments_enabled, currency_code,
       cancellation_notice_hours, parent_reschedule_policy
FROM public.organisations;

-- Grant select to authenticated users (RLS on underlying table still applies)
GRANT SELECT ON public.parent_org_info TO authenticated;
