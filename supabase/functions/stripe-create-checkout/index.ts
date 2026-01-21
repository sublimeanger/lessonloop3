import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create client for auth check
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request
    const { invoiceId, successUrl, cancelUrl } = await req.json();
    if (!invoiceId) {
      throw new Error("invoiceId is required");
    }

    // Create service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        org_id,
        invoice_number,
        total_minor,
        status,
        payer_guardian_id,
        payer_student_id,
        organisations (currency_code),
        guardians:payer_guardian_id (email, full_name),
        students:payer_student_id (email, first_name, last_name)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Check invoice is payable
    if (!["sent", "overdue"].includes(invoice.status)) {
      throw new Error(`Invoice cannot be paid (status: ${invoice.status})`);
    }

    // Calculate amount due (total minus any payments)
    const { data: payments } = await supabase
      .from("payments")
      .select("amount_minor")
      .eq("invoice_id", invoiceId);

    const totalPaid = payments?.reduce((sum, p) => sum + p.amount_minor, 0) || 0;
    const amountDue = invoice.total_minor - totalPaid;

    if (amountDue <= 0) {
      throw new Error("Invoice is already fully paid");
    }

    // Get payer email
    const payerEmail = (invoice.guardians as any)?.email || 
                       (invoice.students as any)?.email || 
                       user.email;
    
    const payerName = (invoice.guardians as any)?.full_name ||
                      `${(invoice.students as any)?.first_name || ''} ${(invoice.students as any)?.last_name || ''}`.trim() ||
                      "Customer";

    // Get currency code
    const currencyCode = ((invoice.organisations as any)?.currency_code || "GBP").toLowerCase();

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check for existing Stripe customer or create one
    let customerId: string | undefined;
    if (payerEmail) {
      const customers = await stripe.customers.list({ email: payerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: payerEmail,
          name: payerName,
          metadata: {
            lessonloop_org_id: invoice.org_id,
            lessonloop_guardian_id: invoice.payer_guardian_id || "",
            lessonloop_student_id: invoice.payer_student_id || "",
          },
        });
        customerId = customer.id;
      }
    }

    // Build success/cancel URLs
    const baseUrl = successUrl?.split("?")[0] || `${req.headers.get("origin")}/portal/invoices`;
    const finalSuccessUrl = `${baseUrl}?payment=success&invoice=${invoiceId}`;
    const finalCancelUrl = cancelUrl || `${baseUrl}?payment=cancelled&invoice=${invoiceId}`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : payerEmail,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currencyCode,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: amountDue,
          },
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        lessonloop_invoice_id: invoiceId,
        lessonloop_org_id: invoice.org_id,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
    });

    // Record the session in our database
    const { error: insertError } = await supabase
      .from("stripe_checkout_sessions")
      .insert({
        org_id: invoice.org_id,
        invoice_id: invoiceId,
        stripe_session_id: session.id,
        stripe_customer_id: customerId,
        amount_minor: amountDue,
        currency_code: currencyCode,
        status: "pending",
        payer_email: payerEmail,
        payer_user_id: user.id,
        expires_at: new Date(session.expires_at! * 1000).toISOString(),
        metadata: {
          invoice_number: invoice.invoice_number,
        },
      });

    if (insertError) {
      console.error("Failed to record checkout session:", insertError);
      // Don't fail - the payment can still proceed
    }

    return new Response(
      JSON.stringify({ 
        sessionId: session.id, 
        url: session.url 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe checkout error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
