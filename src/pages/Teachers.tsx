import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { useTeachers, useTeacherMutations, useTeacherStudentCounts, Teacher } from '@/hooks/useTeachers';
import { Progress } from '@/components/ui/progress';
import { Plus, GraduationCap, Loader2, UserPlus, Lock, Link2, Link2Off, Phone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InviteMemberDialog } from '@/components/settings/InviteMemberDialog';
import { PendingInvitesList } from '@/components/settings/PendingInvitesList';

interface RemovalDialogState {
  open: boolean;
  teacher: Teacher | null;
  lessonCount: number;
  lessons: { id: string; title: string; start_at: string }[];
  reassignTeacherId: string;
  action: 'reassign' | 'cancel' | '';
  isProcessing: boolean;
}

export default function Teachers() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, canAddTeacher, usage } = useUsageCounts();
  
  const { data: teachers = [], isLoading, refetch } = useTeachers();
  const { createTeacher, deleteTeacher } = useTeacherMutations();
  const { data: studentCounts = {} } = useTeacherStudentCounts();
  const { checkTeacherRemoval } = useDeleteValidation();

  // Pre-check validation dialog
  const [preCheckDialog, setPreCheckDialog] = useState<{
    open: boolean;
    teacher: Teacher | null;
    checkResult: DeletionCheckResult | null;
    isChecking: boolean;
  }>({ open: false, teacher: null, checkResult: null, isChecking: false });
  
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);
  
  // Create teacher form
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');

  // Removal dialog
  const [removal, setRemoval] = useState<RemovalDialogState>({
    open: false, teacher: null, lessonCount: 0, lessons: [],
    reassignTeacherId: '', action: '', isProcessing: false,
  });

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

  const initiateRemoval = async (teacher: Teacher) => {
    // First, run validation check
    setPreCheckDialog({ open: true, teacher, checkResult: null, isChecking: true });
    const result = await checkTeacherRemoval(teacher.id);
    
    if (!result.canDelete) {
      // Has blocking issues — show DeleteValidationDialog
      setPreCheckDialog(prev => ({ ...prev, checkResult: result, isChecking: false }));
      return;
    }
    
    // No blocking issues — close pre-check and show the detailed removal dialog
    setPreCheckDialog({ open: false, teacher: null, checkResult: null, isChecking: false });

    // Query future scheduled lessons for this teacher
    const { data: futureLessons, count } = await supabase
      .from('lessons')
      .select('id, title, start_at', { count: 'exact' })
      .eq('teacher_id', teacher.id)
      .eq('status', 'scheduled')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(10);

    setRemoval({
      open: true,
      teacher,
      lessonCount: count ?? 0,
      lessons: futureLessons || [],
      reassignTeacherId: '',
      action: (count ?? 0) > 0 ? '' : 'reassign',
      isProcessing: false,
    });
  };

  const processRemoval = async () => {
    if (!removal.teacher || !currentOrg) return;
    setRemoval(prev => ({ ...prev, isProcessing: true }));

    const { teacher, action, reassignTeacherId, lessonCount } = removal;
    let reassignedCount = 0;
    let cancelledCount = 0;

    try {
      if (lessonCount > 0) {
        if (action === 'reassign' && reassignTeacherId) {
          // Find the new teacher's user_id for teacher_user_id column
          const newTeacher = teachers.find(t => t.id === reassignTeacherId);
          const { error } = await supabase
            .from('lessons')
            .update({ 
              teacher_id: reassignTeacherId,
              teacher_user_id: newTeacher?.user_id || null,
            })
            .eq('teacher_id', teacher.id)
            .eq('status', 'scheduled')
            .gte('start_at', new Date().toISOString());

          if (error) throw error;
          reassignedCount = lessonCount;
        } else if (action === 'cancel') {
          const { error } = await supabase
            .from('lessons')
            .update({ 
              status: 'cancelled' as any,
              cancellation_reason: `Teacher ${teacher.display_name} removed from organisation`,
              cancelled_at: new Date().toISOString(),
            })
            .eq('teacher_id', teacher.id)
            .eq('status', 'scheduled')
            .gte('start_at', new Date().toISOString());

          if (error) throw error;
          cancelledCount = lessonCount;
        }
      }

      // Soft-delete the teacher
      await deleteTeacher.mutateAsync(teacher.id);

      // Summary notification
      const parts: string[] = [`${teacher.display_name} has been removed.`];
      if (reassignedCount > 0) {
        const newName = teachers.find(t => t.id === reassignTeacherId)?.display_name || 'another teacher';
        parts.push(`${reassignedCount} lesson${reassignedCount !== 1 ? 's' : ''} reassigned to ${newName}.`);
      }
      if (cancelledCount > 0) {
        parts.push(`${cancelledCount} lesson${cancelledCount !== 1 ? 's' : ''} cancelled.`);
      }

      toast({ title: 'Teacher removed', description: parts.join(' ') });
    } catch (err: any) {
      toast({ title: 'Error removing teacher', description: err.message, variant: 'destructive' });
    }

    setRemoval(prev => ({ ...prev, open: false, isProcessing: false }));
  };

  const otherTeachers = teachers.filter(t => t.id !== removal.teacher?.id && t.status === 'active');
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
              <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} isAdmin={isOrgAdmin} onRemove={initiateRemoval} />
            ))}
          </TabsContent>

          <TabsContent value="linked" className="space-y-2">
            {linkedTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No linked teachers yet.</p>
            ) : (
              linkedTeachers.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} isAdmin={isOrgAdmin} onRemove={initiateRemoval} />
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
                  <TeacherCard key={teacher.id} teacher={teacher} studentCount={studentCounts[teacher.id] || 0} isAdmin={isOrgAdmin} onRemove={initiateRemoval} />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Pending Invites */}
      <div className="mt-6">
        <PendingInvitesList refreshKey={inviteRefreshKey} roleFilter={['admin', 'teacher', 'finance']} />
      </div>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onInviteSent={() => setInviteRefreshKey(k => k + 1)}
      />

      {/* Create Teacher Dialog */}
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
              <Input id="name" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Amy Brown" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherEmail">Email (optional)</Label>
              <Input id="teacherEmail" type="email" value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} placeholder="amy@example.com" />
              <p className="text-xs text-muted-foreground">If provided, the account will be linked when they accept an invitation with this email.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" value={newTeacherPhone} onChange={(e) => setNewTeacherPhone(e.target.value)} placeholder="07123 456789" />
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

      {/* Teacher Pre-Check Validation Dialog */}
      <DeleteValidationDialog
        open={preCheckDialog.open}
        onOpenChange={(open) => setPreCheckDialog(prev => ({ ...prev, open }))}
        entityName={preCheckDialog.teacher?.display_name || 'Teacher'}
        entityType="Teacher"
        checkResult={preCheckDialog.checkResult}
        isLoading={preCheckDialog.isChecking}
        onConfirmDelete={() => {
          // If validation passed with warnings only, proceed to removal dialog
          if (preCheckDialog.teacher) {
            setPreCheckDialog({ open: false, teacher: null, checkResult: null, isChecking: false });
            initiateRemoval(preCheckDialog.teacher);
          }
        }}
      />

      {/* Teacher Removal Safety Dialog */}
      <AlertDialog open={removal.open} onOpenChange={(open) => setRemoval(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removal.teacher?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {removal.lessonCount > 0 ? (
                  <>
                    <p className="text-destructive font-medium">
                      This teacher has {removal.lessonCount} upcoming lesson{removal.lessonCount !== 1 ? 's' : ''}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Completed lessons will keep the original teacher for reporting accuracy. Choose how to handle upcoming lessons:
                    </p>

                    <div className="space-y-2 pt-1">
                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          name="removal-action"
                          checked={removal.action === 'reassign'}
                          onChange={() => setRemoval(prev => ({ ...prev, action: 'reassign' }))}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-sm">Reassign to another teacher</span>
                          <p className="text-xs text-muted-foreground">All upcoming lessons will be transferred</p>
                        </div>
                      </label>

                      {removal.action === 'reassign' && (
                        <div className="ml-8">
                          <Select value={removal.reassignTeacherId} onValueChange={(v) => setRemoval(prev => ({ ...prev, reassignTeacherId: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a teacher..." />
                            </SelectTrigger>
                            <SelectContent>
                              {otherTeachers.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {otherTeachers.length === 0 && (
                            <p className="text-xs text-destructive mt-1">No other active teachers available.</p>
                          )}
                        </div>
                      )}

                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          name="removal-action"
                          checked={removal.action === 'cancel'}
                          onChange={() => setRemoval(prev => ({ ...prev, action: 'cancel' }))}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-sm">Cancel all upcoming lessons</span>
                          <p className="text-xs text-muted-foreground">Lessons will be marked as cancelled</p>
                        </div>
                      </label>
                    </div>

                    {removal.lessons.length > 0 && (
                      <div className="text-xs text-muted-foreground border rounded p-2 max-h-24 overflow-y-auto space-y-1">
                        {removal.lessons.map(l => (
                          <div key={l.id}>
                            {new Date(l.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {l.title}
                          </div>
                        ))}
                        {removal.lessonCount > removal.lessons.length && (
                          <div className="text-muted-foreground/60">... and {removal.lessonCount - removal.lessons.length} more</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p>This teacher has no upcoming lessons. They will be deactivated and historical records preserved.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removal.isProcessing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={processRemoval}
              disabled={
                removal.isProcessing ||
                (removal.lessonCount > 0 && removal.action === '') ||
                (removal.action === 'reassign' && !removal.reassignTeacherId)
              }
            >
              {removal.isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : 'Remove Teacher'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Teacher card component
function TeacherCard({ teacher, studentCount, isAdmin, onRemove }: { 
  teacher: Teacher; 
  studentCount: number; 
  isAdmin: boolean;
  onRemove: (teacher: Teacher) => void;
}) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent cursor-pointer"
      onClick={() => navigate(`/calendar?teacher=${teacher.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/calendar?teacher=${teacher.id}`); }}
    >
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
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {teacher.email && <span className="hidden sm:inline">{teacher.email}</span>}
          {teacher.phone && (
            <span className="items-center gap-1 hidden sm:flex">
              <Phone className="h-3 w-3" />
              {teacher.phone}
            </span>
          )}
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            {studentCount} student{studentCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(teacher);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
