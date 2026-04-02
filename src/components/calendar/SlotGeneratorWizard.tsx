import { useState, useMemo } from 'react';
import { format, addWeeks, setDay, getDay, parseISO, isAfter, isBefore, startOfDay, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, User, Loader2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SlotPreviewTimeline } from './SlotPreviewTimeline';
import { computeSlots, checkSlotConflicts, useSlotGenerator, type SlotGeneratorConfig, type GeneratedSlot } from '@/hooks/useSlotGenerator';
import { useOrgTimezone } from '@/hooks/useOrgTimezone';
import { useOrg } from '@/contexts/OrgContext';
import { useCurrentTerm } from '@/hooks/useTerms';
import { cn } from '@/lib/utils';

interface Teacher {
  id: string;
  display_name: string;
  user_id: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  location_id: string;
}

interface SlotGeneratorWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: Teacher[];
  locations: Location[];
  rooms: Room[];
  defaultDate?: Date;
  onComplete?: (date: Date) => void;
}

export interface DatedSlotGroup {
  date: Date;
  dateLabel: string;
  slots: GeneratedSlot[];
}

const DURATION_OPTIONS = [15, 20, 30, 45, 60];
const BREAK_OPTIONS = [0, 5, 10, 15];

const REPEAT_OPTIONS = [
  { value: '0', label: 'This day only' },
  { value: '1', label: '1 week' },
  { value: '2', label: '2 weeks' },
  { value: '4', label: '4 weeks' },
  { value: 'term', label: 'Full term' },
];

const DAY_LABELS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function timeOptions() {
  const opts: { label: string; hour: number; minute: number }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) continue;
      opts.push({ label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, hour: h, minute: m });
    }
  }
  return opts;
}

const TIME_OPTIONS = timeOptions();

