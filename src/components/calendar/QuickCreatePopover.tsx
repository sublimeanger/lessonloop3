import { useState, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { format, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickCreatePopoverProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenFullModal: () => void;
  startDate: Date;
  endDate?: Date;
  /** Anchor element for popover positioning */
  anchorRef?: React.RefObject<HTMLDivElement>;
}

const DURATION_PRESETS = [30, 45, 60] as const;

export function QuickCreatePopover({
  open,
  onClose,
  onSaved,
  onOpenFullModal,
  startDate,
  endDate,
}: QuickCreatePopoverProps) {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { teachers, students } = useTeachersAndLocations();
  const { checkConflicts } = useConflictDetection();
  const { syncLesson } = useCalendarSync();

  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [duration, setDuration] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);

  const orgTimezone = currentOrg?.timezone || 'Europe/London';

  // Reset form when opened
  useEffect(() => {
    if (!open) return;
    setStudentId('');
    setIsSaving(false);
    setStudentSearchOpen(false);

    // Auto-select teacher
    const currentUserTeacher = teachers.find(t => t.userId === user?.id);
    setTeacherId(currentUserTeacher?.id || teachers[0]?.id || '');

    // Duration from drag range or org default
    if (endDate) {
      const dragDuration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
      setDuration(Math.max(15, Math.min(dragDuration, 180)));
    } else {
      setDuration(currentOrg?.default_lesson_length_mins || 60);
    }
  }, [open, startDate, endDate, teachers, user?.id, currentOrg?.default_lesson_length_mins]);

  // Auto-select if only one student
  useEffect(() => {
    if (open && students.length === 1 && !studentId) {
      setStudentId(students[0].id);
    }
  }, [open, students, studentId]);

  const selectedStudentName = useMemo(
    () => students.find(s => s.id === studentId)?.name || '',
    [students, studentId]
  );

  const handleCreate = async () => {
    if (!currentOrg || !user || !studentId || !teacherId) return;

    setIsSaving(true);
    try {
      const [hour, minute] = [startDate.getHours(), startDate.getMinutes()];
      const localDateTime = setMinutes(setHours(startOfDay(startDate), hour), minute);
      const startAtUtc = fromZonedTime(localDateTime, orgTimezone);
      const endAtUtc = addMinutes(startAtUtc, duration);

      const student = students.find(s => s.id === studentId);
      const teacher = teachers.find(t => t.id === teacherId);
      const title = `Lesson – ${student?.name || 'Student'}`;

      // Conflict check before insert
      const conflicts = await checkConflicts({
        start_at: startAtUtc,
        end_at: endAtUtc,
        teacher_id: teacherId,
        teacher_user_id: teacher?.userId || null,
        room_id: null,
        location_id: student?.default_location_id || null,
        student_ids: [studentId],
      });

      const blocking = conflicts.filter(c => c.severity === 'error');
      if (blocking.length > 0) {
        toast({
          title: 'Scheduling conflict',
          description: blocking[0].message,
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      // Show non-blocking warnings but allow creation
      const warnings = conflicts.filter(c => c.severity === 'warning');
      if (warnings.length > 0) {
        toast({
          title: 'Scheduling warning',
          description: warnings.map(w => w.message).join('; '),
        });
      }

      // Insert lesson
      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          org_id: currentOrg.id,
          title,
          start_at: startAtUtc.toISOString(),
          end_at: endAtUtc.toISOString(),
          teacher_id: teacherId,
          teacher_user_id: teacher?.userId || null,
          location_id: student?.default_location_id || null,
          lesson_type: 'private',
          status: 'scheduled',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (lessonError) throw lessonError;

      // Add participant
      if (newLesson) {
        const { error: participantError } = await supabase.from('lesson_participants').insert({
          org_id: currentOrg.id,
          lesson_id: newLesson.id,
          student_id: studentId,
        });
        if (participantError) {
          logger.error('Failed to add participant:', participantError);
          toast({
            title: 'Lesson created but student not added',
            description: 'Please edit the lesson to add the student.',
            variant: 'destructive',
          });
        }
      }

      // Fire-and-forget calendar sync
      if (newLesson) {
        syncLesson(newLesson.id, 'create');
      }

      toast({
        title: 'Lesson created',
        description: `${format(startDate, 'EEE d MMM, HH:mm')} – ${duration} min`,
      });
      onSaved();
      onClose();
    } catch (err) {
      logger.error('Quick create failed:', err);
      toast({
        title: 'Failed to create lesson',
        description: 'Please try again or use the full form.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xs p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {format(startDate, 'EEE d MMM, HH:mm')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
              onClick={() => { onClose(); onOpenFullModal(); }}
            >
              <Settings2 className="h-3 w-3 mr-1" />
              More
            </Button>
          </div>

          {/* Student picker */}
          <div className="space-y-1">
            <Label className="text-xs">Student</Label>
            <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left h-8 text-xs font-normal"
                >
                  {selectedStudentName || 'Select student…'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search students…" className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty className="text-xs p-2">No students found.</CommandEmpty>
                    <CommandGroup>
                      {students.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setStudentId(s.id);
                            setStudentSearchOpen(false);
                            if (s.default_teacher_id && teachers.some(t => t.id === s.default_teacher_id)) {
                              setTeacherId(s.default_teacher_id);
                            }
                          }}
                          className="text-xs"
                        >
                          <Check className={cn('h-3 w-3 mr-1.5', studentId === s.id ? 'opacity-100' : 'opacity-0')} />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Teacher — show only if multiple */}
          {teachers.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Duration presets */}
          <div className="space-y-1">
            <Label className="text-xs">Duration</Label>
            <div className="flex gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <Button
                  key={d}
                  variant={duration === d ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-7 text-xs px-0"
                  onClick={() => setDuration(d)}
                >
                  {d}m
                </Button>
              ))}
            </div>
          </div>

          {/* Create button */}
          <Button
            className="w-full h-8 text-xs"
            disabled={!studentId || !teacherId || isSaving}
            onClick={handleCreate}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Create Lesson
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
