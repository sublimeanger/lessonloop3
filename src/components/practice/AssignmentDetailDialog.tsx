import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { useUpdateAssignment, useDeleteAssignment } from '@/hooks/usePractice';
import { toast } from 'sonner';

interface PracticeAssignment {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  target_minutes_per_day: number;
  target_days_per_week: number;
  start_date: string;
  end_date?: string | null;
  created_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface AssignmentDetailDialogProps {
  assignment: PracticeAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentDetailDialog({ assignment, open, onOpenChange }: AssignmentDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();

  if (!assignment) return null;

  const startEditing = () => {
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || '');
    setEditEndDate(assignment.end_date || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        end_date: editEndDate || null,
      });
      toast.success('Assignment updated');
      setIsEditing(false);
    } catch {
      toast.error('Failed to update assignment');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAssignment.mutateAsync(assignment.id);
      toast.success('Assignment deleted');
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to delete assignment');
    }
  };

  const studentName = assignment.student
    ? `${assignment.student.first_name} ${assignment.student.last_name}`
    : 'Unknown student';

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setIsEditing(false); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? 'Edit Assignment' : assignment.title}
              {!isEditing && (
                <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'} className="ml-auto">
                  {assignment.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker value={editEndDate} onChange={setEditEndDate} placeholder="End date" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateAssignment.isPending}>
                  {updateAssignment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Save
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Student</p>
                  <p className="font-medium">{studentName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium">{assignment.target_minutes_per_day} min/day, {assignment.target_days_per_week} days/week</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{format(parseISO(assignment.start_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-medium">{assignment.end_date ? format(parseISO(assignment.end_date), 'dd MMM yyyy') : 'Ongoing'}</p>
                </div>
              </div>
              {assignment.description && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap">{assignment.description}</p>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{assignment.title}". Practice logs from students will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAssignment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAssignment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
