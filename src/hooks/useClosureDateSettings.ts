import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { HolidayPreset } from '@/lib/holidayPresets';

export interface SettingsClosureDate {
  id: string;
  date: string;
  reason: string;
  location_id: string | null;
  applies_to_all_locations: boolean;
  location?: { name: string } | null;
}

interface ClosureLocation {
  id: string;
  name: string;
}

export function useClosureDateSettings() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const closuresQuery = useQuery({
    queryKey: ['closure-dates-settings', currentOrg?.id],
    queryFn: async (): Promise<SettingsClosureDate[]> => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('closure_dates')
        .select('*, location:locations(name)')
        .eq('org_id', currentOrg.id)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data as SettingsClosureDate[]) || [];
    },
    enabled: !!currentOrg,
    staleTime: STALE_STABLE,
  });

  const locationsQuery = useQuery({
    queryKey: ['closure-locations', currentOrg?.id],
    queryFn: async (): Promise<ClosureLocation[]> => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('org_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrg,
    staleTime: STALE_STABLE,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['closure-dates-settings', currentOrg?.id] });
  };

  const addClosureDatesMutation = useMutation({
    mutationFn: async ({ dates, locationId }: { dates: { date: Date; reason: string }[]; locationId: string }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');
      const inserts = dates.map(d => ({
        org_id: currentOrg.id,
        date: format(d.date, 'yyyy-MM-dd'),
        reason: d.reason,
        location_id: locationId === 'all' ? null : locationId,
        applies_to_all_locations: locationId === 'all',
        created_by: user.id,
      }));
      const { error } = await supabase
        .from('closure_dates')
        .upsert(inserts, { onConflict: 'org_id,location_id,date' });
      if (error) throw error;
      return dates.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} closure date${count > 1 ? 's' : ''} added` });
      invalidate();
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding closures', description: error.message, variant: 'destructive' });
    },
  });

  const deleteClosureMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('closure_dates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => {
      toast({ title: 'Error deleting closure', variant: 'destructive' });
    },
  });

  const deleteBulkMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!currentOrg) throw new Error('No org');
      const { error } = await supabase
        .from('closure_dates')
        .delete()
        .eq('org_id', currentOrg.id)
        .eq('reason', reason);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Closures removed' });
      invalidate();
    },
    onError: () => {
      toast({ title: 'Error deleting closures', variant: 'destructive' });
    },
  });

  const addPreset = (preset: HolidayPreset, locationId: string) => {
    const allDates: { date: Date; reason: string }[] = [];
    for (const range of preset.dates) {
      const dates = eachDayOfInterval({
        start: parseISO(range.start),
        end: parseISO(range.end),
      }).map(date => ({ date, reason: range.reason }));
      allDates.push(...dates);
    }
    addClosureDatesMutation.mutate({ dates: allDates, locationId });
  };

  return {
    closures: closuresQuery.data || [],
    locations: locationsQuery.data || [],
    isLoading: closuresQuery.isLoading || locationsQuery.isLoading,
    addClosureDates: (dates: { date: Date; reason: string }[], locationId: string) =>
      addClosureDatesMutation.mutate({ dates, locationId }),
    addPreset,
    deleteClosure: deleteClosureMutation.mutate,
    deleteBulk: deleteBulkMutation.mutate,
    isSaving: addClosureDatesMutation.isPending,
  };
}
