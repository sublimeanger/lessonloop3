import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { sanitiseCSVCell } from '@/lib/utils';

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useDataExport() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const orgName = currentOrg?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export';

  const exportStudents = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const { data, error } = await supabase
        .from('students')
        .select('first_name, last_name, email, phone, dob, status, notes, created_at')
        .eq('org_id', currentOrg.id)
        .order('last_name');

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'No data to export', description: 'No student records found.' });
        return;
      }

      const rows = ['First Name,Last Name,Email,Phone,Date of Birth,Status,Notes,Created'];
      for (const s of data) {
        rows.push(
          [
            sanitiseCSVCell(s.first_name || ''),
            sanitiseCSVCell(s.last_name || ''),
            sanitiseCSVCell(s.email || ''),
            sanitiseCSVCell(s.phone || ''),
            s.dob || '',
            s.status || '',
            sanitiseCSVCell(s.notes || ''),
            s.created_at ? s.created_at.slice(0, 10) : '',
          ].join(','),
        );
      }

      downloadCSV(rows.join('\n'), `students_${orgName}_${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: 'Export complete', description: `${data.length} student${data.length !== 1 ? 's' : ''} exported.` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  }, [currentOrg, orgName, toast]);

  const exportTeachers = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('display_name, email, phone, instruments, employment_type, status, created_at')
        .eq('org_id', currentOrg.id)
        .order('display_name');

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'No data to export', description: 'No teacher records found.' });
        return;
      }

      const rows = ['Name,Email,Phone,Instruments,Employment Type,Status,Created'];
      for (const t of data) {
        rows.push(
          [
            sanitiseCSVCell(t.display_name || ''),
            sanitiseCSVCell(t.email || ''),
            sanitiseCSVCell(t.phone || ''),
            sanitiseCSVCell((t.instruments || []).join('; ')),
            t.employment_type || '',
            t.status || '',
            t.created_at ? t.created_at.slice(0, 10) : '',
          ].join(','),
        );
      }

      downloadCSV(rows.join('\n'), `teachers_${orgName}_${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: 'Export complete', description: `${data.length} teacher${data.length !== 1 ? 's' : ''} exported.` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  }, [currentOrg, orgName, toast]);

  const exportInvoices = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          invoice_number, status, total_minor, currency_code, due_date, issued_at,
          payer_guardian:guardians!invoices_payer_guardian_id_fkey(full_name),
          payer_student:students!invoices_payer_student_id_fkey(first_name, last_name)
        `)
        .eq('org_id', currentOrg.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'No data to export', description: 'No invoice records found.' });
        return;
      }

      const rows = ['Invoice Number,Status,Amount,Currency,Due Date,Issued Date,Payer'];
      for (const inv of data) {
        const payer = inv.payer_guardian
          ? (inv.payer_guardian as any).full_name
          : inv.payer_student
            ? `${(inv.payer_student as any).first_name} ${(inv.payer_student as any).last_name}`
            : '';
        rows.push(
          [
            sanitiseCSVCell(inv.invoice_number || ''),
            inv.status || '',
            ((inv.total_minor || 0) / 100).toFixed(2),
            inv.currency_code || '',
            inv.due_date || '',
            inv.issued_at ? inv.issued_at.slice(0, 10) : '',
            sanitiseCSVCell(payer || ''),
          ].join(','),
        );
      }

      downloadCSV(rows.join('\n'), `invoices_${orgName}_${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: 'Export complete', description: `${data.length} invoice${data.length !== 1 ? 's' : ''} exported.` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  }, [currentOrg, orgName, toast]);

  return { exportStudents, exportTeachers, exportInvoices };
}
