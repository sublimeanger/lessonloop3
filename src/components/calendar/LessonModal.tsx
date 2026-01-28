import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, setHours, setMinutes, startOfDay, parseISO, addWeeks } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useNotesNotification } from '@/hooks/useNotesNotification';
import { useClosurePatternCheck, formatClosureConflicts } from '@/hooks/useClosurePatternCheck';
import { supabase } from '@/integrations/supabase/client';
import { LessonWithDetails, LessonFormData, ConflictResult, LessonStatus, LessonType } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

  const [isSaving, setIsSaving] = useState(false);
  // Consolidated conflict state to prevent multiple re-renders causing layout shifts
  const [conflictState, setConflictState] = useState<{
    isChecking: boolean;
    conflicts: ConflictResult[];
  }>({ isChecking: false, conflicts: [] });
  const [studentsOpen, setStudentsOpen] = useState(false);
  
  // Recurring edit state
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [recurringEditMode, setRecurringEditMode] = useState<RecurringEditMode | null>(null);

  // Form state
  const [lessonType, setLessonType] = useState<LessonType>('private');
  const [teacherUserId, setTeacherUserId] = useState('');
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

  // Calculate total lessons for closure pattern check
  const estimatedTotalLessons = useMemo(() => {
    if (!isRecurring || recurrenceDays.length === 0) return 0;
    // Estimate based on 12 weeks if no end date
    const endDate = recurrenceEndDate || addWeeks(selectedDate, 12);
    const weeksDiff = Math.ceil((endDate.getTime() - selectedDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.ceil(weeksDiff / 1) * recurrenceDays.length);
  }, [isRecurring, recurrenceDays, recurrenceEndDate, selectedDate]);

  // Check for closure date conflicts in recurring series
  const closureCheck = useClosurePatternCheck(
    isRecurring && recurrenceDays.length > 0 ? selectedDate : null,
    1, // intervalWeeks - always 1 for now
    estimatedTotalLessons,
    locationId
  );

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;

    if (lesson) {
      const start = parseISO(lesson.start_at);
      const end = parseISO(lesson.end_at);
      setLessonType(lesson.lesson_type);
      setTeacherUserId(lesson.teacher_user_id);
      setSelectedStudents(lesson.participants?.map(p => p.student.id) || []);
      setLocationId(lesson.location_id);
      setRoomId(lesson.room_id);
      setSelectedDate(start);
      setStartTime(format(start, 'HH:mm'));
      setDurationMins(Math.round((end.getTime() - start.getTime()) / 60000));
      setNotesPrivate(lesson.notes_private || '');
      setNotesShared(lesson.notes_shared || '');
      setStatus(lesson.status);
      setIsRecurring(!!lesson.recurrence_id);
    } else {
      // New lesson
      setLessonType('private');
      setTeacherUserId(user?.id || '');
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
      }
      if (initialEndDate && initialDate) {
        const duration = Math.round((initialEndDate.getTime() - initialDate.getTime()) / 60000);
        setDurationMins(Math.max(15, Math.min(duration, 180)));
      }
    }
    setConflictState({ isChecking: false, conflicts: [] });
    setRecurringEditMode(null);
  }, [open, lesson, initialDate, initialEndDate, user?.id]);

  // Auto-select teacher if only one
  useEffect(() => {
    if (teachers.length === 1 && !teacherUserId) {
      setTeacherUserId(teachers[0].id);
    }
  }, [teachers, teacherUserId]);

  // Filter rooms by location
  const filteredRooms = useMemo(() => {
    if (!locationId) return [];
    return rooms.filter(r => r.location_id === locationId);
  }, [locationId, rooms]);

  // Check conflicts on key field changes with debounce
  useEffect(() => {
    if (!open || !teacherUserId || !selectedDate) return;

    // Increased debounce from 500ms to 800ms to reduce flicker
    const timeoutId = setTimeout(async () => {
      setConflictState(prev => ({ ...prev, isChecking: true }));
      const [hour, minute] = startTime.split(':').map(Number);
      const startAt = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
      const endAt = addMinutes(startAt, durationMins);

      const results = await checkConflicts({
        start_at: startAt,
        end_at: endAt,
        teacher_user_id: teacherUserId,
        room_id: roomId,
        location_id: locationId,
        student_ids: selectedStudents,
        exclude_lesson_id: lesson?.id,
      });

      // Single state update to prevent layout shifts
      setConflictState({ isChecking: false, conflicts: results });
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [open, teacherUserId, selectedDate, startTime, durationMins, roomId, selectedStudents, lesson?.id, checkConflicts]);

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
      
      // Auto-populate teaching defaults for new private lessons only
      if (!lesson) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          // Only populate if field is currently empty and the default exists in available options
          if (!teacherUserId && student.default_teacher_user_id) {
            const teacherExists = teachers.some(t => t.id === student.default_teacher_user_id);
            if (teacherExists) {
              setTeacherUserId(student.default_teacher_user_id);
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

  // Handle save click - check if we need to show recurring dialog first
  const handleSaveClick = () => {
    // If editing a recurring lesson and haven't chosen a mode yet, show dialog
    if (lesson?.recurrence_id && !recurringEditMode) {
      setShowRecurringDialog(true);
      return;
    }
    handleSave();
  };

  // Handle recurring edit mode selection
  const handleRecurringModeSelect = (mode: RecurringEditMode) => {
    setRecurringEditMode(mode);
    setShowRecurringDialog(false);
    // Proceed with save after mode selection
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

    // Validate
    if (!teacherUserId) {
      toast({ title: 'Please select a teacher', variant: 'destructive' });
      return;
    }
    if (selectedStudents.length === 0) {
      toast({ title: 'Please select at least one student', variant: 'destructive' });
      return;
    }

    // Check for blocking conflicts
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
      const startAt = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
      const endAt = addMinutes(startAt, durationMins);

      if (lesson) {
        // Determine which lessons to update based on edit mode
        let lessonIdsToUpdate: string[] = [lesson.id];
        
        if (editMode === 'this_and_future' && lesson.recurrence_id) {
          // Get all future lessons in the same series
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

        // Calculate time offset for future lessons (preserving relative time of day)
        const originalStart = parseISO(lesson.start_at);
        const originalHour = originalStart.getHours();
        const originalMinute = originalStart.getMinutes();
        const [newHour, newMinute] = startTime.split(':').map(Number);
        const timeOffsetMs = ((newHour - originalHour) * 60 + (newMinute - originalMinute)) * 60 * 1000;
        const originalDuration = parseISO(lesson.end_at).getTime() - originalStart.getTime();
        const newDuration = durationMins * 60 * 1000;
        const durationDiff = newDuration - originalDuration;

        // Update each lesson
        for (let i = 0; i < lessonIdsToUpdate.length; i++) {
          const lessonId = lessonIdsToUpdate[i];
          
          if (editMode === 'this_and_future' && i > 0) {
            // For future lessons, only update non-time fields and adjust time relatively
            // First get the current lesson data
            const { data: currentLesson } = await supabase
              .from('lessons')
              .select('start_at, end_at')
              .eq('id', lessonId)
              .single();
            
            if (currentLesson) {
              const currentStart = parseISO(currentLesson.start_at);
              const newStart = new Date(currentStart.getTime() + timeOffsetMs);
              const newEnd = new Date(newStart.getTime() + durationMins * 60 * 1000);
              
              await supabase
                .from('lessons')
                .update({
                  lesson_type: lessonType,
                  teacher_user_id: teacherUserId,
                  location_id: locationId,
                  room_id: roomId,
                  start_at: newStart.toISOString(),
                  end_at: newEnd.toISOString(),
                  title: generateTitle(),
                  // Keep individual notes for future lessons
                })
                .eq('id', lessonId);
            }
          } else {
            // For the current lesson (or single edit), update everything
            const { error } = await supabase
              .from('lessons')
              .update({
                lesson_type: lessonType,
                teacher_user_id: teacherUserId,
                location_id: locationId,
                room_id: roomId,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                title: generateTitle(),
                notes_private: notesPrivate || null,
                notes_shared: notesShared || null,
                status,
                // Detach from series if editing this only
                recurrence_id: editMode === 'this_only' ? null : lesson.recurrence_id,
              })
              .eq('id', lessonId);

            if (error) throw error;
          }

          // Update participants for each lesson
          await supabase.from('lesson_participants').delete().eq('lesson_id', lessonId);
          
          if (selectedStudents.length > 0) {
            await supabase.from('lesson_participants').insert(
              selectedStudents.map(studentId => ({
                org_id: currentOrg.id,
                lesson_id: lessonId,
                student_id: studentId,
              }))
            );
          }
        }

        // Send notification if shared notes were added or changed (only for the main lesson)
        const notesChanged = notesShared && notesShared !== (lesson.notes_shared || '');
        if (notesChanged && currentOrg) {
          const teacherProfile = teachers.find(t => t.id === teacherUserId);
          sendNotesNotification({
            lessonId: lesson.id,
            notesShared,
            lessonTitle: generateTitle(),
            lessonDate: format(startAt, 'EEEE, d MMMM yyyy \'at\' HH:mm'),
            teacherName: teacherProfile?.name || profile?.full_name || 'Your teacher',
            orgName: currentOrg.name,
            orgId: currentOrg.id,
          });
        }

        const updatedCount = lessonIdsToUpdate.length;
        toast({ 
          title: updatedCount > 1 
            ? `${updatedCount} lessons updated` 
            : 'Lesson updated' 
        });
      } else {
        // Create new lesson(s)
        const lessonsToCreate: Date[] = [startAt];

        if (isRecurring && recurrenceDays.length > 0) {
          // Create recurrence rule
          const { data: recurrence, error: recError } = await supabase
            .from('recurrence_rules')
            .insert({
              org_id: currentOrg.id,
              pattern_type: 'weekly',
              days_of_week: recurrenceDays,
              interval_weeks: 1,
              start_date: format(selectedDate, 'yyyy-MM-dd'),
              end_date: recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : null,
              timezone: currentOrg.timezone || 'Europe/London',
            })
            .select()
            .single();

          if (recError) throw recError;

          // Generate lesson dates for the next weeks
          // This is simplified - a real implementation would be more sophisticated
          const endDate = recurrenceEndDate || addMinutes(startAt, 90 * 24 * 60); // 90 days default
          let currentDate = new Date(startAt);
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (recurrenceDays.includes(dayOfWeek) && currentDate > startAt) {
              const lessonDate = setMinutes(setHours(startOfDay(currentDate), hour), minute);
              lessonsToCreate.push(lessonDate);
            }
            currentDate = addMinutes(currentDate, 24 * 60);
          }
        }

        // Create all lessons
        for (const lessonDate of lessonsToCreate) {
          const lessonEndAt = addMinutes(lessonDate, durationMins);
          
          const { data: newLesson, error } = await supabase
            .from('lessons')
            .insert({
              org_id: currentOrg.id,
              lesson_type: lessonType,
              teacher_user_id: teacherUserId,
              location_id: locationId,
              room_id: roomId,
              start_at: lessonDate.toISOString(),
              end_at: lessonEndAt.toISOString(),
              title: generateTitle(),
              notes_private: notesPrivate || null,
              notes_shared: notesShared || null,
              status: 'scheduled',
              created_by: user.id,
            })
            .select()
            .single();

          if (error) throw error;

          // Add participants
          if (newLesson && selectedStudents.length > 0) {
            await supabase.from('lesson_participants').insert(
              selectedStudents.map(studentId => ({
                org_id: currentOrg.id,
                lesson_id: newLesson.id,
                student_id: studentId,
              }))
            );

            // Send notification if shared notes were added (only for first lesson to avoid spam)
            if (notesShared && lessonDate === lessonsToCreate[0]) {
              const teacherProfile = teachers.find(t => t.id === teacherUserId);
              sendNotesNotification({
                lessonId: newLesson.id,
                notesShared,
                lessonTitle: generateTitle(),
                lessonDate: format(lessonDate, 'EEEE, d MMMM yyyy \'at\' HH:mm'),
                teacherName: teacherProfile?.name || profile?.full_name || 'Your teacher',
                orgName: currentOrg.name,
                orgId: currentOrg.id,
              });
            }
          }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lesson Type */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={lessonType === 'private' ? 'default' : 'outline'}
              className="flex-1"
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
              className="flex-1"
              onClick={() => setLessonType('group')}
            >
              Group Lesson
            </Button>
          </div>

          {/* Teacher */}
          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherUserId} onValueChange={setTeacherUserId}>
              <SelectTrigger>
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
            <Popover open={studentsOpen} onOpenChange={setStudentsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                <Command>
                  <CommandInput placeholder="Search students..." />
                  <CommandList>
                    <CommandEmpty>No students found.</CommandEmpty>
                    <CommandGroup>
                      {students.map((student) => (
                        <CommandItem
                          key={student.id}
                          onSelect={() => handleStudentToggle(student.id)}
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
              </PopoverContent>
            </Popover>
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'dd MMM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {/* Location & Room */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId || 'none'} onValueChange={(v) => { setLocationId(v === 'none' ? null : v); setRoomId(null); }}>
                <SelectTrigger>
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
                <SelectTrigger>
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
              <div className="flex items-center justify-between">
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
                    <div className="flex gap-1">
                      {DAY_NAMES.map((day, i) => (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={recurrenceDays.includes(i) ? 'default' : 'outline'}
                          className="w-10 h-8 text-xs"
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
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrenceEndDate ? format(recurrenceEndDate, 'dd MMM yyyy') : 'No end date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
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

                  {/* Closure pattern warnings */}
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
            />
          </div>

          <div className="space-y-2">
            <Label>Private notes (visible to staff only)</Label>
            <Textarea
              value={notesPrivate}
              onChange={(e) => setNotesPrivate(e.target.value)}
              placeholder="Add internal notes about this lesson..."
              rows={2}
            />
          </div>

          {/* Status (edit mode only) */}
          {lesson && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
                <SelectTrigger>
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

          {/* Conflict alerts - fixed min-height to prevent layout shifts */}
          <div className="min-h-[60px]">
            {conflictState.isChecking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking for conflicts...
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveClick} disabled={isSaving || errors.length > 0}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {lesson ? 'Save Changes' : 'Create Lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Recurring Edit Choice Dialog */}
      <RecurringEditDialog
        open={showRecurringDialog}
        onClose={() => setShowRecurringDialog(false)}
        onSelect={handleRecurringModeSelect}
      />
    </Dialog>
  );
}
