import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { StickyNote, BookOpen, ClipboardList, Target, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useStudentQuickNotes } from '@/hooks/useStudentQuickNotes';
import { EngagementBadge } from '@/components/calendar/EngagementRating';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface StudentNotesPopoverProps {
  studentId: string;
  studentName: string;
  /** If true, show a subtle teal dot on the icon */
  hasRecentUpdate?: boolean;
  /** When false, hide the icon entirely (student has no notes). Undefined = always show. */
  hasNotes?: boolean;
}

function NotesContent({
  studentId,
  studentName,
  isOpen,
}: {
  studentId: string;
  studentName: string;
  isOpen: boolean;
}) {
  const { data, isLoading } = useStudentQuickNotes(studentId, isOpen);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { profileNotes, recentLessonNotes } = data || { profileNotes: null, recentLessonNotes: [] };
  const hasAny = profileNotes || recentLessonNotes.length > 0;

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No notes for this student yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Notes */}
      {profileNotes && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Profile Notes
          </h4>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {profileNotes.length > 200 ? profileNotes.slice(0, 200) + '…' : profileNotes}
          </p>
        </div>
      )}

      {/* Recent Lesson Notes */}
      {recentLessonNotes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recent Lesson Notes
          </h4>
          <div className="space-y-3">
            {recentLessonNotes.map((note) => (
              <div key={note.id} className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
                {note.lesson_date && (
                  <p className="text-xs text-muted-foreground font-medium">
                    {format(parseISO(note.lesson_date), 'd MMM yyyy · HH:mm')}
                  </p>
                )}
                {note.content_covered && (
                  <div className="flex gap-1.5 text-xs">
                    <BookOpen className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{note.content_covered}</span>
                  </div>
                )}
                {note.homework && (
                  <div className="flex gap-1.5 text-xs">
                    <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{note.homework}</span>
                  </div>
                )}
                {note.focus_areas && (
                  <div className="flex gap-1.5 text-xs">
                    <Target className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{note.focus_areas}</span>
                  </div>
                )}
                {note.engagement_rating && (
                  <EngagementBadge rating={note.engagement_rating} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View full profile link */}
      <Link
        to={`/students/${studentId}`}
        className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
      >
        View full profile
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function StudentNotesPopover({ studentId, studentName, hasRecentUpdate }: StudentNotesPopoverProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 relative"
      title={`Notes for ${studentName}`}
    >
      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
      {hasRecentUpdate && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">{studentName} — Notes</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <NotesContent studentId={studentId} studentName={studentName} isOpen={isOpen} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="start">
        <h3 className="font-medium text-sm mb-3">{studentName} — Notes</h3>
        <NotesContent studentId={studentId} studentName={studentName} isOpen={isOpen} />
      </PopoverContent>
    </Popover>
  );
}
