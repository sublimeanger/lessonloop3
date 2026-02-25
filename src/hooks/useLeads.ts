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

export type LeadStage =
  | 'enquiry'
  | 'contacted'
  | 'trial_booked'
  | 'trial_completed'
  | 'enrolled'
  | 'lost';

export type LeadSource =
  | 'manual'
  | 'booking_page'
  | 'widget'
  | 'referral'
  | 'website'
  | 'phone'
  | 'walk_in'
  | 'other';

export const LEAD_STAGES: LeadStage[] = [
  'enquiry',
  'contacted',
  'trial_booked',
  'trial_completed',
  'enrolled',
  'lost',
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  enquiry: 'Enquiry',
  contacted: 'Contacted',
  trial_booked: 'Trial Booked',
  trial_completed: 'Trial Completed',
  enrolled: 'Enrolled',
  lost: 'Lost',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  enquiry: '#6366f1',       // indigo
  contacted: '#3b82f6',     // blue
  trial_booked: '#f59e0b',  // amber
  trial_completed: '#8b5cf6', // violet
  enrolled: '#22c55e',      // green
  lost: '#ef4444',          // red
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: 'Manual',
  booking_page: 'Booking Page',
  widget: 'Widget',
  referral: 'Referral',
  website: 'Website',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
};

