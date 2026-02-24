import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, Bell, Shield } from 'lucide-react';
import { useMessagingSettings, type MessagingSettings } from '@/hooks/useMessagingSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';

interface SettingRowProps {
  id: keyof Omit<MessagingSettings, 'org_id'>;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (key: keyof Omit<MessagingSettings, 'org_id'>, value: boolean) => void;
  disabled?: boolean;
}

function SettingRow({ id, label, description, checked, onToggle, disabled }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5 flex-1">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onToggle(id, v)}
        disabled={disabled}
      />
    </div>
  );
}

export function MessagingSettingsTab() {
  const { settings, isLoading, updateSetting, isSaving } = useMessagingSettings();
  const { currentOrg } = useOrg();
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);

  const handleTeacherMessagingToggle = (key: keyof Omit<MessagingSettings, 'org_id'>, value: boolean) => {
    if (key === 'parent_can_message_teacher' && !value) {
      // Toggling OFF — show confirmation
      setShowReassignDialog(true);
      return;
    }
    updateSetting(key, value);
  };

  const handleConfirmReassign = async () => {
    if (!currentOrg) return;
    setIsReassigning(true);
    try {
      const { error } = await supabase.rpc('reassign_teacher_conversations_to_owner', {
        _org_id: currentOrg.id,
      });
      if (error) throw error;
      updateSetting('parent_can_message_teacher', false);
      toast.success('Teacher messaging disabled. Teachers will no longer see parent conversations.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsReassigning(false);
      setShowReassignDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Parent Permissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Parent Messaging Permissions</CardTitle>
          </div>
          <CardDescription>
            Control what parents can do in their messaging portal
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow
            id="parent_can_initiate"
            label="Parents can start conversations"
            description="Allow parents to compose and send new messages to your organisation. If disabled, parents can only reply to messages you send them."
            checked={settings.parent_can_initiate}
            onToggle={updateSetting}
            disabled={isSaving}
          />
          <SettingRow
            id="parent_can_message_owner"
            label="Parents can message the owner"
            description="Allow parents to send messages to the organisation owner."
            checked={settings.parent_can_message_owner}
            onToggle={updateSetting}
            disabled={isSaving}
          />
          <SettingRow
            id="parent_can_message_admin"
            label="Parents can message admins"
            description="Allow parents to send messages to admin staff members."
            checked={settings.parent_can_message_admin}
            onToggle={updateSetting}
            disabled={isSaving}
          />
          <SettingRow
            id="parent_can_message_teacher"
            label="Parents can message teachers directly"
            description="Allow parents to message their child's teacher directly. If disabled, teachers lose access to parent conversations and visibility reverts to admin/owner only."
            checked={settings.parent_can_message_teacher}
            onToggle={handleTeacherMessagingToggle}
            disabled={isSaving || isReassigning}
          />
        </CardContent>
      </Card>

      {/* Routing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Message Routing</CardTitle>
          </div>
          <CardDescription>
            Configure how incoming parent messages are routed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            id="auto_assign_to_teacher"
            label="Auto-assign to student's teacher"
            description="Automatically route parent enquiries to the teacher assigned to their child, instead of the owner or admin."
            checked={settings.auto_assign_to_teacher}
            onToggle={updateSetting}
            disabled={isSaving}
          />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notifications</CardTitle>
          </div>
          <CardDescription>
            Control email notifications for messaging activity
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow
            id="notify_staff_on_new_message"
            label="Notify staff on new parent message"
            description="Send an email to staff when a parent sends a new message or enquiry."
            checked={settings.notify_staff_on_new_message}
            onToggle={updateSetting}
            disabled={isSaving}
          />
          <SettingRow
            id="notify_parent_on_reply"
            label="Notify parent on staff reply"
            description="Send an email notification to parents when staff replies to their conversation."
            checked={settings.notify_parent_on_reply}
            onToggle={updateSetting}
            disabled={isSaving}
          />
        </CardContent>
      </Card>

      {/* Reassignment Confirmation Dialog */}
      <AlertDialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable teacher messaging?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke teachers' access to parent conversations. 
              Teachers will no longer be able to see or reply to messages from parents. 
              All conversations will remain accessible to admins and the organisation owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReassigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReassign}
              disabled={isReassigning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isReassigning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Disabling…
                </>
              ) : (
                'Disable & Revoke Access'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
