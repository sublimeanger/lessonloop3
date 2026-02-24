import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, "stripe-create-checkout");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    // Parse request
    const {
      invoiceId,
      installmentId: requestedInstallmentId,
      payRemaining,
    } = await req.json();
    if (!invoiceId) throw new Error("invoiceId is required");

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
        guardians:payer_guardian_id (id, email, full_name),
        students:payer_student_id (email, first_name, last_name)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) throw new Error("Invoice not found");

    // Check invoice is payable
    if (!["sent", "overdue"].includes(invoice.status)) {
      throw new Error(`Invoice cannot be paid (status: ${invoice.status})`);
    }

    // Calculate amount due
    const { data: payments } = await supabase
      .from("payments")
      .select("amount_minor")
      .eq("invoice_id", invoiceId);

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + p.amount_minor, 0) || 0;
    const amountDue = invoice.total_minor - totalPaid;

    if (amountDue <= 0) throw new Error("Invoice is already fully paid");

    // Determine payment amount & description
    let paymentAmount: number;
    let description: string;
    let resolvedInstallmentId: string | null = null;

    if (requestedInstallmentId) {
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
      paymentAmount = invoice.total_minor - (invoice.paid_minor || 0);
      description = `${invoice.invoice_number} — Remaining balance`;

    } else if (invoice.payment_plan_enabled) {
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
      paymentAmount = amountDue;
      description = `Invoice ${invoice.invoice_number}`;
    }

    if (paymentAmount <= 0) throw new Error("Nothing to pay");

    // Cap at amount due
    if (paymentAmount > amountDue) {
      paymentAmount = amountDue;
      description += " (capped at remaining balance)";
    }

    // Get payer info
    const payerEmail = (invoice.guardians as any)?.email ||
                       (invoice.students as any)?.email ||
                       user.email;

    const payerName = (invoice.guardians as any)?.full_name ||
                      `${(invoice.students as any)?.first_name || ''} ${(invoice.students as any)?.last_name || ''}`.trim() ||
                      "Customer";

    const currencyCode = (invoice.currency_code || (invoice.organisations as any)?.currency_code || "GBP").toLowerCase();

    // Fetch org Stripe Connect info
    const { data: orgConnect } = await supabase
      .from("organisations")
      .select("stripe_connect_account_id, stripe_connect_status, platform_fee_percent, payment_methods_enabled, online_payments_enabled")
      .eq("id", invoice.org_id)
      .single();

    if (orgConnect && orgConnect.online_payments_enabled === false) {
      throw new Error("Online payments are disabled for this organisation.");
    }

    const hasConnectedAccount = orgConnect?.stripe_connect_account_id && orgConnect?.stripe_connect_status === "active";

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find or create Stripe Customer
    let customerId: string | undefined;
    if (payerEmail) {
      // Check guardian_payment_preferences first
      if (invoice.payer_guardian_id) {
        const { data: prefs } = await supabase
          .from("guardian_payment_preferences")
          .select("stripe_customer_id")
          .eq("guardian_id", invoice.payer_guardian_id)
          .eq("org_id", invoice.org_id)
          .maybeSingle();

        if (prefs?.stripe_customer_id) {
          // Verify customer still exists in Stripe
          try {
            await stripe.customers.retrieve(prefs.stripe_customer_id);
            customerId = prefs.stripe_customer_id;
          } catch {
            // Customer deleted in Stripe, create new one
          }
        }
      }

      if (!customerId) {
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

        // Persist customer ID in guardian_payment_preferences
        if (invoice.payer_guardian_id) {
          await supabase
            .from("guardian_payment_preferences")
            .upsert({
              guardian_id: invoice.payer_guardian_id,
              org_id: invoice.org_id,
              stripe_customer_id: customerId,
            }, { onConflict: "guardian_id,org_id" });
        }
      }
    }

    // Build PaymentIntent params
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: paymentAmount,
      currency: currencyCode,
      customer: customerId,
      description,
      setup_future_usage: "off_session",
      payment_method_types: orgConnect?.payment_methods_enabled?.length > 0
        ? orgConnect.payment_methods_enabled
        : ["card"],
      metadata: {
        lessonloop_invoice_id: invoiceId,
        lessonloop_org_id: invoice.org_id,
        lessonloop_installment_id: resolvedInstallmentId || "",
        lessonloop_pay_remaining: payRemaining ? "true" : "false",
      },
    };

    // Route funds to connected account if active
    if (hasConnectedAccount) {
      const feePercent = Number(orgConnect.platform_fee_percent) || 0;
      const applicationFee = feePercent > 0 ? Math.round(paymentAmount * (feePercent / 100)) : 0;

      paymentIntentParams.transfer_data = {
        destination: orgConnect.stripe_connect_account_id!,
      };
      if (applicationFee > 0) {
        paymentIntentParams.application_fee_amount = applicationFee;
      }
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Record session in database for tracking
    await supabase
      .from("stripe_checkout_sessions")
      .insert({
        org_id: invoice.org_id,
        invoice_id: invoiceId,
        stripe_session_id: `pi_${paymentIntent.id}`,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customerId,
        amount_minor: paymentAmount,
        currency_code: currencyCode,
        status: "pending",
        payer_email: payerEmail,
        payer_user_id: user.id,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata: {
          invoice_number: invoice.invoice_number,
          installment_id: resolvedInstallmentId || null,
          pay_remaining: payRemaining ? true : false,
          type: "payment_intent",
        },
      });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId,
        amount: paymentAmount,
        currency: currencyCode,
        description,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe create payment intent error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
