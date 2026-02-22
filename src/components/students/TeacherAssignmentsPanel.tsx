import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useTeachers } from '@/hooks/useTeachers';
import { supabase } from '@/integrations/supabase/client';
import { Plus, GraduationCap, Star, Loader2 } from 'lucide-react';

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  is_primary: boolean;
  teacher?: {
    id: string;
    display_name: string;
    email: string | null;
    user_id: string | null;
  };
}

interface TeacherAssignmentsPanelProps {
  studentId: string;
}

export function TeacherAssignmentsPanel({ studentId }: TeacherAssignmentsPanelProps) {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignmentQueryKey = ['teacher-assignments', currentOrg?.id, studentId];

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: assignmentQueryKey,
    queryFn: async () => {
      if (!currentOrg || !studentId) return [];
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id, 
          teacher_id, 
          is_primary,
          teacher:teachers!student_teacher_assignments_teacher_id_fkey (
            id,
            display_name,
            email,
            user_id
          )
        `)
        .eq('org_id', currentOrg.id)
        .eq('student_id', studentId);
      if (error) throw error;
      return (data || []).map((a) => ({
        id: a.id,
        teacher_id: a.teacher_id,
        is_primary: a.is_primary,
        teacher: a.teacher as unknown as TeacherAssignment['teacher'],
      })) as TeacherAssignment[];
    },
    enabled: !!currentOrg && !!studentId,
  });

  const { data: allTeachers = [] } = useTeachers();
  const availableTeachers = allTeachers.filter(t => t.status === 'active');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherId || !currentOrg) throw new Error('Select a teacher');
      const teacher = availableTeachers.find(t => t.id === selectedTeacherId);
      const { error } = await supabase
        .from('student_teacher_assignments')
        .insert({
          org_id: currentOrg.id,
          student_id: studentId,
          teacher_id: selectedTeacherId,
          teacher_user_id: teacher?.user_id || null,
          is_primary: isPrimary,
        });
      if (error) {
        if (error.message.includes('duplicate')) {
          throw new Error('This teacher is already assigned to this student.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      toast({ title: 'Teacher assigned' });
      setIsDialogOpen(false);
      setSelectedTeacherId('');
      setIsPrimary(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('org_id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      toast({ title: 'Teacher removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const setPrimary = useMutation({
    mutationFn: async ({ assignmentId, primary }: { assignmentId: string; primary: boolean }) => {
      if (primary && currentOrg) {
        await supabase
          .from('student_teacher_assignments')
          .update({ is_primary: false })
          .eq('org_id', currentOrg.id)
          .eq('student_id', studentId);
      }
      const { error } = await supabase
        .from('student_teacher_assignments')
        .update({ is_primary: primary })
        .eq('id', assignmentId)
        .eq('org_id', currentOrg!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const unassignedTeachers = useMemo(
    () => availableTeachers.filter(t => !assignments.some(a => a.teacher_id === t.id)),
    [availableTeachers, assignments]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Assigned Teachers</CardTitle>
          <CardDescription>Teachers who work with this student</CardDescription>
        </div>
        {isOrgAdmin && (
          <Button onClick={() => setIsDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Assign Teacher
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">No teachers assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOrgAdmin 
                ? 'Assign teachers to manage this student.'
                : 'No teachers have been assigned yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {assignment.teacher?.display_name?.[0] || assignment.teacher?.email?.[0] || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {assignment.teacher?.display_name || assignment.teacher?.email || 'Unknown'}
                      </span>
                      {assignment.is_primary && (
                        <Badge className="gap-1 text-xs">
                          <Star className="h-3 w-3" /> Primary
                        </Badge>
                      )}
                      {!assignment.teacher?.user_id && (
                        <Badge variant="outline" className="text-xs">Unlinked</Badge>
                      )}
                    </div>
                    {assignment.teacher?.email && (
                      <p className="text-sm text-muted-foreground">{assignment.teacher.email}</p>
                    )}
                  </div>
                </div>
                {isOrgAdmin && (
                  <div className="flex items-center gap-2">
                    {!assignment.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrimary.mutate({ assignmentId: assignment.id, primary: true })}
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAssignment.mutate(assignment.id)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Teacher Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher</DialogTitle>
            <DialogDescription>
              Select a teacher to assign to this student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher..." />
                </SelectTrigger>
                <SelectContent>
                  {unassignedTeachers.length === 0 ? (
                    <SelectItem value="none" disabled>No teachers available</SelectItem>
                  ) : (
                    unassignedTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.display_name || teacher.email || 'Unknown'}
                        {!teacher.user_id && ' (unlinked)'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Primary Teacher</Label>
                <p className="text-xs text-muted-foreground">
                  The main teacher for this student
                </p>
              </div>
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addAssignment.mutate()} disabled={addAssignment.isPending || !selectedTeacherId}>
              {addAssignment.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : 'Assign Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
