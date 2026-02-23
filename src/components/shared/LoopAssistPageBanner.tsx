import { useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';

const DISMISS_KEY = 'll_page_banners_dismissed';

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function persistDismissed(set: Set<string>) {
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
}

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
  const [dismissed, setDismissed] = useState(() => getDismissed());

  if (!hasAccess || dismissed.has(bannerKey)) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(dismissed);
    next.add(bannerKey);
    persistDismissed(next);
    setDismissed(next);
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
        onClick={dismiss}
        className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
