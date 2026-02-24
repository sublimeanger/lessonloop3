import { Sparkles, X, ArrowRight, EyeOff } from 'lucide-react';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { useBannerDismissals } from '@/hooks/useBannerDismissals';

interface LoopAssistPageBannerProps {
  /** Unique key for dismiss tracking */
  bannerKey: string;
  /** The message shown to the user */
  message: string;
  /** The prompt pre-filled in LoopAssist when clicked */
  prompt: string;
}

export function LoopAssistPageBanner({ bannerKey, message, prompt }: LoopAssistPageBannerProps) {
  const { openDrawerWithMessage } = useLoopAssistUI();
  const { hasAccess } = useFeatureGate('loop_assist');
  const { isDismissed, dismissForSession, dismissPermanently } = useBannerDismissals();

  if (!hasAccess || isDismissed(bannerKey)) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissForSession(bannerKey);
  };

  const handleDismissForever = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissPermanently(bannerKey);
  };

  return (
    <div
      className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 group cursor-pointer transition-colors hover:bg-primary/10"
      onClick={() => openDrawerWithMessage(prompt)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDrawerWithMessage(prompt)}
    >
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1 text-body text-foreground/80 truncate">
        {message}
      </span>
      <ArrowRight className="h-3 w-3 text-primary/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      <button
        type="button"
        onClick={handleDismissForever}
        className="hidden sm:inline-flex ml-1 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-micro text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Don't show again"
      >
        <EyeOff className="h-3 w-3" />
        <span>Don't show</span>
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
