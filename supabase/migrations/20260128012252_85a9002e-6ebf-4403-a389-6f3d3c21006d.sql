-- Create ai_interaction_metrics table for tracking feedback and performance
CREATE TABLE public.ai_interaction_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  feedback TEXT CHECK (feedback IN ('helpful', 'not_helpful')),
  response_time_ms INTEGER,
  action_proposed BOOLEAN DEFAULT FALSE,
  action_executed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_interaction_metrics ENABLE ROW LEVEL SECURITY;

-- Users can read their own org's metrics
CREATE POLICY "Users can view own org metrics"
  ON public.ai_interaction_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = ai_interaction_metrics.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.status = 'active'
    )
  );

-- Users can insert metrics for their org
CREATE POLICY "Users can insert metrics for their org"
  ON public.ai_interaction_metrics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_memberships.org_id = ai_interaction_metrics.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.status = 'active'
    )
  );

-- Index for efficient queries
CREATE INDEX idx_ai_metrics_org_id ON public.ai_interaction_metrics(org_id);
CREATE INDEX idx_ai_metrics_message_id ON public.ai_interaction_metrics(message_id);
CREATE INDEX idx_ai_metrics_created_at ON public.ai_interaction_metrics(created_at);