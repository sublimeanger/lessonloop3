ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}';

COMMENT ON COLUMN public.organisations.ai_preferences IS
  'Custom preferences for LoopAssist AI: terminology, tone, billing cycle, etc.';