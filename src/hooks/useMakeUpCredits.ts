import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInHours, parseISO } from 'date-fns';

export interface MakeUpCredit {
  id: string;
  org_id: string;
  student_id: string;
  issued_for_lesson_id: string | null;
  issued_at: string;
  expires_at: string | null;
  expired_at: string | null;
  redeemed_at: string | null;
  redeemed_lesson_id: string | null;
  applied_to_invoice_id: string | null;
  credit_value_minor: number;
  notes: string | null;
  created_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  issued_for_lesson?: {
    id: string;
    title: string;
    start_at: string;
  } | null;
  redeemed_lesson?: {
    id: string;
    title: string;
    start_at: string;
  } | null;
}

export interface CreateCreditInput {
  student_id: string;
  issued_for_lesson_id?: string;
  credit_value_minor: number;
  expires_at?: string;
  notes?: string;
}

export interface RedeemCreditInput {
  credit_id: string;
  lesson_id: string;
}

export function useMakeUpCredits(studentId?: string, activeOnly = false) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch credits for a student or all credits in org
  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['make_up_credits', currentOrg?.id, studentId, activeOnly],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      let query = supabase
        .from('make_up_credits')
        .select(`
          *,
          issued_for_lesson:lessons!make_up_credits_issued_for_lesson_id_fkey(id, title, start_at),
          redeemed_lesson:lessons!make_up_credits_redeemed_lesson_id_fkey(id, title, start_at)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      // Server-side filter for performance — avoids fetching thousands of
      // redeemed/expired/voided credits for busy academies
      if (activeOnly) {
        query = query
          .is('redeemed_at', null)
          .is('expired_at', null)
          .is('voided_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MakeUpCredit[];
    },
    enabled: !!currentOrg?.id,
  });

  // Get available (unredeemed, non-expired, not applied to invoice) credits
  // Matches the logic in the available_credits database view
  // CRD-H4 FIX: also exclude voided credits
  const availableCredits = credits?.filter(c =>
    !c.redeemed_at &&
    !c.expired_at &&
    !c.voided_at &&
    !c.applied_to_invoice_id &&
    (!c.expires_at || new Date(c.expires_at) > new Date())
  ) || [];

  const totalAvailableValue = availableCredits.reduce((sum, c) => sum + c.credit_value_minor, 0);

  // Create a new credit
  const createCredit = useMutation({
    mutationFn: async (input: CreateCreditInput) => {
      if (!currentOrg?.id || !user?.id) throw new Error('No org or user');

      const { data, error } = await supabase
        .from('make_up_credits')
        .insert({
          org_id: currentOrg.id,
          student_id: input.student_id,
          issued_for_lesson_id: input.issued_for_lesson_id,
          credit_value_minor: input.credit_value_minor,
          expires_at: input.expires_at,
          notes: input.notes,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // FIX 7: Log credit issuance for admin visibility
      supabase
        .from('audit_log')
        .insert({
          org_id: currentOrg.id,
          actor_user_id: user.id,
          action: 'credit_issued',
          entity_type: 'make_up_credit',
          entity_id: data.id,
          after: {
            student_id: input.student_id,
            credit_value_minor: input.credit_value_minor,
            issued_for_lesson_id: input.issued_for_lesson_id,
          } as any,
        })
        .then(({ error: auditErr }) => { if (auditErr) console.error('Audit log error:', auditErr); });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      toast({ title: 'Make-up credit issued' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error issuing credit', description: error.message, variant: 'destructive' });
    },
  });

  // Redeem a credit (atomic server-side with expiry + idempotency checks)
  const redeemCredit = useMutation({
    mutationFn: async (input: RedeemCreditInput) => {
      if (!currentOrg?.id) throw new Error('No org');

      const { data, error } = await supabase.rpc('redeem_make_up_credit', {
        _credit_id: input.credit_id,
        _lesson_id: input.lesson_id,
        _org_id: currentOrg.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      toast({ title: 'Credit redeemed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error redeeming credit', description: error.message, variant: 'destructive' });
    },
  });

  // Void a credit (admin only — preserves audit trail, CRD-C4 FIX)
  const voidCredit = useMutation({
    mutationFn: async (creditId: string) => {
      if (!currentOrg?.id) throw new Error('No org');
      const { data, error } = await (supabase.rpc as any)('void_make_up_credit', {
        _credit_id: creditId,
        _org_id: currentOrg.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist'] });
      toast({ title: 'Credit voided' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error voiding credit', description: error.message, variant: 'destructive' });
    },
  });

  /**
   * Client-side estimate of credit eligibility for UI display.
   * NOTE: The server-side trigger (auto_issue_credit_on_absence) is the
   * source of truth. This is for showing a helpful hint to the admin
   * before they mark attendance. It may disagree with the server.
   */
  const estimateCreditEligibility = useCallback(async (
    lessonStartAt: string,
    cancellationTime: Date = new Date()
  ): Promise<{ eligible: boolean; hoursNotice: number; requiredHours: number; note: string }> => {
    if (!currentOrg?.id) return { eligible: false, hoursNotice: 0, requiredHours: 24, note: '' };

    // Get org's notice hours setting
    const { data: org } = await supabase
      .from('organisations')
      .select('cancellation_notice_hours')
      .eq('id', currentOrg.id)
      .single();

    const requiredHours = org?.cancellation_notice_hours ?? 24;
    const lessonStart = parseISO(lessonStartAt);
    const hoursNotice = differenceInHours(lessonStart, cancellationTime);

    return {
      eligible: hoursNotice >= requiredHours,
      hoursNotice,
      requiredHours,
      note: 'Final eligibility determined by your make-up policies when attendance is saved.',
    };
  }, [currentOrg?.id]);

  return {
    credits,
    availableCredits,
    totalAvailableValue,
    isLoading,
    refetch,
    createCredit,
    redeemCredit,
    voidCredit,
    checkCreditEligibility,
  };
}

// Hook to get org's cancellation notice setting
export function useCancellationNoticeSetting() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: noticeHours, isLoading } = useQuery({
    queryKey: ['cancellation_notice_hours', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return 24;

      const { data, error } = await supabase
        .from('organisations')
        .select('cancellation_notice_hours')
        .eq('id', currentOrg.id)
        .single();

      if (error) throw error;
      return data?.cancellation_notice_hours ?? 24;
    },
    enabled: !!currentOrg?.id,
  });

  const updateNoticeHours = useMutation({
    mutationFn: async (hours: number) => {
      if (!currentOrg?.id) throw new Error('No org');

      const { error } = await supabase
        .from('organisations')
        .update({ cancellation_notice_hours: hours })
        .eq('id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancellation_notice_hours'] });
      toast({ title: 'Cancellation notice period updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating setting', description: error.message, variant: 'destructive' });
    },
  });

  return {
    noticeHours: noticeHours ?? 24,
    isLoading,
    updateNoticeHours,
  };
}
