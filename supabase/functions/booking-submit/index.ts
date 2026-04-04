import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml, sanitiseFromName } from '../_shared/escape-html.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

function formatBookingDate(dateStr: string, timeStr: string): { date: string; time: string } {
  const d = new Date(`${dateStr}T${timeStr}:00Z`);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  return {
    date: d.toLocaleDateString('en-GB', options),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

interface BookingChild {
  first_name: string;
  last_name?: string;
  age?: number;
  instrument?: string;
  experience_level?: string;
}

interface BookingRequest {
  slug: string;
  enquiry_only?: boolean;
  slot?: {
    date: string;
    start_time: string;
    teacher_id?: string;
    teacher_ref?: string;
  };
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  children: BookingChild[];
  notes?: string;
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
    // Rate limit: 5 submissions per hour per IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';

    const rlResult = await checkRateLimit(
      `booking-${clientIp}`,
      'booking-submit',
      { maxRequests: 5, windowMinutes: 60 }
    );
    if (!rlResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many submissions. Please try again later.', retryAfterSeconds: rlResult.retryAfterSeconds }),
        { status: 429, headers: jsonHeaders }
      );
    }

    const body: BookingRequest = await req.json();
    const { slug, enquiry_only, slot, contact, children, notes } = body;

    // Validate required fields — slot is optional for enquiry-only submissions
    if (!enquiry_only) {
      if (!slug || !slot?.date || !slot?.start_time || (!slot?.teacher_id && !slot?.teacher_ref)) {
        return new Response(JSON.stringify({ error: 'Missing slot information' }), { status: 400, headers: jsonHeaders });
      }
    } else if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing booking page slug' }), { status: 400, headers: jsonHeaders });
    }

    // Resolve opaque teacher ref back to UUID if needed
    if (slot) {
      const rawTeacherRef = slot.teacher_ref || slot.teacher_id || '';
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (rawTeacherRef && !UUID_RE.test(rawTeacherRef) && /^[0-9a-f]{32}$/i.test(rawTeacherRef)) {
        const r = rawTeacherRef;
        slot.teacher_id = `${r.slice(0,8)}-${r.slice(8,12)}-${r.slice(12,16)}-${r.slice(16,20)}-${r.slice(20)}`;
      }
    }
    if (!contact?.name || !contact?.email) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400, headers: jsonHeaders });
    }
    if (!children || children.length === 0 || !children[0]?.first_name) {
      return new Response(JSON.stringify({ error: 'At least one child is required' }), { status: 400, headers: jsonHeaders });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify booking page exists and is enabled
    const { data: bookingPage, error: bpError } = await supabase
      .from('booking_pages')
      .select('id, org_id, confirmation_message, title, org:organisations(name)')
      .eq('slug', slug)
      .eq('enabled', true)
      .single();

    if (bpError || !bookingPage) {
      return new Response(JSON.stringify({ error: 'Booking page not found or disabled' }), { status: 404, headers: jsonHeaders });
    }

    const orgId = bookingPage.org_id;
    const orgName = (bookingPage as any).org?.name || bookingPage.title || 'the studio';

    // Re-validate slot availability before creating lead (skip for enquiry-only)
    if (!enquiry_only && slot) {
      const { data: bookingPageFull } = await supabase
        .from('booking_pages')
        .select('lesson_duration_mins')
        .eq('id', bookingPage.id)
        .single();

      const durationMins = bookingPageFull?.lesson_duration_mins || 60;
      const slotStartTime = `${slot.date}T${slot.start_time}:00Z`;
      const slotEndMins = parseInt(slot.start_time.split(':')[0]) * 60 +
        parseInt(slot.start_time.split(':')[1]) + durationMins;
      const endHH = String(Math.floor(slotEndMins / 60)).padStart(2, '0');
      const endMM = String(slotEndMins % 60).padStart(2, '0');
      const slotEndTime = `${slot.date}T${endHH}:${endMM}:00Z`;

      const { data: conflictingLessons } = await supabase
        .from('lessons')
        .select('id')
        .eq('org_id', orgId)
        .eq('teacher_id', slot.teacher_id)
        .neq('status', 'cancelled')
        .lt('start_at', slotEndTime)
        .gt('end_at', slotStartTime)
        .limit(1);

      if (conflictingLessons && conflictingLessons.length > 0) {
        return new Response(
          JSON.stringify({ error: 'This slot is no longer available. Please refresh and choose another time.' }),
          { status: 409, headers: jsonHeaders }
        );
      }
    }

    // 2. Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id: orgId,
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone || null,
        stage: enquiry_only ? 'new' : 'trial_booked',
        source: 'booking_page',
        source_detail: slug,
        preferred_instrument: children[0]?.instrument || null,
        trial_date: slot ? `${slot.date}T${slot.start_time}:00` : null,
        notes: notes || null,
      })
      .select('id')
      .single();

    if (leadError || !lead) {
      console.error('Failed to create lead:', leadError);
      return new Response(JSON.stringify({ error: 'Failed to submit booking' }), { status: 500, headers: jsonHeaders });
    }

    // 3. Create lead students
    const studentInserts = children.map((child) => ({
      lead_id: lead.id,
      org_id: orgId,
      first_name: child.first_name,
      last_name: child.last_name || null,
      age: child.age || null,
      instrument: child.instrument || null,
      experience_level: child.experience_level || null,
    }));

    await supabase.from('lead_students').insert(studentInserts);

    // 4. Create activity entries
    const activities = [
      {
        lead_id: lead.id,
        org_id: orgId,
        activity_type: 'created',
        description: enquiry_only
          ? `New enquiry via booking page (${slug})`
          : `New booking request via booking page (${slug})`,
        metadata: { source: 'booking_page', slot: slot || null, enquiry_only: !!enquiry_only },
      },
    ];
    if (!enquiry_only && slot) {
      activities.push({
        lead_id: lead.id,
        org_id: orgId,
        activity_type: 'trial_booked',
        description: `Trial requested for ${slot.date} at ${slot.start_time}`,
        metadata: { slot, enquiry_only: false },
      });
    }
    await supabase.from('lead_activities').insert(activities);

    // 5. Send confirmation email to the contact
    if (RESEND_API_KEY) {
      try {
        const childNames = children.map(c => c.first_name).join(', ');
        const emailSubject = enquiry_only
          ? `Enquiry received - ${orgName}`
          : `Trial lesson request received - ${orgName}`;

        let emailBody: string;
        if (enquiry_only) {
          emailBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0d9488;">Enquiry Received</h2>
              <p>Hi ${escapeHtml(contact.name)},</p>
              <p>Thank you for your interest in ${escapeHtml(orgName)}! We've received your enquiry.</p>
              <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${escapeHtml(childNames)}</p>
                ${notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
              </div>
              <p>A member of the team will be in touch shortly to discuss lesson options and availability.</p>
              ${bookingPage.confirmation_message ? `<p style="color: #666; font-style: italic;">${escapeHtml(bookingPage.confirmation_message)}</p>` : ''}
              <p style="color: #999; font-size: 12px; margin-top: 32px;">This email was sent by LessonLoop on behalf of ${escapeHtml(orgName)}.</p>
            </div>
          `;
        } else {
          const formatted = formatBookingDate(slot!.date, slot!.start_time);
          emailBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0d9488;">Trial Lesson Request Received</h2>
              <p>Hi ${escapeHtml(contact.name)},</p>
              <p>Thank you for your interest in ${escapeHtml(orgName)}! We've received your trial lesson request.</p>
              <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Date:</strong> ${formatted.date}</p>
                <p style="margin: 4px 0;"><strong>Time:</strong> ${formatted.time}</p>
                <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${escapeHtml(childNames)}</p>
              </div>
              <p>The team will review your request and confirm the booking shortly. You'll receive another email once confirmed.</p>
              ${bookingPage.confirmation_message ? `<p style="color: #666; font-style: italic;">${escapeHtml(bookingPage.confirmation_message)}</p>` : ''}
              <p style="color: #999; font-size: 12px; margin-top: 32px;">This email was sent by LessonLoop on behalf of ${escapeHtml(orgName)}.</p>
            </div>
          `;
        }

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${sanitiseFromName(orgName)} <noreply@lessonloop.net>`,
            to: [contact.email],
            subject: emailSubject,
            html: emailBody,
          }),
        });
        // Log to message_log
        await supabase.from('message_log').insert({
          org_id: orgId,
          channel: 'email',
          subject: emailSubject,
          body: '',
          sender_user_id: null,
          recipient_type: 'guardian',
          recipient_email: contact.email,
          recipient_name: contact.name,
          message_type: enquiry_only ? 'enquiry_confirmation' : 'booking_confirmation',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
        // Don't fail the booking if email fails
      }
    }

    // 6. Notify org admins (best effort)
    try {
      const { data: admins } = await supabase
        .from('org_memberships')
        .select('user_id, profiles:user_id(email)')
        .eq('org_id', orgId)
        .in('role', ['owner', 'admin'])
        .eq('status', 'active');

      if (admins && admins.length > 0 && RESEND_API_KEY) {
        const adminEmails = admins
          .map((a: any) => a.profiles?.email)
          .filter(Boolean);

        if (adminEmails.length > 0) {
          const childSummary = children.map(c => `${c.first_name}${c.instrument ? ` (${c.instrument})` : ''}`).join(', ');
          const adminSubject = enquiry_only
            ? `New enquiry from ${contact.name}`
            : `New trial booking request from ${contact.name}`;

          let adminHtmlBody: string;
          if (enquiry_only) {
            adminHtmlBody = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0d9488;">New Enquiry</h2>
                <p>A new enquiry has been submitted via your booking page.</p>
                <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Contact:</strong> ${escapeHtml(contact.name)} (${escapeHtml(contact.email)}${contact.phone ? `, ${escapeHtml(contact.phone)}` : ''})</p>
                  <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${escapeHtml(childSummary)}</p>
                  ${notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
                </div>
                <p>Head to the <a href="https://app.lessonloop.net/leads" style="color: #0d9488;">Leads</a> page to follow up.</p>
              </div>
            `;
          } else {
            const adminFormatted = formatBookingDate(slot!.date, slot!.start_time);
            adminHtmlBody = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0d9488;">New Trial Lesson Request</h2>
                <p>A new trial lesson has been requested via your booking page.</p>
                <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Contact:</strong> ${escapeHtml(contact.name)} (${escapeHtml(contact.email)}${contact.phone ? `, ${escapeHtml(contact.phone)}` : ''})</p>
                  <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${escapeHtml(childSummary)}</p>
                  <p style="margin: 4px 0;"><strong>Requested:</strong> ${adminFormatted.date} at ${adminFormatted.time}</p>
                  ${notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
                </div>
                <p>Head to the <a href="https://app.lessonloop.net/leads" style="color: #0d9488;">Leads</a> page to review and confirm.</p>
              </div>
            `;
          }

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${sanitiseFromName(orgName)} <noreply@lessonloop.net>`,
              to: adminEmails,
              subject: adminSubject,
              html: adminHtmlBody,
            }),
          });
        }
      }
    } catch (notifyErr) {
      console.error('Failed to notify admins:', notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error('booking-submit error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: jsonHeaders });
  }
});
