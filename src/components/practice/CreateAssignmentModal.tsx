import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateAssignment } from '@/hooks/usePractice';
import { supabase } from '@/integrations/supabase/client';
import { activeStudentsQuery } from '@/lib/studentQuery';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useStudentInstruments } from '@/hooks/useStudentInstruments';
import { useGradeLevels } from '@/hooks/useInstruments';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedStudentId?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export function CreateAssignmentModal({ 
  open, 
  onOpenChange,
  preselectedStudentId 
}: CreateAssignmentModalProps) {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(preselectedStudentId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetMinutes, setTargetMinutes] = useState('30');
  const [targetDays, setTargetDays] = useState('5');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [gradeLevelId, setGradeLevelId] = useState('');

  const createAssignment = useCreateAssignment();
  const { data: studentInstruments } = useStudentInstruments(studentId || undefined);
  const { data: allGradeLevels } = useGradeLevels();

  // Build grade options from the student's instruments' exam boards
  const gradeOptions = (() => {
    if (!studentInstruments || !allGradeLevels) return allGradeLevels || [];
    const boardIds = new Set(
      studentInstruments
        .map((si) => si.exam_board_id)
        .filter(Boolean) as string[],
    );
    if (boardIds.size === 0) return allGradeLevels.filter((g) => g.exam_board_id === null);
    // Show universal + all boards the student uses
    return allGradeLevels.filter(
      (g) => g.exam_board_id === null || boardIds.has(g.exam_board_id),
    );
  })();

  const fetchStudents = useCallback(async () => {
    if (isAdmin) {
      const { data } = await activeStudentsQuery(currentOrg!.id)
        .order('first_name');
      setStudents((data || []) as Student[]);
    } else if (user) {
      // Teacher: only show assigned students
      const { data: teacherRecord } = await supabase
        .from('teachers')
        .select('id')
        .eq('org_id', currentOrg!.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (teacherRecord) {
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('teacher_id', teacherRecord.id);

        const studentIds = (assignments || []).map(a => a.student_id);
        if (studentIds.length > 0) {
          const { data } = await activeStudentsQuery(currentOrg!.id)
            .in('id', studentIds)
            .order('first_name');
          setStudents((data || []) as Student[]);
        } else {
          setStudents([]);
        }
      } else {
        setStudents([]);
      }
    }
  }, [isAdmin, currentOrg, user]);

  useEffect(() => {
    if (open && currentOrg?.id) {
      fetchStudents();
    }
  }, [open, currentOrg?.id, fetchStudents]);

  useEffect(() => {
    if (preselectedStudentId) {
      setStudentId(preselectedStudentId);
    }
  }, [preselectedStudentId]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId || !title.trim()) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await createAssignment.mutateAsync({
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || undefined,
        target_minutes_per_day: parseInt(targetMinutes) || 30,
        target_days_per_week: parseInt(targetDays) || 5,
        start_date: startDate,
        end_date: endDate || undefined,
        grade_level_id: gradeLevelId && gradeLevelId !== 'none' ? gradeLevelId : undefined,
      });
      
      toast.success('Practice assignment created');
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create assignment');
    }
  };

  const resetForm = () => {
    setStudentId(preselectedStudentId || '');
    setTitle('');
    setDescription('');
    setTargetMinutes('30');
    setTargetDays('5');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setGradeLevelId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-md sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Create Practice Assignment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student">Student *</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="min-h-11 sm:min-h-9">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Assignment Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Scales and Arpeggios"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Practice instructions..."
              rows={3}
            />
          </div>

          {/* Grade level (optional) */}
          {studentId && gradeOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="gradeLevel">Grade Level</Label>
              <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
                <SelectTrigger className="min-h-11 sm:min-h-9">
                  <SelectValue placeholder="Optional — tag with grade level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grade level</SelectItem>
                  {gradeOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}{g.is_diploma ? ' (Diploma)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetMinutes">Minutes/Day</Label>
              <Input
                id="targetMinutes"
                type="number"
                min="5"
                max="180"
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetDays">Days/Week</Label>
              <Input
                id="targetDays"
                type="number"
                min="1"
                max="7"
                value={targetDays}
                onChange={(e) => setTargetDays(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled={createAssignment.isPending}>
              Create Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
