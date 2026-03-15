-- FIX 1: practice_streaks RLS allows cross-org writes
-- The original "System can insert/update streaks" policies had WITH CHECK(true)
-- and USING(true), allowing any authenticated user to write streaks for ANY org.
-- Those were dropped but never replaced with proper org-scoped policies.

-- Drop any lingering permissive policies (idempotent)
DROP POLICY IF EXISTS "System can insert streaks" ON public.practice_streaks;
DROP POLICY IF EXISTS "System can update streaks" ON public.practice_streaks;

-- Add properly scoped INSERT policy
CREATE POLICY "Users can insert own streaks" ON public.practice_streaks
  FOR INSERT WITH CHECK (is_org_member(auth.uid(), org_id));

-- Add properly scoped UPDATE policy
CREATE POLICY "Users can update own streaks" ON public.practice_streaks
  FOR UPDATE USING (is_org_member(auth.uid(), org_id));
