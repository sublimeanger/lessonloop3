-- Fix overly permissive RLS policies on practice_streaks
-- The trigger function runs with SECURITY DEFINER, so it bypasses RLS
-- We need to restrict direct user access while allowing the trigger to work

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can insert streaks" ON public.practice_streaks;
DROP POLICY IF EXISTS "System can update streaks" ON public.practice_streaks;

-- Staff can still read all streaks for their org (for teacher dashboard)
-- Parents can only read their children's streaks (handled at query level + existing policy)
-- No direct INSERT/UPDATE allowed - only the SECURITY DEFINER trigger can modify