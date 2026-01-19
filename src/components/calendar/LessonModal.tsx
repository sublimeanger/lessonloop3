import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, setHours, setMinutes, startOfDay, parseISO } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useConflictDetection } from '@/hooks/useConflictDetection';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { teachers, locations, rooms, students } = useTeachersAndLocations();
  const { checkConflicts } = useConflictDetection();

  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [studentsOpen, setStudentsOpen] = useState(false);

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
  const [status, setStatus] = useState<LessonStatus>('scheduled');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);

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
    setConflicts([]);
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

  // Check conflicts on key field changes
  useEffect(() => {
    if (!open || !teacherUserId || !selectedDate) return;

    const timeoutId = setTimeout(async () => {
      setIsCheckingConflicts(true);
      const [hour, minute] = startTime.split(':').map(Number);
      const startAt = setMinutes(setHours(startOfDay(selectedDate), hour), minute);
      const endAt = addMinutes(startAt, durationMins);

      const results = await checkConflicts({
        start_at: startAt,
        end_at: endAt,
        teacher_user_id: teacherUserId,
        room_id: roomId,
        student_ids: selectedStudents,
        exclude_lesson_id: lesson?.id,
      });

      setConflicts(results);
      setIsCheckingConflicts(false);
    }, 500);

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
    } else {
      setSelectedStudents(prev => 
        prev.includes(studentId)
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    }
  };

  const handleSave = async () => {
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
    const blockingConflicts = conflicts.filter(c => c.severity === 'error');
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
        // Update existing lesson
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
            status,
          })
          .eq('id', lesson.id);

        if (error) throw error;

        // Update participants
        await supabase.from('lesson_participants').delete().eq('lesson_id', lesson.id);
        
        if (selectedStudents.length > 0) {
          await supabase.from('lesson_participants').insert(
            selectedStudents.map(studentId => ({
              org_id: currentOrg.id,
              lesson_id: lesson.id,
              student_id: studentId,
            }))
          );
        }

        toast({ title: 'Lesson updated' });
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

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-3">
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
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Private notes (visible to staff only)</Label>
            <Textarea
              value={notesPrivate}
              onChange={(e) => setNotesPrivate(e.target.value)}
              placeholder="Add notes about this lesson..."
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

          {/* Conflict alerts */}
          {isCheckingConflicts && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for conflicts...
            </div>
          )}
          
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errors.map((e, i) => (
                  <div key={i}>{e.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}
          
          {warnings.length > 0 && (
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || errors.length > 0}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {lesson ? 'Save Changes' : 'Create Lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
