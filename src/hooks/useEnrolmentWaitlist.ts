import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/error-handler';
import { STALE_SEMI_STABLE } from '@/config/query-stale-times';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaitlistStatus =
  | 'waiting'
  | 'offered'
  | 'accepted'
  | 'enrolled'
  | 'declined'
  | 'expired'
  | 'withdrawn'
  | 'lost';

export type WaitlistPriority = 'normal' | 'high' | 'urgent';

export type WaitlistSource =
  | 'manual'
  | 'lead_pipeline'
  | 'booking_page'
  | 'parent_portal'
  | 'website';

export interface EnrolmentWaitlistEntry {
  id: string;
  org_id: string;
  lead_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  guardian_id: string | null;
  child_first_name: string;
  child_last_name: string | null;
  child_age: number | null;
  instrument_id: string | null;
  instrument_name: string;
  preferred_teacher_id: string | null;
  preferred_location_id: string | null;
  preferred_days: string[] | null;
  preferred_time_earliest: string | null;
  preferred_time_latest: string | null;
  experience_level: string | null;
  lesson_duration_mins: number;
  position: number;
  status: WaitlistStatus;
  offered_slot_day: string | null;
  offered_slot_time: string | null;
  offered_teacher_id: string | null;
  offered_location_id: string | null;
  offered_rate_minor: number | null;
  offered_at: string | null;
  offer_expires_at: string | null;
  responded_at: string | null;
  converted_student_id: string | null;
  converted_at: string | null;
  source: WaitlistSource;
  notes: string | null;
  priority: WaitlistPriority;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  teacher?: { id: string; display_name: string } | null;
  location?: { id: string; name: string } | null;
  offered_teacher?: { id: string; display_name: string } | null;
  offered_location?: { id: string; name: string } | null;
}

export interface WaitlistActivity {
  id: string;
  org_id: string;
  waitlist_id: string;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface WaitlistFilters {
  status?: WaitlistStatus | 'active';
  instrument_id?: string;
  teacher_id?: string;
  location_id?: string;
  search?: string;
  priority?: WaitlistPriority;
}

export interface AddToWaitlistInput {
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  child_first_name: string;
  child_last_name?: string;
  child_age?: number | null;
  instrument_id?: string;
  instrument_name: string;
  preferred_teacher_id?: string;
  preferred_location_id?: string;
  preferred_days?: string[];
  preferred_time_earliest?: string;
  preferred_time_latest?: string;
  experience_level?: string;
  lesson_duration_mins?: number;
  notes?: string;
  priority?: WaitlistPriority;
  source?: WaitlistSource;
  lead_id?: string;
  guardian_id?: string;
}

export interface OfferSlotInput {
  waitlist_id: string;
  day: string;
  time: string;
  teacher_id: string;
  location_id: string;
  rate_minor: number;
}

export interface UpdateWaitlistInput {
  id: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  child_first_name?: string;
  child_last_name?: string;
  child_age?: number | null;
  instrument_id?: string;
  instrument_name?: string;
  preferred_teacher_id?: string | null;
  preferred_location_id?: string | null;
  preferred_days?: string[];
  preferred_time_earliest?: string | null;
  preferred_time_latest?: string | null;
  experience_level?: string | null;
  lesson_duration_mins?: number;
  notes?: string;
  priority?: WaitlistPriority;
}

export interface ConvertWaitlistInput {
  waitlist_id: string;
  teacher_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function invalidateWaitlistQueries(queryClient: ReturnType<typeof useQueryClient>, orgId: string) {
  queryClient.invalidateQueries({ queryKey: ['enrolment-waitlist'] });
  queryClient.invalidateQueries({ queryKey: ['enrolment-waitlist-stats'] });
  queryClient.invalidateQueries({ queryKey: ['enrolment-waitlist-by-instrument'] });
  queryClient.invalidateQueries({ queryKey: ['enrolment-waitlist-entry'] });
  queryClient.invalidateQueries({ queryKey: ['enrolment-waitlist-parent'] });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List waitlist entries with joins. Supports filters including status='active'
 * which returns entries with status IN ('waiting','offered').
 */
export function useEnrolmentWaitlist(filters?: WaitlistFilters) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['enrolment-waitlist', currentOrg?.id, filters],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = db
        .from('enrolment_waitlist')
        .select(`
          *,
          teacher:teachers!enrolment_waitlist_preferred_teacher_id_fkey(id, display_name),
          location:locations!enrolment_waitlist_preferred_location_id_fkey(id, name),
          offered_teacher:teachers!enrolment_waitlist_offered_teacher_id_fkey(id, display_name),
          offered_location:locations!enrolment_waitlist_offered_location_id_fkey(id, name)
        `)
        .eq('org_id', currentOrg.id)
        .order('position', { ascending: true });

      // Status filter
      if (filters?.status === 'active') {
        query = query.in('status', ['waiting', 'offered']);
      } else if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.instrument_id) query = query.eq('instrument_id', filters.instrument_id);
      if (filters?.teacher_id) query = query.eq('preferred_teacher_id', filters.teacher_id);
      if (filters?.location_id) query = query.eq('preferred_location_id', filters.location_id);
      if (filters?.priority) query = query.eq('priority', filters.priority);

