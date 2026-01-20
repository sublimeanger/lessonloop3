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
import { useSendMessage, useMessageTemplates } from '@/hooks/useMessages';

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

  const { data: templates } = useMessageTemplates();
  const sendMessage = useSendMessage();

  // Pre-select guardian if provided
  useEffect(() => {
    if (preselectedGuardian) {
      setSelectedGuardianId(preselectedGuardian.id);
    }
  }, [preselectedGuardian]);

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

  const selectedGuardian = guardians.find(g => g.id === selectedGuardianId) || preselectedGuardian;

  const handleSend = async () => {
    if (!selectedGuardian || !selectedGuardian.email || !subject.trim() || !body.trim()) return;

    await sendMessage.mutateAsync({
      recipient_type: 'guardian',
      recipient_id: selectedGuardian.id,
      recipient_email: selectedGuardian.email,
      recipient_name: selectedGuardian.full_name,
      subject: subject.trim(),
      body: body.trim(),
      related_id: studentId,
      message_type: 'manual',
    });

    // Reset form
    setSubject('');
    setBody('');
    setSelectedTemplateId('');
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

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
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
            disabled={!hasValidRecipient || !subject.trim() || !body.trim() || sendMessage.isPending}
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
