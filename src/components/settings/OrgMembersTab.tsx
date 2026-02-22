import { useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Mail, Shield, UserMinus, UserPlus } from 'lucide-react';
import { InviteMemberDialog } from './InviteMemberDialog';
import { PendingInvitesList } from './PendingInvitesList';

const getRoleBadgeColor = (role: AppRole) => {
  switch (role) {
    case 'owner': return 'bg-primary text-primary-foreground';
    case 'admin': return 'bg-info text-info-foreground';
    case 'teacher': return 'bg-success text-success-foreground';
    case 'finance': return 'bg-warning text-warning-foreground';
    case 'parent': return 'bg-accent text-accent-foreground';
    default: return 'bg-muted';
  }
};

export function OrgMembersTab() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { user } = useAuth();
  const { members, isLoading, changeRole, disableMember, updatingMember } = useOrgMembers();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Organisation Members
              </CardTitle>
              <CardDescription>
                Manage who has access to {currentOrg?.name || 'your organisation'}
              </CardDescription>
            </div>
            {isOrgAdmin && (
              <Button onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const isTargetOwner = member.role === 'owner';
            const canEditRole = isOrgAdmin && !isCurrentUser && !isTargetOwner;
            const canDisable = isOrgAdmin && !isCurrentUser && !isTargetOwner;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 rounded-lg border bg-card p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  {member.profile?.full_name?.[0] || member.profile?.email?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {member.profile?.full_name || member.profile?.email || 'Unknown'}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {member.profile?.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {member.profile.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canEditRole ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => changeRole({ memberId: member.id, newRole: value as AppRole })}
                      disabled={updatingMember === member.id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </Badge>
                  )}

                  {canDisable && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={updatingMember === member.id}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disable member access?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {member.profile?.full_name || member.profile?.email} will no longer be able to access this organisation. You can re-invite them later if needed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disableMember({ memberId: member.id, memberName: member.profile?.full_name || member.profile?.email || 'Member' })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disable Access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No members found</p>
          )}

          <PendingInvitesList />

          {!isOrgAdmin && (
            <p className="text-sm text-muted-foreground">
              Only organisation owners and admins can change member roles or disable access.
            </p>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
    </>
  );
}
