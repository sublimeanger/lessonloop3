import { cn } from '@/lib/utils';

interface EngagementRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

const RATINGS = [
  { value: 1, label: 'Struggling', emoji: '😔' },
  { value: 2, label: 'Needs work', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Excellent', emoji: '😊' },
];

export function EngagementRating({ value, onChange, readonly = false, size = 'md' }: EngagementRatingProps) {
  const buttonSize = size === 'sm' ? 'h-8 w-8 text-base' : 'h-11 w-11 text-xl';

  return (
    <div className="flex items-center gap-1.5">
      {RATINGS.map((rating) => {
        const isSelected = value === rating.value;
        return (
          <button
            key={rating.value}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(rating.value)}
            className={cn(
              'rounded-full flex items-center justify-center transition-all duration-150',
              buttonSize,
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95',
              isSelected
                ? 'bg-primary/10 ring-2 ring-primary scale-110'
                : 'opacity-40 hover:opacity-70',
              !isSelected && readonly && 'opacity-20'
            )}
            title={rating.label}
            aria-label={`${rating.label} (${rating.value}/5)`}
          >
            {rating.emoji}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Inline display-only engagement rating for cards and summaries.
 */
export function EngagementBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const info = RATINGS.find(r => r.value === rating);
  if (!info) return null;

  return (
    <span className="inline-flex items-center gap-1 text-sm" title={`Engagement: ${info.label}`}>
      <span>{info.emoji}</span>
      <span className="text-xs text-muted-foreground">{info.label}</span>
    </span>
  );
}
