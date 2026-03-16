import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Eye, Lock, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EngagementBadge } from '@/components/calendar/EngagementRating';
import { formatDateUK, formatTimeUK, cn } from '@/lib/utils';
import type { ExplorerNote } from '@/hooks/useNotesExplorer';

interface NoteCardProps {
  note: ExplorerNote;
  isAdmin: boolean;
  currentTeacherId?: string | null;
  timezone?: string;
}

export function NoteCard({ note, isAdmin, currentTeacherId, timezone }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const studentName = note.student_first_name
    ? `${note.student_first_name} ${note.student_last_name || ''}`.trim()
    : 'All students';

  const time = formatTimeUK(note.lesson_start_at, timezone);
  const hasContent = note.content_covered || note.homework || note.focus_areas;
  const previewText = note.content_covered
    ? note.content_covered.length > 120
      ? note.content_covered.slice(0, 120) + '…'
      : note.content_covered
    : note.homework
      ? note.homework.length > 120
        ? note.homework.slice(0, 120) + '…'
        : note.homework
      : 'No content';

  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardContent className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{time}</span>
              <span className="text-sm text-muted-foreground">—</span>
              <span className="text-sm font-medium text-foreground truncate">{note.lesson_title}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm text-muted-foreground">{studentName}</span>
              {note.teacher_display_name && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{note.teacher_display_name}</span>
                </>
              )}
              {note.parent_visible ? (
                <span title="Visible to parents"><Eye className="h-3 w-3 text-muted-foreground" /></span>
              ) : (
                <span title="Private"><Lock className="h-3 w-3 text-muted-foreground" /></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {note.engagement_rating && <EngagementBadge rating={note.engagement_rating} />}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collapsed preview */}
        {!expanded && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{previewText}</p>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 space-y-3">
            {note.content_covered && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Content Covered</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content_covered}</p>
              </div>
            )}
            {note.homework && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Homework</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.homework}</p>
              </div>
            )}
            {note.focus_areas && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Focus Areas</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.focus_areas}</p>
              </div>
            )}
            {isAdmin && note.teacher_private_notes && (
              <div className="rounded-md bg-muted/50 p-2.5 border-l-2 border-primary/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Private Notes
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.teacher_private_notes}</p>
              </div>
            )}

            {/* Action links */}
            <div className="flex gap-2 pt-1">
              {note.student_id && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/students/${note.student_id}`}>
                    View Student <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
