import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from '@/hooks/use-toast';

interface ExportData {
  organisation: string;
  exportedAt: string;
  files: {
    students: string;
    guardians: string;
    lessons: string;
    invoices: string;
    payments: string;
  };
  counts: {
    students: number;
    guardians: number;
    lessons: number;
    invoices: number;
    payments: number;
  };
}

interface DeleteRequest {
  action: 'soft_delete' | 'anonymise';
  entityType: 'student' | 'guardian';
  entityId: string;
}

export function useGDPRExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke<ExportData>('gdpr-export', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (!data) {
        throw new Error('No data returned');
      }

      // Download each CSV file
      const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      const timestamp = new Date().toISOString().split('T')[0];
      const orgName = data.organisation.replace(/\s+/g, '_');

      downloadCSV(data.files.students, `${orgName}_students_${timestamp}.csv`);
      downloadCSV(data.files.guardians, `${orgName}_guardians_${timestamp}.csv`);
      downloadCSV(data.files.lessons, `${orgName}_lessons_${timestamp}.csv`);
      downloadCSV(data.files.invoices, `${orgName}_invoices_${timestamp}.csv`);
      downloadCSV(data.files.payments, `${orgName}_payments_${timestamp}.csv`);

      toast({
        title: 'Export complete',
        description: `Exported ${data.counts.students} students, ${data.counts.guardians} guardians, ${data.counts.lessons} lessons, ${data.counts.invoices} invoices, ${data.counts.payments} payments`,
      });

      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast({
        title: 'Export failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportData, isExporting };
}

export function useGDPRDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteRequest) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('gdpr-delete', {
        body: request,
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as { success: boolean; message: string };
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Request processed',
        description: data.message,
      });
      
      // Invalidate relevant queries
      if (variables.entityType === 'student') {
        queryClient.invalidateQueries({ queryKey: ['students'] });
      } else if (variables.entityType === 'guardian') {
        queryClient.invalidateQueries({ queryKey: ['guardians'] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Request failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeletionCandidates() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['deletion-candidates', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { students: [], guardians: [] };

      // Get inactive students that could be deleted
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, status, deleted_at, updated_at')
        .eq('org_id', currentOrg.id)
        .eq('status', 'inactive')
        .is('deleted_at', null)
        .order('updated_at', { ascending: true });

      // Get guardians without active linked students
      const { data: guardians } = await supabase
        .from('guardians')
        .select(`
          id, 
          full_name, 
          deleted_at, 
          updated_at,
          student_guardians(student_id)
        `)
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null);

      return {
        students: students || [],
        guardians: guardians || [],
      };
    },
    enabled: !!currentOrg?.id,
  });
}
