
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own org metrics" ON public.ai_interaction_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for their org" ON public.ai_interaction_metrics;

-- Users can only view their own metrics
CREATE POLICY "Users can view own metrics"
  ON public.ai_interaction_metrics FOR SELECT
  USING (user_id = auth.uid() AND is_org_member(auth.uid(), org_id));

-- Admins can view all org metrics
CREATE POLICY "Admins can view all org metrics"
  ON public.ai_interaction_metrics FOR SELECT
  USING (is_org_admin(auth.uid(), org_id));

-- Users can only insert their own metrics
CREATE POLICY "Users can insert own metrics"
  ON public.ai_interaction_metrics FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_org_member(auth.uid(), org_id));
