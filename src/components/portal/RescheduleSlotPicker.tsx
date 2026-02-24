import { useState, useMemo } from 'react';
import { format, parseISO, addDays, setHours, setMinutes, startOfDay, isBefore, isAfter, addMinutes, differenceInMinutes } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AvailableSlot {
  start: Date;
  end: Date;
  isPreferred?: boolean;
}

interface RescheduleSlotPickerProps {
  lessonId: string;
  lessonTitle: string;
  originalStart: string;
  originalEnd: string;
  teacherId: string | null;
  orgId: string;
  onSlotSelect: (slot: { proposedStart: Date; proposedEnd: Date }) => void;
  onCancel: () => void;
  isLateCancel?: boolean;
  cancellationNoticeHours?: number;
}

export function RescheduleSlotPicker({
  lessonId,
  lessonTitle,
  originalStart,
  originalEnd,
  teacherId,
  orgId,
  onSlotSelect,
  onCancel,
  isLateCancel = false,
  cancellationNoticeHours = 24,
}: RescheduleSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const originalDuration = differenceInMinutes(parseISO(originalEnd), parseISO(originalStart));

  // Fetch teacher's availability blocks by teacher_id
  const { data: availabilityBlocks } = useQuery({
    queryKey: ['teacher-availability', teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data, error } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('teacher_id', teacherId);
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's time-off blocks by teacher_id
  const { data: timeOffBlocks } = useQuery({
    queryKey: ['teacher-time-off', teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data, error } = await supabase
        .from('time_off_blocks')
        .select('*')
        .eq('teacher_id', teacherId);
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  // Fetch teacher's existing lessons for conflict checking (use teacher_id)
  const { data: teacherLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['teacher-lessons-for-reschedule', teacherId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!teacherId) return [];
      const startOfWeek = addDays(selectedDate, -7);
      const endOfWeek = addDays(selectedDate, 14);
      
      const { data, error } = await supabase
        .from('lessons')
        .select('id, start_at, end_at, status')
        .eq('teacher_id', teacherId)
        .eq('status', 'scheduled')
        .gte('start_at', startOfWeek.toISOString())
        .lte('start_at', endOfWeek.toISOString())
        .neq('id', lessonId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  // Fetch closure dates
  const { data: closures } = useQuery({
    queryKey: ['closure-dates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closure_dates')
        .select('date, reason')
        .eq('org_id', orgId);
      
      if (error) throw error;
      return data;
    },
  });

  // Generate available slots for the selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate || lessonsLoading) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Check if the date is a closure date
    const isClosure = closures?.some(c => c.date === format(selectedDate, 'yyyy-MM-dd'));
    if (isClosure) return [];

    // Get availability blocks for this day
    const dayBlocks = availabilityBlocks?.filter(
      b => b.day_of_week.toLowerCase() === dayName
    ) || [];

    // P2 Fix: Don't use hardcoded fallback - if no availability configured, show empty
    // Only use fallback if we're still loading or haven't fetched yet
    const hasConfiguredAvailability = availabilityBlocks && availabilityBlocks.length > 0;
    
    if (dayBlocks.length === 0 && !hasConfiguredAvailability) {
      // No availability configured at all - return empty to show message
      return [];
    }

    const slots: AvailableSlot[] = [];
    
    dayBlocks.forEach(block => {
      const [startHour, startMin] = block.start_time_local.split(':').map(Number);
      const [endHour, endMin] = block.end_time_local.split(':').map(Number);
      
      let slotStart = setMinutes(setHours(startOfDay(selectedDate), startHour), startMin);
      const blockEnd = setMinutes(setHours(startOfDay(selectedDate), endHour), endMin);
      
      // Generate 15-minute interval slots
      while (slotStart < blockEnd) {
        const slotEnd = addMinutes(slotStart, originalDuration);
        
        // Don't go past block end
        if (isAfter(slotEnd, blockEnd)) break;
        
        // Don't allow slots in the past
        if (isBefore(slotStart, new Date())) {
          slotStart = addMinutes(slotStart, 15);
          continue;
        }
        
        // Check for conflicts with existing lessons
        const hasLessonConflict = teacherLessons?.some(lesson => {
          const lessonStart = parseISO(lesson.start_at);
          const lessonEnd = parseISO(lesson.end_at);
          return slotStart < lessonEnd && slotEnd > lessonStart;
        });

        // Check for conflicts with time-off blocks
        const hasTimeOffConflict = timeOffBlocks?.some(block => {
          const offStart = parseISO(block.start_at);
          const offEnd = parseISO(block.end_at);
          return slotStart < offEnd && slotEnd > offStart;
        });
        
        if (!hasLessonConflict && !hasTimeOffConflict) {
          // Check if this matches the original time (preferred)
          const originalDate = parseISO(originalStart);
          const isPreferred = slotStart.getHours() === originalDate.getHours() && 
                             slotStart.getMinutes() === originalDate.getMinutes();
          
          slots.push({ start: slotStart, end: slotEnd, isPreferred });
        }
        
        slotStart = addMinutes(slotStart, 15);
      }
    });
    
    return slots;
  }, [selectedDate, availabilityBlocks, teacherLessons, timeOffBlocks, closures, originalDuration, lessonsLoading, originalStart]);

  // Disable dates that are closures or in the past
  const disabledDates = useMemo(() => {
    const disabled: Date[] = [];
    closures?.forEach(c => {
      disabled.push(parseISO(c.date));
    });
    return disabled;
  }, [closures]);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    onSlotSelect({
      proposedStart: selectedSlot.start,
      proposedEnd: selectedSlot.end,
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-semibold">Select New Time for:</h3>
        <p className="text-muted-foreground">{lessonTitle}</p>
        <p className="text-sm text-muted-foreground">
          Original: {format(parseISO(originalStart), 'EEE, d MMM \'at\' HH:mm')}
        </p>
      </div>

      {isLateCancel && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This is within {cancellationNoticeHours} hours notice. Your cancellation policy may apply.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Picker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Select Date</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => 
                isBefore(date, startOfDay(new Date())) ||
                disabledDates.some(d => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
              }
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Time Slots */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Available Times
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {lessonsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No available slots on this date.</p>
                <p className="text-sm mt-1">
                  {availabilityBlocks && availabilityBlocks.length === 0 
                    ? 'Teacher availability has not been configured. Please contact your teacher to arrange a new time.'
                    : 'Try selecting a different day.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-72">
                <div className="grid grid-cols-2 gap-2 p-1">
                  {availableSlots.map((slot, i) => (
                    <Button
                      key={i}
                      variant={selectedSlot === slot ? 'default' : 'outline'}
                      className={cn(
                        'justify-start text-sm min-h-[44px] active:scale-[0.97] transition-transform',
                        slot.isPreferred ? 'border-primary' : ''
                      )}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {format(slot.start, 'HH:mm')}
                      {slot.isPreferred && (
                        <Badge variant="secondary" className="ml-1 text-micro px-1">
                          Same time
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedSlot && (
        <Alert className="bg-primary/5 border-primary/20">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Selected:</strong> {format(selectedSlot.start, 'EEEE, d MMMM')} at {format(selectedSlot.start, 'HH:mm')} - {format(selectedSlot.end, 'HH:mm')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!selectedSlot}>
          Request This Time
        </Button>
      </div>
    </div>
  );
}
