import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { addMinutes, format, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';
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

/** FIX 3: Check for existing lessons and mark conflicting slots */
export async function checkSlotConflicts(
  slots: GeneratedSlot[],
  teacherId: string,
  date: Date,
  timezone: string,
): Promise<GeneratedSlot[]> {
  const dayStart = fromZonedTime(startOfDay(date), timezone).toISOString();
  const dayEnd = fromZonedTime(endOfDay(date), timezone).toISOString();

  const { data: existingLessons } = await supabase
    .from('lessons')
    .select('start_at, end_at')
    .eq('teacher_id', teacherId)
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd)
    .neq('status', 'cancelled');

  const conflicts = existingLessons || [];
  if (conflicts.length === 0) return slots;

  return slots.map(slot => {
    // Build local datetimes for comparison
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const slotStartUtc = fromZonedTime(setMinutes(setHours(date, sh), sm), timezone).getTime();
    const slotEndUtc = fromZonedTime(setMinutes(setHours(date, eh), em), timezone).getTime();

    const hasConflict = conflicts.some(existing => {
      const eStart = new Date(existing.start_at).getTime();
      const eEnd = new Date(existing.end_at).getTime();
      return slotStartUtc < eEnd && slotEndUtc > eStart;
    });

    if (hasConflict) {
      return { ...slot, excluded: true, conflictMessage: 'Conflicts with existing lesson' };
    }
    return slot;
  });
}

export function useSlotGenerator() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ config, slots, timezone }: { config: SlotGeneratorConfig; slots: GeneratedSlot[]; timezone: string }) => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const activeSlots = slots.filter(s => !s.excluded);
      if (activeSlots.length === 0) throw new Error('No slots to generate');
      if (activeSlots.length > 50) throw new Error('Maximum 50 slots per batch');

      // FIX 5: Server-side past date validation
      const now = new Date();
      for (const slot of activeSlots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const localStart = setMinutes(setHours(config.date, sh), sm);
        const utcStart = fromZonedTime(localStart, timezone);
        if (utcStart < now) {
          throw new Error('Cannot generate slots in the past');
        }
      }

      const dateStr = format(config.date, 'yyyy-MM-dd');

      // FIX 6: Batch insert all slots at once
      const allSlotRows = activeSlots.map(slot => {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        const localStart = setMinutes(setHours(config.date, sh), sm);
        const localEnd = setMinutes(setHours(config.date, eh), em);
        const utcStart = fromZonedTime(localStart, timezone);
        const utcEnd = fromZonedTime(localEnd, timezone);

        return {
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
        };
      });

      const { data, error } = await supabase
        .from('lessons')
        .insert(allSlotRows)
        .select('id');

      if (error) throw error;
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
            date: dateStr,
            teacher_id: config.teacherId,
            duration_mins: config.durationMins,
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
