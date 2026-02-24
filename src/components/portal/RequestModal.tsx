import { useState, useEffect } from 'react';
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
import { useParentEnquiry } from '@/hooks/useParentEnquiry';

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

  useEffect(() => {
    if (open) {
      setRequestType(defaultType);
      setSubject(lessonTitle ? `Regarding: ${lessonTitle}` : '');
      setMessage('');
      setStudentId('');
    }
  }, [open, defaultType, lessonTitle]);

  const createRequest = useCreateMessageRequest();
  const sendEnquiry = useParentEnquiry();

  const isGeneralEnquiry = requestType === 'general';
  const isPending = isGeneralEnquiry ? sendEnquiry.isPending : createRequest.isPending;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;

    if (isGeneralEnquiry) {
      // General enquiries go through the conversations model
      await sendEnquiry.mutateAsync({
        subject: subject.trim(),
        body: message.trim(),
        student_id: studentId || undefined,
      });
    } else {
      // Cancellation/reschedule go through message_requests
      await createRequest.mutateAsync({
        request_type: requestType,
        subject: subject.trim(),
        message: message.trim(),
        student_id: studentId || undefined,
        lesson_id: lessonId,
      });
    }

    // Reset form
    setSubject('');
    setMessage('');
    setStudentId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] h-full sm:h-auto sm:max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isGeneralEnquiry ? 'Send a Message' : 'Send a Request'}</DialogTitle>
          <DialogDescription>
            {isGeneralEnquiry
              ? 'Send a message to the academy. They will respond in your inbox.'
              : 'Submit a request to the admin team. They will respond as soon as possible.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as 'cancellation' | 'reschedule' | 'general')}>
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
              placeholder={isGeneralEnquiry ? 'What is your message about?' : 'Brief summary of your request'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isGeneralEnquiry ? 'Write your message...' : 'Please provide details of your request...'}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sticky bottom-0 bg-background pt-4 pb-safe">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!subject.trim() || !message.trim() || isPending}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              isGeneralEnquiry ? 'Send Message' : 'Send Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
