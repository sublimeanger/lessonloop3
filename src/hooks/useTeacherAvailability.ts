import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type AvailabilityBlock = Tables<'availability_blocks'>;
export type TimeOffBlock = Tables<'time_off_blocks'>;
export type DayOfWeek = Tables<'availability_blocks'>['day_of_week'];

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

// Hook for current user's availability blocks
export function useAvailabilityBlocks(teacherUserId?: string) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const targetUserId = teacherUserId || user?.id;

  return useQuery({
    queryKey: ['availability-blocks', currentOrg?.id, targetUserId],
    queryFn: async () => {
      if (!currentOrg?.id || !targetUserId) return [];

      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('teacher_user_id', targetUserId)
        .order('day_of_week')
        .order('start_time_local');

      if (error) throw error;
      return data as AvailabilityBlock[];
    },
    enabled: !!currentOrg?.id && !!targetUserId,
  });
}

// Hook for current user's time-off blocks
export function useTimeOffBlocks(teacherUserId?: string) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const targetUserId = teacherUserId || user?.id;

  return useQuery({
    queryKey: ['time-off-blocks', currentOrg?.id, targetUserId],
    queryFn: async () => {
      if (!currentOrg?.id || !targetUserId) return [];

      const { data, error } = await supabase
        .from('time_off_blocks')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('teacher_user_id', targetUserId)
        .order('start_at', { ascending: true });

      if (error) throw error;
      return data as TimeOffBlock[];
    },
    enabled: !!currentOrg?.id && !!targetUserId,
  });
}

// Create availability block
export function useCreateAvailabilityBlock() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (block: Omit<TablesInsert<'availability_blocks'>, 'org_id' | 'teacher_user_id'> & { teacher_user_id?: string }) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No organisation selected');

      const { data, error } = await supabase
        .from('availability_blocks')
        .insert({
          ...block,
          org_id: currentOrg.id,
          teacher_user_id: block.teacher_user_id || user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
      toast({ title: 'Availability added', description: 'Your availability has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Delete availability block
export function useDeleteAvailabilityBlock() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { error } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-blocks'] });
      toast({ title: 'Availability removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Create time-off block
export function useCreateTimeOffBlock() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (block: { start_at: string; end_at: string; reason?: string; teacher_user_id?: string }) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No organisation selected');

      const { data, error } = await supabase
        .from('time_off_blocks')
        .insert({
          org_id: currentOrg.id,
          teacher_user_id: block.teacher_user_id || user.id,
          start_at: block.start_at,
          end_at: block.end_at,
          reason: block.reason || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-blocks'] });
      toast({ title: 'Time off added', description: 'Your time off has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Delete time-off block
export function useDeleteTimeOffBlock() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');

      const { error } = await supabase
        .from('time_off_blocks')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-blocks'] });
      toast({ title: 'Time off removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Check if a lesson time is within teacher's availability
 */
export function isWithinAvailability(
  dayOfWeek: DayOfWeek,
  startTime: string, // HH:mm format
  endTime: string,   // HH:mm format
  availabilityBlocks: AvailabilityBlock[]
): boolean {
  // Get blocks for this day
  const dayBlocks = availabilityBlocks.filter(b => b.day_of_week === dayOfWeek);
  
  if (dayBlocks.length === 0) {
    // No availability set for this day
    return false;
  }

  // Check if the lesson time fits within any availability block
  return dayBlocks.some(block => {
    const blockStart = block.start_time_local;
    const blockEnd = block.end_time_local;
    return startTime >= blockStart && endTime <= blockEnd;
  });
}
