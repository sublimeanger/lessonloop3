
-- RPC: Get full calendar health for admin dashboard
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
STABLE
SECURITY DEFINER
SET search_path = 'public'
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
    AND cc.guardian_id IS NULL
    AND is_org_admin(auth.uid(), p_org_id)
  ORDER BY teacher_name, cc.provider;
$$;

-- Lightweight RPC: count of error-state connections for dashboard banner
CREATE OR REPLACE FUNCTION public.get_org_sync_error_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM calendar_connections cc
  WHERE cc.org_id = p_org_id
    AND cc.guardian_id IS NULL
    AND is_org_admin(auth.uid(), p_org_id)
    AND (
      cc.sync_status = 'error'
      OR (cc.sync_enabled AND cc.last_sync_at < now() - interval '6 hours')
      OR (cc.token_expires_at IS NOT NULL AND cc.token_expires_at < now())
    );
$$;
