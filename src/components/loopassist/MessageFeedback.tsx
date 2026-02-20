import { useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string;
  className?: string;
}

type FeedbackType = 'helpful' | 'not_helpful' | null;

export function MessageFeedback({ messageId, conversationId, className }: MessageFeedbackProps) {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: FeedbackType) => {
    if (!user || !currentOrg || isSubmitting) return;
    
    // Toggle off if same feedback clicked
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);

    if (!newFeedback) return;

    setIsSubmitting(true);
    try {
      // Persist feedback to ai_interaction_metrics table
      const { error } = await supabase.from('ai_interaction_metrics').insert({
        org_id: currentOrg.id,
        message_id: messageId,
        conversation_id: conversationId,
        user_id: user.id,
        feedback: newFeedback,
      });

      if (error) {
        logger.error('Failed to save feedback:', error);
        // Still show visual feedback even if save fails
      }
      
      if (newFeedback === 'helpful') {
        toast.success('Thanks for your feedback!', { duration: 2000 });
      } else {
        toast('Feedback recorded. We will work on improving.', { duration: 2000 });
      }
    } catch (error) {
      logger.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 rounded-full',
          feedback === 'helpful' && 'bg-success/10 text-success hover:bg-success/20 hover:text-success'
        )}
        onClick={() => handleFeedback('helpful')}
        disabled={isSubmitting}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 rounded-full',
          feedback === 'not_helpful' && 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
        )}
        onClick={() => handleFeedback('not_helpful')}
        disabled={isSubmitting}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
