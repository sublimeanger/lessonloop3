import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrg } from '@/contexts/OrgContext';
import {
  useRecurringInvoiceTemplates,
  useUpdateRecurringTemplate,
  useDeleteRecurringTemplate,
  type RecurringTemplate,
} from '@/hooks/useRecurringInvoiceTemplates';
import {
  useRecurringTemplateRecipients,
  useSaveTemplateRecipients,
} from '@/hooks/useRecurringTemplateRecipients';
import {
  useRecurringTemplateItems,
  useSaveTemplateItems,
} from '@/hooks/useRecurringTemplateItems';
import { useRecurringTemplateRuns } from '@/hooks/useRecurringTemplateRuns';
import { useRunRecurringTemplate } from '@/hooks/useRunRecurringTemplate';
import type { ItemDraft } from '@/components/settings/recurring-billing/ItemsField';

export interface ActivationIssues {
  missingRecipients: boolean;
  missingItems: boolean;
  missingTerm: boolean;
  isReady: boolean;
}

export function useRecurringTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { currentOrg, isOrgAdmin, isOrgOwner, currentRole } = useOrg();
  const canEdit = isOrgOwner || isOrgAdmin || currentRole === 'finance';

  const { data: templates = [], isLoading: isTemplatesLoading } =
    useRecurringInvoiceTemplates();
  const template = useMemo<RecurringTemplate | null>(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const { data: recipients = [], isLoading: isRecipientsLoading } =
    useRecurringTemplateRecipients(templateId ?? null);
  const { data: items = [], isLoading: isItemsLoading } =
    useRecurringTemplateItems(templateId ?? null);
  const { data: runs = [], isLoading: isRunsLoading } =
    useRecurringTemplateRuns(templateId ?? null);

  const updateMutation = useUpdateRecurringTemplate();
  const deleteMutation = useDeleteRecurringTemplate();
  const saveRecipientsMutation = useSaveTemplateRecipients();
  const saveItemsMutation = useSaveTemplateItems();
  const runMutation = useRunRecurringTemplate();

  const [isRunning, setIsRunning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{
    name: string;
    frequency: string;
    billing_mode: string;
    auto_send: boolean;
    next_run_date: string;
    term_id: string | null;
  } | null>(null);
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[] | null>(null);

  const issues = useMemo<ActivationIssues>(() => {
    const activeRecipients = recipients.filter((r) => r.is_active);
    const missingRecipients = activeRecipients.length === 0;
    const needsItems =
      template?.billing_mode === 'upfront' ||
      template?.billing_mode === 'hybrid';
    const missingItems = needsItems && items.length === 0;
    const isOneShotTermly =
      template?.frequency === 'termly' && !!template?.term_id;
    const isTermlyWithoutTerm =
      template?.frequency === 'termly' && !template?.term_id;
    // "missingTerm" means: termly frequency with no term selected AND the
    // template is explicitly a one-shot config. Rolling termly is OK.
    // We can't fully distinguish rolling vs one_shot without schema; here
    // we only flag termly-no-term as a soft warning when templates exist
    // without a term but are not rolling.
    const missingTerm = false; // handled via explicit UX warning elsewhere
    void isOneShotTermly;
    void isTermlyWithoutTerm;
    return {
      missingRecipients,
      missingItems,
      missingTerm,
      isReady: !missingRecipients && !missingItems && !missingTerm,
    };
  }, [recipients, items, template]);

  const handleSaveSettings = async (patch: {
    name?: string;
    frequency?: string;
    billing_mode?: string;
    auto_send?: boolean;
    next_run_date?: string;
    term_id?: string | null;
  }) => {
    if (!template) return;
    await updateMutation.mutateAsync({ id: template.id, ...patch });
    setSettingsDraft(null);
  };

  const handleSaveRecipients = async (studentIds: string[]) => {
    if (!template || !currentOrg) return;
    await saveRecipientsMutation.mutateAsync({
      templateId: template.id,
      orgId: currentOrg.id,
      studentIds,
      existingRecipients: recipients,
    });
  };

  const handleSaveItems = async (draft: ItemDraft[]) => {
    if (!template || !currentOrg) return;
    const clean = draft
      .filter((i) => i.description.trim() && parseFloat(i.amount_major) > 0)
      .map((i) => ({
        description: i.description.trim(),
        amount_minor: Math.round(parseFloat(i.amount_major) * 100),
        quantity: Math.max(1, Math.floor(i.quantity)),
      }));
    await saveItemsMutation.mutateAsync({
      templateId: template.id,
      orgId: currentOrg.id,
      items: clean,
    });
    setItemsDraft(null);
  };

  const handleActivate = async () => {
    if (!template || !issues.isReady) return;
    await updateMutation.mutateAsync({ id: template.id, active: true });
  };

  const handlePauseResume = async () => {
    if (!template) return;
    await updateMutation.mutateAsync({
      id: template.id,
      active: !template.active,
    });
  };

  const handleRunNow = async () => {
    if (!template) return;
    setIsRunning(true);
    try {
      await runMutation.mutateAsync({
        templateId: template.id,
        autoSend: template.auto_send,
      });
    } catch {
      /* toast handled in hook */
    } finally {
      setIsRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    await deleteMutation.mutateAsync(template.id);
    setDeleteOpen(false);
    navigate('/settings?tab=recurring');
  };

  const openRunDetail = (runId: string) => {
    navigate(`/settings/recurring-billing/runs/${runId}`);
  };

  return {
    // identity
    templateId: templateId ?? null,
    template,
    canEdit,
    currentOrg,

    // loading
    isLoading: isTemplatesLoading,
    isRecipientsLoading,
    isItemsLoading,
    isRunsLoading,

    // data
    recipients,
    items,
    runs,
    issues,

    // draft state
    settingsDraft,
    setSettingsDraft,
    itemsDraft,
    setItemsDraft,

    // mutations / pending
    isSaving:
      updateMutation.isPending ||
      saveRecipientsMutation.isPending ||
      saveItemsMutation.isPending,
    isRunning,
    isDeleting: deleteMutation.isPending,

    // dialogs
    deleteOpen,
    setDeleteOpen,

    // handlers
    handleSaveSettings,
    handleSaveRecipients,
    handleSaveItems,
    handleActivate,
    handlePauseResume,
    handleRunNow,
    handleDelete,
    openRunDetail,

    // navigation
    navigate,
  };
}
