import { useState, useEffect, useRef } from 'react';
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
import { useSendMessage, useMessageTemplates } from '@/hooks/useMessages';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

interface ComposeMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guardians?: Guardian[];
  preselectedGuardian?: Guardian;
  studentId?: string;
  studentName?: string;
}

export function ComposeMessageModal({
  open,
  onOpenChange,
  guardians = [],
  preselectedGuardian,
  studentId,
  studentName,
}: ComposeMessageModalProps) {
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [linkedStudents, setLinkedStudents] = useState<{ id: string; name: string }[]>([]);

  const { currentOrg } = useOrg();
  const { data: templates } = useMessageTemplates();
  const sendMessage = useSendMessage();
  const { isOnline, guardOffline } = useOnlineStatus();
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
      setSelectedStudentId('');
      if (!preselectedGuardian) {
        setSelectedGuardianId('');
      }
      setLinkedStudents([]);
    }
  }, [open, preselectedGuardian]);

  // Auto-focus the subject field when modal opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        subjectInputRef.current?.focus();
      });
    }
  }, [open]);

  // Pre-select guardian if provided
  useEffect(() => {
    if (preselectedGuardian) {
      setSelectedGuardianId(preselectedGuardian.id);
    }
  }, [preselectedGuardian]);

  // Pre-select student if provided
  useEffect(() => {
    if (studentId) {
      setSelectedStudentId(studentId);
    }
  }, [studentId]);

  // Apply template
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSubject(template.subject);
        setBody(template.body);
      }
    }
  }, [selectedTemplateId, templates]);

  // Fetch linked students when guardian changes
  useEffect(() => {
    const guardianId = selectedGuardianId || preselectedGuardian?.id;
    if (!guardianId || !currentOrg) {
      setLinkedStudents([]);
      return;
    }

    const fetchStudents = async () => {
      const { data } = await supabase
        .from('student_guardians')
        .select('student_id, students!inner(id, first_name, last_name)')
        .eq('guardian_id', guardianId)
        .eq('org_id', currentOrg.id);

      if (data) {
        const students = data.map((sg: any) => ({
          id: sg.students.id,
          name: `${sg.students.first_name} ${sg.students.last_name}`,
        }));
        setLinkedStudents(students);
        // Auto-select if only one student and nothing pre-selected
        if (students.length === 1 && !selectedStudentId) {
          setSelectedStudentId(students[0].id);
        }
      }
    };
    fetchStudents();
  }, [selectedGuardianId, preselectedGuardian?.id, currentOrg?.id]);

  const selectedGuardian = guardians.find(g => g.id === selectedGuardianId) || preselectedGuardian;

  const handleSend = async () => {
    if (guardOffline()) return;
    if (!selectedGuardian || !selectedGuardian.email || !subject.trim() || !body.trim()) return;

    await sendMessage.mutateAsync({
      recipient_type: 'guardian',
      recipient_id: selectedGuardian.id,
      recipient_email: selectedGuardian.email,
      recipient_name: selectedGuardian.full_name,
      subject: subject.trim(),
      body: body.trim(),
      related_id: selectedStudentId || studentId,
      message_type: 'manual',
    });

    // Reset form
    setSubject('');
    setBody('');
    setSelectedTemplateId('');
    setSelectedStudentId('');
    if (!preselectedGuardian) {
      setSelectedGuardianId('');
    }
    onOpenChange(false);
  };

  const hasValidRecipient = selectedGuardian && selectedGuardian.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            {studentName
              ? `Send a message to ${studentName}'s guardian`
              : 'Send a message to a guardian'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guardian selector (if not preselected) */}
          {!preselectedGuardian && guardians.length > 0 && (
            <div className="space-y-2">
              <Label>To</Label>
              <Select value={selectedGuardianId} onValueChange={setSelectedGuardianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {guardians.map((guardian) => (
                    <SelectItem
                      key={guardian.id}
                      value={guardian.id}
                      disabled={!guardian.email}
                    >
                      {guardian.full_name}
                      {guardian.email ? ` (${guardian.email})` : ' (no email)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show preselected guardian */}
          {preselectedGuardian && (
            <div className="space-y-2">
              <Label>To</Label>
              <div className="rounded-md border px-3 py-2 text-sm bg-muted/50">
                {preselectedGuardian.full_name}
                {preselectedGuardian.email && (
                  <span className="text-muted-foreground ml-2">
                    ({preselectedGuardian.email})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Use Template (optional)</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Related student selector */}
          {linkedStudents.length > 0 && (
            <div className="space-y-2">
              <Label>Related Student (optional)</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Link to a student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No student linked</SelectItem>
                  {linkedStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              ref={subjectInputRef}
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!hasValidRecipient || !subject.trim() || !body.trim() || sendMessage.isPending || !isOnline}
          >
            {sendMessage.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Email'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
