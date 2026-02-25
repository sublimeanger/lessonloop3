import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { STALE_STABLE } from '@/config/query-stale-times';

// ─── Types ───────────────────────────────────────────────

export interface BookingPageConfig {
  id: string;
  org_id: string;
  slug: string;
  enabled: boolean;
  title: string | null;
  description: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  accent_color: string | null;
  lesson_duration_mins: number;
  advance_booking_days: number;
  min_notice_hours: number;
  buffer_minutes: number;
  require_phone: boolean;
  confirmation_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingPageTeacher {
  id: string;
  booking_page_id: string;
  teacher_id: string;
  org_id: string;
}

export interface BookingPageInstrument {
  id: string;
  booking_page_id: string;
  instrument_id: string;
  org_id: string;
}

export interface BookingPageWithRelations extends BookingPageConfig {
  booking_page_teachers: BookingPageTeacher[];
  booking_page_instruments: BookingPageInstrument[];
}

// ─── Fetch booking page config ───────────────────────────

export function useBookingPageConfig() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['booking-page', currentOrg?.id],
    queryFn: async (): Promise<BookingPageWithRelations | null> => {
      if (!currentOrg) return null;

      const { data, error } = await (supabase as any)
        .from('booking_pages')
        .select(`
          *,
          booking_page_teachers(*),
          booking_page_instruments(*)
        `)
        .eq('org_id', currentOrg.id)
        .maybeSingle();

      if (error) throw error;
      return data as BookingPageWithRelations | null;
    },
    enabled: !!currentOrg,
    staleTime: STALE_STABLE,
  });
}

// ─── Upsert booking page config ──────────────────────────

export type BookingPageUpsertData = Partial<
  Omit<BookingPageConfig, 'id' | 'org_id' | 'created_at' | 'updated_at'>
>;

export function useUpdateBookingPage() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: BookingPageUpsertData & { id?: string }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      const slug = data.slug || currentOrg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      if (data.id) {
        // Update existing
        const { data: updated, error } = await (supabase as any)
          .from('booking_pages')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)
          .eq('org_id', currentOrg.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Insert new
        const { data: inserted, error } = await (supabase as any)
          .from('booking_pages')
          .insert({
            org_id: currentOrg.id,
            slug,
            ...data,
          })
          .select()
          .single();

        if (error) throw error;
        return inserted;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-page'] });
      toast({ title: 'Booking page saved' });
    },
    onError: (error: Error) => {
      const msg = error.message.includes('duplicate') || error.message.includes('unique')
        ? 'This URL slug is already taken. Please choose a different one.'
        : error.message;
      toast({ title: 'Failed to save booking page', description: msg, variant: 'destructive' });
    },
  });
}

// ─── Sync booking page teachers ──────────────────────────

export function useBookingPageTeachers() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingPageId,
      teacherIds,
    }: {
      bookingPageId: string;
      teacherIds: string[];
    }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Delete all existing teacher selections
      const { error: deleteError } = await (supabase as any)
        .from('booking_page_teachers')
        .delete()
        .eq('booking_page_id', bookingPageId)
        .eq('org_id', currentOrg.id);

      if (deleteError) throw deleteError;

      // Insert new selections
      if (teacherIds.length > 0) {
        const rows = teacherIds.map((teacher_id) => ({
          booking_page_id: bookingPageId,
          teacher_id,
          org_id: currentOrg.id,
        }));

        const { error: insertError } = await (supabase as any)
          .from('booking_page_teachers')
          .insert(rows);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-page'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update teachers', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Sync booking page instruments ───────────────────────

export function useBookingPageInstruments() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bookingPageId,
      instrumentIds,
    }: {
      bookingPageId: string;
      instrumentIds: string[];
    }) => {
      if (!currentOrg) throw new Error('No organisation selected');

      // Delete all existing instrument selections
      const { error: deleteError } = await (supabase as any)
        .from('booking_page_instruments')
        .delete()
        .eq('booking_page_id', bookingPageId)
        .eq('org_id', currentOrg.id);

      if (deleteError) throw deleteError;

      // Insert new selections
      if (instrumentIds.length > 0) {
        const rows = instrumentIds.map((instrument_id) => ({
          booking_page_id: bookingPageId,
          instrument_id,
          org_id: currentOrg.id,
        }));

        const { error: insertError } = await (supabase as any)
          .from('booking_page_instruments')
          .insert(rows);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-page'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update instruments', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Public: fetch booking page by slug ──────────────────

export interface PublicBookingPage extends BookingPageConfig {
  booking_page_teachers: Array<{
    id: string;
    teacher_id: string;
    teacher?: {
      id: string;
      display_name: string;
      bio: string | null;
      instruments: string[];
    };
  }>;
  booking_page_instruments: Array<{
    id: string;
    instrument_id: string;
    instrument?: {
      id: string;
      name: string;
      category: string;
    };
  }>;
  organisation?: {
    id: string;
    name: string;
    timezone: string;
  };
}

export function usePublicBookingPage(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-booking-page', slug],
    queryFn: async (): Promise<PublicBookingPage | null> => {
      if (!slug) return null;

      const { data, error } = await (supabase as any)
        .from('booking_pages')
        .select(`
          *,
          booking_page_teachers(
            id,
            teacher_id,
            teacher:teachers(id, display_name, bio, instruments)
          ),
          booking_page_instruments(
            id,
            instrument_id,
            instrument:instruments(id, name, category)
          ),
          organisation:organisations(id, name, timezone)
        `)
        .eq('slug', slug)
        .eq('enabled', true)
        .maybeSingle();

      if (error) throw error;
      return data as PublicBookingPage | null;
    },
    enabled: !!slug,
    staleTime: STALE_STABLE,
  });
}

// ─── Slot fetching (edge function) ───────────────────────

export interface TimeSlot {
  time: string; // HH:mm format
  teacher_id: string;
  teacher_name: string;
  date: string; // YYYY-MM-DD
}

export async function fetchBookingSlots(params: {
  booking_page_id: string;
  date: string;
  instrument_id?: string;
  teacher_id?: string;
}): Promise<TimeSlot[]> {
  try {
    const { data, error } = await supabase.functions.invoke('booking-get-slots', {
      body: params,
    });

    if (error) throw error;
    if (data?.slots) return data.slots as TimeSlot[];
  } catch {
    // TODO: Remove mock slots once edge function is deployed.
    // For now, return simulated slots so the UI can be developed and tested.
    return generateMockSlots(params.date, params.teacher_id);
  }

  return [];
}

function generateMockSlots(date: string, teacherId?: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const morningTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
  const afternoonTimes = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const eveningTimes = ['17:00', '17:30', '18:00', '18:30', '19:00'];

  const allTimes = [...morningTimes, ...afternoonTimes, ...eveningTimes];
  const teacherNames = ['Ms. Johnson', 'Mr. Smith', 'Mrs. Davis'];

  // Simulate some randomness based on the date string hash
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) - hash + date.charCodeAt(i)) | 0;
  }

  for (const time of allTimes) {
    // Use hash to pseudo-randomly include/exclude slots
    hash = ((hash << 5) - hash + time.charCodeAt(0)) | 0;
    if (Math.abs(hash) % 3 === 0) continue; // skip ~1/3 of slots

    const teacherIndex = Math.abs(hash) % teacherNames.length;
    slots.push({
      time,
      teacher_id: teacherId || `mock-teacher-${teacherIndex}`,
      teacher_name: teacherNames[teacherIndex],
      date,
    });
  }

  return slots;
}
