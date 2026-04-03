import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { useTerms, useCreateTerm, useUpdateTerm, useDeleteTerm, type Term } from '@/hooks/useTerms';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Loader2, GraduationCap } from 'lucide-react';

function getTermStatus(term: Term): 'past' | 'current' | 'upcoming' {
  const today = new Date().toISOString().split('T')[0];
  if (term.end_date < today) return 'past';
  if (term.start_date <= today && term.end_date >= today) return 'current';
  return 'upcoming';
}

const statusConfig = {
  past: { label: 'Past', variant: 'secondary' as const },
  current: { label: 'Current', variant: 'default' as const },
  upcoming: { label: 'Upcoming', variant: 'outline' as const },
};

// UK academic year presets
function getUKTermPresets(year: number) {
  return [
    { name: `Autumn Term ${year}`, start_date: `${year}-09-02`, end_date: `${year}-12-19` },
    { name: `Spring Term ${year + 1}`, start_date: `${year + 1}-01-06`, end_date: `${year + 1}-03-28` },
    { name: `Summer Term ${year + 1}`, start_date: `${year + 1}-04-14`, end_date: `${year + 1}-07-18` },
  ];
}

export function TermManagementCard() {
  const { data: terms = [], isLoading } = useTerms();
  const createTerm = useCreateTerm();
  const updateTerm = useUpdateTerm();
  const deleteTerm = useDeleteTerm();
  const { currentOrg } = useOrg();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [presetYear, setPresetYear] = useState<string>('');

  // S3-L1: Delete confirmation with continuation/billing check
  const [termToDelete, setTermToDelete] = useState<Term | null>(null);
  const [deleteCheckResult, setDeleteCheckResult] = useState<{
    continuationRuns: number;
    billingRuns: number;
    isChecking: boolean;
  } | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const openAdd = () => {
    setEditingTerm(null);
    setForm({ name: '', start_date: '', end_date: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (term: Term) => {
    setEditingTerm(term);
    setForm({ name: term.name, start_date: term.start_date, end_date: term.end_date });
    setIsDialogOpen(true);
  };

  // S3-L1: Initiate delete with pre-check
  const initiateDelete = async (term: Term) => {
    setTermToDelete(term);
    setDeleteCheckResult({ continuationRuns: 0, billingRuns: 0, isChecking: true });

    const [contResult, billResult] = await Promise.all([
      (supabase.from as any)('term_continuation_runs')
        .select('id', { count: 'exact', head: true })
        .or(`current_term_id.eq.${term.id},next_term_id.eq.${term.id}`),
      supabase
        .from('billing_runs')
        .select('id', { count: 'exact', head: true })
        .eq('term_id', term.id),
    ]);

    setDeleteCheckResult({
      continuationRuns: contResult.count || 0,
      billingRuns: billResult.count || 0,
      isChecking: false,
    });
  };

  const confirmDelete = () => {
    if (!termToDelete) return;
    deleteTerm.mutate(termToDelete.id);
    setTermToDelete(null);
    setDeleteCheckResult(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) return;

    if (form.end_date < form.start_date) {
      toast({ title: 'Invalid dates', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }

    // Check for overlapping terms
    const overlapping = terms.find(t => {
      if (editingTerm && t.id === editingTerm.id) return false;
      return form.start_date <= t.end_date && form.end_date >= t.start_date;
    });

    if (overlapping) {
      toast({ 
        title: 'Date overlap', 
        description: `Overlaps with "${overlapping.name}" (${format(parseISO(overlapping.start_date), 'd MMM')} – ${format(parseISO(overlapping.end_date), 'd MMM')})`,
        variant: 'destructive' 
      });
      return;
    }

    // S3-L2: Warn if shortening end date with lessons outside new range
    if (editingTerm && form.end_date < editingTerm.end_date && currentOrg) {
      const { count } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', currentOrg.id)
        .gt('start_at', `${form.end_date}T23:59:59`)
        .lte('start_at', `${editingTerm.end_date}T23:59:59`)
        .neq('status', 'cancelled');

      if (count && count > 0) {
        toast({
          title: 'Warning: lessons outside new term dates',
          description: `${count} lesson${count !== 1 ? 's are' : ' is'} scheduled after the new end date. These lessons will remain but fall outside this term.`,
        });
      }
    }

    if (editingTerm) {
      await updateTerm.mutateAsync({ id: editingTerm.id, ...form });
    } else {
      await createTerm.mutateAsync(form);
    }
    setIsDialogOpen(false);
  };

  // S3-L4: Batch preset creation with Promise.all
  const handlePresetAdd = async () => {
    if (!presetYear) return;
    const presets = getUKTermPresets(parseInt(presetYear));
    const newPresets = presets.filter(preset => !terms.some(t => t.name === preset.name));

    if (newPresets.length === 0) {
      toast({ title: 'All terms for this year already exist' });
      setPresetYear('');
      return;
    }

    try {
      await Promise.all(newPresets.map(preset => createTerm.mutateAsync(preset)));
    } catch {
      // Individual errors handled by mutation's onError
    }
    setPresetYear('');
  };

  const isSaving = createTerm.isPending || updateTerm.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Terms
              </CardTitle>
              <CardDescription>
                Define your teaching terms for termly billing and reporting
              </CardDescription>
            </div>
            <Button onClick={openAdd} className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Term
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : terms.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <h3 className="mt-4 font-medium">No terms defined</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add terms to enable termly billing. Use the UK preset to quickly add a full academic year.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button onClick={openAdd} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {terms.map((term) => {
                const status = getTermStatus(term);
                const cfg = statusConfig[status];
                return (
                  <div
                    key={term.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{term.name}</span>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(term.start_date), 'd MMM yyyy')} –{' '}
                        {format(parseISO(term.end_date), 'd MMM yyyy')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" aria-label={`Edit term ${term.name}`} onClick={() => openEdit(term)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 text-destructive hover:text-destructive sm:min-h-9"
                        aria-label={`Delete term ${term.name}`}
                        disabled={deleteTerm.isPending}
                        onClick={() => initiateDelete(term)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* UK Preset Quick-Add */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed p-3">
            <span className="text-sm text-muted-foreground">Quick-add UK academic year:</span>
            <Select value={presetYear} onValueChange={setPresetYear}>
              <SelectTrigger className="h-11 w-full sm:w-[140px]">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}/{y + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePresetAdd}
              disabled={!presetYear || createTerm.isPending}
            >
              {createTerm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add 3 Terms'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* S3-L1: Delete confirmation with impact check */}
      <AlertDialog open={!!termToDelete} onOpenChange={(open) => { if (!open) { setTermToDelete(null); setDeleteCheckResult(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete term?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to delete &ldquo;{termToDelete?.name}&rdquo;?
                {deleteCheckResult?.isChecking && (
                  <span className="block mt-2 text-muted-foreground">Checking linked data…</span>
                )}
                {!deleteCheckResult?.isChecking && deleteCheckResult && deleteCheckResult.continuationRuns > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    ⚠️ {deleteCheckResult.continuationRuns} continuation run{deleteCheckResult.continuationRuns !== 1 ? 's' : ''} will be permanently deleted, including all parent responses.
                  </span>
                )}
                {!deleteCheckResult?.isChecking && deleteCheckResult && deleteCheckResult.billingRuns > 0 && (
                  <span className="block mt-1">
                    {deleteCheckResult.billingRuns} billing run{deleteCheckResult.billingRuns !== 1 ? 's' : ''} will lose their term reference.
                  </span>
                )}
                {!deleteCheckResult?.isChecking && deleteCheckResult && !deleteCheckResult.continuationRuns && !deleteCheckResult.billingRuns && (
                  <span className="block mt-1">This action cannot be undone.</span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteCheckResult?.isChecking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCheckResult?.isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {deleteCheckResult && deleteCheckResult.continuationRuns > 0
                ? 'Delete Term & Continuation Data'
                : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg sm:border sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingTerm ? 'Edit Term' : 'Add Term'}</DialogTitle>
            <DialogDescription>
              {editingTerm ? 'Update the term details' : 'Define a new teaching term period'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Term Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Autumn Term 2025"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.name.trim() || !form.start_date || !form.end_date}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTerm ? 'Save changes' : 'Create Term'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
