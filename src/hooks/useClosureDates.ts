import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { format, parseISO, isSameDay, startOfDay } from 'date-fns';

export interface ClosureDateInfo {
  date: Date;
  reason: string;
  location_id: string | null;
  applies_to_all_locations: boolean;
}

export function useClosureDates() {
  const { currentOrg } = useOrg();
  const [closures, setClosures] = useState<ClosureDateInfo[]>([]);

  const fetchClosures = useCallback(async (startDate: Date, endDate: Date) => {
    if (!currentOrg) return;

    const { data } = await supabase
      .from('closure_dates')
      .select('date, reason, location_id, applies_to_all_locations')
      .eq('org_id', currentOrg.id)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    if (data) {
      setClosures(data.map(c => ({
        ...c,
        date: parseISO(c.date),
      })));
    }
  }, [currentOrg]);

  const isClosureDate = useCallback((date: Date, locationId?: string | null): ClosureDateInfo | null => {
    const dayStart = startOfDay(date);
    
    for (const closure of closures) {
      if (isSameDay(closure.date, dayStart)) {
        // Check if applies to this location
        if (closure.applies_to_all_locations) {
          return closure;
        }
        if (locationId && closure.location_id === locationId) {
          return closure;
        }
        if (!locationId && !closure.location_id) {
          return closure;
        }
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
    fetchClosures, 
    isClosureDate, 
    getClosuresForDate,
    blockScheduling: currentOrg?.block_scheduling_on_closures ?? true,
  };
}
