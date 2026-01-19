import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, GraduationCap, Loader2, Mail, UserPlus } from 'lucide-react';

interface OrgMember {
  id: string;
  user_id: string;
  role: AppRole;
  status: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
  teacher_profile?: {
    instruments: string[];
    display_name: string | null;
    employment_type: string;
  };
}

interface Invite {
  id: string;
  email: string;
  role: AppRole;
  expires_at: string;
  accepted_at: string | null;
}

export default function Teachers() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher'>('teacher');

  const fetchTeachers = async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    
    // Fetch memberships with profiles
    const { data: memberData } = await supabase
      .from('org_memberships')
      .select('*')
      .eq('org_id', currentOrg.id)
      .in('role', ['owner', 'admin', 'teacher'])
      .eq('status', 'active');
    
    // Fetch profiles for each member
    const membersWithProfiles: OrgMember[] = [];
    for (const member of memberData || []) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', member.user_id)
        .maybeSingle();
      
      const { data: teacherProfile } = await supabase
        .from('teacher_profiles')
        .select('instruments, display_name, employment_type')
        .eq('user_id', member.user_id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();
      
      membersWithProfiles.push({
        ...member,
        profile: profile || undefined,
        teacher_profile: teacherProfile || undefined,
      });
    }
    
    setMembers(membersWithProfiles);
    
    // Fetch pending invites
    const { data: inviteData } = await supabase
      .from('invites')
      .select('*')
      .eq('org_id', currentOrg.id)
      .is('accepted_at', null)
      .in('role', ['admin', 'teacher']);
    
    setInvites((inviteData || []) as Invite[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, [currentOrg?.id]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrg) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    const { error } = await supabase.from('invites').insert({
      org_id: currentOrg.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        toast({ title: 'Already invited', description: 'This email has already been invited.', variant: 'destructive' });
      } else {
        toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Invite sent', description: `Invitation sent to ${inviteEmail}` });
      setIsDialogOpen(false);
      setInviteEmail('');
      fetchTeachers();
    }
    setIsSaving(false);
  };

  const cancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from('invites').delete().eq('id', inviteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchTeachers();
    }
  };

  const getRoleColor = (role: AppRole) => {
    switch (role) {
      case 'owner': return 'bg-primary text-primary-foreground';
      case 'admin': return 'bg-blue-500 text-white';
      case 'teacher': return 'bg-green-500 text-white';
      default: return 'bg-muted';
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Teachers"
        description="Manage your teaching staff and admins"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Teachers' }]}
        actions={
          isOrgAdmin && (
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Invite Teacher
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Team */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Team Members</h3>
            {members.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-4 text-lg font-medium">No team members yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Invite teachers to help manage your students.</p>
                  {isOrgAdmin && (
                    <Button onClick={() => setIsDialogOpen(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Invite Your First Teacher
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {member.profile?.full_name?.[0] || member.profile?.email?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {member.teacher_profile?.display_name || member.profile?.full_name || member.profile?.email || 'Unknown'}
                        </span>
                        <Badge className={`text-xs ${getRoleColor(member.role)}`}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {member.profile?.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />
                            {member.profile.email}
                          </span>
                        )}
                        {member.teacher_profile?.instruments && member.teacher_profile.instruments.length > 0 && (
                          <span className="truncate">
                            {member.teacher_profile.instruments.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Pending Invites</h3>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-4 rounded-lg border border-dashed bg-muted/30 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{invite.email}</span>
                        <Badge variant="outline" className="text-xs">{invite.role}</Badge>
                        <Badge variant="secondary" className="text-xs">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {new Date(invite.expires_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    {isOrgAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => cancelInvite(invite.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teacher@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'teacher')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'admin' ? 'Admins can manage students, teachers, and billing.' : 'Teachers can view and manage their assigned students.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
