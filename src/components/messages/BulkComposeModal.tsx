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
import { Loader2, Send, Users } from 'lucide-react';
import { RecipientFilter } from './RecipientFilter';
import {
  useBulkMessageFilters,
  useRecipientPreview,
  useSendBulkMessage,
  type FilterCriteria,
} from '@/hooks/useBulkMessage';
import { useMessageTemplates } from '@/hooks/useMessages';

interface BulkComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkComposeModal({ open, onOpenChange }: BulkComposeModalProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [filters, setFilters] = useState<FilterCriteria>({});

  const { locations, teachers } = useBulkMessageFilters();
  const { data: preview, isLoading: previewLoading } = useRecipientPreview(filters);
  const { data: templates } = useMessageTemplates();
  const sendBulkMessage = useSendBulkMessage();

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

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setSubject('');
      setBody('');
      setSelectedTemplateId('');
      setFilters({});
    }
  }, [open]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || !preview?.count) return;

    const batchName = name.trim() || `Bulk message - ${new Date().toLocaleDateString('en-GB')}`;

    await sendBulkMessage.mutateAsync({
      name: batchName,
      subject: subject.trim(),
      body: body.trim(),
      filter_criteria: filters,
    });

    onOpenChange(false);
  };

  const recipientCount = preview?.count || 0;
  const canSend = subject.trim() && body.trim() && recipientCount > 0 && !sendBulkMessage.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Bulk Message
          </DialogTitle>
          <DialogDescription>
            Send an email to multiple guardians at once. Use filters to target specific groups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recipient Filters */}
          <RecipientFilter
            filters={filters}
            onFiltersChange={setFilters}
            locations={locations}
            teachers={teachers}
            recipientCount={recipientCount}
            isLoading={previewLoading}
          />

          {/* Batch Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="batch-name">
              Batch Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., September fees reminder"
            />
          </div>

          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Use Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template (optional)" />
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
            <Label htmlFor="bulk-subject">Subject *</Label>
            <Input
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="bulk-body">Message *</Label>
            <Textarea
              id="bulk-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend} className="gap-2">
            {sendBulkMessage.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send to {recipientCount} Guardian{recipientCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
