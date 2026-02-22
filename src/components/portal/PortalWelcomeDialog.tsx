import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, MessageSquare, Music } from 'lucide-react';

interface PortalWelcomeDialogProps {
  userId: string;
  academyName: string;
}

const STORAGE_KEY_PREFIX = 'lessonloop_portal_welcomed_';

export function PortalWelcomeDialog({ userId, academyName }: PortalWelcomeDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_KEY_PREFIX}${userId}`;
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [userId]);

  const handleDismiss = () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to {academyName}! 🎶</DialogTitle>
          <DialogDescription>
            Your parent portal is ready. Here's what you can do:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {[
            { icon: Calendar, text: 'View your children\'s lesson schedule' },
            { icon: CreditCard, text: 'Check and pay invoices' },
            { icon: MessageSquare, text: 'Message the academy directly' },
            { icon: Music, text: 'Track practice progress' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {text}
            </li>
          ))}
        </ul>
        <Button onClick={handleDismiss} className="w-full mt-2">Got it!</Button>
      </DialogContent>
    </Dialog>
  );
}
