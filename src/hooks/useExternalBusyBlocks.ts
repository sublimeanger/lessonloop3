import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_VOLATILE, GC_DEFAULT } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { safeGetItem, safeSetItem } from '@/lib/storage';

export interface BusyBlock {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  title: string | null;
}

export interface CalendarSyncInfo {
  last_sync_at: string | null;
  sync_status: string;
  provider: string;
}

function toOrgLocalIso(utcIso: string, timezone: string): string {
  const zoned = toZonedTime(utcIso, timezone);
  return format(zoned, "yyyy-MM-dd'T'HH:mm:ss.SSS");
}

export function useExternalBusyBlocks(startIso: string, endIso: string, teacherFilter: string | null) {
  const { currentOrg } = useOrg();

  const { data: busyBlocks = [], isLoading } = useQuery({
    queryKey: ['external-busy-blocks', currentOrg?.id, startIso, endIso, teacherFilter],
    queryFn: async () => {
      if (!currentOrg) return [];
      const tz = currentOrg.timezone || 'Europe/London';

      let query = supabase
        .from('external_busy_blocks')
        .select('id, user_id, start_at, end_at, title')
        .eq('org_id', currentOrg.id)
        .lt('start_at', endIso)
        .gt('end_at', startIso);

      if (teacherFilter) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('user_id')
          .eq('id', teacherFilter)
          .single();
        if (teacher?.user_id) {
          query = query.eq('user_id', teacher.user_id);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((b) => ({
        id: b.id,
        user_id: b.user_id,
        start_at: toOrgLocalIso(b.start_at, tz),
        end_at: toOrgLocalIso(b.end_at, tz),
        title: b.title,
      }));
    },
    enabled: !!currentOrg,
    staleTime: STALE_VOLATILE,
    gcTime: GC_DEFAULT,
  });

  const { data: syncInfo } = useQuery({
    queryKey: ['calendar-sync-info', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return null;
      const { data } = await supabase
        .from('calendar_connections')
        .select('last_sync_at, sync_status, provider')
        .eq('org_id', currentOrg.id)
        .eq('sync_enabled', true)
        .order('last_sync_at', { ascending: false })
        .limit(1);
      if (!data || data.length === 0) return null;
      return data[0] as CalendarSyncInfo;
    },
    enabled: !!currentOrg,
    staleTime: 60_000,
    gcTime: GC_DEFAULT,
  });

  return { busyBlocks, isLoading, syncInfo: syncInfo ?? null };
}

const SHOW_EXTERNAL_KEY = 'll-show-external-events';

export function useShowExternalEvents() {
  const initial = safeGetItem(SHOW_EXTERNAL_KEY) !== '0';
  const [show, setShowRaw] = useState(initial);

  function setShow(v: boolean) {
    setShowRaw(v);
    safeSetItem(SHOW_EXTERNAL_KEY, v ? '1' : '0');
  }

  return [show, setShow] as const;
}
