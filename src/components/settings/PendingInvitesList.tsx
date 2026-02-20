import { useState, useEffect } from 'react';
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
  /** External trigger to refetch (increment to force refetch) */
  refreshKey?: number;
  /** Filter to specific roles, e.g. ['admin','teacher','finance']. If empty, shows all staff roles. */
  roleFilter?: AppRole[];
}

export function PendingInvitesList({ refreshKey = 0, roleFilter }: PendingInvitesListProps) {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const roles = roleFilter || ['admin', 'teacher', 'finance'];

  const fetchInvites = async () => {
    if (!currentOrg) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('org_id', currentOrg.id)
      .is('accepted_at', null)
      .in('role', roles)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching invites:', error);
    }
    setInvites((data || []) as Invite[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchInvites();
  }, [currentOrg?.id, refreshKey]);

  const handleCancel = async (inviteId: string) => {
    setCancellingId(inviteId);
    const { error } = await supabase.from('invites').delete().eq('id', inviteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Invite cancelled' });
      fetchInvites();
    }
    setCancellingId(null);
  };

  const handleResend = async (invite: Invite) => {
    setResendingId(invite.id);
    try {
      await supabase.functions.invoke('send-invite-email', {
        body: { inviteId: invite.id },
      });
      toast({ title: 'Invite resent', description: `Resent to ${invite.email}` });
    } catch (err: any) {
      toast({ title: 'Error resending', description: err.message, variant: 'destructive' });
    }
    setResendingId(null);
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
                  title="Copy invite link"
                  onClick={() => handleCopyLink(invite)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Resend invite"
                  onClick={() => handleResend(invite)}
                  disabled={resendingId === invite.id}
                >
                  {resendingId === invite.id ? (
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
