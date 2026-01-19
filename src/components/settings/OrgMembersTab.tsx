import { useState, useEffect } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Mail, Shield, UserMinus } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: AppRole;
  status: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export function OrgMembersTab() {
  const { currentOrg, currentRole, isOrgOwner } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    
    const { data: memberData } = await supabase
      .from('org_memberships')
      .select('*')
      .eq('org_id', currentOrg.id)
      .neq('status', 'disabled');
    
    const membersWithProfiles: Member[] = [];
    for (const member of memberData || []) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', member.user_id)
        .maybeSingle();
      
      membersWithProfiles.push({
        ...member,
        profile: profile || undefined,
      });
    }
    
    // Sort: owner first, then by name
    membersWithProfiles.sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '');
    });
    
    setMembers(membersWithProfiles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [currentOrg?.id]);

  const handleRoleChange = async (memberId: string, newRole: AppRole) => {
    setUpdatingMember(memberId);
    
    const { error } = await supabase
      .from('org_memberships')
      .update({ role: newRole })
      .eq('id', memberId);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role updated' });
      fetchMembers();
    }
    
    setUpdatingMember(null);
  };

  const handleDisableMember = async (memberId: string, memberName: string) => {
    setUpdatingMember(memberId);
    
    const { error } = await supabase
      .from('org_memberships')
      .update({ status: 'disabled' })
      .eq('id', memberId);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Member disabled', description: `${memberName} no longer has access.` });
      fetchMembers();
    }
    
    setUpdatingMember(null);
  };

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'owner': return 'bg-primary text-primary-foreground';
      case 'admin': return 'bg-blue-500 text-white';
      case 'teacher': return 'bg-green-500 text-white';
      case 'finance': return 'bg-amber-500 text-white';
      case 'parent': return 'bg-purple-500 text-white';
      default: return 'bg-muted';
    }
  };

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Organisation Members
        </CardTitle>
        <CardDescription>
          Manage who has access to {currentOrg?.name || 'your organisation'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map((member) => {
          const isCurrentUser = member.user_id === user?.id;
          const canEditRole = isOrgOwner && !isCurrentUser && member.role !== 'owner';
          const canDisable = isOrgOwner && !isCurrentUser && member.role !== 'owner';
          
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
                    onValueChange={(value) => handleRoleChange(member.id, value as AppRole)}
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
                          onClick={() => handleDisableMember(member.id, member.profile?.full_name || member.profile?.email || 'Member')}
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
        
        {!isOrgOwner && (
          <p className="text-sm text-muted-foreground">
            Only the organisation owner can change member roles or disable access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
