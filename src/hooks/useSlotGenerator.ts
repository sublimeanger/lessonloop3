import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { addMinutes, format, setHours, setMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

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

      const createdIds: string[] = [];
      const dateStr = format(config.date, 'yyyy-MM-dd');

      for (const slot of activeSlots) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);

        // Build local datetime then convert to UTC
        const localStart = setMinutes(setHours(config.date, sh), sm);
        const localEnd = setMinutes(setHours(config.date, eh), em);
        const utcStart = fromZonedTime(localStart, timezone);
        const utcEnd = fromZonedTime(localEnd, timezone);

        const { data, error } = await supabase
          .from('lessons')
          .insert({
            org_id: currentOrg.id,
            title: `Open Slot — ${slot.startTime}`,
            start_at: utcStart.toISOString(),
            end_at: utcEnd.toISOString(),
            lesson_type: config.lessonType,
            status: 'scheduled',
            teacher_id: config.teacherId,
            teacher_user_id: config.teacherUserId,
            location_id: config.locationId || null,
            room_id: config.roomId || null,
            max_participants: config.maxParticipants,
            notes_shared: config.notes || null,
            is_open_slot: true,
            is_online: false,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data) createdIds.push(data.id);
      }

      // Audit log
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
