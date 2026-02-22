import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, X, RefreshCw, Copy } from 'lucide-react';
import { AppRole } from '@/contexts/AuthContext';

interface Invite {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface PendingInvitesListProps {
  /** @deprecated Use queryClient.invalidateQueries instead */
  refreshKey?: number;
  /** Filter to specific roles, e.g. ['admin','teacher','finance']. If empty, shows all staff roles. */
  roleFilter?: AppRole[];
  /** Called when admin wants to re-invite an expired invite with pre-filled email and role */
  onReinvite?: (email: string, role: AppRole) => void;
}

export function PendingInvitesList({ roleFilter, onReinvite }: PendingInvitesListProps) {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const roles = roleFilter || ['admin', 'teacher', 'finance'];

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['pending-invites', currentOrg?.id, roles],
    queryFn: async (): Promise<Invite[]> => {
      if (!currentOrg) return [];

      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('org_id', currentOrg.id)
        .is('accepted_at', null)
        .in('role', roles)
        .gte('expires_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching invites:', error);
        return [];
      }
      return (data || []) as Invite[];
    },
    enabled: !!currentOrg,
    staleTime: 30 * 1000,
  });

  const handleCancel = async (inviteId: string) => {
    setCancellingId(inviteId);
    const { error } = await supabase.from('invites').delete().eq('id', inviteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Invite cancelled' });
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
    }
    setCancellingId(null);
  };

  const handleResend = async (invite: Invite) => {
    setResendingId(invite.id);
    try {
      // Extend expiry by 7 days on resend
      const { error: updateError } = await supabase
        .from('invites')
        .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('id', invite.id);
      if (updateError) throw updateError;

      await supabase.functions.invoke('send-invite-email', {
        body: { inviteId: invite.id },
      });
      toast({ title: 'Invite resent', description: `Resent to ${invite.email} with a fresh 7-day expiry.` });
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
    } catch (err: any) {
      toast({ title: 'Error resending', description: err.message, variant: 'destructive' });
    }
    setResendingId(null);
  };

  const handleReinvite = async (invite: Invite) => {
    setCancellingId(invite.id);
    const { error } = await supabase.from('invites').delete().eq('id', invite.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setCancellingId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
    setCancellingId(null);
    onReinvite?.(invite.email, invite.role);
  };

  const handleCopyLink = (invite: Invite) => {
    const url = `${window.location.origin}/accept-invite?token=${invite.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: 'Invite link copied to clipboard.' });
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Pending Invites</h4>
      {invites.map((invite) => {
        const expired = isExpired(invite.expires_at);
        return (
          <div
            key={invite.id}
            className="flex items-center gap-4 rounded-lg border border-dashed bg-muted/30 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{invite.email}</span>
                <Badge variant="outline" className="text-xs capitalize">{invite.role}</Badge>
                {expired ? (
                  <Badge variant="destructive" className="text-xs">Expired</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {expired
                  ? `Expired ${new Date(invite.expires_at).toLocaleDateString('en-GB')}`
                  : `Expires ${new Date(invite.expires_at).toLocaleDateString('en-GB')}`}
              </p>
            </div>
            {isOrgAdmin && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={expired ? "Invite expired" : "Copy invite link"}
                  onClick={() => handleCopyLink(invite)}
                  disabled={expired}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={expired ? "Re-invite" : "Resend invite"}
                  onClick={() => expired ? handleReinvite(invite) : handleResend(invite)}
                  disabled={resendingId === invite.id || cancellingId === invite.id}
                >
                  {resendingId === invite.id || (expired && cancellingId === invite.id) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Cancel invite"
                  onClick={() => handleCancel(invite.id)}
                  disabled={cancellingId === invite.id}
                >
                  {cancellingId === invite.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
