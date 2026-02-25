import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface BookingChild {
  first_name: string;
  last_name?: string;
  age?: number;
  instrument?: string;
  experience_level?: string;
}

interface BookingRequest {
  slug: string;
  slot: {
    date: string;
    start_time: string;
    teacher_id: string;
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
    const { slug, slot, contact, children, notes } = body;

    // Validate required fields
    if (!slug || !slot?.date || !slot?.start_time || !slot?.teacher_id) {
      return new Response(JSON.stringify({ error: 'Missing slot information' }), { status: 400, headers: jsonHeaders });
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

    // 2. Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        org_id: orgId,
        contact_name: contact.name,
        contact_email: contact.email,
        contact_phone: contact.phone || null,
        stage: 'trial_booked',
        source: 'booking_page',
        source_detail: slug,
        preferred_instrument: children[0]?.instrument || null,
        trial_date: `${slot.date}T${slot.start_time}:00`,
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
    await supabase.from('lead_activities').insert([
      {
        lead_id: lead.id,
        org_id: orgId,
        activity_type: 'created',
        description: `New enquiry via booking page (${slug})`,
        metadata: { source: 'booking_page', slot },
      },
      {
        lead_id: lead.id,
        org_id: orgId,
        activity_type: 'trial_booked',
        description: `Trial requested for ${slot.date} at ${slot.start_time}`,
        metadata: { slot },
      },
    ]);

    // 5. Send confirmation email to the contact
    if (RESEND_API_KEY) {
      try {
        const childNames = children.map(c => c.first_name).join(', ');
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'LessonLoop <noreply@lessonloop.net>',
            to: [contact.email],
            subject: `Trial lesson request received - ${orgName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0d9488;">Trial Lesson Request Received</h2>
                <p>Hi ${contact.name},</p>
                <p>Thank you for your interest in ${orgName}! We've received your trial lesson request.</p>
                <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0;"><strong>Date:</strong> ${slot.date}</p>
                  <p style="margin: 4px 0;"><strong>Time:</strong> ${slot.start_time}</p>
                  <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${childNames}</p>
                </div>
                <p>The team will review your request and confirm the booking shortly. You'll receive another email once confirmed.</p>
                ${bookingPage.confirmation_message ? `<p style="color: #666; font-style: italic;">${bookingPage.confirmation_message}</p>` : ''}
                <p style="color: #999; font-size: 12px; margin-top: 32px;">This email was sent by LessonLoop on behalf of ${orgName}.</p>
              </div>
            `,
          }),
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
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'LessonLoop <noreply@lessonloop.net>',
              to: adminEmails,
              subject: `New trial booking request from ${contact.name}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #0d9488;">New Trial Lesson Request</h2>
                  <p>A new trial lesson has been requested via your booking page.</p>
                  <div style="background: #f0fdfa; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>Contact:</strong> ${contact.name} (${contact.email}${contact.phone ? `, ${contact.phone}` : ''})</p>
                    <p style="margin: 4px 0;"><strong>Student${children.length > 1 ? 's' : ''}:</strong> ${childSummary}</p>
                    <p style="margin: 4px 0;"><strong>Requested:</strong> ${slot.date} at ${slot.start_time}</p>
                    ${notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${notes}</p>` : ''}
                  </div>
                  <p>Head to the <a href="https://app.lessonloop.net/leads" style="color: #0d9488;">Leads</a> page to review and confirm.</p>
                </div>
              `,
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
