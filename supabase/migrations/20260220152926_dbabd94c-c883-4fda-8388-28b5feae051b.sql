
-- Fix: make the view use SECURITY INVOKER so underlying RLS applies
ALTER VIEW public.parent_org_info SET (security_invoker = on);
