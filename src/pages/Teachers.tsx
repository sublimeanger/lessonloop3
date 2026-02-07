import { useState } from 'react';
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
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { useTeachers, useTeacherMutations, useTeacherStudentCounts } from '@/hooks/useTeachers';
import { Progress } from '@/components/ui/progress';
import { Plus, GraduationCap, Loader2, Mail, UserPlus, Users, Lock, Link2, Link2Off, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Invite {
  id: string;
  email: string;
  role: AppRole;
  expires_at: string;
  accepted_at: string | null;
}

export default function Teachers() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, canAddTeacher, usage } = useUsageCounts();
  
  // Fetch teachers from new teachers table
  const { data: teachers = [], isLoading, refetch } = useTeachers();
  const { createTeacher } = useTeacherMutations();
  const { data: studentCounts = {} } = useTeacherStudentCounts();
  
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'teacher' | 'finance'>('teacher');
  
  // Create teacher form (unlinked)
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');

  // Fetch pending invites
  const fetchInvites = async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from('invites')
      .select('*')
      .eq('org_id', currentOrg.id)
      .is('accepted_at', null)
      .in('role', ['admin', 'teacher', 'finance']);
    setInvites((data || []) as Invite[]);
  };

  // Load invites on mount
  useState(() => {
    fetchInvites();
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentOrg) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }
    
    if (inviteRole === 'teacher' && !canAddTeacher) {
      toast({ 
        title: 'Teacher limit reached', 
        description: `You've reached your limit of ${limits.maxTeachers} teachers.`,
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSaving(true);
    
    const { data: invite, error } = await supabase.from('invites').insert({
      org_id: currentOrg.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    }).select().single();
    
    if (error) {
      if (error.message.includes('duplicate')) {
        toast({ title: 'Already invited', variant: 'destructive' });
      } else {
        toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
      }
      setIsSaving(false);
      return;
    }
    
    // Send invite email
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      
      await supabase.functions.invoke('send-invite-email', {
        body: {
          inviteId: invite.id,
          orgId: currentOrg.id,
          orgName: currentOrg.name,
          recipientEmail: inviteEmail.trim().toLowerCase(),
          recipientRole: inviteRole,
          inviteToken: invite.token,
          inviterName: profile?.full_name || 'A team member',
        },
      });
      
      toast({ title: 'Invite sent', description: `Invitation sent to ${inviteEmail}` });
    } catch (emailError: any) {
      console.error('Email error:', emailError);
      toast({ title: 'Invite created', description: 'Email may not have been sent.' });
    }
    
    setIsInviteDialogOpen(false);
    setInviteEmail('');
    fetchInvites();
    setIsSaving(false);
  };

  const handleCreateTeacher = async () => {
    if (!newTeacherName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    
    if (!canAddTeacher) {
      toast({ title: 'Teacher limit reached', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    
    await createTeacher.mutateAsync({
      display_name: newTeacherName.trim(),
      email: newTeacherEmail.trim() || undefined,
      phone: newTeacherPhone.trim() || undefined,
    });
    
    setIsCreateDialogOpen(false);
    setNewTeacherName('');
    setNewTeacherEmail('');
    setNewTeacherPhone('');
    setIsSaving(false);
  };

  const cancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from('invites').delete().eq('id', inviteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchInvites();
    }
  };

  const linkedTeachers = teachers.filter(t => t.isLinked);
  const unlinkedTeachers = teachers.filter(t => !t.isLinked);

  return (
    <AppLayout>
      <PageHeader
        title="Teachers"
        description="Manage your teaching staff"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Teachers' }]}
        actions={
          isOrgAdmin && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setIsCreateDialogOpen(true)} 
                className="gap-2"
                disabled={!canAddTeacher}
              >
                <Plus className="h-4 w-4" />
                Add Teacher
              </Button>
              <Button 
                onClick={() => setIsInviteDialogOpen(true)} 
                className="gap-2"
                disabled={!canAddTeacher}
              >
                {!canAddTeacher && <Lock className="h-4 w-4" />}
                <UserPlus className="h-4 w-4" />
                Invite to Login
              </Button>
            </div>
          )
        }
      />

      {/* Usage indicator */}
      {limits.maxTeachers < 9999 && (
        <div className="mb-6 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Teacher Usage</span>
            <span className={cn(
              'text-sm',
              usage.isTeacherNearLimit && 'text-warning font-medium',
              usage.isTeacherAtLimit && 'text-destructive font-medium'
            )}>
              {teachers.length} / {limits.maxTeachers}
            </span>
          </div>
          <Progress 
            value={(teachers.length / limits.maxTeachers) * 100} 
            className={cn(
              'h-2',
              usage.isTeacherNearLimit && '[&>div]:bg-warning',
              usage.isTeacherAtLimit && '[&>div]:bg-destructive'
            )} 
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : teachers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No teachers yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add teachers to manage your students.</p>
            {isOrgAdmin && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Teacher
                </Button>
                <Button onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({teachers.length})</TabsTrigger>
            <TabsTrigger value="linked">
              <Link2 className="h-3 w-3 mr-1" />
              Linked ({linkedTeachers.length})
            </TabsTrigger>
            <TabsTrigger value="unlinked">
              <Link2Off className="h-3 w-3 mr-1" />
              Unlinked ({unlinkedTeachers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} />
            ))}
          </TabsContent>

          <TabsContent value="linked" className="space-y-2">
            {linkedTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No linked teachers yet.</p>
            ) : (
              linkedTeachers.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} />
              ))
            )}
          </TabsContent>

          <TabsContent value="unlinked" className="space-y-2">
            {unlinkedTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No unlinked teachers.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Unlinked teachers can be assigned to lessons but cannot log in. Send them an invite to link their account.
                </p>
                {unlinkedTeachers.map((teacher) => (
                  <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="mt-6">
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

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organisation with login access.</DialogDescription>
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
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'teacher' | 'finance')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'admin' 
                  ? 'Admins can manage students, teachers, and billing.' 
                  : inviteRole === 'finance'
                  ? 'Finance users can manage invoices and billing.'
                  : 'Teachers can view and manage their assigned students.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Teacher Dialog (unlinked) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>
              Create a teacher record without login access. They can be linked to an account later via invitation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name *</Label>
              <Input
                id="name"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="Amy Brown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherEmail">Email (optional)</Label>
              <Input
                id="teacherEmail"
                type="email"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                placeholder="amy@example.com"
              />
              <p className="text-xs text-muted-foreground">
                If provided, the account will be linked when they accept an invitation with this email.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={newTeacherPhone}
                onChange={(e) => setNewTeacherPhone(e.target.value)}
                placeholder="07123 456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTeacher} disabled={isSaving || !newTeacherName.trim()}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Add Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Teacher card component
function TeacherCard({ teacher, studentCount }: { teacher: any; studentCount: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
        {teacher.display_name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{teacher.display_name}</span>
          {teacher.isLinked ? (
            <Badge variant="outline" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              Linked
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1">
              <Link2Off className="h-3 w-3" />
              Unlinked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {teacher.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" />
              {teacher.email}
            </span>
          )}
          {teacher.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {teacher.phone}
            </span>
          )}
          {teacher.instruments && teacher.instruments.length > 0 && (
            <span className="truncate">
              {teacher.instruments.join(', ')}
            </span>
          )}
          {studentCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {studentCount} student{studentCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
