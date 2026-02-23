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
    const { invoiceId, successUrl, cancelUrl, installmentId: requestedInstallmentId, payRemaining } = await req.json();
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
        paid_minor,
        currency_code,
        status,
        payment_plan_enabled,
        installment_count,
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

    // Verify caller is authorized to pay this invoice
    const { data: isAuthorized } = await supabase.rpc('is_invoice_payer', {
      _user_id: user.id,
      _invoice_id: invoiceId,
    });
    if (!isAuthorized) {
      throw new Error("You are not authorized to pay this invoice");
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

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount_minor, 0) || 0;
    const amountDue = invoice.total_minor - totalPaid;

    if (amountDue <= 0) {
      throw new Error("Invoice is already fully paid");
    }

    // ─── Determine payment amount & description based on installment logic ───
    let paymentAmount: number;
    let description: string;
    let resolvedInstallmentId: string | null = null;

    if (requestedInstallmentId) {
      // Specific installment requested
      const { data: installment, error: instError } = await supabase
        .from("invoice_installments")
        .select("*")
        .eq("id", requestedInstallmentId)
        .eq("invoice_id", invoice.id)
        .in("status", ["pending", "overdue"])
        .single();

      if (instError || !installment) {
        throw new Error("Installment not found or already paid");
      }

      paymentAmount = installment.amount_minor;
      description = `${invoice.invoice_number} — Installment ${installment.installment_number} of ${invoice.installment_count}`;
      resolvedInstallmentId = installment.id;

    } else if (payRemaining && invoice.payment_plan_enabled) {
      // Pay remaining balance for payment plan invoice (use fresh calculation, not cached paid_minor)
      paymentAmount = amountDue;
      description = `${invoice.invoice_number} — Remaining balance`;

    } else if (invoice.payment_plan_enabled) {
      // Auto-select next unpaid installment
      const { data: nextInstallment, error: nextError } = await supabase
        .from("invoice_installments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .in("status", ["pending", "overdue"])
        .order("installment_number", { ascending: true })
        .limit(1)
        .single();

      if (nextError || !nextInstallment) {
        throw new Error("All installments are already paid");
      }

      paymentAmount = nextInstallment.amount_minor;
      description = `${invoice.invoice_number} — Installment ${nextInstallment.installment_number} of ${invoice.installment_count}`;
      resolvedInstallmentId = nextInstallment.id;

    } else {
      // Standard full-amount payment (existing behaviour)
      paymentAmount = amountDue;
      description = `Invoice ${invoice.invoice_number}`;
    }

    if (paymentAmount <= 0) {
      throw new Error("Nothing to pay");
    }

    // Cap payment at amount due (prevents overpayment for installments that exceed remaining balance)
    if (paymentAmount > amountDue) {
      paymentAmount = amountDue;
      description += " (capped at remaining balance)";
    }

    // Check for an active pending checkout session to prevent duplicates
    const { data: pendingSessions } = await supabase
      .from("stripe_checkout_sessions")
      .select("id, stripe_session_id, expires_at")
      .eq("invoice_id", invoiceId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (pendingSessions && pendingSessions.length > 0) {
      // Expire old sessions — they'll 404 on Stripe but won't double-charge
      await supabase
        .from("stripe_checkout_sessions")
        .update({ status: "expired" })
        .in("id", pendingSessions.map((s: any) => s.id));
    }

    // Get payer email
    const payerEmail = (invoice.guardians as any)?.email || 
                       (invoice.students as any)?.email || 
                       user.email;
    
    const payerName = (invoice.guardians as any)?.full_name ||
                      `${(invoice.students as any)?.first_name || ''} ${(invoice.students as any)?.last_name || ''}`.trim() ||
                      "Customer";

    // Get currency code
    const currencyCode = (invoice.currency_code || (invoice.organisations as any)?.currency_code || "GBP").toLowerCase();

    // Fetch org's Stripe Connect info and payment preferences
    const { data: orgConnect } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id, stripe_connect_status, platform_fee_percent, payment_methods_enabled, online_payments_enabled")
      .eq("id", invoice.org_id)
      .single();

    // Check if online payments are enabled
    if (orgConnect && orgConnect.online_payments_enabled === false) {
      throw new Error("Online payments are disabled for this organisation. Please pay by bank transfer.");
    }

    const hasConnectedAccount = orgConnect?.stripe_connect_account_id && orgConnect?.stripe_connect_status === "active";

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

    // Build checkout session params
    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : payerEmail,
      payment_method_types: orgConnect?.payment_methods_enabled?.length > 0
        ? orgConnect.payment_methods_enabled
        : ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currencyCode,
            product_data: {
              name: description,
              description: `Payment for ${description}`,
            },
            unit_amount: paymentAmount,
          },
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        lessonloop_invoice_id: invoiceId,
        lessonloop_org_id: invoice.org_id,
        lessonloop_installment_id: resolvedInstallmentId || "",
        lessonloop_pay_remaining: payRemaining ? "true" : "false",
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    };

    // Route funds to connected account if Stripe Connect is active
    if (hasConnectedAccount) {
      const feePercent = Number(orgConnect.platform_fee_percent) || 0;
      const applicationFee = feePercent > 0 ? Math.round(paymentAmount * (feePercent / 100)) : 0;
      
      sessionParams.payment_intent_data = {
        transfer_data: {
          destination: orgConnect.stripe_connect_account_id,
        },
        ...(applicationFee > 0 && { application_fee_amount: applicationFee }),
      };
    }

    // Create Stripe Checkout Session with idempotency key
    const idempotencyKey = `checkout_${invoiceId}_${resolvedInstallmentId || "full"}_${paymentAmount}_${Date.now()}`;
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });

    // Record the session in our database
    const { error: insertError } = await supabase
      .from("stripe_checkout_sessions")
      .insert({
        org_id: invoice.org_id,
        invoice_id: invoiceId,
        stripe_session_id: session.id,
        stripe_customer_id: customerId,
        amount_minor: paymentAmount,
        currency_code: currencyCode,
        status: "pending",
        payer_email: payerEmail,
        payer_user_id: user.id,
        expires_at: new Date(session.expires_at! * 1000).toISOString(),
        metadata: {
          invoice_number: invoice.invoice_number,
          installment_id: resolvedInstallmentId || null,
          pay_remaining: payRemaining ? true : false,
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
