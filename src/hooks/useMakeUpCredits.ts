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
  redeemed_at: string | null;
  redeemed_lesson_id: string | null;
  credit_value_minor: number;
  notes: string | null;
  created_by: string | null;
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

export function useMakeUpCredits(studentId?: string) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch credits for a student or all credits in org
  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['make_up_credits', currentOrg?.id, studentId],
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

      const { data, error } = await query;
      if (error) throw error;
      return data as MakeUpCredit[];
    },
    enabled: !!currentOrg?.id,
  });

  // Get available (unredeemed, non-expired) credits for a student
  const availableCredits = credits?.filter(c => 
    !c.redeemed_at && 
    !(c as any).expired_at &&
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

  // Delete a credit (admin only)
  const deleteCredit = useMutation({
    mutationFn: async (creditId: string) => {
      const { error } = await supabase
        .from('make_up_credits')
        .delete()
        .eq('id', creditId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['make_up_credits'] });
      toast({ title: 'Credit deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting credit', description: error.message, variant: 'destructive' });
    },
  });

  // Check if a lesson cancellation qualifies for a credit
  const checkCreditEligibility = useCallback(async (
    lessonStartAt: string,
    cancellationTime: Date = new Date()
  ): Promise<{ eligible: boolean; hoursNotice: number; requiredHours: number }> => {
    if (!currentOrg?.id) return { eligible: false, hoursNotice: 0, requiredHours: 24 };

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
    deleteCredit,
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
