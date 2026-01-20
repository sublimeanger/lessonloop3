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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, User } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
  user_id: string | null;
}

interface GuardianInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuardianInviteModal({ open, onOpenChange }: GuardianInviteModalProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open && currentOrg) {
      fetchGuardians();
    }
  }, [open, currentOrg?.id]);

  const fetchGuardians = async () => {
    if (!currentOrg) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('guardians')
      .select('id, full_name, email, user_id')
      .eq('org_id', currentOrg.id)
      .is('user_id', null) // Only uninvited guardians
      .not('email', 'is', null)
      .order('full_name');

    if (error) {
      toast({ title: 'Error loading guardians', description: error.message, variant: 'destructive' });
    } else {
      setGuardians(data || []);
    }
    setIsLoading(false);
  };

  const handleInvite = async () => {
    if (!selectedGuardianId || !currentOrg) return;

    const guardian = guardians.find(g => g.id === selectedGuardianId);
    if (!guardian?.email) {
      toast({ title: 'No email', description: 'Guardian has no email address.', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      // Create invite record
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .insert({
          org_id: currentOrg.id,
          email: guardian.email,
          role: 'parent' as const,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send invite email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          inviteId: invite.id,
          guardianId: guardian.id,
        },
      });

      if (emailError) {
        console.error('Email error:', emailError);
        // Don't fail - invite was created
      }

      toast({
        title: 'Invite sent',
        description: `Portal invite sent to ${guardian.full_name} at ${guardian.email}`,
      });

      setSelectedGuardianId('');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error sending invite',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsSending(false);
  };

  const selectedGuardian = guardians.find(g => g.id === selectedGuardianId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Guardian to Portal</DialogTitle>
          <DialogDescription>
            Send a portal invite to a guardian so they can view their children's lessons and invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : guardians.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No uninvited guardians with email addresses.</p>
              <p className="text-sm mt-1">Add guardians to students first.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Guardian</Label>
                <Select value={selectedGuardianId} onValueChange={setSelectedGuardianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a guardian to invite" />
                  </SelectTrigger>
                  <SelectContent>
                    {guardians.map((guardian) => (
                      <SelectItem key={guardian.id} value={guardian.id}>
                        <div className="flex items-center gap-2">
                          <span>{guardian.full_name}</span>
                          <span className="text-muted-foreground text-xs">({guardian.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGuardian && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {selectedGuardian.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{selectedGuardian.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedGuardian.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedGuardianId || isSending}
          >
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
