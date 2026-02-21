import { useState } from 'react';
import { logger } from '@/lib/logger';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent?: () => void;
}

export function InviteMemberDialog({ open, onOpenChange, onInviteSent }: InviteMemberDialogProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher' | 'finance'>('teacher');
  const [isSending, setIsSending] = useState(false);

  const roleDescriptions: Record<string, string> = {
    admin: 'Admins can manage students, teachers, and billing.',
    teacher: 'Teachers can view and manage their assigned students.',
    finance: 'Finance users can manage invoices and billing.',
  };

  const handleInvite = async () => {
    if (!email.trim() || !currentOrg) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    // Check if email is already an active member
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMembership } = await supabase
        .from('org_memberships')
        .select('id, status')
        .eq('org_id', currentOrg.id)
        .eq('user_id', existingProfile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (existingMembership) {
        toast({ title: 'Already a member', description: 'This person is already an active member of your organisation.', variant: 'destructive' });
        setIsSending(false);
        return;
      }
    }

    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        org_id: currentOrg.id,
        email: email.trim().toLowerCase(),
        role,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        toast({ title: 'Already invited', description: 'This email has a pending invite.', variant: 'destructive' });
      } else {
        toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
      }
      setIsSending(false);
      return;
    }

    // Send invite email (only needs inviteId)
    try {
      await supabase.functions.invoke('send-invite-email', {
        body: { inviteId: invite.id },
      });
      toast({ title: 'Invite sent', description: `Invitation sent to ${email.trim()}` });
    } catch (emailError: any) {
      logger.error('Email error:', emailError);
      toast({ title: 'Invite created', description: 'Email may not have been sent.' });
    }

    setEmail('');
    setRole('teacher');
    setIsSending(false);
    onOpenChange(false);
    onInviteSent?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organisation with login access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'teacher' | 'finance')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isSending || !email.trim()}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
