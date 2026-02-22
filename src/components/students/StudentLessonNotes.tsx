import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { formatDateUK, formatTimeUK } from '@/lib/utils';

interface LessonNote {
  id: string;
  title: string;
  start_at: string;
  status: string;
  notes_shared: string | null;
  notes_private: string | null;
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

  useEffect(() => {
    if (!currentOrg || !studentId) return;

    const fetchNotes = async () => {
      setIsLoading(true);

      const selectColumns = isOrgAdmin
        ? `lesson:lessons!inner(id, title, start_at, status, notes_shared, notes_private, teacher:teachers(display_name))`
        : `lesson:lessons!inner(id, title, start_at, status, notes_shared, teacher:teachers(display_name))`;

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
          ? `lesson:lessons!inner(id, title, start_at, status, notes_shared, notes_private, teacher:teachers(display_name))`
          : `lesson:lessons!inner(id, title, start_at, status, notes_shared, teacher:teachers(display_name))`;

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
          <div className="flex flex-col items-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">No lesson notes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Notes added during lesson completion will appear here.
            </p>
          </div>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
