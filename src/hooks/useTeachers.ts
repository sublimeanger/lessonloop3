import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface Teacher {
  id: string;
  org_id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  instruments: string[];
  employment_type: 'contractor' | 'employee';
  pay_rate_type: 'per_lesson' | 'hourly' | 'percentage' | null;
  pay_rate_value: number | null;
  payroll_notes: string | null;
  bio: string | null;
  status: 'active' | 'inactive';
  default_lesson_length_mins: number;
  created_at: string;
  updated_at: string;
  isLinked: boolean; // derived: user_id is not null
}

export interface CreateTeacherData {
  display_name: string;
  email?: string;
  phone?: string;
  instruments?: string[];
  employment_type?: 'contractor' | 'employee';
  pay_rate_type?: 'per_lesson' | 'hourly' | 'percentage';
  pay_rate_value?: number;
  bio?: string;
}

export function useTeachers() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['teachers', currentOrg?.id],
    queryFn: async (): Promise<Teacher[]> => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('teachers')
        .select('id, org_id, user_id, display_name, email, phone, instruments, employment_type, bio, status, default_lesson_length_mins, created_at, updated_at')
        .eq('org_id', currentOrg.id)
        .order('display_name')
        .limit(100);

      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        pay_rate_type: null,
        pay_rate_value: null,
        payroll_notes: null,
        isLinked: !!t.user_id,
      }));
    },
    enabled: !!currentOrg,
  });
}

export function useTeacherMutations() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTeacher = useMutation({
    mutationFn: async (data: CreateTeacherData) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const { data: teacher, error } = await supabase
        .from('teachers')
        .insert({
          org_id: currentOrg.id,
          display_name: data.display_name,
          email: data.email?.toLowerCase() || null,
          phone: data.phone || null,
          instruments: data.instruments || [],
          employment_type: data.employment_type || 'contractor',
          pay_rate_type: data.pay_rate_type || null,
          pay_rate_value: data.pay_rate_value || 0,
          bio: data.bio || null,
          user_id: null, // Unlinked teacher
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return teacher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      toast({ title: 'Teacher created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create teacher', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateTeacher = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Teacher> & { id: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');
      const { error } = await supabase
        .from('teachers')
        .update(data)
        .eq('id', id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher updated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update teacher', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteTeacher = useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Fetch teacher to get user_id before deactivating
      const { data: teacher, error: fetchError } = await supabase
        .from('teachers')
        .select('user_id')
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .single();
      if (fetchError) throw fetchError;

      // Soft delete teacher record
      const { error } = await supabase
        .from('teachers')
        .update({ status: 'inactive' })
        .eq('id', id)
        .eq('org_id', currentOrg.id);
      if (error) throw error;

      // Disable org membership to revoke access
      if (teacher?.user_id) {
        const { error: memberError } = await supabase
          .from('org_memberships')
          .update({ status: 'disabled' as any })
          .eq('org_id', currentOrg.id)
          .eq('user_id', teacher.user_id);
        if (memberError) console.error('Failed to disable membership:', memberError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      toast({ title: 'Teacher removed' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to remove teacher', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const reactivateTeacher = useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Fetch teacher to get user_id
      const { data: teacher, error: fetchError } = await supabase
        .from('teachers')
        .select('user_id')
        .eq('id', id)
        .eq('org_id', currentOrg.id)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('teachers')
        .update({ status: 'active' })
        .eq('id', id)
        .eq('org_id', currentOrg.id);
      if (error) throw error;

      // Re-enable org membership
      if (teacher?.user_id) {
        const { error: memberError } = await supabase
          .from('org_memberships')
          .update({ status: 'active' as any })
          .eq('org_id', currentOrg.id)
          .eq('user_id', teacher.user_id);
        if (memberError) console.error('Failed to re-enable membership:', memberError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
      queryClient.invalidateQueries({ queryKey: ['org-members'] });
      toast({ title: 'Teacher reactivated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to reactivate teacher', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return { createTeacher, updateTeacher, deleteTeacher, reactivateTeacher };
}

// Hook to get teacher assignment counts (for display)
export function useTeacherStudentCounts() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['teacher-student-counts', currentOrg?.id],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!currentOrg) return {};

      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id')
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.teacher_id) {
          counts[row.teacher_id] = (counts[row.teacher_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!currentOrg,
  });
}
