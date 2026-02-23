-- CALSYNC-002: Schedule automatic busy block refresh every 30 minutes.
-- NOTE: This requires pg_cron and pg_net extensions. If not available on
-- your Supabase plan, configure as a Supabase Scheduled Function in the
-- dashboard: Edge Functions → Schedules, every 30 minutes, function:
-- calendar-refresh-busy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-calendar-busy-blocks',
      '*/30 * * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/calendar-refresh-busy',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', current_setting('app.settings.cron_secret')
        ),
        body := '{}'::jsonb
      );
      $$
    );
    RAISE NOTICE 'Cron job refresh-calendar-busy-blocks scheduled';
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule calendar-refresh-busy manually via Supabase dashboard';
  END IF;
END $$;

-- CALSYNC-004: Add guardian_id column to calendar_connections for parent iCal feeds.
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS guardian_id uuid REFERENCES public.guardians(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.calendar_connections.guardian_id IS
  'When set, the iCal feed is scoped to this guardian''s children''s lessons instead of a teacher''s lessons.';

-- Drop old unique constraint that only covers (user_id, org_id, provider)
-- and recreate to include guardian_id so a user can have both a teacher
-- connection and a parent connection.
DO $$
BEGIN
  -- Find and drop existing unique constraint on (user_id, org_id, provider)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.calendar_connections'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 3
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.calendar_connections DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.calendar_connections'::regclass
        AND contype = 'u'
        AND array_length(conkey, 1) = 3
      LIMIT 1
    );
  END IF;
END $$;

-- Recreate with guardian_id included (COALESCE handles NULL guardian_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_connections_user_org_provider_guardian
  ON public.calendar_connections (user_id, org_id, provider, COALESCE(guardian_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- CALSYNC-005: RPC function for admin sync health dashboard.
CREATE OR REPLACE FUNCTION public.get_org_calendar_health(p_org_id uuid)
RETURNS TABLE (
  connection_id uuid,
  user_id uuid,
  teacher_name text,
  provider text,
  sync_enabled boolean,
  sync_status text,
  last_sync_at timestamptz,
  calendar_name text,
  token_expires_at timestamptz,
  events_synced bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    cc.id as connection_id,
    cc.user_id,
    COALESCE(t.display_name, p.full_name, 'Unknown') as teacher_name,
    cc.provider,
    cc.sync_enabled,
    cc.sync_status,
    cc.last_sync_at,
    cc.calendar_name,
    cc.token_expires_at,
    COALESCE(em.event_count, 0) as events_synced
  FROM calendar_connections cc
  LEFT JOIN teachers t ON t.user_id = cc.user_id AND t.org_id = cc.org_id
  LEFT JOIN profiles p ON p.id = cc.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as event_count
    FROM calendar_event_mappings cem
    WHERE cem.connection_id = cc.id AND cem.sync_status = 'synced'
  ) em ON true
  WHERE cc.org_id = p_org_id
    AND cc.guardian_id IS NULL  -- exclude parent connections
    AND is_org_admin(auth.uid(), p_org_id)  -- security check
  ORDER BY teacher_name, cc.provider;
$$;

-- Lightweight RPC for dashboard banner — just count of problem connections
CREATE OR REPLACE FUNCTION public.get_calendar_error_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM calendar_connections
  WHERE org_id = p_org_id
    AND guardian_id IS NULL
    AND (
      sync_status = 'error'
      OR (sync_enabled = true AND sync_status = 'active' AND last_sync_at < NOW() - INTERVAL '6 hours')
      OR (token_expires_at IS NOT NULL AND token_expires_at < NOW())
    )
    AND is_org_admin(auth.uid(), p_org_id);
$$;
