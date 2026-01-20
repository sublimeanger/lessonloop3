-- Create ai_conversations table
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_messages table
CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_action_proposals table
CREATE TABLE public.ai_action_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  proposal JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'executed', 'failed', 'cancelled')),
  result JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_proposals ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_conversations (users can only see their own conversations in their org)
CREATE POLICY "Users can view own conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can create own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can update own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can delete own conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

-- RLS policies for ai_messages
CREATE POLICY "Users can view messages in own conversations"
  ON public.ai_messages FOR SELECT
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can create messages in own conversations"
  ON public.ai_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

-- RLS policies for ai_action_proposals
CREATE POLICY "Users can view own action proposals"
  ON public.ai_action_proposals FOR SELECT
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can create own action proposals"
  ON public.ai_action_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can update own action proposals"
  ON public.ai_action_proposals FOR UPDATE
  USING (auth.uid() = user_id AND is_org_member(auth.uid(), org_id));

-- Add updated_at trigger for ai_conversations
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id, org_id);
CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX idx_ai_action_proposals_user ON public.ai_action_proposals(user_id, org_id);
CREATE INDEX idx_ai_action_proposals_status ON public.ai_action_proposals(status);

-- Add audit triggers
CREATE TRIGGER audit_ai_action_proposals
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_action_proposals
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();