/** Compute all target dates given repeat config */
function computeTargetDates(
  startDate: Date,
  repeatValue: string,
  selectedDays: number[],
  termEndDate?: string | null,
): Date[] {
  if (repeatValue === '0' || selectedDays.length === 0) {
    return [startDate];
  }

  let weekCount: number;
  if (repeatValue === 'term') {
    if (!termEndDate) return [startDate];
    const end = parseISO(termEndDate);
    const diffMs = end.getTime() - startDate.getTime();
    weekCount = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (weekCount <= 0) return [startDate];
    weekCount = Math.min(weekCount, 52); // safety cap
  } else {
    weekCount = parseInt(repeatValue, 10);
  }

  const today = startOfDay(new Date());
  const endLimit = repeatValue === 'term' && termEndDate ? parseISO(termEndDate) : null;
  const dates: Date[] = [];

  for (let week = 0; week < weekCount; week++) {
    const weekBase = addWeeks(startDate, week);
    for (const dayOfWeek of selectedDays) {
      const adjusted = setDay(weekBase, dayOfWeek, { weekStartsOn: 1 });
      if (isBefore(adjusted, startDate) && !isSameDay(adjusted, startDate)) continue;
      if (isBefore(adjusted, today)) continue;
      if (endLimit && isAfter(adjusted, endLimit)) continue;
      // Avoid duplicates
      if (!dates.some(d => isSameDay(d, adjusted))) {
        dates.push(adjusted);
      }
    }
  }

  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

export function SlotGeneratorWizard({ open, onOpenChange, teachers, locations, rooms, defaultDate, onComplete }: SlotGeneratorWizardProps) {
  const { timezone } = useOrgTimezone();
  const { currentOrg } = useOrg();
  const currentTerm = useCurrentTerm();
  const generateMutation = useSlotGenerator();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [date, setDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('20:00');
  const [durationMins, setDurationMins] = useState(30);
  const [breakMins, setBreakMins] = useState(0);

  // Repeat state
  const [repeatValue, setRepeatValue] = useState('0');
  const [selectedDays, setSelectedDays] = useState<number[]>(() => [getDay(defaultDate || new Date())]);

  // Step 2 state
  const [teacherId, setTeacherId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lessonType, setLessonType] = useState<'private' | 'group'>('private');
  const [maxParticipants, setMaxParticipants] = useState(1);
  const [notes, setNotes] = useState('');

  // Step 3 state
  const [slotGroups, setSlotGroups] = useState<DatedSlotGroup[]>([]);

  const selectedTeacher = teachers.find(t => t.id === teacherId);
  const filteredRooms = locationId ? rooms.filter(r => r.location_id === locationId) : rooms;

  // When date changes, auto-select its day of week
  const handleDateChange = (d: Date) => {
    setDate(d);
    const dow = getDay(d);
    if (!selectedDays.includes(dow)) {
      setSelectedDays(prev => [...prev, dow].sort());
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        // Don't allow deselecting all days
        if (prev.length <= 1) return prev;
        return prev.filter(d => d !== day);
      }
      return [...prev, day].sort();
    });
  };

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setSlotGroups([]);
      setTeacherId('');
      setLocationId('');
      setRoomId('');
      setLessonType('private');
      setMaxParticipants(1);
      setNotes('');
      setRepeatValue('0');
      setSelectedDays([getDay(defaultDate || new Date())]);
    }
    onOpenChange(isOpen);
  };

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return { hour: h, minute: m };
  };

  const slotsPerDay = useMemo(() => {
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    const totalMins = (e.hour * 60 + e.minute) - (s.hour * 60 + s.minute);
    if (totalMins <= 0) return 0;
    const block = durationMins + breakMins;
    return Math.floor(totalMins / block);
  }, [startTime, endTime, durationMins, breakMins]);

  const targetDates = useMemo(() => {
    return computeTargetDates(date, repeatValue, selectedDays, currentTerm?.end_date);
  }, [date, repeatValue, selectedDays, currentTerm?.end_date]);

  const totalSlotCount = slotsPerDay * targetDates.length;

  const goToStep2 = () => {
    if (slotsPerDay <= 0) return;
    setStep(2);
  };

  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  const goToStep3 = async () => {
    if (!teacherId) return;
    const s = parseTime(startTime);
    const e = parseTime(endTime);

    setIsCheckingConflicts(true);
    const groups: DatedSlotGroup[] = [];

    for (const targetDate of targetDates) {
      const config: SlotGeneratorConfig = {
        date: targetDate,
        startHour: s.hour, startMinute: s.minute,
        endHour: e.hour, endMinute: e.minute,
        durationMins, breakMins,
        teacherId, teacherUserId: selectedTeacher?.user_id || null,
        locationId: locationId || null, roomId: roomId || null,
        lessonType, maxParticipants, notes,
      };
      const rawSlots = computeSlots(config);
      const checkedSlots = await checkSlotConflicts(
        rawSlots,
        { teacherId, roomId: roomId || null, locationId: locationId || null, orgId: currentOrg?.id || '' },
        targetDate,
        timezone,
      );
      // Prefix slot IDs with date to keep them unique across groups
      const datePrefix = format(targetDate, 'yyyy-MM-dd');
      const prefixedSlots = checkedSlots.map(sl => ({
        ...sl,
        id: `${datePrefix}-${sl.id}`,
      }));
      groups.push({
        date: targetDate,
        dateLabel: format(targetDate, 'EEE, d MMM yyyy'),
        slots: prefixedSlots,
      });
    }

    setIsCheckingConflicts(false);
    setSlotGroups(groups);
    setStep(3);
  };

  const toggleSlot = (slotId: string) => {
    setSlotGroups(prev => prev.map(group => ({
      ...group,
      slots: group.slots.map(s => {
        if (s.id === slotId && s.conflictMessage) return s;
        return s.id === slotId ? { ...s, excluded: !s.excluded } : s;
      }),
    })));
  };

  const handleGenerate = async () => {
    const s = parseTime(startTime);
    const e = parseTime(endTime);

    const allConfigs: { config: SlotGeneratorConfig; slots: GeneratedSlot[] }[] = slotGroups.map(group => ({
      config: {
        date: group.date,
        startHour: s.hour, startMinute: s.minute,
        endHour: e.hour, endMinute: e.minute,
        durationMins, breakMins,
        teacherId, teacherUserId: selectedTeacher?.user_id || null,
        locationId: locationId || null, roomId: roomId || null,
        lessonType, maxParticipants, notes,
      },
      slots: group.slots,
    }));

    await generateMutation.mutateAsync({ configs: allConfigs, timezone });
    handleOpenChange(false);
    onComplete?.(date);
  };

  const allSlots = slotGroups.flatMap(g => g.slots);
  const activeSlotCount = allSlots.filter(s => !s.excluded).length;

  const isRepeatEnabled = repeatValue !== '0';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Generate Open Slots — Date & Time'}
            {step === 2 && 'Generate Open Slots — Details'}
            {step === 3 && 'Generate Open Slots — Preview'}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'EEEE, d MMMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && handleDateChange(d)}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>End Time</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration per slot</Label>
                <Select value={String(durationMins)} onValueChange={v => setDurationMins(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Break between slots</Label>
                <Select value={String(breakMins)} onValueChange={v => setBreakMins(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BREAK_OPTIONS.map(b => (
                      <SelectItem key={b} value={String(b)}>{b === 0 ? 'None' : `${b} min`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Repeat section */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Repeat</Label>
              </div>
              <Select value={repeatValue} onValueChange={setRepeatValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                      {opt.value === 'term' && !currentTerm && ' (no active term)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isRepeatEnabled && (
                <div>
                  <Label className="text-xs text-muted-foreground">On days</Label>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {DAY_LABELS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                          selectedDays.includes(d.value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isRepeatEnabled && repeatValue === 'term' && !currentTerm && (
                <p className="text-xs text-destructive">No active term found. Please set up a term first, or choose a fixed repeat duration.</p>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">
                {slotsPerDay > 0
                  ? `This will create ${totalSlotCount} slot${totalSlotCount !== 1 ? 's' : ''}${targetDates.length > 1 ? ` across ${targetDates.length} days` : ''}`
                  : 'Invalid time range'}
              </p>
              {slotsPerDay > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {slotsPerDay} per day · {startTime} → {endTime}, {durationMins} min each{breakMins > 0 ? ` + ${breakMins} min break` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Teacher <span className="text-destructive">*</span></Label>
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">No teachers available. Add a teacher first.</p>
              ) : (
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Select value={locationId || '__none__'} onValueChange={(v) => { setLocationId(v === '__none__' ? '' : v); setRoomId(''); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room</Label>
                <Select value={roomId || '__none__'} onValueChange={(v) => setRoomId(v === '__none__' ? '' : v)} disabled={!locationId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {filteredRooms.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lesson Type</Label>
                <Select value={lessonType} onValueChange={(v) => { setLessonType(v as any); setMaxParticipants(v === 'private' ? 1 : 4); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Students</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={maxParticipants}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                    setMaxParticipants(Math.max(1, Math.min(30, isNaN(v) ? 1 : v)));
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Notes (applied to all slots)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {slotGroups.length <= 1 ? (
              <SlotPreviewTimeline slots={allSlots} onToggleSlot={toggleSlot} />
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {slotGroups.map(group => {
                  const groupActive = group.slots.filter(s => !s.excluded).length;
                  return (
                    <div key={group.dateLabel}>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-sm font-semibold text-foreground">{group.dateLabel}</h4>
                        <span className="text-xs text-muted-foreground">{groupActive} of {group.slots.length} active</span>
                      </div>
                      <SlotPreviewTimeline slots={group.slots} onToggleSlot={toggleSlot} />
                    </div>
                  );
                })}
              </div>
            )}
            {activeSlotCount === 0 && allSlots.length > 0 && (
              <p className="text-sm text-destructive text-center">
                All slots have conflicts. Go back and choose a different date or time range.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setStep(s => s - 1)} disabled={generateMutation.isPending}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <Button className="min-h-11 sm:min-h-9" onClick={goToStep2} disabled={slotsPerDay <= 0 || (repeatValue === 'term' && !currentTerm)}>
              Next
            </Button>
          )}
          {step === 2 && (
            <Button className="min-h-11 sm:min-h-9" onClick={goToStep3} disabled={!teacherId || isCheckingConflicts}>
              {isCheckingConflicts ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking conflicts…</>
              ) : 'Preview Slots'}
            </Button>
          )}
          {step === 3 && (
            <Button className="min-h-11 sm:min-h-9" onClick={handleGenerate} disabled={activeSlotCount === 0 || generateMutation.isPending}>
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate ${activeSlotCount} Slot${activeSlotCount !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
