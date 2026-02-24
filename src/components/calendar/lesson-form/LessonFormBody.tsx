import { RefObject, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { LessonWithDetails, LessonStatus, LessonType, ConflictResult } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { DURATION_OPTIONS, TIME_OPTIONS } from './constants';
import { StudentSelector } from './StudentSelector';
import { RecurrenceSection } from './RecurrenceSection';
import { ConflictAlerts } from './ConflictAlerts';

interface LessonFormBodyProps {
  lesson?: LessonWithDetails | null;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  students: { id: string; name: string }[];
  filteredRooms: { id: string; name: string }[];
  lessonType: LessonType;
  setLessonType: (type: LessonType) => void;
  teacherId: string;
  setTeacherId: (id: string) => void;
  selectedStudents: string[];
  setSelectedStudents: React.Dispatch<React.SetStateAction<string[]>>;
  locationId: string | null;
  setLocationId: (id: string | null) => void;
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  startTime: string;
  setStartTime: (time: string) => void;
  durationMins: number;
  setDurationMins: (mins: number) => void;
  notesPrivate: string;
  setNotesPrivate: (notes: string) => void;
  notesShared: string;
  setNotesShared: (notes: string) => void;
  recapUrl: string;
  setRecapUrl: (url: string) => void;
  status: LessonStatus;
  setStatus: (status: LessonStatus) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurrenceDays: number[];
  recurrenceEndDate: Date | null;
  setRecurrenceEndDate: (date: Date | null) => void;
  studentsOpen: boolean;
  setStudentsOpen: (open: boolean) => void;
  studentSheetOpen: boolean;
  setStudentSheetOpen: (open: boolean) => void;
  conflictState: { isChecking: boolean; conflicts: ConflictResult[] };
  setConflictState: (state: { isChecking: boolean; conflicts: ConflictResult[] }) => void;
  errors: ConflictResult[];
  warnings: ConflictResult[];
  closureCheck: { hasConflicts: boolean; warningMessage: string | null; conflicts: { date: Date; reason: string }[] };
  handleStudentToggle: (studentId: string) => void;
  handleRecurrenceDayToggle: (day: number) => void;
  studentSelectorRef: RefObject<HTMLButtonElement>;
}

export function LessonFormBody({
  lesson,
  teachers,
  locations,
  students,
  filteredRooms,
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
  recapUrl, setRecapUrl,
  status, setStatus,
  isRecurring, setIsRecurring,
  recurrenceDays,
  recurrenceEndDate, setRecurrenceEndDate,
  studentsOpen, setStudentsOpen,
  studentSheetOpen, setStudentSheetOpen,
  conflictState, setConflictState,
  errors, warnings,
  closureCheck,
  handleStudentToggle,
  handleRecurrenceDayToggle,
  studentSelectorRef,
}: LessonFormBodyProps) {
  const isMobile = useIsMobile();
  const { currentOrg } = useOrg();

  // Find which teacher is selected and get their recent locations
  const selectedTeacherId = teacherId || null;
  const { data: teacherLocationIds = [] } = useQuery({
    queryKey: ['teacher-recent-locations', selectedTeacherId, currentOrg?.id],
    queryFn: async () => {
      if (!selectedTeacherId || !currentOrg) return [];
      const since = subDays(new Date(), 90).toISOString();
      const { data } = await supabase
        .from('lessons')
        .select('location_id')
        .eq('teacher_id', selectedTeacherId)
        .eq('org_id', currentOrg.id)
        .gte('start_at', since)
        .not('location_id', 'is', null);
      if (!data) return [];
      return [...new Set(data.map(l => l.location_id).filter(Boolean))] as string[];
    },
    enabled: !!selectedTeacherId && !!currentOrg,
    // Uses default SEMI_STABLE (2 min)
  });

  const { recentLocations, otherLocations } = useMemo(() => {
    if (!selectedTeacherId || teacherLocationIds.length === 0) {
      return { recentLocations: [], otherLocations: locations };
    }
    const idSet = new Set(teacherLocationIds);
    return {
      recentLocations: locations.filter(l => idSet.has(l.id)),
      otherLocations: locations.filter(l => !idSet.has(l.id)),
    };
  }, [locations, teacherLocationIds, selectedTeacherId]);

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

  return (
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

      {/* Teacher */}
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
      <StudentSelector
        students={students}
        selectedStudents={selectedStudents}
        setSelectedStudents={setSelectedStudents}
        lessonType={lessonType}
        isMobile={isMobile}
        studentsOpen={studentsOpen}
        setStudentsOpen={setStudentsOpen}
        studentSheetOpen={studentSheetOpen}
        setStudentSheetOpen={setStudentSheetOpen}
        onStudentToggle={handleStudentToggle}
        studentSelectorRef={studentSelectorRef}
      />

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
              {recentLocations.length > 0 ? (
                <>
                  <SelectGroup>
                    <SelectLabel className="text-xs text-muted-foreground">Recent locations</SelectLabel>
                    {recentLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  {otherLocations.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground">All locations</SelectLabel>
                        {otherLocations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </>
              ) : (
                locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))
              )}
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
      <RecurrenceSection
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring}
        recurrenceDays={recurrenceDays}
        onDayToggle={handleRecurrenceDayToggle}
        recurrenceEndDate={recurrenceEndDate}
        setRecurrenceEndDate={setRecurrenceEndDate}
        selectedDate={selectedDate}
        closureCheck={closureCheck}
        lesson={lesson}
      />

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

      {/* Recap Link */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-muted-foreground" />
          Lesson Recording / Recap Link
        </Label>
        <Input
          type="url"
          value={recapUrl}
          onChange={(e) => setRecapUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="min-h-[44px]"
        />
        <p className="text-xs text-muted-foreground">
          Attach a recording link for students to review after the lesson.
        </p>
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
      <ConflictAlerts
        conflictState={conflictState}
        errors={errors}
        warnings={warnings}
        setConflictState={setConflictState}
      />
    </div>
  );
}
