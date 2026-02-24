import { useState, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherSchema, type TeacherFormValues } from '@/lib/schemas';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { useTeachers, useTeacherMutations, useTeacherStudentCounts, Teacher } from '@/hooks/useTeachers';
import { Progress } from '@/components/ui/progress';
import { Plus, GraduationCap, Loader2, UserPlus, Lock, Link2, Link2Off, Phone, Trash2, Search, Pencil, RotateCcw } from 'lucide-react';
import { cn, formatDateForOrg } from '@/lib/utils';
import { InviteMemberDialog } from '@/components/settings/InviteMemberDialog';
import { PendingInvitesList } from '@/components/settings/PendingInvitesList';
import { TEACHER_COLOURS } from '@/components/calendar/teacherColours';
import { TeacherQuickView } from '@/components/teachers/TeacherQuickView';

interface RemovalDialogState {
  open: boolean;
  teacher: Teacher | null;
  lessonCount: number;
  lessons: { id: string; title: string; start_at: string }[];
  reassignTeacherId: string;
  action: 'reassign' | 'cancel' | '';
  isProcessing: boolean;
}

type FilterTab = 'all' | 'linked' | 'unlinked' | 'inactive';

function getTeacherColourIndex(teachers: Teacher[], teacherId: string): number {
  const sorted = [...teachers].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const idx = sorted.findIndex(t => t.id === teacherId);
  return idx >= 0 ? idx % TEACHER_COLOURS.length : 0;
}

