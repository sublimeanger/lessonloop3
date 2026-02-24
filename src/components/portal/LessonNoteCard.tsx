import { BookOpen, ClipboardList, Target } from 'lucide-react';
import { EngagementBadge } from '@/components/calendar/EngagementRating';

interface LessonNoteCardProps {
  contentCovered: string | null;
  homework: string | null;
  focusAreas: string | null;
  engagementRating: number | null;
}

export function LessonNoteCard({
  contentCovered,
  homework,
  focusAreas,
  engagementRating,
}: LessonNoteCardProps) {
  const hasContent = contentCovered || homework || focusAreas || engagementRating;
  if (!hasContent) return null;

  return (
    <div className="space-y-2.5">
      {contentCovered && (
        <div className="flex gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">What was covered</p>
            <p className="whitespace-pre-wrap">{contentCovered}</p>
          </div>
        </div>
      )}

      {homework && (
        <div className="flex gap-2 text-sm">
          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Homework</p>
            <p className="whitespace-pre-wrap">{homework}</p>
          </div>
        </div>
      )}

      {focusAreas && (
        <div className="flex gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Focus areas</p>
            <p className="whitespace-pre-wrap">{focusAreas}</p>
          </div>
        </div>
      )}

      {engagementRating && (
        <div className="flex items-center gap-2">
          <EngagementBadge rating={engagementRating} />
        </div>
      )}
    </div>
  );
}
