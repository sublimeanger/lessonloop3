-- Create calendar_connections table for storing OAuth tokens
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  calendar_id TEXT,
  calendar_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disconnected')),
  ical_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id, provider)
);

-- Create calendar_event_mappings table for tracking synced events
CREATE TABLE public.calendar_event_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, lesson_id)
);

-- Create external_busy_blocks table for conflict detection
CREATE TABLE public.external_busy_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  source_event_id TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_calendar_connections_user_org ON public.calendar_connections(user_id, org_id);
CREATE INDEX idx_calendar_connections_ical_token ON public.calendar_connections(ical_token) WHERE ical_token IS NOT NULL;
CREATE INDEX idx_calendar_event_mappings_lesson ON public.calendar_event_mappings(lesson_id);
CREATE INDEX idx_calendar_event_mappings_connection ON public.calendar_event_mappings(connection_id);
CREATE INDEX idx_external_busy_blocks_user_time ON public.external_busy_blocks(user_id, start_at, end_at);
CREATE INDEX idx_external_busy_blocks_org ON public.external_busy_blocks(org_id);

-- Enable RLS on all tables
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_busy_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_connections
CREATE POLICY "Users can view their own calendar connections"
  ON public.calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections"
  ON public.calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
  ON public.calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
  ON public.calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for calendar_event_mappings (via connection ownership)
CREATE POLICY "Users can view their own event mappings"
  ON public.calendar_event_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = connection_id AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own event mappings"
  ON public.calendar_event_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = connection_id AND cc.user_id = auth.uid()
    )
  );

-- RLS policies for external_busy_blocks
-- Org staff can view busy blocks for scheduling purposes
CREATE POLICY "Staff can view org busy blocks"
  ON public.external_busy_blocks FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Users can manage their own busy blocks"
  ON public.external_busy_blocks FOR ALL
  USING (auth.uid() = user_id);

-- Add updated_at trigger for calendar_connections
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate iCal token
CREATE OR REPLACE FUNCTION public.generate_ical_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;