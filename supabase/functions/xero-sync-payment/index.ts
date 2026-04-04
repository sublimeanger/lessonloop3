import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getValidXeroToken } from "../_shared/xero-auth.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- JWT Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { payment_id } = await req.json();
    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'payment_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // (a) Look up payment with related invoice
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoices!payments_invoice_id_fkey (id, org_id)
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const invoice = payment.invoice as any;
    const orgId = invoice.org_id;

    // --- Org membership check ---
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // (b) Get Xero connection + valid token
    const { data: connection, error: connError } = await supabase
      .from('xero_connections')
      .select('*')
      .eq('org_id', orgId)
      .eq('sync_status', 'active')
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Xero not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidXeroToken(supabase, connection);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to get Xero access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = connection.tenant_id;
    const xeroHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // (c) Look up invoice Xero mapping
    const { data: invoiceMapping } = await supabase
      .from('xero_entity_mappings')
      .select('xero_id')
      .eq('org_id', orgId)
      .eq('entity_type', 'invoice')
      .eq('local_id', invoice.id)
      .maybeSingle();

    if (!invoiceMapping) {
      return new Response(JSON.stringify({
        error: 'Invoice not synced to Xero yet. Sync the invoice first.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // (d) Check if payment already mapped (idempotent)
    const { data: existingPaymentMapping } = await supabase
      .from('xero_entity_mappings')
      .select('xero_id')
      .eq('org_id', orgId)
      .eq('entity_type', 'payment')
      .eq('local_id', payment_id)
      .maybeSingle();

    if (existingPaymentMapping) {
      return new Response(JSON.stringify({
        success: true,
        xero_payment_id: existingPaymentMapping.xero_id,
        message: 'Payment already synced',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // (e) Create Xero payment
    const paymentBody = {
      Invoice: { InvoiceID: invoiceMapping.xero_id },
      Account: { Code: '090' },
      Date: new Date(payment.created_at).toISOString().split('T')[0],
      Amount: payment.amount_minor / 100,
      Reference: `LL-PMT-${payment.id.substring(0, 8)}`,
    };

    const paymentRes = await fetch('https://api.xero.com/api.xro/2.0/Payments', {
      method: 'POST',
      headers: xeroHeaders,
      body: JSON.stringify(paymentBody),
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('Xero create payment failed:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to create Xero payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentData = await paymentRes.json();
    const xeroPaymentId = paymentData.Payments[0].PaymentID;

    // Save mapping
    await supabase
      .from('xero_entity_mappings')
      .insert({
        org_id: orgId,
        entity_type: 'payment',
        local_id: payment_id,
        xero_id: xeroPaymentId,
      });

    // (f) Return success
    return new Response(JSON.stringify({ success: true, xero_payment_id: xeroPaymentId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Xero sync payment error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
