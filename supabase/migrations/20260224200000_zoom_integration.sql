-- Zoom Integration: online lessons with automatic Zoom meeting creation
-- =====================================================================

-- 1. Add is_online flag to lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_lessons_is_online ON public.lessons(is_online) WHERE is_online = true;

-- 2. Expand calendar_connections provider CHECK to include 'zoom'
ALTER TABLE public.calendar_connections
  DROP CONSTRAINT IF EXISTS calendar_connections_provider_check;
ALTER TABLE public.calendar_connections
  ADD CONSTRAINT calendar_connections_provider_check
    CHECK (provider IN ('google', 'apple', 'zoom'));

-- 3. Create zoom_meeting_mappings table
CREATE TABLE IF NOT EXISTS public.zoom_meeting_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  zoom_meeting_id bigint NOT NULL,
  join_url text NOT NULL,
  start_url text,
  sync_status text NOT NULL DEFAULT 'synced',
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_meeting_mappings_connection
  ON public.zoom_meeting_mappings(connection_id);

-- 4. RLS for zoom_meeting_mappings
ALTER TABLE public.zoom_meeting_mappings ENABLE ROW LEVEL SECURITY;

-- Staff can view mappings for their own connections
CREATE POLICY "Users can view own zoom mappings"
  ON public.zoom_meeting_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = zoom_meeting_mappings.connection_id
        AND cc.user_id = auth.uid()
    )
  );

-- Service role handles inserts/updates/deletes (edge functions use service role key)
