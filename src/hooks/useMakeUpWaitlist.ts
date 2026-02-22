import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ── Types ───────────────────────────────────────────────────────────────

export interface WaitlistEntry {
  id: string;
  org_id: string;
  student_id: string;
  missed_lesson_id: string;
  missed_lesson_date: string;
  lesson_title: string;
  lesson_duration_minutes: number;
  absence_reason: string;
  teacher_id: string | null;
  location_id: string | null;
  guardian_id: string | null;
  credit_id: string | null;
  attendance_record_id: string | null;
  preferred_days: string[] | null;
  preferred_time_earliest: string | null;
  preferred_time_latest: string | null;
  status: string;
  matched_lesson_id: string | null;
  matched_at: string | null;
  offered_at: string | null;
  responded_at: string | null;
  booked_lesson_id: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined
  student?: { id: string; first_name: string; last_name: string } | null;
  guardian?: { id: string; full_name: string; email: string | null } | null;
  matched_lesson?: { id: string; title: string; start_at: string; end_at: string; location_id: string | null; teacher_id: string | null } | null;
  missed_lesson?: { id: string; title: string; start_at: string } | null;
}

export interface WaitlistFilters {
  status?: string;
  teacherId?: string;
  studentId?: string;
}

export interface WaitlistMatchResult {
  waitlist_id: string;
  student_id: string;
  student_name: string;
  guardian_name: string;
  guardian_email: string;
  missed_lesson_title: string;
  missed_lesson_date: string;
  waiting_since: string;
  match_quality: string;
}

// ── useWaitlist ─────────────────────────────────────────────────────────

export function useWaitlist(filters?: WaitlistFilters) {
  const { currentOrg } = useOrg();

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ['make_up_waitlist', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = supabase
        .from('make_up_waitlist')
        .select(`
          *,
          student:students!make_up_waitlist_student_id_fkey(id, first_name, last_name),
          guardian:guardians!make_up_waitlist_guardian_id_fkey(id, full_name, email),
          matched_lesson:lessons!make_up_waitlist_matched_lesson_id_fkey(id, title, start_at, end_at, location_id, teacher_id),
          missed_lesson:lessons!make_up_waitlist_missed_lesson_id_fkey(id, title, start_at)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
      if (filters?.studentId) query = query.eq('student_id', filters.studentId);

      const { data, error } = await query;
      if (error) throw error;
      return data as WaitlistEntry[];
    },
    enabled: !!currentOrg?.id,
  });

  return { entries, isLoading, refetch };
}

// ── useOfferMakeUp ──────────────────────────────────────────────────────

export function useOfferMakeUp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (waitlistId: string) => {
      const { data, error } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'offered', offered_at: new Date().toISOString() })
        .eq('id', waitlistId)
        .select()
        .single();

      if (error) throw error;

      // Fire edge function to notify parent
      await supabase.functions.invoke('notify-makeup-offer', {
        body: { waitlist_id: waitlistId },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      toast({ title: 'Offer sent to parent' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error sending offer', description: error.message, variant: 'destructive' });
    },
  });
}

// ── useDismissMatch ─────────────────────────────────────────────────────

export function useDismissMatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (waitlistId: string) => {
      const { data, error } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'waiting', matched_lesson_id: null, matched_at: null })
        .eq('id', waitlistId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      toast({ title: 'Match dismissed — entry returned to pool' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error dismissing match', description: error.message, variant: 'destructive' });
    },
  });
}

// ── useConfirmMakeUp ────────────────────────────────────────────────────

export function useConfirmMakeUp() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ waitlistId }: { waitlistId: string; lessonId?: string; studentId?: string }) => {
      if (!currentOrg?.id) throw new Error('No org');

      // Atomic server-side confirm: locks row, validates status, checks duplicates, inserts participant
      const { data, error } = await supabase.rpc('confirm_makeup_booking', {
        _waitlist_id: waitlistId,
        _org_id: currentOrg.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['register'] });
      queryClient.invalidateQueries({ queryKey: ['lesson_participants'] });
      toast({ title: 'Make-up lesson confirmed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error confirming make-up', description: error.message, variant: 'destructive' });
    },
  });
}

// ── useFindMatches ──────────────────────────────────────────────────────

export function useFindMatches() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lessonId, absentStudentId }: { lessonId: string; absentStudentId: string }) => {
      if (!currentOrg?.id) throw new Error('No org');

      const { data, error } = await supabase.rpc('find_waitlist_matches', {
        _lesson_id: lessonId,
        _absent_student_id: absentStudentId,
        _org_id: currentOrg.id,
      });

      if (error) throw error;
      return (data ?? []) as WaitlistMatchResult[];
    },
    onError: (error: Error) => {
      toast({ title: 'Error finding matches', description: error.message, variant: 'destructive' });
    },
  });
}

// ── useWaitlistStats ────────────────────────────────────────────────────

export function useWaitlistStats() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['make_up_waitlist_stats', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { waiting: 0, matched: 0, offered: 0, accepted: 0, booked: 0 };

      const { data, error } = await supabase
        .from('make_up_waitlist')
        .select('status')
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      const counts = { waiting: 0, matched: 0, offered: 0, accepted: 0, booked: 0 };
      for (const row of data ?? []) {
        if (row.status in counts) counts[row.status as keyof typeof counts]++;
      }
      return counts;
    },
    enabled: !!currentOrg?.id,
  });
}

// ── useParentWaitlistEntries ────────────────────────────────────────────

export function useParentWaitlistEntries() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['make_up_waitlist_parent', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg?.id || !user?.id) return [];

      // Look up guardian record for this user
      const { data: guardian, error: gErr } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (gErr) throw gErr;
      if (!guardian) return [];

      const { data, error } = await supabase
        .from('make_up_waitlist')
        .select(`
          *,
          student:students!make_up_waitlist_student_id_fkey(id, first_name, last_name),
          matched_lesson:lessons!make_up_waitlist_matched_lesson_id_fkey(id, title, start_at, end_at),
          missed_lesson:lessons!make_up_waitlist_missed_lesson_id_fkey(id, title, start_at)
        `)
        .eq('org_id', currentOrg.id)
        .eq('guardian_id', guardian.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WaitlistEntry[];
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });
}
