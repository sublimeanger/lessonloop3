import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { format, parseISO, isSameDay, startOfDay } from 'date-fns';

export interface ClosureDateInfo {
  date: Date;
  reason: string;
  location_id: string | null;
  applies_to_all_locations: boolean;
}

export function useClosureDates(startDate?: Date, endDate?: Date) {
  const { currentOrg } = useOrg();

  const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
  const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

  const { data: closures = [] } = useQuery({
    queryKey: ['closure-dates', currentOrg?.id, startStr, endStr],
    queryFn: async () => {
      if (!currentOrg || !startStr || !endStr) return [];
      const { data } = await supabase
        .from('closure_dates')
        .select('date, reason, location_id, applies_to_all_locations')
        .eq('org_id', currentOrg.id)
        .gte('date', startStr)
        .lte('date', endStr);
      return (data || []).map(c => ({
        ...c,
        date: parseISO(c.date),
      })) as ClosureDateInfo[];
    },
    enabled: !!currentOrg && !!startDate && !!endDate,
    staleTime: STALE_STABLE,
  });

  const isClosureDate = useCallback((date: Date, locationId?: string | null): ClosureDateInfo | null => {
    const dayStart = startOfDay(date);
    for (const closure of closures) {
      if (isSameDay(closure.date, dayStart)) {
        if (closure.applies_to_all_locations) return closure;
        if (locationId && closure.location_id === locationId) return closure;
        if (!locationId && !closure.location_id) return closure;
      }
    }
    return null;
  }, [closures]);

  const getClosuresForDate = useCallback((date: Date): ClosureDateInfo[] => {
    const dayStart = startOfDay(date);
    return closures.filter(c => isSameDay(c.date, dayStart));
  }, [closures]);

  return {
    closures,
    isClosureDate,
    getClosuresForDate,
    blockScheduling: currentOrg?.block_scheduling_on_closures ?? true,
  };
}
