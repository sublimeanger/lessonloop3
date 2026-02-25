import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface SlotRequest {
  slug: string;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  teacher_id?: string;
}

interface Slot {
  date: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  teacher_id: string;
  teacher_name: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body: SlotRequest = await req.json();
    const { slug, date_from, date_to, teacher_id } = body;

    if (!slug || !date_from || !date_to) {
      return new Response(JSON.stringify({ error: 'slug, date_from, date_to are required' }), { status: 400, headers: jsonHeaders });
    }

    // Use service role to bypass RLS for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get booking page
    const { data: bookingPage, error: bpError } = await supabase
      .from('booking_pages')
      .select('*, org:organisations(id, timezone, schedule_start_hour, schedule_end_hour)')
      .eq('slug', slug)
      .eq('enabled', true)
      .single();

    if (bpError || !bookingPage) {
      return new Response(JSON.stringify({ error: 'Booking page not found' }), { status: 404, headers: jsonHeaders });
    }

    const orgId = bookingPage.org_id;
    const orgTz = bookingPage.org?.timezone || 'Europe/London';
    const durationMins = bookingPage.lesson_duration_mins;
    const bufferMins = bookingPage.buffer_minutes || 0;
    const minNoticeHours = bookingPage.min_notice_hours || 24;

    // 2. Get bookable teachers
    const { data: bpTeachers } = await supabase
      .from('booking_page_teachers')
      .select('teacher_id, teacher:teachers(id, display_name, user_id)')
      .eq('booking_page_id', bookingPage.id);

    if (!bpTeachers || bpTeachers.length === 0) {
      return new Response(JSON.stringify({ slots: [] }), { status: 200, headers: jsonHeaders });
    }

    const teachers = bpTeachers
      .filter((t: any) => t.teacher)
      .map((t: any) => ({
        id: t.teacher.id,
        name: t.teacher.display_name,
        user_id: t.teacher.user_id,
      }));

    // Optionally filter to a single teacher
    const filteredTeachers = teacher_id ? teachers.filter((t: any) => t.id === teacher_id) : teachers;
    if (filteredTeachers.length === 0) {
      return new Response(JSON.stringify({ slots: [] }), { status: 200, headers: jsonHeaders });
    }

    // 3. Get availability blocks for all teachers
    const teacherIds = filteredTeachers.map((t: any) => t.id);
    const { data: availBlocks } = await supabase
      .from('availability_blocks')
      .select('*')
      .eq('org_id', orgId)
      .in('teacher_id', teacherIds);

    // 4. Get existing lessons in date range (not cancelled)
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('id, teacher_id, start_at, end_at')
      .eq('org_id', orgId)
      .in('teacher_id', teacherIds)
      .neq('status', 'cancelled')
      .gte('start_at', `${date_from}T00:00:00`)
      .lte('start_at', `${date_to}T23:59:59`);

    // 5. Get time-off blocks in date range
    const { data: timeOff } = await supabase
      .from('time_off_blocks')
      .select('*')
      .eq('org_id', orgId)
      .in('teacher_id', teacherIds)
      .lte('start_at', `${date_to}T23:59:59`)
      .gte('end_at', `${date_from}T00:00:00`);

    // 6. Get closure dates
    const { data: closures } = await supabase
      .from('closure_dates')
      .select('date')
      .eq('org_id', orgId)
      .gte('date', date_from)
      .lte('date', date_to);

    const closureDates = new Set((closures || []).map((c: any) => c.date));

    // 7. Calculate slots
    const now = new Date();
    const minNoticeTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
    const slots: Slot[] = [];

    // Iterate each day in range
    const startDate = new Date(date_from + 'T00:00:00');
    const endDate = new Date(date_to + 'T00:00:00');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      if (closureDates.has(dateStr)) continue;

      const dayOfWeek = DAY_NAMES[d.getDay()];

      for (const teacher of filteredTeachers) {
        // Get availability for this teacher on this day
        const teacherAvail = (availBlocks || []).filter(
          (b: any) => b.teacher_id === teacher.id && b.day_of_week === dayOfWeek
        );

        for (const block of teacherAvail) {
          // Parse block times (HH:MM:SS format)
          const blockStart = parseTimeToMinutes(block.start_time_local);
          const blockEnd = parseTimeToMinutes(block.end_time_local);

          // Generate slots within this availability block
          for (let slotStart = blockStart; slotStart + durationMins <= blockEnd; slotStart += durationMins + bufferMins) {
            const slotEnd = slotStart + durationMins;
            const slotStartTime = minutesToTime(slotStart);
            const slotEndTime = minutesToTime(slotEnd);

            // Check minimum notice
            const slotDateTime = new Date(`${dateStr}T${slotStartTime}:00`);
            if (slotDateTime <= minNoticeTime) continue;

            // Check for conflicts with existing lessons
            const hasConflict = (existingLessons || []).some((lesson: any) => {
              if (lesson.teacher_id !== teacher.id) return false;
              const lessonStart = new Date(lesson.start_at);
              const lessonEnd = new Date(lesson.end_at);
              const sStart = new Date(`${dateStr}T${slotStartTime}:00`);
              const sEnd = new Date(`${dateStr}T${slotEndTime}:00`);
              return sStart < lessonEnd && sEnd > lessonStart;
            });
            if (hasConflict) continue;

            // Check for time-off conflicts
            const hasTimeOff = (timeOff || []).some((to: any) => {
              if (to.teacher_id !== teacher.id) return false;
              const toStart = new Date(to.start_at);
              const toEnd = new Date(to.end_at);
              const sStart = new Date(`${dateStr}T${slotStartTime}:00`);
              const sEnd = new Date(`${dateStr}T${slotEndTime}:00`);
              return sStart < toEnd && sEnd > toStart;
            });
            if (hasTimeOff) continue;

            slots.push({
              date: dateStr,
              start_time: slotStartTime,
              end_time: slotEndTime,
              teacher_id: teacher.id,
              teacher_name: teacher.name,
            });
          }
        }
      }
    }

    // Sort by date, then time
    slots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    return new Response(JSON.stringify({ slots }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error('booking-get-slots error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: jsonHeaders });
  }
});

function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
