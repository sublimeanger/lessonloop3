import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { useStaffMembers, useSendInternalMessage } from '@/hooks/useInternalMessages';
import { Badge } from '@/components/ui/badge';

interface InternalComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRecipient?: { user_id: string; role: string } | null;
}

export function InternalComposeModal({
  open,
  onOpenChange,
  preselectedRecipient,
}: InternalComposeModalProps) {
  const { data: staffMembers, isLoading: staffLoading } = useStaffMembers();
  const sendMessage = useSendInternalMessage();

  const [recipientId, setRecipientId] = useState(preselectedRecipient?.user_id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const selectedStaff = staffMembers?.find(s => s.user_id === recipientId);

  const handleSend = async () => {
    if (!recipientId || !subject.trim() || !body.trim() || !selectedStaff) return;

    await sendMessage.mutateAsync({
      recipientUserId: recipientId,
      recipientRole: selectedStaff.role,
      subject: subject.trim(),
      body: body.trim(),
    });

    // Reset form and close
    setRecipientId('');
    setSubject('');
    setBody('');
    onOpenChange(false);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Internal Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Recipient</Label>
            {staffLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading staff...
              </div>
            ) : (
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers?.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{member.full_name}</span>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {!staffMembers?.length && (
                    <div className="p-2 text-sm text-muted-foreground">
                      No other staff members found
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
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
            disabled={!recipientId || !subject.trim() || !body.trim() || sendMessage.isPending}
            className="gap-2"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