      if (filters?.search) {
        query = query.or(
          `contact_name.ilike.%${filters.search}%,child_first_name.ilike.%${filters.search}%,child_last_name.ilike.%${filters.search}%,instrument_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          console.error('[Waitlist] Table enrolment_waitlist not found. Run migration: 20260227120000_enrolment_waitlist.sql');
          throw new Error('The enrolment waitlist feature requires a database migration. Please contact support.');
        }
        throw error;
      }
      return (data ?? []) as EnrolmentWaitlistEntry[];
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Single waitlist entry with activity log.
 */
export function useEnrolmentWaitlistEntry(id: string | undefined) {
  const { currentOrg } = useOrg();

  const entryQuery = useQuery({
    queryKey: ['enrolment-waitlist-entry', currentOrg?.id, id],
    queryFn: async () => {
      if (!currentOrg?.id || !id) return null;

      const { data, error } = await db
        .from('enrolment_waitlist')
        .select(`
          *,
          teacher:teachers!enrolment_waitlist_preferred_teacher_id_fkey(id, display_name),
          location:locations!enrolment_waitlist_preferred_location_id_fkey(id, name),
          offered_teacher:teachers!enrolment_waitlist_offered_teacher_id_fkey(id, display_name),
          offered_location:locations!enrolment_waitlist_offered_location_id_fkey(id, name)
        `)
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .single();

      if (error) throw error;
      return data as EnrolmentWaitlistEntry;
    },
    enabled: !!currentOrg?.id && !!id,
    staleTime: STALE_SEMI_STABLE,
  });

  const activityQuery = useQuery({
    queryKey: ['enrolment-waitlist-activity', currentOrg?.id, id],
    queryFn: async () => {
      if (!currentOrg?.id || !id) return [];

      const { data, error } = await db
        .from('enrolment_waitlist_activity')
        .select('*')
        .eq('waitlist_id', id)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as WaitlistActivity[];
    },
    enabled: !!currentOrg?.id && !!id,
    staleTime: STALE_SEMI_STABLE,
  });

  return {
    entry: entryQuery.data,
    activities: activityQuery.data ?? [],
    isLoading: entryQuery.isLoading,
    isActivityLoading: activityQuery.isLoading,
  };
}

/**
 * Counts per status for stats bar.
 */
export function useEnrolmentWaitlistStats() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['enrolment-waitlist-stats', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { waiting: 0, offered: 0, accepted: 0, enrolled_this_term: 0, total: 0 };

      const statuses = ['waiting', 'offered', 'accepted'] as const;

      const results = await Promise.all(
        statuses.map((status) =>
          db
            .from('enrolment_waitlist')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', status)
        )
      );

      // Enrolled this term: count entries with status='enrolled' and converted_at in the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { count: enrolledCount } = await db
        .from('enrolment_waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .eq('status', 'enrolled')
        .gte('converted_at', ninetyDaysAgo.toISOString());

      const counts = { waiting: 0, offered: 0, accepted: 0, enrolled_this_term: 0, total: 0 };
      statuses.forEach((status, i) => {
        if (results[i].error) throw results[i].error;
        counts[status] = results[i].count ?? 0;
      });
      counts.enrolled_this_term = enrolledCount ?? 0;
      counts.total = counts.waiting + counts.offered + counts.accepted;
      return counts;
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Grouped counts by instrument for dashboard widget.
 */
export function useEnrolmentWaitlistByInstrument() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['enrolment-waitlist-by-instrument', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await db
        .from('enrolment_waitlist')
        .select('instrument_name, status')
        .eq('org_id', currentOrg.id)
        .in('status', ['waiting', 'offered']);

      if (error) throw error;
      if (!data) return [];

      // Group by instrument
      const grouped: Record<string, { instrument_name: string; waiting_count: number; offered_count: number }> = {};
      for (const row of data as { instrument_name: string; status: string }[]) {
        if (!grouped[row.instrument_name]) {
          grouped[row.instrument_name] = { instrument_name: row.instrument_name, waiting_count: 0, offered_count: 0 };
        }
        if (row.status === 'waiting') grouped[row.instrument_name].waiting_count++;
        else if (row.status === 'offered') grouped[row.instrument_name].offered_count++;
      }

      return Object.values(grouped).sort((a, b) =>
        (b.waiting_count + b.offered_count) - (a.waiting_count + a.offered_count)
      );
    },
    enabled: !!currentOrg?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add a new entry to the enrolment waitlist.
 */
export function useAddToEnrolmentWaitlist() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AddToWaitlistInput) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      // WL-M4 FIX: Use atomic RPC for position calculation
      const { data: result, error } = await db.rpc('add_to_enrolment_waitlist', {
        _org_id: currentOrg.id,
        _contact_name: input.contact_name,
        _child_first_name: input.child_first_name,
        _instrument_name: input.instrument_name,
        _contact_email: input.contact_email || null,
        _contact_phone: input.contact_phone || null,
        _child_last_name: input.child_last_name || null,
        _child_age: input.child_age ?? null,
        _instrument_id: input.instrument_id || null,
        _preferred_teacher_id: input.preferred_teacher_id || null,
        _preferred_location_id: input.preferred_location_id || null,
        _preferred_days: input.preferred_days || null,
        _preferred_time_earliest: input.preferred_time_earliest || null,
        _preferred_time_latest: input.preferred_time_latest || null,
        _experience_level: input.experience_level || null,
        _lesson_duration_mins: input.lesson_duration_mins ?? 30,
        _notes: input.notes || null,
        _priority: input.priority || 'normal',
        _source: input.source || 'manual',
        _lead_id: input.lead_id || null,
        _guardian_id: input.guardian_id || null,
      });

      if (error) throw error;

      // If linked to a lead, log lead activity (non-critical, outside RPC)
      if (input.lead_id && result?.id) {
        await db.from('lead_activities').insert({
          lead_id: input.lead_id,
          org_id: currentOrg.id,
          activity_type: 'waitlist_added',
          description: `Added to enrolment waiting list for ${input.instrument_name}`,
          metadata: { waitlist_id: result.id },
          created_by: user.id,
        });
      }

      return result;
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Added to waiting list',
        description: 'The family has been added to the enrolment waiting list.',
      });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('schema cache') || msg.includes('42P01')) {
        toastError(new Error('The enrolment waitlist feature requires a database migration. Please contact support.'), 'Waiting list unavailable');
      } else {
        toastError(error, 'Failed to add to waiting list');
      }
    },
  });
}

/**
 * Offer a slot to a waiting family.
 */
export function useOfferSlot() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: OfferSlotInput) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      // Get org's expiry hours
      const { data: org } = await db
        .from('organisations')
        .select('enrolment_offer_expiry_hours')
        .eq('id', currentOrg.id)
        .single();

      const expiryHours = org?.enrolment_offer_expiry_hours ?? 48;
      const offeredAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      const { data: entry, error } = await db
        .from('enrolment_waitlist')
        .update({
          status: 'offered',
          offered_slot_day: input.day,
          offered_slot_time: input.time,
          offered_teacher_id: input.teacher_id,
          offered_location_id: input.location_id,
          offered_rate_minor: input.rate_minor,
          offered_at: offeredAt,
          offer_expires_at: expiresAt,
        })
        .eq('id', input.waitlist_id)
        .eq('org_id', currentOrg.id)
        .select()
        .single();

      if (error) throw error;

      // Log 'offered' activity
      await db.from('enrolment_waitlist_activity').insert({
        org_id: currentOrg.id,
        waitlist_id: input.waitlist_id,
        activity_type: 'offered',
        description: `Slot offered: ${input.day} at ${input.time}`,
        metadata: {
          day: input.day,
          time: input.time,
          teacher_id: input.teacher_id,
          location_id: input.location_id,
          rate_minor: input.rate_minor,
          expires_at: expiresAt,
        },
        created_by: user.id,
      });

      // Call send-enrolment-offer edge function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke('send-enrolment-offer', {
          body: { waitlist_id: input.waitlist_id, org_id: currentOrg.id },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } catch (emailErr) {
        // Non-fatal: offer is saved even if email fails
        console.error('Failed to send offer email:', emailErr);
      }

      return entry;
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      toast({
        title: 'Slot offered',
        description: 'The family has been notified of the available slot.',
      });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to offer slot');
    },
  });
}

/**
 * Respond to an offer: accept or decline.
 */
export function useRespondToOffer() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ waitlist_id, action }: { waitlist_id: string; action: 'accept' | 'decline' }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // WL-H5 FIX: Use atomic RPC instead of plain UPDATE
      const { data, error } = await db.rpc('respond_to_enrolment_offer', {
        _entry_id: waitlist_id,
        _org_id: currentOrg.id,
        _action: action,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      toast({
        title: variables.action === 'accept' ? 'Offer accepted' : 'Offer declined',
        description: variables.action === 'accept'
          ? 'The family accepted the offer. You can now convert them to a student.'
          : 'The family declined the offer.',
      });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to respond to offer');
    },
  });
}

/**
 * Convert a waitlist entry to an enrolled student.
 * Creates guardian → student → student_guardians (same pattern as useConvertLead).
 */
export function useConvertWaitlistToStudent() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ConvertWaitlistInput) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      // Atomic RPC: creates guardian (if needed), student, links them,
      // marks waitlist entry as enrolled, and logs activity — all in one transaction.
      const { data, error } = await db.rpc('convert_waitlist_to_student', {
        p_entry_id: input.waitlist_id,
        p_org_id: currentOrg.id,
        p_teacher_id: input.teacher_id || null,
      });

      if (error) throw error;

      return {
        waitlist_id: data.waitlist_id,
        student_id: data.student_id,
        guardian_id: data.guardian_id,
      };
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      toast({
        title: 'Student enrolled',
        description: 'The waiting list entry has been converted to a student.',
      });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to convert to student');
    },
  });
}

/**
 * Withdraw an entry from the waitlist and reposition remaining.
 */
export function useWithdrawFromWaitlist() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (waitlist_id: string) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // WL-H6 FIX: Use atomic RPC instead of sequential client-side operations
      const { data, error } = await db.rpc('withdraw_from_enrolment_waitlist', {
        _entry_id: waitlist_id,
        _org_id: currentOrg.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      toast({ title: 'Withdrawn', description: 'Entry removed from the waiting list.' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to withdraw');
    },
  });
}

/**
 * Update preferences, notes, or priority of a waitlist entry.
 */
export function useUpdateWaitlistEntry() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateWaitlistInput) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const { id, ...updates } = input;

      // Check if priority changed for activity logging
      let oldPriority: string | null = null;
      if (updates.priority) {
        const { data: existing } = await db
          .from('enrolment_waitlist')
          .select('priority')
          .eq('id', id)
          .eq('org_id', currentOrg.id)
          .single();
        oldPriority = existing?.priority;
      }

      const { data: entry, error } = await db
        .from('enrolment_waitlist')
        .update(updates)
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .select()
        .single();

      if (error) throw error;

      // Log activity if priority changed
      if (updates.priority && oldPriority && updates.priority !== oldPriority) {
        await db.from('enrolment_waitlist_activity').insert({
          org_id: currentOrg.id,
          waitlist_id: id,
          activity_type: 'priority_changed',
          description: `Priority changed from ${oldPriority} to ${updates.priority}`,
          metadata: { old_priority: oldPriority, new_priority: updates.priority },
          created_by: user?.id || null,
        });
      }

      return entry;
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
      toast({ title: 'Updated', description: 'Waiting list entry updated.' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to update entry');
    },
  });
}

/**
 * Reorder waitlist entries within an instrument group (up/down).
 */
export function useReorderWaitlist() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entries: { id: string; position: number }[]) => {
      if (!currentOrg) throw new Error('No organisation selected');

      for (const entry of entries) {
        const { error } = await db
          .from('enrolment_waitlist')
          .update({ position: entry.position })
          .eq('id', entry.id)
          .eq('org_id', currentOrg.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateWaitlistQueries(queryClient, currentOrg!.id);
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to reorder');
    },
  });
}

// ---------------------------------------------------------------------------
// Parent Portal Hook
// ---------------------------------------------------------------------------

/**
 * Waitlist entries for the logged-in parent (guardian).
 */
export function useParentEnrolmentWaitlist() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrolment-waitlist-parent', currentOrg?.id, user?.id],
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

      const { data, error } = await db
        .from('enrolment_waitlist')
        .select(`
          *,
          offered_teacher:teachers!enrolment_waitlist_offered_teacher_id_fkey(id, display_name),
          offered_location:locations!enrolment_waitlist_offered_location_id_fkey(id, name)
        `)
        .eq('org_id', currentOrg.id)
        .eq('guardian_id', guardian.id)
        .in('status', ['waiting', 'offered', 'accepted'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as EnrolmentWaitlistEntry[];
    },
    enabled: !!currentOrg?.id && !!user?.id,
    staleTime: STALE_SEMI_STABLE,
  });
}
