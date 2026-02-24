import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineEmptyState } from '@/components/shared/EmptyState';
import { Loader2, FileText, Lock, Video, ExternalLink, BookOpen, ClipboardList, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { formatDateUK, formatTimeUK } from '@/lib/utils';
import { useStudentLessonNotes } from '@/hooks/useLessonNotes';
import { EngagementBadge } from '@/components/calendar/EngagementRating';

interface LessonNote {
  id: string;
  title: string;
  start_at: string;
  status: string;
  notes_shared: string | null;
  notes_private: string | null;
  recap_url: string | null;
  teacher_name: string | null;
}

interface LessonParticipantRow {
  lesson: {
    id: string;
    title: string;
    start_at: string;
    status: string;
    notes_shared: string | null;
    notes_private?: string | null;
    recap_url?: string | null;
    teacher: { display_name: string } | null;
  };
}

interface StudentLessonNotesProps {
  studentId: string;
}

export function StudentLessonNotes({ studentId }: StudentLessonNotesProps) {
  const { currentOrg, isOrgAdmin } = useOrg();
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { data: structuredNotes } = useStudentLessonNotes(studentId);

  useEffect(() => {
    if (!currentOrg || !studentId) return;

    const fetchNotes = async () => {
      setIsLoading(true);

      const selectColumns = isOrgAdmin
        ? `lesson:lessons!inner(id, title, start_at, status, notes_shared, notes_private, recap_url, teacher:teachers(display_name))`
        : `lesson:lessons!inner(id, title, start_at, status, notes_shared, recap_url, teacher:teachers(display_name))`;

      const { data, error } = await supabase
        .from('lesson_participants')
        .select(selectColumns)
        .eq('student_id', studentId)
        .eq('org_id', currentOrg.id)
        .not('lesson.notes_shared', 'is', null)
        .order('lesson(start_at)', { ascending: false });

      if (error) {
        // Fallback: fetch without the OR for notes_private
        // PostgREST doesn't support OR across columns easily in nested filters
        // So we fetch lessons with notes_shared, then separately with notes_private
        const fallbackSelect = isOrgAdmin
          ? `lesson:lessons!inner(id, title, start_at, status, notes_shared, notes_private, recap_url, teacher:teachers(display_name))`
          : `lesson:lessons!inner(id, title, start_at, status, notes_shared, recap_url, teacher:teachers(display_name))`;

        const { data: sharedData } = await supabase
          .from('lesson_participants')
          .select(fallbackSelect)
          .eq('student_id', studentId)
          .eq('org_id', currentOrg.id);

        const allLessons = (sharedData || [])
          .map((lp) => (lp as unknown as LessonParticipantRow).lesson)
          .filter((l) => l && (l.notes_shared || (isOrgAdmin && l.notes_private)))
          .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

        // Deduplicate by id
        const seen = new Set<string>();
        const unique = allLessons.filter((l) => {
          if (seen.has(l.id)) return false;
          seen.add(l.id);
          return true;
        });

        setNotes(unique.map((l) => ({
          id: l.id,
          title: l.title,
          start_at: l.start_at,
          status: l.status,
          notes_shared: l.notes_shared,
          notes_private: isOrgAdmin ? (l.notes_private || null) : null,
          recap_url: l.recap_url || null,
          teacher_name: l.teacher?.display_name || null,
        })));
        setIsLoading(false);
        return;
      }

      // Deduplicate lessons (student may appear in multiple participants)
      const seen = new Set<string>();
      const lessonNotes: LessonNote[] = [];

      (data || []).forEach((lp) => {
        const l = (lp as unknown as LessonParticipantRow).lesson;
        if (!l || seen.has(l.id)) return;
        if (!l.notes_shared && !(isOrgAdmin && l.notes_private)) return;
        seen.add(l.id);
        lessonNotes.push({
          id: l.id,
          title: l.title,
          start_at: l.start_at,
          status: l.status,
          notes_shared: l.notes_shared,
          notes_private: isOrgAdmin ? (l.notes_private || null) : null,
          recap_url: (l as any).recap_url || null,
          teacher_name: l.teacher?.display_name || null,
        });
      });

      setNotes(lessonNotes);
      setIsLoading(false);
    };

    fetchNotes();
  }, [studentId, currentOrg?.id, isOrgAdmin]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lesson Notes</CardTitle>
        <CardDescription>Notes and observations from lessons</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <InlineEmptyState
            icon={FileText}
            message="No lesson notes yet. Notes added during lesson completion will appear here."
          />
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatDateUK(note.start_at)} at {formatTimeUK(note.start_at)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {note.status}
                    </Badge>
                  </div>
                  {note.teacher_name && (
                    <span className="text-xs text-muted-foreground">
                      {note.teacher_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{note.title}</p>

                {/* Structured notes from lesson_notes table */}
                {(() => {
                  const structured = structuredNotes?.filter(
                    sn => sn.lesson_id === note.id && sn.parent_visible
                  );
                  if (!structured || structured.length === 0) return null;
                  return structured.map(sn => (
                    <div key={sn.id} className="rounded-md bg-primary/5 p-3 space-y-2">
                      {sn.content_covered && (
                        <div className="flex gap-2 text-sm">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">What was covered</p>
                            <p className="whitespace-pre-wrap">{sn.content_covered}</p>
                          </div>
                        </div>
                      )}
                      {sn.homework && (
                        <div className="flex gap-2 text-sm">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Homework</p>
                            <p className="whitespace-pre-wrap">{sn.homework}</p>
                          </div>
                        </div>
                      )}
                      {sn.focus_areas && (
                        <div className="flex gap-2 text-sm">
                          <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Focus areas</p>
                            <p className="whitespace-pre-wrap">{sn.focus_areas}</p>
                          </div>
                        </div>
                      )}
                      {sn.engagement_rating && <EngagementBadge rating={sn.engagement_rating} />}
                      {isOrgAdmin && sn.teacher_private_notes && (
                        <div className="rounded-md bg-muted/50 p-2 border-l-2 border-primary/30 mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Private
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{sn.teacher_private_notes}</p>
                        </div>
                      )}
                    </div>
                  ));
                })()}

                {note.notes_shared && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Shared Note</p>
                    <p className="text-sm whitespace-pre-wrap">{note.notes_shared}</p>
                  </div>
                )}

                {isOrgAdmin && note.notes_private && (
                  <div className="rounded-md bg-muted/50 p-3 border-l-2 border-primary/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Private Note
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{note.notes_private}</p>
                  </div>
                )}

                {note.recap_url && (
                  <a
                    href={note.recap_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-primary hover:bg-muted transition-colors"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Watch Recap
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
