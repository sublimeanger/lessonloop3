import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { FileText, ChevronDown, Loader2, Save, Lock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EngagementRating } from './EngagementRating';
import { useLessonNotes, useSaveLessonNote, LessonNote } from '@/hooks/useLessonNotes';

interface Participant {
  id: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

interface LessonNotesFormProps {
  lessonId: string;
  participants: Participant[];
  isGroupLesson?: boolean;
  defaultOpen?: boolean;
}

interface NoteFormState {
  id?: string;
  studentId: string | null;
  contentCovered: string;
  homework: string;
  focusAreas: string;
  engagementRating: number | null;
  teacherPrivateNotes: string;
  parentVisible: boolean;
}

const emptyNote = (studentId: string | null = null): NoteFormState => ({
  studentId,
  contentCovered: '',
  homework: '',
  focusAreas: '',
  engagementRating: null,
  teacherPrivateNotes: '',
  parentVisible: true,
});

export function LessonNotesForm({
  lessonId,
  participants,
  isGroupLesson = false,
  defaultOpen = false,
}: LessonNotesFormProps) {
  const { data: existingNotes, isLoading } = useLessonNotes(lessonId);
  const saveMutation = useSaveLessonNote();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [perStudentMode, setPerStudentMode] = useState(false);
  const [activeStudentTab, setActiveStudentTab] = useState<string>('lesson');

  // Form state: 'lesson' key for whole-lesson, student IDs for per-student
  const [forms, setForms] = useState<Record<string, NoteFormState>>({
    lesson: emptyNote(null),
  });

  const initializedRef = useRef(false);

  // Initialize form from existing notes
  useEffect(() => {
    if (!existingNotes || initializedRef.current) return;
    if (existingNotes.length === 0) return;

    initializedRef.current = true;
    const newForms: Record<string, NoteFormState> = {};

    for (const note of existingNotes) {
      const key = note.student_id || 'lesson';
      newForms[key] = {
        id: note.id,
        studentId: note.student_id,
        contentCovered: note.content_covered || '',
        homework: note.homework || '',
        focusAreas: note.focus_areas || '',
        engagementRating: note.engagement_rating,
        teacherPrivateNotes: note.teacher_private_notes || '',
        parentVisible: note.parent_visible,
      };
    }

    // Check if there are per-student notes
    const hasPerStudentNotes = existingNotes.some(n => n.student_id !== null);
    if (hasPerStudentNotes) {
      setPerStudentMode(true);
    }

    // Ensure lesson-level form exists
    if (!newForms.lesson) {
      newForms.lesson = emptyNote(null);
    }

    // Ensure per-student forms exist for all participants
    for (const p of participants) {
      if (!newForms[p.student.id]) {
        newForms[p.student.id] = emptyNote(p.student.id);
      }
    }

    setForms(prev => ({ ...prev, ...newForms }));

    // Auto-open if there are existing notes
    if (existingNotes.length > 0) {
      setIsOpen(true);
    }
  }, [existingNotes, participants]);

  // Initialize per-student forms when toggling to per-student mode
  useEffect(() => {
    if (perStudentMode) {
      setForms(prev => {
        const next = { ...prev };
        for (const p of participants) {
          if (!next[p.student.id]) {
            next[p.student.id] = emptyNote(p.student.id);
          }
        }
        return next;
      });
    }
  }, [perStudentMode, participants]);

  const updateField = useCallback((key: string, field: keyof NoteFormState, value: any) => {
    setForms(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, []);

  const handleSave = useCallback(async (key: string) => {
    const form = forms[key];
    if (!form) return;

    // Don't save if all fields are empty
    const hasContent = form.contentCovered || form.homework || form.focusAreas ||
      form.engagementRating || form.teacherPrivateNotes;
    if (!hasContent) return;

    await saveMutation.mutateAsync({
      id: form.id,
      lesson_id: lessonId,
      student_id: form.studentId,
      content_covered: form.contentCovered || null,
      homework: form.homework || null,
      focus_areas: form.focusAreas || null,
      engagement_rating: form.engagementRating,
      teacher_private_notes: form.teacherPrivateNotes || null,
      parent_visible: form.parentVisible,
    });
  }, [forms, lessonId, saveMutation]);

  const handleSaveAll = useCallback(async () => {
    if (perStudentMode) {
      // Save lesson-level note first, then per-student
      await handleSave('lesson');
      for (const p of participants) {
        await handleSave(p.student.id);
      }
    } else {
      await handleSave('lesson');
    }
  }, [perStudentMode, participants, handleSave]);

  const hasAnyContent = Object.values(forms).some(f =>
    f.contentCovered || f.homework || f.focusAreas || f.engagementRating || f.teacherPrivateNotes
  );

  const noteCount = existingNotes?.length || 0;

  const renderNoteFields = (key: string) => {
    const form = forms[key] || emptyNote(key === 'lesson' ? null : key);

    return (
      <div className="space-y-4">
        {/* Content Covered */}
        <div className="space-y-1.5">
          <Label className="text-sm">What was covered</Label>
          <Textarea
            value={form.contentCovered}
            onChange={(e) => updateField(key, 'contentCovered', e.target.value)}
            placeholder="Scales, sight-reading, new piece introduction..."
            rows={2}
            className="min-h-[44px] resize-none"
          />
        </div>

        {/* Homework */}
        <div className="space-y-1.5">
          <Label className="text-sm">Homework / Practice tasks</Label>
          <Textarea
            value={form.homework}
            onChange={(e) => updateField(key, 'homework', e.target.value)}
            placeholder="Practice bars 1-16 of new piece, scales at 80bpm..."
            rows={2}
            className="min-h-[44px] resize-none"
          />
        </div>

        {/* Focus Areas */}
        <div className="space-y-1.5">
          <Label className="text-sm">Focus areas for next lesson</Label>
          <Textarea
            value={form.focusAreas}
            onChange={(e) => updateField(key, 'focusAreas', e.target.value)}
            placeholder="Dynamics, hand position, rhythm accuracy..."
            rows={2}
            className="min-h-[44px] resize-none"
          />
        </div>

        {/* Engagement Rating */}
        <div className="space-y-1.5">
          <Label className="text-sm">Student engagement</Label>
          <EngagementRating
            value={form.engagementRating}
            onChange={(rating) => updateField(key, 'engagementRating', rating)}
          />
        </div>

        {/* Private Notes */}
        <div className="space-y-1.5">
          <Label className="text-sm flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-muted-foreground" />
            Private notes (staff only)
          </Label>
          <Textarea
            value={form.teacherPrivateNotes}
            onChange={(e) => updateField(key, 'teacherPrivateNotes', e.target.value)}
            placeholder="Internal observations not shared with parents..."
            rows={2}
            className="min-h-[44px] resize-none"
          />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading notes...
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span>Structured Notes</span>
          {noteCount > 0 && (
            <Badge variant="secondary" className="text-micro px-1.5 py-0">
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
            </Badge>
          )}
          <ChevronDown className={cn(
            'h-4 w-4 ml-auto transition-transform duration-200',
            isOpen && 'rotate-180'
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Per-student toggle for group lessons */}
          {isGroupLesson && participants.length > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Per-student notes</span>
              </div>
              <Switch
                checked={perStudentMode}
                onCheckedChange={setPerStudentMode}
              />
            </div>
          )}

          {perStudentMode && participants.length > 1 ? (
            <Tabs value={activeStudentTab} onValueChange={setActiveStudentTab}>
              <TabsList className="w-full">
                <TabsTrigger value="lesson" className="flex-1 text-xs">
                  Whole Lesson
                </TabsTrigger>
                {participants.map((p) => (
                  <TabsTrigger
                    key={p.student.id}
                    value={p.student.id}
                    className="flex-1 text-xs"
                  >
                    {p.student.first_name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="lesson" className="mt-3">
                {renderNoteFields('lesson')}
              </TabsContent>
              {participants.map((p) => (
                <TabsContent key={p.student.id} value={p.student.id} className="mt-3">
                  {renderNoteFields(p.student.id)}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            renderNoteFields('lesson')
          )}

          <Separator />

          {/* Save button */}
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={saveMutation.isPending || !hasAnyContent}
              className="gap-2 min-h-[36px]"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Notes
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
