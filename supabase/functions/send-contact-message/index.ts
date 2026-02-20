import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RECIPIENT_EMAIL = 'jamie@searchflare.co.uk';

interface ContactRequest {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: ContactRequest = await req.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email || !body.subject || !body.message) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message length
    if (body.message.length < 10 || body.message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Message must be between 10 and 2000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs for email — use full HTML entity escaping
    const escapeHtml = (str: string): string =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const sanitizedData = {
      firstName: escapeHtml(body.firstName.slice(0, 50)),
      lastName: escapeHtml(body.lastName.slice(0, 50)),
      email: body.email.slice(0, 255),
      subject: escapeHtml(body.subject.slice(0, 100)),
      message: escapeHtml(body.message.slice(0, 2000)),
    };

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      // Still return success for demo/dev purposes - form submission works
      console.log('Contact form submission (email not sent):', sanitizedData);
      return new Response(
        JSON.stringify({ success: true, message: 'Message received (email delivery pending configuration)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LessonLoop Contact <noreply@lessonloop.net>',
        to: [RECIPIENT_EMAIL],
        reply_to: sanitizedData.email,
        subject: 'LessonLoop enquiry',
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${sanitizedData.firstName} ${sanitizedData.lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${sanitizedData.email}">${sanitizedData.email}</a></p>
          <p><strong>Subject:</strong> ${sanitizedData.subject}</p>
          <hr />
          <h3>Message:</h3>
          <p style="white-space: pre-wrap;">${sanitizedData.message}</p>
          <hr />
          <p style="color: #666; font-size: 12px;">
            This message was sent from the LessonLoop contact form.
          </p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send email');
    }

    console.log('Contact form email sent successfully:', {
      from: sanitizedData.email,
      subject: sanitizedData.subject,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Message sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing contact form:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process your message. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
