import { useEffect, useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DetailSkeleton } from '@/components/shared/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RecipientsField } from '@/components/settings/recurring-billing/RecipientsField';
import { ItemsField, type ItemDraft } from '@/components/settings/recurring-billing/ItemsField';
import { TermModeField } from '@/components/settings/recurring-billing/TermModeField';
import { useRecurringTemplateDetailPage } from '@/hooks/useRecurringTemplateDetailPage';
import {
  AlertTriangle, Loader2, Play, Trash2, ToggleLeft, ToggleRight, Save,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  termly: 'Termly',
};

const MODE_LABELS: Record<string, string> = {
  delivered: 'Delivered lessons',
  upfront: 'Upfront charge',
  hybrid: 'Hybrid',
};

const OUTCOME_VARIANT: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'success',
  partial: 'destructive',
  failed: 'destructive',
  cancelled: 'secondary',
  running: 'outline',
};

function formatDateSafe(iso: string | null | undefined, fmt = 'd MMM yyyy'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

export default function RecurringTemplateDetail() {
  usePageMeta('Recurring Template | LessonLoop', 'Manage recurring billing template');
  const hook = useRecurringTemplateDetailPage();
  const {
    template, canEdit, currentOrg, isLoading,
    recipients, items, runs, issues,
    settingsDraft, setSettingsDraft, itemsDraft, setItemsDraft,
    isSaving, isRunning, isDeleting,
    deleteOpen, setDeleteOpen,
    handleSaveSettings, handleSaveRecipients, handleSaveItems,
    handleActivate, handlePauseResume, handleRunNow, handleDelete,
    openRunDetail,
  } = hook;

  const [recipientDraft, setRecipientDraft] = useState<string[] | null>(null);

  useEffect(() => {
    if (recipientDraft === null) {
      setRecipientDraft(recipients.filter((r) => r.is_active).map((r) => r.student_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients]);

  if (isLoading || !template) {
    return (
      <AppLayout>
        <DetailSkeleton />
      </AppLayout>
    );
  }

  const needsItems =
    template.billing_mode === 'upfront' || template.billing_mode === 'hybrid';
  const isTermly = template.frequency === 'termly';

  const draftOrTemplate = settingsDraft ?? {
    name: template.name,
    frequency: template.frequency,
    billing_mode: template.billing_mode,
    auto_send: template.auto_send,
    next_run_date: template.next_run_date ?? '',
    term_id: template.term_id,
  };

  const currentItemsDraft: ItemDraft[] =
    itemsDraft ??
    items.map((i) => ({
      id: i.id,
      description: i.description,
      amount_major: (i.amount_minor / 100).toFixed(2),
      quantity: i.quantity,
    }));

  return (
    <AppLayout>
      <PageHeader
        title={template.name}
        description={`${FREQUENCY_LABELS[template.frequency] || template.frequency} • ${MODE_LABELS[template.billing_mode] || template.billing_mode}`}
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={handleRunNow}
                disabled={!template.active || isRunning}
                title={
                  !template.active
                    ? 'Activate the template before running.'
                    : 'Generate invoices now.'
                }
              >
                {isRunning ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Running…</>
                ) : (
                  <><Play className="h-3.5 w-3.5" />Run now</>
                )}
              </Button>
              <Button
                variant={template.active ? 'outline' : 'default'}
                size="sm"
                className="gap-1.5"
                onClick={handlePauseResume}
                disabled={isSaving}
              >
                {template.active ? (
                  <><ToggleRight className="h-3.5 w-3.5" />Pause</>
                ) : (
                  <><ToggleLeft className="h-3.5 w-3.5" />Resume</>
                )}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete template"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Badge variant={template.active ? 'success' : 'secondary'}>
          {template.active ? 'Active' : 'Paused'}
        </Badge>
        {template.auto_send && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
            Auto-send
          </Badge>
        )}
      </div>

      {/* Activate banner — only when paused */}
      {!template.active && canEdit && (
        <Card className="mb-4 border-destructive/60">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <h3 className="font-medium">This template is paused</h3>
                {issues.isReady ? (
                  <p className="text-sm text-muted-foreground">
                    Ready to activate. Invoices will be generated on the next scheduled run.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Before activating, resolve:</p>
                    <ul className="text-sm list-disc list-inside text-muted-foreground space-y-0.5">
                      {issues.missingRecipients && (
                        <li>Add at least one recipient.</li>
                      )}
                      {issues.missingItems && (
                        <li>Add at least one valid item (upfront/hybrid mode).</li>
                      )}
                    </ul>
                  </>
                )}
                <Button
                  size="sm"
                  onClick={handleActivate}
                  disabled={!issues.isReady || isSaving}
                  className="mt-1"
                >
                  Activate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Settings */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Template Settings</CardTitle>
            {canEdit && settingsDraft === null && (
              <Button variant="ghost" size="sm" onClick={() => setSettingsDraft(draftOrTemplate)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsDraft === null ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{template.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Frequency</dt>
                <dd className="font-medium">{FREQUENCY_LABELS[template.frequency] || template.frequency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium">{MODE_LABELS[template.billing_mode] || template.billing_mode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Next run</dt>
                <dd className="font-medium">{formatDateSafe(template.next_run_date)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Auto-send</dt>
                <dd className="font-medium">{template.auto_send ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={settingsDraft.name}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={settingsDraft.frequency}
                  onValueChange={(v) => setSettingsDraft({ ...settingsDraft, frequency: v })}
                >
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
                <Select
                  value={settingsDraft.billing_mode}
                  onValueChange={(v) => setSettingsDraft({ ...settingsDraft, billing_mode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivered">Delivered lessons</SelectItem>
                    <SelectItem value="upfront">Upfront</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Run Date</Label>
                <DatePicker
                  value={settingsDraft.next_run_date}
                  onChange={(v) => setSettingsDraft({ ...settingsDraft, next_run_date: v })}
                  placeholder="Select date"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-send invoices</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When enabled, invoices are emailed immediately.
                  </p>
                </div>
                <Switch
                  checked={settingsDraft.auto_send}
                  onCheckedChange={(v) => setSettingsDraft({ ...settingsDraft, auto_send: v })}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setSettingsDraft(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveSettings({
                    name: settingsDraft.name.trim(),
                    frequency: settingsDraft.frequency,
                    billing_mode: settingsDraft.billing_mode,
                    auto_send: settingsDraft.auto_send,
                    next_run_date: settingsDraft.next_run_date,
                  })}
                  disabled={!settingsDraft.name.trim() || !settingsDraft.next_run_date || isSaving}
                  className="gap-1.5"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RecipientsField
            templateId={template.id}
            selectedIds={recipientDraft ?? []}
            onChange={setRecipientDraft}
            existingRecipients={recipients}
          />
          {canEdit && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => recipientDraft && handleSaveRecipients(recipientDraft)}
                disabled={isSaving || recipientDraft === null}
                className="gap-1.5"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                Save recipients
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      {needsItems && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ItemsField
              value={currentItemsDraft}
              onChange={setItemsDraft}
              currencyCode={currentOrg?.currency_code || 'GBP'}
            />
            {canEdit && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSaveItems(currentItemsDraft)}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Save className="h-3.5 w-3.5" />
                  Save items
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Term Mode */}
      {isTermly && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Term Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <TermModeField
              value={{
                mode: template.term_id ? 'one_shot' : 'rolling',
                termId: template.term_id,
              }}
              onChange={(v) => handleSaveSettings({
                term_id: v.mode === 'one_shot' ? v.termId : null,
              })}
            />
          </CardContent>
        </Card>
      )}

      {/* Recent Runs */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet. Use "Run now" to generate invoices from this template.
            </p>
          ) : (
            <div className="divide-y">
              {runs.slice(0, 10).map((run) => (
                <button
                  key={run.id}
                  onClick={() => openRunDetail(run.id)}
                  className="flex items-center justify-between w-full py-2.5 text-left hover:bg-muted/50 px-2 -mx-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={OUTCOME_VARIANT[run.outcome ?? 'running'] ?? 'outline'}>
                      {run.outcome ?? 'running'}
                    </Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {formatDateSafe(run.period_start)} – {formatDateSafe(run.period_end)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {run.invoices_generated} invoice(s)
                        {run.recipients_skipped > 0 &&
                          ` · ${run.recipients_skipped} skipped`}
                        {' · '}{formatDateSafe(run.started_at)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{template.name}"? Existing invoices created by this template won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