// Shared form fields for create/edit
function TeacherFormFields() {
  return (
    <div className="space-y-4 py-4">
      <FormField name="display_name" render={({ field }) => (
        <FormItem>
          <FormLabel>Display Name *</FormLabel>
          <FormControl><Input {...field} placeholder="Amy Brown" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email (optional)</FormLabel>
          <FormControl><Input type="email" {...field} placeholder="amy@example.com" /></FormControl>
          <FormDescription>If provided, the account will be linked when they accept an invitation with this email.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="phone" render={({ field }) => (
        <FormItem>
          <FormLabel>Phone (optional)</FormLabel>
          <FormControl><Input {...field} placeholder="07123 456789" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="instruments" render={({ field }) => (
        <FormItem>
          <FormLabel>Instruments (optional)</FormLabel>
          <FormControl><Input {...field} placeholder="Piano, Guitar, Violin" /></FormControl>
          <FormDescription>Comma-separated list of instruments.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="employment_type" render={({ field }) => (
        <FormItem>
          <FormLabel>Employment Type</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="bio" render={({ field }) => (
        <FormItem>
          <FormLabel>Bio (optional)</FormLabel>
          <FormControl><Textarea {...field} placeholder="A short bio about the teacher..." rows={3} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}

export default function Teachers() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, canAddTeacher, usage } = useUsageCounts();
  
  const { data: teachers = [], isLoading, refetch } = useTeachers();
  const { createTeacher, updateTeacher, deleteTeacher, reactivateTeacher } = useTeacherMutations();
  const { data: studentCounts = {} } = useTeacherStudentCounts();
  const { checkTeacherRemoval } = useDeleteValidation();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

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
  const createForm = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { display_name: '', email: '', phone: '', instruments: '', employment_type: 'contractor', bio: '' },
  });

  // Edit teacher state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const editForm = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { display_name: '', email: '', phone: '', instruments: '', employment_type: 'contractor', bio: '' },
  });
  const [isEditing, setIsEditing] = useState(false);

  // Quick view state
  const [quickViewTeacher, setQuickViewTeacher] = useState<Teacher | null>(null);

  // Removal dialog
  const [removal, setRemoval] = useState<RemovalDialogState>({
    open: false, teacher: null, lessonCount: 0, lessons: [],
    reassignTeacherId: '', action: '', isProcessing: false,
  });

  // Filtered teachers
  const activeTeachers = useMemo(() => teachers.filter(t => t.status === 'active'), [teachers]);
  const inactiveTeachers = useMemo(() => teachers.filter(t => t.status === 'inactive'), [teachers]);

  const filteredTeachers = useMemo(() => {
    let list = filterTab === 'inactive' ? inactiveTeachers : activeTeachers;
    if (filterTab === 'linked') list = list.filter(t => t.isLinked);
    else if (filterTab === 'unlinked') list = list.filter(t => !t.isLinked);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.display_name.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.phone?.includes(q)
      );
    }
    return list;
  }, [activeTeachers, inactiveTeachers, filterTab, search]);

  const linkedCount = activeTeachers.filter(t => t.isLinked).length;
  const unlinkedCount = activeTeachers.filter(t => !t.isLinked).length;

  const FILTER_PILLS: { value: FilterTab; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: activeTeachers.length },
    { value: 'linked', label: 'Linked', count: linkedCount },
    { value: 'unlinked', label: 'Unlinked', count: unlinkedCount },
    ...(inactiveTeachers.length > 0 ? [{ value: 'inactive' as FilterTab, label: 'Inactive', count: inactiveTeachers.length }] : []),
  ];

  const resetCreateForm = () => {
    createForm.reset();
  };

  const handleCreateTeacher = async (values: TeacherFormValues) => {
    if (!canAddTeacher) {
      toast({ title: 'Teacher limit reached', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await createTeacher.mutateAsync({
        display_name: values.display_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        instruments: values.instruments ? values.instruments.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        employment_type: values.employment_type,
        bio: values.bio || undefined,
      });
      setIsCreateDialogOpen(false);
      resetCreateForm();
    } catch {
      // Error handled by mutation's onError
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditTeacher(teacher);
    editForm.reset({
      display_name: teacher.display_name,
      email: teacher.email || '',
      phone: teacher.phone || '',
      instruments: teacher.instruments?.join(', ') || '',
      employment_type: (teacher.employment_type as 'contractor' | 'employee') || 'contractor',
      bio: teacher.bio || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditTeacher = async (values: TeacherFormValues) => {
    if (!editTeacher) return;
    setIsEditing(true);
    try {
      await updateTeacher.mutateAsync({
        id: editTeacher.id,
        display_name: values.display_name,
        email: values.email || null,
        phone: values.phone || null,
        instruments: values.instruments ? values.instruments.split(',').map(s => s.trim()).filter(Boolean) : [],
        employment_type: values.employment_type,
        bio: values.bio || null,
      });
      setEditDialogOpen(false);
    } catch {
      // Error handled by mutation's onError
    } finally {
      setIsEditing(false);
    }
  };

  const initiateRemoval = async (teacher: Teacher) => {
    setPreCheckDialog({ open: true, teacher, checkResult: null, isChecking: true });
    const result = await checkTeacherRemoval(teacher.id);
    
    if (!result.canDelete) {
      setPreCheckDialog(prev => ({ ...prev, checkResult: result, isChecking: false }));
      return;
    }
    
    setPreCheckDialog({ open: false, teacher: null, checkResult: null, isChecking: false });

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

      // Clean up student-teacher assignments
      const { error: staError } = await supabase
        .from('student_teacher_assignments')
        .delete()
        .eq('teacher_id', teacher.id)
        .eq('org_id', currentOrg.id);
      if (staError) logger.error('Failed to clean up student-teacher assignments:', staError);

      // Null out practice assignments for this teacher
      const { error: paError } = await supabase
        .from('practice_assignments')
        .update({ teacher_id: null })
        .eq('teacher_id', teacher.id);
      if (paError) logger.error('Failed to clean up practice assignments:', paError);

      // Clear default_teacher_id on students
      const { error: sdError } = await supabase
        .from('students')
        .update({ default_teacher_id: null })
        .eq('default_teacher_id', teacher.id)
        .eq('org_id', currentOrg.id);
      if (sdError) logger.error('Failed to clear default teacher on students:', sdError);

      await deleteTeacher.mutateAsync(teacher.id);

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
      toast({ title: 'Failed to remove teacher', description: err.message, variant: 'destructive' });
    }

    setRemoval(prev => ({ ...prev, open: false, isProcessing: false }));
  };

  const otherTeachers = teachers.filter(t => t.id !== removal.teacher?.id && t.status === 'active');

  return (
    <AppLayout>
      <PageHeader
        title={`Teachers${activeTeachers.length > 0 ? ` (${activeTeachers.length})` : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Teachers' }]}
        actions={
          isOrgAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setIsCreateDialogOpen(true)} 
                className="gap-1.5 min-h-11 sm:min-h-9"
                disabled={!canAddTeacher}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Teacher</span>
              </Button>
              <Button 
                size="sm"
                onClick={() => setIsInviteDialogOpen(true)} 
                className="gap-1.5"
                disabled={!canAddTeacher}
              >
                {!canAddTeacher && <Lock className="h-4 w-4" />}
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Invite to Login</span>
              </Button>
            </div>
          )
        }
      />

      {/* Usage indicator */}
      {limits.maxTeachers < 9999 && (
        <div className="mb-4 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium">Teacher Usage</span>
            <span className={cn(
              'text-xs',
              usage.isTeacherNearLimit && 'text-warning font-medium',
              usage.isTeacherAtLimit && 'text-destructive font-medium'
            )}>
              {activeTeachers.length} / {limits.maxTeachers}
            </span>
          </div>
          <Progress 
            value={(activeTeachers.length / limits.maxTeachers) * 100} 
            className={cn(
              'h-1.5',
              usage.isTeacherNearLimit && '[&>div]:bg-warning',
              usage.isTeacherAtLimit && '[&>div]:bg-destructive'
            )} 
          />
        </div>
      )}

      {/* Search + Filter pills */}
      {teachers.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9 sm:h-9"
            />
          </div>

          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted/50 p-0.5 sm:w-fit" role="tablist" aria-label="Teacher filters">
            {FILTER_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setFilterTab(pill.value)}
                className={cn(
                  'min-h-11 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all',
                  filterTab === pill.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {pill.label}
                <span className="ml-1 text-muted-foreground">({pill.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No teachers yet"
          description="Add teachers to manage your teaching staff and assign lessons."
          actionLabel={isOrgAdmin ? 'Add Teacher' : undefined}
          onAction={isOrgAdmin ? () => setIsCreateDialogOpen(true) : undefined}
          secondaryActionLabel={isOrgAdmin ? 'Invite to Login' : undefined}
          onSecondaryAction={isOrgAdmin ? () => setIsInviteDialogOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTeachers.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="text-muted-foreground">No teachers match your search</p>
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const colourIdx = getTeacherColourIndex(activeTeachers, teacher.id);
              const colour = TEACHER_COLOURS[colourIdx];
              return (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  studentCount={studentCounts[teacher.id] || 0}
                  isAdmin={isOrgAdmin}
                  onRemove={initiateRemoval}
                  onEdit={openEditDialog}
                  onReactivate={(t) => reactivateTeacher.mutate(t.id)}
                  onQuickView={setQuickViewTeacher}
                  colour={colour}
                  isInactiveView={filterTab === 'inactive'}
                />
              );
            })
          )}
        </div>
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
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>
              Create a teacher record without login access. They can be linked to an account later via invitation.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateTeacher)}>
              <TeacherFormFields />
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Add Teacher'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update {editTeacher?.display_name}'s details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditTeacher)}>
              <TeacherFormFields />
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
                          value="reassign"
                          checked={removal.action === 'reassign'}
                          onChange={() => setRemoval(prev => ({ ...prev, action: 'reassign' }))}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium text-sm text-foreground">Reassign lessons to another teacher</span>
                          <p className="text-xs text-muted-foreground mt-0.5">Students stay enrolled. Only the teacher changes.</p>
                        </div>
                      </label>

                      {removal.action === 'reassign' && (
                        <div className="pl-7">
                          <Select value={removal.reassignTeacherId} onValueChange={(v) => setRemoval(prev => ({ ...prev, reassignTeacherId: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select replacement teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherTeachers.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          name="removal-action"
                          value="cancel"
                          checked={removal.action === 'cancel'}
                          onChange={() => setRemoval(prev => ({ ...prev, action: 'cancel' }))}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium text-sm text-foreground">Cancel all upcoming lessons</span>
                          <p className="text-xs text-muted-foreground mt-0.5">Students will need to be rescheduled manually.</p>
                        </div>
                      </label>
                    </div>

                    {removal.lessons.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View affected lessons ({removal.lessonCount > 10 ? `showing first 10 of ${removal.lessonCount}` : removal.lessonCount})
                        </summary>
                        <ul className="mt-2 space-y-1 text-muted-foreground">
                          {removal.lessons.map(l => (
                            <li key={l.id}>{l.title} — {formatDateForOrg(l.start_at, currentOrg?.timezone || 'Europe/London', 'EEE d MMM')}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                ) : (
                  <p>
                    This teacher has no upcoming lessons. They can be safely removed.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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

      {/* Teacher Quick View */}
      <TeacherQuickView
        teacher={quickViewTeacher}
        open={!!quickViewTeacher}
        onOpenChange={(open) => { if (!open) setQuickViewTeacher(null); }}
        onEdit={openEditDialog}
        onRemove={(t) => { setQuickViewTeacher(null); initiateRemoval(t); }}
        colour={quickViewTeacher ? TEACHER_COLOURS[getTeacherColourIndex(activeTeachers, quickViewTeacher.id)] : TEACHER_COLOURS[0]}
      />
      {teachers.length >= 100 && (
        <p className="text-xs text-muted-foreground text-center mt-4">Showing first 100 teachers. Use the search bar to find specific teachers.</p>
      )}
    </AppLayout>
  );
}

// Teacher card component
function TeacherCard({ teacher, studentCount, isAdmin, onRemove, onEdit, onReactivate, onQuickView, colour, isInactiveView }: { 
  teacher: Teacher; 
  studentCount: number; 
  isAdmin: boolean;
  onRemove: (teacher: Teacher) => void;
  onEdit: (teacher: Teacher) => void;
  onReactivate: (teacher: Teacher) => void;
  onQuickView: (teacher: Teacher) => void;
  colour: (typeof TEACHER_COLOURS)[number];
  isInactiveView?: boolean;
}) {
  return (
    <div 
      className={cn(
        "group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-pointer sm:flex-row sm:items-center sm:gap-4",
        isInactiveView && "opacity-60"
      )}
      onClick={() => onQuickView(teacher)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onQuickView(teacher); }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm shrink-0"
        style={{ backgroundColor: colour.hex }}
      >
        {teacher.display_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold truncate">{teacher.display_name}</span>
          {isInactiveView ? (
            <Badge variant="destructive" className="text-micro shrink-0">Inactive</Badge>
          ) : teacher.isLinked ? (
            <Badge variant="outline" className="text-micro gap-1 shrink-0">
              <Link2 className="h-3 w-3" />
              Linked
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-micro gap-1 shrink-0">
              <Link2Off className="h-3 w-3" />
              Unlinked
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {teacher.email && <span className="hidden sm:inline truncate">{teacher.email}</span>}
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
        <div className="flex w-full items-center justify-end gap-1 shrink-0 transition-opacity sm:w-auto sm:opacity-0 sm:group-hover:opacity-100">
          {isInactiveView ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onReactivate(teacher);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reactivate
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon" className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(teacher);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon" className="h-11 w-11 sm:h-9 sm:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(teacher);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
