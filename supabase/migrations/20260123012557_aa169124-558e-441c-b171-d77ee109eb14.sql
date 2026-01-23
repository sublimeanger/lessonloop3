-- Phase 1: Critical Security Fixes
-- Block anonymous access to sensitive tables

-- Profiles: Block anon access entirely
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles FOR ALL TO anon
USING (false);

-- Payments: Block anon access entirely  
CREATE POLICY "Block anonymous access to payments"
ON public.payments FOR ALL TO anon
USING (false);

-- User roles: Block anon access
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles FOR ALL TO anon
USING (false);