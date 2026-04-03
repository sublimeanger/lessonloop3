-- Hint completion tracking — cross-device persistence
CREATE TABLE IF NOT EXISTS public.hint_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_id text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, hint_id)
);

CREATE INDEX IF NOT EXISTS idx_hint_completions_user ON public.hint_completions(user_id);

ALTER TABLE public.hint_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hint completions"
  ON public.hint_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hint completions"
  ON public.hint_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hint completions"
  ON public.hint_completions FOR DELETE
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
