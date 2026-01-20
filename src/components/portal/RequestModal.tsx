import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2 } from 'lucide-react';
import { useCreateMessageRequest, useChildrenWithDetails } from '@/hooks/useParentPortal';

interface RequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'cancellation' | 'reschedule' | 'general';
  lessonId?: string;
  lessonTitle?: string;
}

export function RequestModal({
  open,
  onOpenChange,
  defaultType = 'general',
  lessonId,
  lessonTitle,
}: RequestModalProps) {
  const [requestType, setRequestType] = useState<'cancellation' | 'reschedule' | 'general'>(defaultType);
  const [subject, setSubject] = useState(lessonTitle ? `Regarding: ${lessonTitle}` : '');
  const [message, setMessage] = useState('');
  const [studentId, setStudentId] = useState<string>('');

  const { data: children } = useChildrenWithDetails();
  const createRequest = useCreateMessageRequest();

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;

    await createRequest.mutateAsync({
      request_type: requestType,
      subject: subject.trim(),
      message: message.trim(),
      student_id: studentId || undefined,
      lesson_id: lessonId,
    });

    // Reset form
    setSubject('');
    setMessage('');
    setStudentId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send a Request</DialogTitle>
          <DialogDescription>
            Submit a request to the admin team. They will respond as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Request Type</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Enquiry</SelectItem>
                <SelectItem value="cancellation">Lesson Cancellation</SelectItem>
                <SelectItem value="reschedule">Reschedule Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {children && children.length > 1 && (
            <div className="space-y-2">
              <Label>Regarding Student (optional)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All / Not specific</SelectItem>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.first_name} {child.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please provide details of your request..."
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!subject.trim() || !message.trim() || createRequest.isPending}
          >
            {createRequest.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
