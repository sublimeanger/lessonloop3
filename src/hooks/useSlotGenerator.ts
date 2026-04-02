import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { addMinutes, format, setHours, setMinutes, startOfDay, endOfDay, getDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface SlotGeneratorConfig {
  date: Date;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  durationMins: number;
  breakMins: number;
  teacherId: string;
  teacherUserId: string | null;
  locationId: string | null;
  roomId: string | null;
  lessonType: 'private' | 'group';
  maxParticipants: number;
  notes: string;
}

export interface GeneratedSlot {
  id: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  excluded: boolean;
  conflictMessage?: string;
}

function timeToMinutes(h: number, m: number): number {
  return h * 60 + m;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function timeStringToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export function computeSlots(config: SlotGeneratorConfig): GeneratedSlot[] {
  const startMins = timeToMinutes(config.startHour, config.startMinute);
  const endMins = timeToMinutes(config.endHour, config.endMinute);
  const slotBlock = config.durationMins + config.breakMins;
  const slots: GeneratedSlot[] = [];

  let current = startMins;
  let i = 0;
  while (current + config.durationMins <= endMins) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const endH = Math.floor((current + config.durationMins) / 60);
    const endM = (current + config.durationMins) % 60;
    slots.push({
      id: `slot-${i}`,
      startTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      excluded: false,
    });
    current += slotBlock;
    i++;
    if (i > 50) break; // Safety cap
  }

  return slots;
}

/** SG-01..04: Check teacher lessons, room conflicts, closure dates, time-off, and availability */
export async function checkSlotConflicts(
  slots: GeneratedSlot[],
  config: { teacherId: string; roomId: string | null; locationId: string | null; orgId: string },
  date: Date,
  timezone: string,
): Promise<GeneratedSlot[]> {
  const dayStart = fromZonedTime(startOfDay(date), timezone).toISOString();
  const dayEnd = fromZonedTime(endOfDay(date), timezone).toISOString();
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = DAY_NAMES[getDay(date)];

  // Fetch all conflict sources in parallel
  const [teacherLessonsResult, roomLessonsResult, closuresResult, timeOffResult, availResult] = await Promise.all([
    // 1. Teacher double-booking
    supabase
      .from('lessons')
      .select('start_at, end_at')
      .eq('teacher_id', config.teacherId)
      .gte('start_at', dayStart)
      .lte('start_at', dayEnd)
      .neq('status', 'cancelled'),

    // 2. Room double-booking (only if room selected)
    config.roomId
      ? supabase
          .from('lessons')
          .select('start_at, end_at')
          .eq('room_id', config.roomId)
          .gte('start_at', dayStart)
          .lte('start_at', dayEnd)
          .neq('status', 'cancelled')
      : Promise.resolve({ data: null }),

    // 3. Closure dates
    supabase
      .from('closure_dates')
      .select('date, reason, location_id, applies_to_all_locations')
      .eq('org_id', config.orgId)
      .eq('date', dateStr),

    // 4. Teacher time-off
    supabase
      .from('time_off_blocks')
      .select('start_at, end_at, reason')
      .eq('teacher_id', config.teacherId)
      .lte('start_at', dayEnd)
      .gte('end_at', dayStart),

    // 5. Teacher availability blocks for this day of week
    supabase
      .from('availability_blocks')
      .select('start_time_local, end_time_local')
      .eq('teacher_id', config.teacherId)
      .eq('day_of_week', dayOfWeek),
  ]);

  const teacherLessons = teacherLessonsResult.data || [];
  const roomLessons = roomLessonsResult.data || [];
  const closures = closuresResult.data || [];
  const timeOffBlocks = timeOffResult.data || [];
  const availBlocks = availResult.data || [];

  // Check for org-wide or location-specific closure
  const applicableClosures = closures.filter(c =>
    c.applies_to_all_locations || !config.locationId || c.location_id === config.locationId
  );
  const hasClosure = applicableClosures.length > 0;
  const closureReason = hasClosure
    ? applicableClosures[0]?.reason || 'Closure date'
    : null;

  return slots.map(slot => {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const slotStartUtc = fromZonedTime(setMinutes(setHours(date, sh), sm), timezone).getTime();
    const slotEndUtc = fromZonedTime(setMinutes(setHours(date, eh), em), timezone).getTime();
    const slotStartMins = sh * 60 + sm;
    const slotEndMins = eh * 60 + em;

    // SG-02: Closure date — blocks all slots on this day
    if (hasClosure) {
      return { ...slot, excluded: true, conflictMessage: `Closure: ${closureReason}` };
    }

    // SG-01: Teacher double-booking
    const teacherConflict = teacherLessons.some(existing => {
      const eStart = new Date(existing.start_at).getTime();
      const eEnd = new Date(existing.end_at).getTime();
      return slotStartUtc < eEnd && slotEndUtc > eStart;
    });
    if (teacherConflict) {
      return { ...slot, excluded: true, conflictMessage: 'Teacher has an existing lesson' };
    }

    // SG-01: Room double-booking
    if (config.roomId) {
      const roomConflict = roomLessons.some(existing => {
        const eStart = new Date(existing.start_at).getTime();
        const eEnd = new Date(existing.end_at).getTime();
        return slotStartUtc < eEnd && slotEndUtc > eStart;
      });
      if (roomConflict) {
        return { ...slot, excluded: true, conflictMessage: 'Room already booked' };
      }
    }

    // SG-03: Teacher time-off
    const timeOffConflict = timeOffBlocks.some(to => {
      const toStart = new Date(to.start_at).getTime();
      const toEnd = new Date(to.end_at).getTime();
      return slotStartUtc < toEnd && slotEndUtc > toStart;
    });
    if (timeOffConflict) {
      const reason = timeOffBlocks.find(to => {
        const toStart = new Date(to.start_at).getTime();
        const toEnd = new Date(to.end_at).getTime();
        return slotStartUtc < toEnd && slotEndUtc > toStart;
      })?.reason;
      return { ...slot, excluded: true, conflictMessage: `Teacher on leave${reason ? `: ${reason}` : ''}` };
    }

    // SG-04: Outside availability — warn but don't block (excluded: false)
    if (availBlocks.length > 0) {
      const coveredByAvailability = availBlocks.some(block => {
        const blockStart = timeStringToMinutes(block.start_time_local);
        const blockEnd = timeStringToMinutes(block.end_time_local);
        return slotStartMins >= blockStart && slotEndMins <= blockEnd;
      });
      if (!coveredByAvailability) {
        return { ...slot, excluded: false, conflictMessage: 'Outside teacher availability' };
      }
    }

    return slot;
  });
}

export function useSlotGenerator() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configs, timezone }: {
      configs: { config: SlotGeneratorConfig; slots: GeneratedSlot[] }[];
      timezone: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const now = new Date();
      const allSlotRows: any[] = [];
      const allDateStrs: string[] = [];

      for (const { config, slots } of configs) {
        const activeSlots = slots.filter(s => !s.excluded);
        if (activeSlots.length === 0) continue;

        const dateStr = format(config.date, 'yyyy-MM-dd');
        allDateStrs.push(dateStr);

        for (const slot of activeSlots) {
          const [sh, sm] = slot.startTime.split(':').map(Number);
          const [eh, em] = slot.endTime.split(':').map(Number);
          const localStart = setMinutes(setHours(config.date, sh), sm);
          const localEnd = setMinutes(setHours(config.date, eh), em);
          const utcStart = fromZonedTime(localStart, timezone);
          const utcEnd = fromZonedTime(localEnd, timezone);

          if (utcStart < now) {
            throw new Error('Cannot generate slots in the past');
          }

          allSlotRows.push({
            org_id: currentOrg.id,
            title: `Open Slot — ${slot.startTime}`,
            start_at: utcStart.toISOString(),
            end_at: utcEnd.toISOString(),
            lesson_type: config.lessonType,
            status: 'scheduled' as const,
            teacher_id: config.teacherId,
            teacher_user_id: config.teacherUserId,
            location_id: config.locationId || null,
            room_id: config.roomId || null,
            max_participants: config.maxParticipants,
            notes_shared: config.notes || null,
            is_open_slot: true,
            is_online: false,
            created_by: user.id,
          });
        }
      }

      if (allSlotRows.length === 0) throw new Error('No slots to generate');
      if (allSlotRows.length > 200) throw new Error('Maximum 200 slots per batch');

      const { data, error } = await supabase
        .from('lessons')
        .insert(allSlotRows)
        .select('id');

      // SG-05/SG-06: Parse DB trigger conflict errors into user-friendly messages
      if (error) {
        const msg = error.message || '';
        if (msg.includes('CONFLICT:TEACHER:')) {
          throw new Error('A teacher scheduling conflict was detected. Please re-run the preview to see updated conflicts.');
        }
        if (msg.includes('CONFLICT:ROOM:')) {
          throw new Error('A room scheduling conflict was detected. Please re-run the preview to see updated conflicts.');
        }
        throw error;
      }
      const createdIds = (data || []).map(d => d.id);

      // FIX 3: Include lesson_ids in audit log
      logAudit(
        currentOrg.id,
        user.id,
        'generate_lesson_slots',
        'lesson',
        null,
        {
          after: {
            count: createdIds.length,
            dates: [...new Set(allDateStrs)],
            teacher_id: configs[0]?.config.teacherId,
            duration_mins: configs[0]?.config.durationMins,
            lesson_ids: createdIds,
          },
        }
      );

      return createdIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-lessons'] });
      toast({
        title: `${ids.length} open slots created`,
        description: 'Slots are now visible on the calendar',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate slots',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
