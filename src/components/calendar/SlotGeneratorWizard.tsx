import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, User, Loader2 } from 'lucide-react';
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

const DURATION_OPTIONS = [15, 20, 30, 45, 60];
const BREAK_OPTIONS = [0, 5, 10, 15];

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

export function SlotGeneratorWizard({ open, onOpenChange, teachers, locations, rooms, defaultDate, onComplete }: SlotGeneratorWizardProps) {
  const { timezone } = useOrgTimezone();
  const { currentOrg } = useOrg();
  const generateMutation = useSlotGenerator();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [date, setDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('20:00');
  const [durationMins, setDurationMins] = useState(30);
  const [breakMins, setBreakMins] = useState(0);

  // Step 2 state
  const [teacherId, setTeacherId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lessonType, setLessonType] = useState<'private' | 'group'>('private');
  const [maxParticipants, setMaxParticipants] = useState(1);
  const [notes, setNotes] = useState('');

  // Step 3 state
  const [slots, setSlots] = useState<GeneratedSlot[]>([]);

  const selectedTeacher = teachers.find(t => t.id === teacherId);
  const filteredRooms = locationId ? rooms.filter(r => r.location_id === locationId) : rooms;

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setSlots([]);
      setTeacherId('');
      setLocationId('');
      setRoomId('');
      setLessonType('private');
      setMaxParticipants(1);
      setNotes('');
    }
    onOpenChange(isOpen);
  };

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return { hour: h, minute: m };
  };

  const slotCount = useMemo(() => {
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    const totalMins = (e.hour * 60 + e.minute) - (s.hour * 60 + s.minute);
    if (totalMins <= 0) return 0;
    const block = durationMins + breakMins;
    return Math.floor(totalMins / block);
  }, [startTime, endTime, durationMins, breakMins]);

  const goToStep2 = () => {
    if (slotCount <= 0) return;
    setStep(2);
  };

  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  const goToStep3 = async () => {
    if (!teacherId) return;
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    const config: SlotGeneratorConfig = {
      date,
      startHour: s.hour, startMinute: s.minute,
      endHour: e.hour, endMinute: e.minute,
      durationMins, breakMins,
      teacherId, teacherUserId: selectedTeacher?.user_id || null,
      locationId: locationId || null, roomId: roomId || null,
      lessonType, maxParticipants, notes,
    };
    const rawSlots = computeSlots(config);
    // SG-01..04: Check for conflicts (teacher, room, closure, time-off, availability)
    setIsCheckingConflicts(true);
    const checkedSlots = await checkSlotConflicts(
      rawSlots,
      { teacherId, roomId: roomId || null, locationId: locationId || null, orgId: currentOrg?.id || '' },
      date,
      timezone,
    );
    setIsCheckingConflicts(false);
    setSlots(checkedSlots);
    setStep(3);
  };

  const toggleSlot = (id: string) => {
    setSlots(prev => prev.map(s => {
      // Don't allow toggling conflict slots back on
      if (s.id === id && s.conflictMessage) return s;
      return s.id === id ? { ...s, excluded: !s.excluded } : s;
    }));
  };

  const handleGenerate = async () => {
    const s = parseTime(startTime);
    const e = parseTime(endTime);
    const config: SlotGeneratorConfig = {
      date,
      startHour: s.hour, startMinute: s.minute,
      endHour: e.hour, endMinute: e.minute,
      durationMins, breakMins,
      teacherId, teacherUserId: selectedTeacher?.user_id || null,
      locationId: locationId || null, roomId: roomId || null,
      lessonType, maxParticipants, notes,
    };

    await generateMutation.mutateAsync({ config, slots, timezone });
    handleOpenChange(false);
    onComplete?.(date);
  };

  const activeSlotCount = slots.filter(s => !s.excluded).length;

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
                    onSelect={(d) => d && setDate(d)}
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

            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">
                {slotCount > 0 ? `This will create ${slotCount} slot${slotCount !== 1 ? 's' : ''}` : 'Invalid time range'}
              </p>
              {slotCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {startTime} → {endTime}, {durationMins} min each{breakMins > 0 ? ` + ${breakMins} min break` : ''}
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
            <SlotPreviewTimeline slots={slots} onToggleSlot={toggleSlot} />
            {activeSlotCount === 0 && slots.length > 0 && (
              <p className="text-sm text-destructive text-center">
                All slots have conflicts. Go back and choose a different date or time range.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={generateMutation.isPending}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <Button onClick={goToStep2} disabled={slotCount <= 0}>
              Next
            </Button>
          )}
          {step === 2 && (
            <Button onClick={goToStep3} disabled={!teacherId || isCheckingConflicts}>
              {isCheckingConflicts ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking conflicts…</>
              ) : 'Preview Slots'}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleGenerate} disabled={activeSlotCount === 0 || generateMutation.isPending}>
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
