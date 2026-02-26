import { useState, useEffect } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, MessageSquare, Zap, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LoopAssistIntroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoopAssistIntroModal({ open, onOpenChange }: LoopAssistIntroModalProps) {
  const { user } = useAuth();
  const [hasSeenIntro, setHasSeenIntro] = useState(true);

  // Check if user has seen the intro — localStorage first (fast), then user metadata (cross-device)
  useEffect(() => {
    if (user) {
      const seenLocal = safeGetItem(`lessonloop_loopassist_intro_${user.id}`);
      const seenMeta = user.user_metadata?.loopassist_intro_seen;
      if (seenLocal || seenMeta) {
        // Sync localStorage if only metadata flag is set (new device)
        if (!seenLocal && seenMeta) {
          safeSetItem(`lessonloop_loopassist_intro_${user.id}`, 'true');
        }
        setHasSeenIntro(true);
      } else {
        setHasSeenIntro(false);
      }
    }
  }, [user]);

  const handleDismiss = () => {
    if (user) {
      safeSetItem(`lessonloop_loopassist_intro_${user.id}`, 'true');
      // Persist to user metadata so flag survives across devices/browsers
      supabase.auth.updateUser({
        data: { loopassist_intro_seen: true },
      });
    }
    setHasSeenIntro(true);
    onOpenChange(false);

    // Show first-use toast with keyboard shortcut hint
    import('sonner').then(({ toast }) => {
      setTimeout(() => {
        toast.info('Pro tip: Press ⌘J to open LoopAssist from anywhere');
      }, 500);
    });
  };

  // Only show if user hasn't seen it and modal should be open
  const shouldShow = open && !hasSeenIntro;

  return (
    <Dialog open={shouldShow} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Meet LoopAssist</DialogTitle>
              <DialogDescription>Your AI-powered assistant</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <p className="text-muted-foreground">
            LoopAssist helps you manage your teaching business faster. Ask questions, request actions, 
            and get things done without navigating through menus.
          </p>

          <div className="space-y-4">
            <FeatureItem
              icon={MessageSquare}
              title="Ask Questions"
              description="What invoices are overdue? Who has lessons tomorrow?"
            />
            <FeatureItem
              icon={Zap}
              title="Request Actions"
              description="Send invoice reminders, generate billing runs, reschedule lessons"
            />
            <FeatureItem
              icon={CheckCircle2}
              title="Confirm Before Acting"
              description="Review proposed actions before they're executed—you're always in control"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-normal">
                "What's outstanding this month?"
              </Badge>
              <Badge variant="secondary" className="font-normal">
                "Send reminders for overdue invoices"
              </Badge>
              <Badge variant="secondary" className="font-normal">
                "What lessons do I have today?"
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button onClick={handleDismiss}>
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Hook to check and trigger intro modal
export function useLoopAssistIntro() {
  const { user } = useAuth();
  const [showIntro, setShowIntro] = useState(false);

  const checkAndShowIntro = () => {
    if (user) {
      const seenLocal = safeGetItem(`lessonloop_loopassist_intro_${user.id}`);
      const seenMeta = user.user_metadata?.loopassist_intro_seen;
      if (!seenLocal && !seenMeta) {
        setShowIntro(true);
      }
    }
  };

  return {
    showIntro,
    setShowIntro,
    checkAndShowIntro,
  };
}
