import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, addMinutes, setHours, setMinutes, startOfDay, parseISO, addWeeks } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useNotesNotification } from '@/hooks/useNotesNotification';
import { useClosurePatternCheck, formatClosureConflicts } from '@/hooks/useClosurePatternCheck';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { LessonWithDetails, LessonFormData, ConflictResult, LessonStatus, LessonType } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Check, Loader2, AlertCircle, AlertTriangle, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { RecurringEditDialog, RecurringEditMode } from './RecurringEditDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface LessonModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lesson?: LessonWithDetails | null;
  initialDate?: Date;
  initialEndDate?: Date;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const TIME_OPTIONS = Array.from({ length: 56 }, (_, i) => {
  const hour = Math.floor(i / 4) + 7;
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function LessonModal({ open, onClose, onSaved, lesson, initialDate, initialEndDate }: LessonModalProps) {
  const { currentOrg } = useOrg();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { teachers, locations, rooms, students } = useTeachersAndLocations();
  const { checkConflicts } = useConflictDetection();
  const { sendNotesNotification } = useNotesNotification();
  const isMobile = useIsMobile();
  const { isOnline, guardOffline } = useOnlineStatus();

  const [isSaving, setIsSaving] = useState(false);
  const [conflictState, setConflictState] = useState<{
    isChecking: boolean;
    conflicts: ConflictResult[];
  }>({ isChecking: false, conflicts: [] });
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [studentSheetOpen, setStudentSheetOpen] = useState(false);
  
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [recurringEditMode, setRecurringEditMode] = useState<RecurringEditMode | null>(null);

  const [lessonType, setLessonType] = useState<LessonType>('private');
  const [teacherId, setTeacherId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [durationMins, setDurationMins] = useState(60);
  const [notesPrivate, setNotesPrivate] = useState('');
  const [notesShared, setNotesShared] = useState('');
  const [status, setStatus] = useState<LessonStatus>('scheduled');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);

  const conflictCheckRef = useRef<number>(0);
  const lastCheckKeyRef = useRef<string>('');
  const checkConflictsRef = useRef(checkConflicts);
  checkConflictsRef.current = checkConflicts;
  const studentSelectorRef = useRef<HTMLButtonElement>(null);

  const orgTimezone = currentOrg?.timezone || 'Europe/London';

  const estimatedTotalLessons = useMemo(() => {
    if (!isRecurring || recurrenceDays.length === 0) return 0;
    const endDate = recurrenceEndDate || addWeeks(selectedDate, 12);
    const weeksDiff = Math.ceil((endDate.getTime() - selectedDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.ceil(weeksDiff / 1) * recurrenceDays.length);
  }, [isRecurring, recurrenceDays, recurrenceEndDate, selectedDate]);

  const closureCheck = useClosurePatternCheck(
    isRecurring && recurrenceDays.length > 0 ? selectedDate : null,
    1,
    estimatedTotalLessons,
    locationId
  );

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;

    if (lesson) {
      const start = parseISO(lesson.start_at);
      const end = parseISO(lesson.end_at);
      const zonedStart = toZonedTime(start, orgTimezone);
      setLessonType(lesson.lesson_type);
      const lessonTeacherId = (lesson as any).teacher_id || teachers.find(t => t.userId === lesson.teacher_user_id)?.id || '';
      setTeacherId(lessonTeacherId);
      setSelectedStudents(lesson.participants?.map(p => p.student.id) || []);
      setLocationId(lesson.location_id);
      setRoomId(lesson.room_id);
      setSelectedDate(zonedStart);
      setStartTime(format(zonedStart, 'HH:mm'));
      setDurationMins(Math.round((end.getTime() - start.getTime()) / 60000));
      setNotesPrivate(lesson.notes_private || '');
      setNotesShared(lesson.notes_shared || '');
      setStatus(lesson.status);
      setIsRecurring(!!lesson.recurrence_id);
    } else {
      setLessonType('private');
      const currentUserTeacher = teachers.find(t => t.userId === user?.id);
      setTeacherId(currentUserTeacher?.id || teachers[0]?.id || '');
      setSelectedStudents([]);
      setLocationId(null);
      setRoomId(null);
      setNotesPrivate('');
      setNotesShared('');
      setStatus('scheduled');
      setIsRecurring(false);
      setRecurrenceDays([]);
      setRecurrenceEndDate(null);

      if (initialDate) {
        setSelectedDate(initialDate);
        setStartTime(format(initialDate, 'HH:mm'));
        setDurationMins(currentOrg?.default_lesson_length_mins || 60);
      } else {
        setDurationMins(currentOrg?.default_lesson_length_mins || 60);
      }
      
      if (initialEndDate && initialDate) {
        const duration = Math.round((initialEndDate.getTime() - initialDate.getTime()) / 60000);
        setDurationMins(Math.max(15, Math.min(duration, 180)));
      }
    }
    setConflictState({ isChecking: false, conflicts: [] });
    setRecurringEditMode(null);
    conflictCheckRef.current = 0;
    lastCheckKeyRef.current = '';

    // Auto-focus the student selector after modal renders
    requestAnimationFrame(() => {
      studentSelectorRef.current?.focus();
    });
  }, [open, lesson, initialDate, initialEndDate, user?.id, orgTimezone, currentOrg?.default_lesson_length_mins]);

  useEffect(() => {
    if (teachers.length === 1 && !teacherId) {
      setTeacherId(teachers[0].id);
    }
  }, [teachers, teacherId]);

  const filteredRooms = useMemo(() => {
    if (!locationId) return [];
    return rooms.filter(r => r.location_id === locationId);
  }, [locationId, rooms]);

  const conflictCheckKey = useMemo(() => {
    if (!open || !teacherId || !selectedDate) return null;
    const sortedStudents = [...selectedStudents].sort().join(',');
    return `${teacherId}-${format(selectedDate, 'yyyy-MM-dd')}-${startTime}-${durationMins}-${roomId || 'none'}-${locationId || 'none'}-${sortedStudents}-${lesson?.id || 'new'}`;
  }, [open, teacherId, selectedDate, startTime, durationMins, roomId, locationId, selectedStudents, lesson?.id]);

  const teachersRef = useRef(teachers);
  teachersRef.current = teachers;

  useEffect(() => {
    if (!conflictCheckKey) {
      setConflictState(prev =>
        prev.isChecking || prev.conflicts.length > 0
          ? { isChecking: false, conflicts: [] }
          : prev
      );
      lastCheckKeyRef.current = '';
      return;
    }

    if (conflictCheckKey === lastCheckKeyRef.current) {
      return;
    }

    lastCheckKeyRef.current = conflictCheckKey;
    const thisCheckId = ++conflictCheckRef.current;
    let completed = false;
    
    const completeCheck = (conflicts: ConflictResult[]) => {
      if (completed) return;
      completed = true;
      setConflictState({ isChecking: false, conflicts });
    };
    
    setConflictState({ isChecking: true, conflicts: [] });
    
    const hardTimeout = setTimeout(() => {
      if (!completed) {
        console.warn('Conflict check hard timeout triggered');
        completeCheck([{
          type: 'teacher',
          severity: 'warning',
          message: 'Conflict check timed out. Please verify manually.',
        }]);
      }
    }, 4000);
    
    const debounceTimer = setTimeout(async () => {
      if (completed) return;
      
      try {
        const [hour, minute] = startTime.split(':').map(Number);
        const localDateTime = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
        const startAtUtc = fromZonedTime(localDateTime, orgTimezone);
        const endAtUtc = addMinutes(startAtUtc, durationMins);

        const selectedTeacher = teachersRef.current.find(t => t.id === teacherId);
        const teacherUserId = selectedTeacher?.userId || null;

        const results = await checkConflictsRef.current({
          start_at: startAtUtc,
          end_at: endAtUtc,
          teacher_user_id: teacherUserId,
          teacher_id: teacherId,
          room_id: roomId,
          location_id: locationId,
          student_ids: selectedStudents,
          exclude_lesson_id: lesson?.id,
        });

        if (conflictCheckRef.current === thisCheckId) {
          completeCheck(results);
        }
      } catch (error) {
        console.error('Conflict check failed:', error);
        if (conflictCheckRef.current === thisCheckId) {
          completeCheck([{
            type: 'teacher',
            severity: 'warning',
            message: 'Unable to check conflicts. Please verify manually.',
          }]);
        }
      }
    }, 300);

    return () => {
      completed = true;
      clearTimeout(debounceTimer);
      clearTimeout(hardTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflictCheckKey]);

  const generateTitle = () => {
    if (selectedStudents.length === 0) return 'New Lesson';
    
    const studentNames = selectedStudents
      .map(id => students.find(s => s.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    
    if (selectedStudents.length > 2) {
      return `${lessonType === 'group' ? 'Group' : 'Lesson'} – ${studentNames} +${selectedStudents.length - 2}`;
    }
    return `${lessonType === 'group' ? 'Group lesson' : 'Lesson'} – ${studentNames}`;
  };

  const handleStudentToggle = (studentId: string) => {
    if (lessonType === 'private') {
      setSelectedStudents([studentId]);
      setStudentsOpen(false);
      setStudentSheetOpen(false);
      
      if (!lesson) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          if (!teacherId && student.default_teacher_id) {
            const teacherExists = teachers.some(t => t.id === student.default_teacher_id);
            if (teacherExists) {
              setTeacherId(student.default_teacher_id);
            }
          }
          if (!locationId && student.default_location_id) {
            const locationExists = locations.some(l => l.id === student.default_location_id);
            if (locationExists) {
              setLocationId(student.default_location_id);
            }
          }
        }
      }
    } else {
      setSelectedStudents(prev => 
        prev.includes(studentId)
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    }
  };

  const handleSaveClick = () => {
    if (guardOffline()) return;
    if (lesson?.recurrence_id && !recurringEditMode) {
      setShowRecurringDialog(true);
      return;
    }
    handleSave();
  };

  const handleRecurringModeSelect = (mode: RecurringEditMode) => {
    setRecurringEditMode(mode);
    setShowRecurringDialog(false);
    handleSaveWithMode(mode);
  };

  const handleSave = async () => {
    if (lesson?.recurrence_id && recurringEditMode) {
      handleSaveWithMode(recurringEditMode);
    } else {
      handleSaveWithMode(null);
    }
  };

  const handleSaveWithMode = async (editMode: RecurringEditMode | null) => {
    if (!currentOrg || !user) return;

    if (!teacherId) {
      toast({ title: 'Please select a teacher', variant: 'destructive' });
      return;
    }
    if (selectedStudents.length === 0) {
      toast({ title: 'Please select at least one student', variant: 'destructive' });
      return;
    }

    const selectedTeacher = teachers.find(t => t.id === teacherId);
    const teacherUserId = selectedTeacher?.userId || null;

    const blockingConflicts = conflictState.conflicts.filter(c => c.severity === 'error');
    if (blockingConflicts.length > 0) {
      toast({ 
        title: 'Cannot save due to conflicts', 
        description: blockingConflicts[0].message,
        variant: 'destructive' 
      });
      return;
    }

    setIsSaving(true);

    try {
      const [hour, minute] = startTime.split(':').map(Number);
      const localDateTime = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
      const startAtUtc = fromZonedTime(localDateTime, orgTimezone);
      const endAtUtc = addMinutes(startAtUtc, durationMins);

      if (lesson) {
        let lessonIdsToUpdate: string[] = [lesson.id];
        
        if (editMode === 'this_and_future' && lesson.recurrence_id) {
          const { data: futureLessons } = await supabase
            .from('lessons')
            .select('id, start_at')
            .eq('recurrence_id', lesson.recurrence_id)
            .gte('start_at', lesson.start_at)
            .order('start_at', { ascending: true });
          
          if (futureLessons) {
            lessonIdsToUpdate = futureLessons.map(l => l.id);
          }
        }

        const originalStart = parseISO(lesson.start_at);
        const originalHour = originalStart.getHours();
        const originalMinute = originalStart.getMinutes();
        const [newHour, newMinute] = startTime.split(':').map(Number);
        const timeOffsetMs = ((newHour - originalHour) * 60 + (newMinute - originalMinute)) * 60 * 1000;
        const originalDuration = parseISO(lesson.end_at).getTime() - originalStart.getTime();
        const newDuration = durationMins * 60 * 1000;

        const title = generateTitle();

        try {
          const { error: firstError } = await supabase
            .from('lessons')
            .update({
              lesson_type: lessonType,
              teacher_user_id: teacherUserId,
              teacher_id: teacherId,
              location_id: locationId,
              room_id: roomId,
              start_at: startAtUtc.toISOString(),
              end_at: endAtUtc.toISOString(),
              title,
              notes_private: notesPrivate || null,
              notes_shared: notesShared || null,
              status,
              recurrence_id: editMode === 'this_only' ? null : lesson.recurrence_id,
            })
            .eq('id', lesson.id);

          if (firstError) throw firstError;

          const futureIds = lessonIdsToUpdate.filter(id => id !== lesson.id);

          if (futureIds.length > 0 && editMode === 'this_and_future') {
            const { error: batchError } = await supabase
              .from('lessons')
              .update({
                lesson_type: lessonType,
                teacher_user_id: teacherUserId,
                teacher_id: teacherId,
                location_id: locationId,
                room_id: roomId,
                title,
              })
              .eq('recurrence_id', lesson.recurrence_id)
              .gt('start_at', lesson.start_at);

            if (batchError) throw batchError;

            if (timeOffsetMs !== 0 || originalDuration !== newDuration) {
              const { data: futureTimes } = await supabase
                .from('lessons')
                .select('id, start_at')
                .in('id', futureIds);

              if (futureTimes && futureTimes.length > 0) {
                await Promise.all(futureTimes.map(fl => {
                  const shiftedStart = new Date(parseISO(fl.start_at).getTime() + timeOffsetMs);
                  const shiftedEnd = new Date(shiftedStart.getTime() + newDuration);
                  return supabase
                    .from('lessons')
                    .update({
                      start_at: shiftedStart.toISOString(),
                      end_at: shiftedEnd.toISOString(),
                    })
                    .eq('id', fl.id);
                }));
              }
            }
          }

          await supabase
            .from('lesson_participants')
            .delete()
            .in('lesson_id', lessonIdsToUpdate);

          if (selectedStudents.length > 0) {
            const allParticipants = lessonIdsToUpdate.flatMap(lessonId =>
              selectedStudents.map(studentId => ({
                org_id: currentOrg.id,
                lesson_id: lessonId,
                student_id: studentId,
              }))
            );

            const { error: partError } = await supabase
              .from('lesson_participants')
              .insert(allParticipants);

            if (partError) throw partError;
          }
        } catch (batchError: any) {
          toast({
            title: 'Error updating lessons',
            description: `${batchError.message}. Partial updates may have occurred — please check the calendar.`,
            variant: 'destructive',
          });
          throw batchError;
        }

        const notesChanged = notesShared && notesShared !== (lesson.notes_shared || '');
        if (notesChanged && currentOrg) {
          const zonedStart = toZonedTime(startAtUtc, orgTimezone);
          sendNotesNotification({
            lessonId: lesson.id,
            notesShared,
            lessonTitle: generateTitle(),
            lessonDate: format(zonedStart, 'EEEE, d MMMM yyyy \'at\' HH:mm'),
            teacherName: selectedTeacher?.name || profile?.full_name || 'Your teacher',
            orgName: currentOrg.name,
            orgId: currentOrg.id,
          });
        }

        const updatedCount = lessonIdsToUpdate.length;

        // Fire-and-forget audit log for update
        logAudit(currentOrg.id, user.id, 'update', 'lesson', lesson.id, {
          before: { title: lesson.title, start_at: lesson.start_at, teacher_id: (lesson as any).teacher_id, status: lesson.status },
          after: { title: generateTitle(), start_at: startAtUtc.toISOString(), teacher_id: teacherId, status },
        });

        toast({
          title: updatedCount > 1 
            ? `${updatedCount} lessons updated` 
            : 'Lesson updated' 
        });
      } else {
        const lessonsToCreate: Date[] = [startAtUtc];
        let recurrenceId: string | null = null;

        if (isRecurring && recurrenceDays.length > 0) {
          const { data: recurrence, error: recError } = await supabase
            .from('recurrence_rules')
            .insert({
              org_id: currentOrg.id,
              pattern_type: 'weekly',
              days_of_week: recurrenceDays,
              interval_weeks: 1,
              start_date: format(selectedDate, 'yyyy-MM-dd'),
              end_date: recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : null,
              timezone: orgTimezone,
            })
            .select()
            .single();

          if (recError) throw recError;
          recurrenceId = recurrence.id;

          const endDate = recurrenceEndDate 
            ? fromZonedTime(
                setHours(startOfDay(recurrenceEndDate), 23),
                orgTimezone
              )
            : addMinutes(startAtUtc, 90 * 24 * 60);
          let currentDate = new Date(startAtUtc);
          
          while (currentDate <= endDate) {
            const zonedDate = toZonedTime(currentDate, orgTimezone);
            const dayOfWeek = zonedDate.getDay();
            if (recurrenceDays.includes(dayOfWeek) && currentDate.getTime() > startAtUtc.getTime()) {
              lessonsToCreate.push(new Date(currentDate));
            }
            currentDate = addMinutes(currentDate, 24 * 60);
          }
        }

        const MAX_RECURRING = 200;
        if (lessonsToCreate.length > MAX_RECURRING) {
          toast({
            title: 'Series capped',
            description: `Maximum of ${MAX_RECURRING} recurring lessons allowed. Only the first ${MAX_RECURRING} will be created.`,
            variant: 'destructive',
          });
          lessonsToCreate.splice(MAX_RECURRING);
        }

        const title = generateTitle();

        const allLessonRows = lessonsToCreate.map(lessonDate => ({
          org_id: currentOrg.id,
          lesson_type: lessonType,
          teacher_user_id: teacherUserId,
          teacher_id: teacherId,
          location_id: locationId,
          room_id: roomId,
          start_at: lessonDate.toISOString(),
          end_at: addMinutes(lessonDate, durationMins).toISOString(),
          title,
          notes_private: notesPrivate || null,
          notes_shared: notesShared || null,
          status: 'scheduled' as const,
          created_by: user.id,
          recurrence_id: recurrenceId,
        }));

        try {
          const { data: insertedLessons, error: lessonError } = await supabase
            .from('lessons')
            .insert(allLessonRows)
            .select('id, start_at');

          if (lessonError) throw lessonError;

          if (insertedLessons && selectedStudents.length > 0) {
            const allParticipants = insertedLessons.flatMap(lesson =>
              selectedStudents.map(studentId => ({
                org_id: currentOrg.id,
                lesson_id: lesson.id,
                student_id: studentId,
              }))
            );

            const { error: partError } = await supabase
              .from('lesson_participants')
              .insert(allParticipants);

            if (partError) throw partError;

            if (notesShared && insertedLessons.length > 0) {
              const firstLesson = insertedLessons[0];
              const zonedLessonDate = toZonedTime(new Date(firstLesson.start_at), orgTimezone);
              sendNotesNotification({
                lessonId: firstLesson.id,
                notesShared,
                lessonTitle: title,
                lessonDate: format(zonedLessonDate, 'EEEE, d MMMM yyyy \'at\' HH:mm'),
                teacherName: selectedTeacher?.name || profile?.full_name || 'Your teacher',
                orgName: currentOrg.name,
                orgId: currentOrg.id,
              });
            }
          }

          // Fire-and-forget audit log for create
          if (insertedLessons && insertedLessons.length > 0) {
            logAudit(currentOrg.id, user.id, 'create', 'lesson', insertedLessons[0].id, {
              after: { title, start_at: startAtUtc.toISOString(), teacher_id: teacherId, count: insertedLessons.length },
            });
          }
        } catch (batchError: any) {
          toast({
            title: 'Error creating lessons',
            description: `${batchError.message}. Partial creation may have occurred — please check the calendar.`,
            variant: 'destructive',
          });
          throw batchError;
        }

        toast({ 
          title: isRecurring ? `${lessonsToCreate.length} lessons created` : 'Lesson created' 
        });
      }

      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error saving lesson', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecurrenceDayToggle = (day: number) => {
    setRecurrenceDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const errors = conflictState.conflicts.filter(c => c.severity === 'error');
  const warnings = conflictState.conflicts.filter(c => c.severity === 'warning');
  const isSaveDisabled = isSaving || conflictState.isChecking || errors.length > 0 || !isOnline;

  // ─── Student selector content (shared between mobile sheet & desktop popover) ───
  const studentSelectorContent = (
    <Command>
      <CommandInput placeholder="Search students..." className="min-h-[44px]" />
      <CommandList className={isMobile ? "max-h-[60vh]" : ""}>
        <CommandEmpty>No students found.</CommandEmpty>
        <CommandGroup>
          {students.map((student) => (
            <CommandItem
              key={student.id}
              onSelect={() => handleStudentToggle(student.id)}
              className="min-h-[44px]"
            >
              <Checkbox
                checked={selectedStudents.includes(student.id)}
                className="mr-2"
              />
              {student.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  // ─── Duration selector: chips on mobile, dropdown on desktop ───
  const durationSelector = isMobile ? (
    <div className="space-y-2">
      <Label>Duration</Label>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {DURATION_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDurationMins(d)}
            className={cn(
              "shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium border transition-colors",
              durationMins === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent"
            )}
          >
            {d} min
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="space-y-2">
      <Label>Duration</Label>
      <Select value={durationMins.toString()} onValueChange={(v) => setDurationMins(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATION_OPTIONS.map((d) => (
            <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ─── Form body (shared between Dialog & Drawer) ───
  const formBody = (
    <div className="space-y-4 py-4">
      {/* Lesson Type */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={lessonType === 'private' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => {
            setLessonType('private');
            if (selectedStudents.length > 1) {
              setSelectedStudents([selectedStudents[0]]);
            }
          }}
        >
          Private Lesson
        </Button>
        <Button
          type="button"
          variant={lessonType === 'group' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => setLessonType('group')}
        >
          Group Lesson
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Teacher</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students */}
      <div className="space-y-2">
        <Label>Student{lessonType === 'group' ? 's' : ''}</Label>
        {isMobile ? (
          <>
            <Button
              ref={studentSelectorRef}
              variant="outline"
              className="w-full justify-start text-left font-normal min-h-[44px]"
              onClick={() => setStudentSheetOpen(true)}
            >
              {selectedStudents.length === 0 ? (
                <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
              ) : (
                <span className="truncate">
                  {selectedStudents.map(id => students.find(s => s.id === id)?.name).join(', ')}
                </span>
              )}
            </Button>
            <Sheet open={studentSheetOpen} onOpenChange={setStudentSheetOpen}>
              <SheetContent side="bottom" className="h-[85vh] p-0" hideCloseButton>
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Select Student{lessonType === 'group' ? 's' : ''}</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  {studentSelectorContent}
                </div>
                {lessonType === 'group' && (
                  <div className="p-4 border-t">
                    <Button className="w-full min-h-[44px]" onClick={() => setStudentSheetOpen(false)}>
                      Done ({selectedStudents.length} selected)
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={studentsOpen} onOpenChange={setStudentsOpen}>
            <PopoverTrigger asChild>
              <Button ref={studentSelectorRef} variant="outline" className="w-full justify-start text-left font-normal">
                {selectedStudents.length === 0 ? (
                  <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
                ) : (
                  <span className="truncate">
                    {selectedStudents.map(id => students.find(s => s.id === id)?.name).join(', ')}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              {studentSelectorContent}
            </PopoverContent>
          </Popover>
        )}
        {selectedStudents.length > 0 && lessonType === 'group' && (
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedStudents.map(id => {
              const student = students.find(s => s.id === id);
              return (
                <Badge key={id} variant="secondary" className="gap-1">
                  {student?.name}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setSelectedStudents(prev => prev.filter(s => s !== id))}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Date & Time */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "top" : "bottom"}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {durationSelector}
      </div>

      {/* Location & Room */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select value={locationId || 'none'} onValueChange={(v) => { setLocationId(v === 'none' ? null : v); setRoomId(null); }}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Room</Label>
          <Select 
            value={roomId || 'none'} 
            onValueChange={(v) => setRoomId(v === 'none' ? null : v)}
            disabled={!locationId}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={locationId ? "Select room" : "Select location first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No room</SelectItem>
              {filteredRooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recurrence */}
      {!lesson && (
        <div className="space-y-3">
          <div className="flex items-center justify-between min-h-[44px]">
            <Label htmlFor="recurring">Recurring lesson</Label>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>
          
          {isRecurring && (
            <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
              <div className="space-y-2">
                <Label className="text-sm">Repeat on</Label>
                <div className="flex gap-1 flex-wrap">
                  {DAY_NAMES.map((day, i) => (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={recurrenceDays.includes(i) ? 'default' : 'outline'}
                      className="w-10 h-10 text-xs"
                      onClick={() => handleRecurrenceDayToggle(i)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">End date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEndDate ? format(recurrenceEndDate, 'dd MMM yyyy') : 'No end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "top" : "bottom"}>
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate || undefined}
                      onSelect={(date) => setRecurrenceEndDate(date || null)}
                      disabled={(date) => date < selectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {closureCheck.hasConflicts && (
                <Alert className="border-secondary bg-secondary/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">{closureCheck.warningMessage}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      These lessons will be skipped automatically.
                    </p>
                    {closureCheck.conflicts.length <= 5 && (
                      <ul className="text-xs mt-2 space-y-0.5 text-muted-foreground">
                        {closureCheck.conflicts.map((c, i) => (
                          <li key={i}>
                            • {format(c.date, 'EEE, d MMM')}: {c.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label>Shared notes (visible to parents)</Label>
        <Textarea
          value={notesShared}
          onChange={(e) => setNotesShared(e.target.value)}
          placeholder="Add lesson notes that parents can see..."
          rows={2}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Private notes (visible to staff only)</Label>
        <Textarea
          value={notesPrivate}
          onChange={(e) => setNotesPrivate(e.target.value)}
          placeholder="Add internal notes about this lesson..."
          rows={2}
          className="min-h-[44px]"
        />
      </div>

      {/* Status (edit mode only) */}
      {lesson && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Conflict alerts */}
      <div className="min-h-[60px]">
        {conflictState.isChecking && (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for conflicts...
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setConflictState({ 
                isChecking: false, 
                conflicts: [{
                  type: 'teacher',
                  severity: 'warning',
                  message: 'Conflict check skipped. Please verify manually.',
                }]
              })}
            >
              Skip
            </Button>
          </div>
        )}
        
        {!conflictState.isChecking && errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        
        {!conflictState.isChecking && warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {warnings.map((w, i) => (
                <div key={i}>{w.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );

  // ─── Footer buttons (shared) ───
  const footerButtons = (
    <>
      <Button variant="outline" onClick={onClose} className="min-h-[44px]">Cancel</Button>
      <Button onClick={handleSaveClick} disabled={isSaveDisabled} className="min-h-[44px]">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {conflictState.isChecking ? 'Checking...' : (lesson ? 'Save Changes' : 'Create Lesson')}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader>
              <DrawerTitle>{lesson ? 'Edit Lesson' : 'New Lesson'}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 flex-1">
              {formBody}
            </div>
            <DrawerFooter className="sticky bottom-0 bg-background border-t pt-3 pb-safe flex-row gap-2">
              {footerButtons}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <RecurringEditDialog
          open={showRecurringDialog}
          onClose={() => setShowRecurringDialog(false)}
          onSelect={handleRecurringModeSelect}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
        </DialogHeader>

        {formBody}

        <DialogFooter>
          {footerButtons}
        </DialogFooter>
      </DialogContent>

      <RecurringEditDialog
        open={showRecurringDialog}
        onClose={() => setShowRecurringDialog(false)}
        onSelect={handleRecurringModeSelect}
      />
    </Dialog>
  );
}
