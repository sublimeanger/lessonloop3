import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { format, addMinutes, setHours, setMinutes, startOfDay, parseISO, addWeeks, isSameDay, eachDayOfInterval } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useNotesNotification } from '@/hooks/useNotesNotification';
import { useClosurePatternCheck } from '@/hooks/useClosurePatternCheck';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { LessonWithDetails, ConflictResult, LessonStatus, LessonType } from './types';
import { RecurringEditMode } from './RecurringEditDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface UseLessonFormProps {
  open: boolean;
  lesson?: LessonWithDetails | null;
  initialDate?: Date;
  initialEndDate?: Date;
  onSaved: () => void;
  onClose: () => void;
}

export function useLessonForm({ open, lesson, initialDate, initialEndDate, onSaved, onClose }: UseLessonFormProps) {
  const { currentOrg } = useOrg();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { teachers, locations, rooms, students } = useTeachersAndLocations();
  const { checkConflicts } = useConflictDetection();
  const { sendNotesNotification } = useNotesNotification();
  const { isOnline, guardOffline } = useOnlineStatus();

  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState('');
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
      const lessonTeacherId = lesson.teacher_id || teachers.find(t => t.userId === lesson.teacher_user_id)?.id || '';
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
        logger.warn('Conflict check hard timeout triggered');
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
          teacher_id: teacherId,
          teacher_user_id: teacherUserId,
          room_id: roomId,
          location_id: locationId,
          student_ids: selectedStudents,
          exclude_lesson_id: lesson?.id,
        });

        if (conflictCheckRef.current === thisCheckId) {
          completeCheck(results);
        }
      } catch (error) {
        logger.error('Conflict check failed:', error);
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
    if (durationMins < 15) {
      toast({ title: 'Lesson too short', description: 'Minimum lesson duration is 15 minutes.', variant: 'destructive' });
      return;
    }
    if (durationMins > 240) {
      toast({ title: 'Lesson too long', description: 'Maximum lesson duration is 4 hours.', variant: 'destructive' });
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
              setSavingProgress('Shifting future lesson times…');
              await supabase.rpc('shift_recurring_lesson_times', {
                p_recurrence_id: lesson.recurrence_id!,
                p_after_start_at: lesson.start_at,
                p_offset_ms: timeOffsetMs,
                p_new_duration_ms: newDuration,
                p_exclude_lesson_id: lesson.id,
              });
            }
          }

          setSavingProgress('Updating participants…');
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

        logAudit(currentOrg.id, user.id, 'update', 'lesson', lesson.id, {
          before: { title: lesson.title, start_at: lesson.start_at, teacher_id: lesson.teacher_id, status: lesson.status },
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

          // Build recurrence dates in org timezone to handle DST correctly
          const zonedStart = toZonedTime(startAtUtc, orgTimezone);
          const zonedEnd = recurrenceEndDate
            ? setHours(startOfDay(recurrenceEndDate), 23)
            : toZonedTime(addMinutes(startAtUtc, 90 * 24 * 60), orgTimezone);

          const allDays = eachDayOfInterval({ start: zonedStart, end: zonedEnd });
          for (const day of allDays) {
            const dayOfWeek = day.getDay();
            if (recurrenceDays.includes(dayOfWeek)) {
              // Set the same wall-clock time as the original lesson
              const lessonLocal = setMinutes(setHours(day, zonedStart.getHours()), zonedStart.getMinutes());
              const lessonUtc = fromZonedTime(lessonLocal, orgTimezone);
              if (lessonUtc.getTime() > startAtUtc.getTime()) {
                lessonsToCreate.push(lessonUtc);
              }
            }
          }
        }

        // Filter out closure dates before inserting
        let skippedCount = 0;
        if (isRecurring && lessonsToCreate.length > 1) {
          const seriesStart = format(selectedDate, 'yyyy-MM-dd');
          const seriesEnd = format(
            recurrenceEndDate || addWeeks(selectedDate, 90),
            'yyyy-MM-dd'
          );
          const { data: closureDates } = await supabase
            .from('closure_dates')
            .select('date, location_id, applies_to_all_locations')
            .eq('org_id', currentOrg.id)
            .gte('date', seriesStart)
            .lte('date', seriesEnd);

          if (closureDates && closureDates.length > 0) {
            const beforeCount = lessonsToCreate.length;
            const filtered = lessonsToCreate.filter(lessonDate => {
              const zonedDate = toZonedTime(lessonDate, orgTimezone);
              return !closureDates.some(cd => {
                const closureDate = parseISO(cd.date);
                if (!isSameDay(zonedDate, closureDate)) return false;
                return cd.applies_to_all_locations || !locationId || cd.location_id === locationId;
              });
            });
            skippedCount = beforeCount - filtered.length;
            lessonsToCreate.length = 0;
            lessonsToCreate.push(...filtered);
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
            const allParticipants = insertedLessons.flatMap(l =>
              selectedStudents.map(studentId => ({
                org_id: currentOrg.id,
                lesson_id: l.id,
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

          if (insertedLessons && insertedLessons.length > 0) {
            logAudit(currentOrg.id, user.id, 'create', 'lesson', insertedLessons[0].id, {
              after: { title, start_at: startAtUtc.toISOString(), teacher_id: teacherId, count: insertedLessons.length },
            });
          }
        } catch (batchError: any) {
          const msg = batchError.message || '';
          if (msg.includes('CONFLICT:TEACHER:')) {
            toast({ title: 'Teacher conflict', description: msg.split('CONFLICT:TEACHER:')[1], variant: 'destructive' });
          } else if (msg.includes('CONFLICT:ROOM:')) {
            toast({ title: 'Room conflict', description: msg.split('CONFLICT:ROOM:')[1], variant: 'destructive' });
          } else {
            toast({
              title: 'Error creating lessons',
              description: `${msg}. Partial creation may have occurred — please check the calendar.`,
              variant: 'destructive',
            });
          }
          throw batchError;
        }

        toast({
          title: isRecurring ? `${lessonsToCreate.length} lessons created` : 'Lesson created',
          description: skippedCount > 0 ? `${skippedCount} skipped due to closure dates` : undefined,
        });
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('CONFLICT:TEACHER:')) {
        toast({ title: 'Teacher conflict', description: msg.split('CONFLICT:TEACHER:')[1], variant: 'destructive' });
      } else if (msg.includes('CONFLICT:ROOM:')) {
        toast({ title: 'Room conflict', description: msg.split('CONFLICT:ROOM:')[1], variant: 'destructive' });
      } else {
        toast({ title: 'Error saving lesson', description: msg, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
      setSavingProgress('');
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

  return {
    // Data from hooks needed by JSX
    teachers,
    locations,
    rooms,
    students,

    // Form state
    lessonType, setLessonType,
    teacherId, setTeacherId,
    selectedStudents, setSelectedStudents,
    locationId, setLocationId,
    roomId, setRoomId,
    selectedDate, setSelectedDate,
    startTime, setStartTime,
    durationMins, setDurationMins,
    notesPrivate, setNotesPrivate,
    notesShared, setNotesShared,
    status, setStatus,
    isRecurring, setIsRecurring,
    recurrenceDays,
    recurrenceEndDate, setRecurrenceEndDate,

    // UI state
    isSaving, savingProgress,
    studentsOpen, setStudentsOpen,
    studentSheetOpen, setStudentSheetOpen,
    showRecurringDialog, setShowRecurringDialog,
    conflictState, setConflictState,

    // Derived
    filteredRooms, errors, warnings, isSaveDisabled,
    closureCheck,
    estimatedTotalLessons,

    // Handlers
    handleStudentToggle,
    handleSaveClick,
    handleRecurringModeSelect,
    handleRecurrenceDayToggle,
  };
}