export interface LeadStudent {
  id: string;
  lead_id: string;
  org_id: string;
  first_name: string;
  last_name: string | null;
  age: number | null;
  instrument: string | null;
  experience_level: string | null;
  notes: string | null;
  converted_student_id: string | null;
  created_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  org_id: string;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface LeadFollowUp {
  id: string;
  lead_id: string;
  org_id: string;
  due_at: string;
  note: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  stage: LeadStage;
  source: LeadSource;
  source_detail: string | null;
  preferred_instrument: string | null;
  preferred_day: string | null;
  preferred_time: string | null;
  assigned_to: string | null;
  trial_date: string | null;
  trial_lesson_id: string | null;
  notes: string | null;
  lost_reason: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadListItem extends Lead {
  student_count: number;
  latest_activity_at: string | null;
}

export interface LeadDetail extends Lead {
  lead_students: LeadStudent[];
  lead_activities: LeadActivity[];
  lead_follow_ups: LeadFollowUp[];
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface LeadFilters {
  stage?: LeadStage;
  source?: LeadSource;
  search?: string;
}

// ---------------------------------------------------------------------------
// Input types for mutations
// ---------------------------------------------------------------------------

export interface CreateLeadInput {
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  source?: LeadSource;
  preferred_instrument?: string;
  notes?: string;
  children: {
    first_name: string;
    last_name?: string;
    age?: number | null;
    instrument?: string;
    experience_level?: string;
  }[];
}

export interface ConvertLeadInput {
  leadId: string;
  students: {
    lead_student_id: string;
    first_name: string;
    last_name: string;
    teacher_id?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all leads with student count and most recent activity timestamp.
 * Accepts optional stage, source, and search filters.
 */
export function useLeads(filters?: LeadFilters) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['leads', currentOrg?.id, filters],
    queryFn: async (): Promise<LeadListItem[]> => {
      if (!currentOrg) return [];

      let query = db
        .from('leads')
        .select(`
          *,
          lead_students(id),
          lead_activities(created_at)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (filters?.stage) {
        query = query.eq('stage', filters.stage);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.search) {
        query = query.ilike('contact_name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => {
        const activities = (row.lead_activities || []) as { created_at: string }[];
        const latestActivity = activities.length > 0
          ? activities.reduce((latest, a) => a.created_at > latest ? a.created_at : latest, activities[0].created_at)
          : null;

        return {
          ...row,
          student_count: (row.lead_students || []).length,
          latest_activity_at: latestActivity,
          lead_students: undefined,
          lead_activities: undefined,
        } as LeadListItem;
      });
    },
    enabled: !!currentOrg,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Returns the count of leads per stage for Kanban column headers.
 */
export function useLeadStageCounts() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead-stage-counts', currentOrg?.id],
    queryFn: async (): Promise<Record<LeadStage, number>> => {
      if (!currentOrg) {
        return Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
      }

      const { data, error } = await db
        .from('leads')
        .select('stage')
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
      for (const row of data || []) {
        const stage = row.stage as LeadStage;
        if (stage in counts) {
          counts[stage]++;
        }
      }
      return counts;
    },
    enabled: !!currentOrg,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Fetch a single lead with students, activities, and follow-ups joined.
 */
export function useLead(leadId: string | undefined) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead', currentOrg?.id, leadId],
    queryFn: async (): Promise<LeadDetail | null> => {
      if (!currentOrg || !leadId) return null;

      const { data, error } = await db
        .from('leads')
        .select(`
          *,
          lead_students(*),
          lead_activities(*),
          lead_follow_ups(*)
        `)
        .eq('id', leadId)
        .eq('org_id', currentOrg.id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        lead_students: (data.lead_students || []) as LeadStudent[],
        lead_activities: ((data.lead_activities || []) as LeadActivity[]).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
        lead_follow_ups: ((data.lead_follow_ups || []) as LeadFollowUp[]).sort(
          (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
        ),
      } as LeadDetail;
    },
    enabled: !!currentOrg && !!leadId,
    staleTime: STALE_SEMI_STABLE,
  });
}

/**
 * Create a new lead with children and an initial 'created' activity.
 */
export function useCreateLead() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      // 1. Create the lead
      const { data: lead, error: leadError } = await db
        .from('leads')
        .insert({
          org_id: currentOrg.id,
          contact_name: input.contact_name,
          contact_email: input.contact_email || null,
          contact_phone: input.contact_phone || null,
          source: input.source || 'manual',
          preferred_instrument: input.preferred_instrument || null,
          notes: input.notes || null,
          stage: 'enquiry' as const,
          created_by: user.id,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // 2. Create lead_students
      if (input.children.length > 0) {
        const students = input.children.map((child) => ({
          lead_id: lead.id,
          org_id: currentOrg.id,
          first_name: child.first_name,
          last_name: child.last_name || null,
          age: child.age ?? null,
          instrument: child.instrument || null,
          experience_level: child.experience_level || null,
        }));

        const { error: studentsError } = await db
          .from('lead_students')
          .insert(students);

        if (studentsError) throw studentsError;
      }

      // 3. Create 'created' activity
      const { error: activityError } = await db
        .from('lead_activities')
        .insert({
          lead_id: lead.id,
          org_id: currentOrg.id,
          activity_type: 'created',
          description: `Lead created for ${input.contact_name}`,
          created_by: user.id,
        });

      if (activityError) throw activityError;

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-counts'] });
      toast({ title: 'Lead created', description: 'New lead has been added to the pipeline.' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to create lead');
    },
  });
}

/**
 * Update a lead's stage and log a 'stage_changed' activity.
 */
export function useUpdateLeadStage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, stage, reason }: { leadId: string; stage: LeadStage; reason?: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Get the current stage for the activity log
      const { data: currentLead, error: fetchError } = await db
        .from('leads')
        .select('stage')
        .eq('id', leadId)
        .eq('org_id', currentOrg.id)
        .single();

      if (fetchError) throw fetchError;

      const updates: Record<string, unknown> = { stage };
      if (stage === 'lost' && reason) {
        updates.lost_reason = reason;
      }
      if (stage === 'enrolled') {
        updates.converted_at = new Date().toISOString();
      }

      const { error: updateError } = await db
        .from('leads')
        .update(updates)
        .eq('id', leadId)
        .eq('org_id', currentOrg.id);

      if (updateError) throw updateError;

      // Log activity
      const { error: activityError } = await db
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          org_id: currentOrg.id,
          activity_type: 'stage_changed',
          description: `Stage changed from ${STAGE_LABELS[currentLead.stage as LeadStage]} to ${STAGE_LABELS[stage]}`,
          metadata: { from: currentLead.stage, to: stage, reason } as any,
          created_by: user?.id || null,
        });

      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-funnel'] });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to update lead stage');
    },
  });
}

/**
 * Update lead fields (contact info, preferences, etc.).
 */
export function useUpdateLead() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, ...updates }: { leadId: string } & Partial<Lead>) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const { error } = await db
        .from('leads')
        .update(updates)
        .eq('id', leadId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      toast({ title: 'Lead updated' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to update lead');
    },
  });
}

/**
 * Delete a lead and all related records (cascade handled by DB).
 */
export function useDeleteLead() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadId: string) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Delete child records first (in case cascade isn't set)
      await db.from('lead_activities').delete().eq('lead_id', leadId).eq('org_id', currentOrg.id);
      await db.from('lead_follow_ups').delete().eq('lead_id', leadId).eq('org_id', currentOrg.id);
      await db.from('lead_students').delete().eq('lead_id', leadId).eq('org_id', currentOrg.id);

      const { error } = await db
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-counts'] });
      toast({ title: 'Lead deleted' });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to delete lead');
    },
  });
}

/**
 * Convert a lead to enrolled students.
 * Creates real student records, a guardian from lead contact info,
 * links student_guardians, marks lead as 'enrolled', and logs a 'converted' activity.
 */
export function useConvertLead() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ConvertLeadInput) => {
      if (!currentOrg) throw new Error('No organisation selected');
      if (!user) throw new Error('Not authenticated');

      // Fetch the lead for contact info
      const { data: lead, error: leadFetchError } = await db
        .from('leads')
        .select('*')
        .eq('id', input.leadId)
        .eq('org_id', currentOrg.id)
        .single();

      if (leadFetchError) throw leadFetchError;

      // 1. Create guardian from lead contact info
      const { data: guardian, error: guardianError } = await supabase
        .from('guardians')
        .insert({
          org_id: currentOrg.id,
          full_name: lead.contact_name,
          email: lead.contact_email || null,
          phone: lead.contact_phone || null,
        })
        .select()
        .single();

      if (guardianError) throw guardianError;

      // 2. Create students and link guardians
      for (const studentInput of input.students) {
        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert({
            org_id: currentOrg.id,
            first_name: studentInput.first_name,
            last_name: studentInput.last_name,
            default_teacher_id: studentInput.teacher_id || null,
            status: 'active',
          })
          .select()
          .single();

        if (studentError) throw studentError;

        // Link student to guardian
        const { error: linkError } = await supabase
          .from('student_guardians')
          .insert({
            org_id: currentOrg.id,
            student_id: student.id,
            guardian_id: guardian.id,
            relationship: 'parent' as any,
            is_primary_payer: true,
          } as any);

        if (linkError) throw linkError;

        // Update the lead_student record with converted_student_id
        const { error: updateLeadStudentError } = await db
          .from('lead_students')
          .update({ converted_student_id: student.id })
          .eq('id', studentInput.lead_student_id)
          .eq('org_id', currentOrg.id);

        if (updateLeadStudentError) throw updateLeadStudentError;
      }

      // 3. Update lead stage to 'enrolled'
      const { error: stageError } = await db
        .from('leads')
        .update({
          stage: 'enrolled' as const,
          converted_at: new Date().toISOString(),
        })
        .eq('id', input.leadId)
        .eq('org_id', currentOrg.id);

      if (stageError) throw stageError;

      // 4. Log 'converted' activity
      const { error: activityError } = await db
        .from('lead_activities')
        .insert({
          lead_id: input.leadId,
          org_id: currentOrg.id,
          activity_type: 'converted',
          description: `Lead converted: ${input.students.length} student(s) enrolled`,
          metadata: { student_count: input.students.length } as any,
          created_by: user.id,
        });

      if (activityError) throw activityError;

      return { leadId: input.leadId, guardianId: guardian.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Lead converted',
        description: 'Students have been created and enrolled successfully.',
      });
    },
    onError: (error: unknown) => {
      toastError(error, 'Failed to convert lead');
    },
  });
}
