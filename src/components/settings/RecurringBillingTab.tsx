import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useOrg } from '@/contexts/OrgContext';
import {
  useRecurringInvoiceTemplates,
  useCreateRecurringTemplate,
  useUpdateRecurringTemplate,
  useDeleteRecurringTemplate,
  type RecurringTemplate,
} from '@/hooks/useRecurringInvoiceTemplates';
import {
  Plus, Loader2, CalendarClock, Trash2, Pencil, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  termly: 'Termly',
};

const MODE_LABELS: Record<string, string> = {
  delivered: 'Delivered lessons',
  upfront: 'Upfront charge',
};

function TemplateCard({
  template,
  canEdit,
  onEdit,
  onToggle,
  onDelete,
}: {
  template: RecurringTemplate;
  canEdit: boolean;
  onEdit: (t: RecurringTemplate) => void;
  onToggle: (t: RecurringTemplate) => void;
  onDelete: (t: RecurringTemplate) => void;
}) {
  return (
    <div className={cn(
      'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all sm:flex-row sm:items-center sm:gap-4',
      !template.active && 'opacity-60',
    )}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <CalendarClock className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{template.name}</span>
          <Badge variant={template.active ? 'success' : 'secondary'}>
            {template.active ? 'Active' : 'Paused'}
          </Badge>
          <Badge variant="outline">
            {FREQUENCY_LABELS[template.frequency] || template.frequency}
          </Badge>
          {template.auto_send && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
              Auto-send
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
          <span>Mode: {MODE_LABELS[template.billing_mode] || template.billing_mode}</span>
          <span>Next run: {format(parseISO(template.next_run_date), 'd MMM yyyy')}</span>
          {template.last_run_at && (
            <span>
              Last run: {format(parseISO(template.last_run_at), 'd MMM yyyy')} — {template.last_run_invoice_count} invoice{template.last_run_invoice_count !== 1 ? 's' : ''}
              {template.last_run_status === 'failed' && (
                <span className="text-destructive font-medium"> (failed)</span>
              )}
            </span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onToggle(template)} title={template.active ? 'Pause' : 'Resume'}>
            {template.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit(template)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onDelete(template)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function RecurringBillingTab() {
  const { isOrgAdmin, isOrgOwner } = useOrg();
  const canEdit = isOrgOwner || isOrgAdmin;

  const { data: templates = [], isLoading } = useRecurringInvoiceTemplates();
  const createMutation = useCreateRecurringTemplate();
  const updateMutation = useUpdateRecurringTemplate();
  const deleteMutation = useDeleteRecurringTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formFrequency, setFormFrequency] = useState('monthly');
  const [formMode, setFormMode] = useState('delivered');
  const [formAutoSend, setFormAutoSend] = useState(false);
  const [formNextRunDate, setFormNextRunDate] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormFrequency('monthly');
    setFormMode('delivered');
    setFormAutoSend(false);
    setFormNextRunDate('');
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetForm();
    // Default next run to 1st of next month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setFormNextRunDate(format(nextMonth, 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const openEdit = (template: RecurringTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormFrequency(template.frequency);
    setFormMode(template.billing_mode);
    setFormAutoSend(template.auto_send);
    setFormNextRunDate(template.next_run_date);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formNextRunDate) return;

    if (editingTemplate) {
      await updateMutation.mutateAsync({
        id: editingTemplate.id,
        name: formName.trim(),
        frequency: formFrequency,
        billing_mode: formMode,
        auto_send: formAutoSend,
        next_run_date: formNextRunDate,
      });
    } else {
      await createMutation.mutateAsync({
        name: formName.trim(),
        frequency: formFrequency,
        billing_mode: formMode,
        auto_send: formAutoSend,
        next_run_date: formNextRunDate,
      });
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleToggle = async (template: RecurringTemplate) => {
    await updateMutation.mutateAsync({
      id: template.id,
      active: !template.active,
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recurring Billing</CardTitle>
            <CardDescription>
              Set up templates to automatically generate invoices on a schedule.
            </CardDescription>
          </div>
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Template</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No recurring billing templates"
            description="Create a template to automatically generate invoices weekly, monthly, or each term."
            actionLabel={canEdit ? 'Create Template' : undefined}
            onAction={canEdit ? openCreate : undefined}
          />
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                canEdit={canEdit}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Recurring Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the recurring billing template settings.'
                : 'Set up automatic invoice generation on a schedule.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Monthly Tuition"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="termly">Termly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Mode</Label>
              <Select value={formMode} onValueChange={setFormMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivered">Delivered lessons (bill completed lessons)</SelectItem>
                  <SelectItem value="upfront">Upfront (bill for upcoming period)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-next-run">Next Run Date</Label>
              <Input
                id="tpl-next-run"
                type="date"
                value={formNextRunDate}
                onChange={(e) => setFormNextRunDate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-send invoices</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, invoices are emailed immediately. Otherwise they're created as drafts.
                </p>
              </div>
              <Switch checked={formAutoSend} onCheckedChange={setFormAutoSend} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim() || !formNextRunDate}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This won't affect invoices already created by this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
