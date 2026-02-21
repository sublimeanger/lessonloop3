import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

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
  const { currentOrg } = useOrg();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(preselectedStudentId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetMinutes, setTargetMinutes] = useState('30');
  const [targetDays, setTargetDays] = useState('5');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');

  const createAssignment = useCreateAssignment();

  useEffect(() => {
    if (open && currentOrg?.id) {
      fetchStudents();
    }
  }, [open, currentOrg?.id]);

  useEffect(() => {
    if (preselectedStudentId) {
      setStudentId(preselectedStudentId);
    }
  }, [preselectedStudentId]);

  const fetchStudents = async () => {
    const { data } = await activeStudentsQuery(currentOrg!.id)
      .order('first_name');
    
    setStudents((data || []) as any);
  };

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
      });
      
      toast.success('Practice assignment created');
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create assignment');
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Practice Assignment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student">Student *</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAssignment.isPending}>
              Create Assignment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
