-- Phase 1: Add missing RLS policies to rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limit records
CREATE POLICY "Users can view own rate limits"
ON public.rate_limits FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all rate limits (for the edge functions)
CREATE POLICY "Service role can manage all rate limits"
ON public.rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add missing policies to user_roles (currently only has SELECT)
CREATE POLICY "Service role can manage user roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);