import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { getValidXeroToken } from "../_shared/xero-auth.ts";

/** Map LessonLoop invoice status to Xero invoice status. */
function mapInvoiceStatus(status: string): string {
  switch (status) {
    case 'draft': return 'DRAFT';
    case 'sent': return 'AUTHORISED';
    case 'paid': return 'AUTHORISED';
    case 'voided': return 'VOIDED';
    default: return 'DRAFT';
  }
}

/** Format a date string or Date as YYYY-MM-DD. */
function toXeroDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

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

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // (a) Look up invoice with items, guardian, and org
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*),
        guardian:guardians!invoices_guardian_id_fkey (id, full_name, email, phone),
        org:organisations!invoices_org_id_fkey (id, name, currency_code)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // (b) Get Xero connection
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

    // (c) Get valid access token
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

    // (d) Ensure guardian has a Xero contact mapping
    const guardian = invoice.guardian as any;
    let xeroContactId: string;

    const { data: contactMapping } = await supabase
      .from('xero_entity_mappings')
      .select('xero_id')
      .eq('org_id', orgId)
      .eq('entity_type', 'contact')
      .eq('local_id', guardian.id)
      .maybeSingle();

    if (contactMapping) {
      xeroContactId = contactMapping.xero_id;
    } else {
      // Create contact in Xero
      const contactBody = {
        Name: guardian.full_name,
        EmailAddress: guardian.email || undefined,
        Phones: guardian.phone
          ? [{ PhoneType: 'MOBILE', PhoneNumber: guardian.phone }]
          : [],
      };

      const contactRes = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
        method: 'POST',
        headers: xeroHeaders,
        body: JSON.stringify(contactBody),
      });

      if (!contactRes.ok) {
        const errorText = await contactRes.text();
        console.error('Xero create contact failed:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to create Xero contact' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const contactData = await contactRes.json();
      xeroContactId = contactData.Contacts[0].ContactID;

      // Save mapping
      await supabase
        .from('xero_entity_mappings')
        .insert({
          org_id: orgId,
          entity_type: 'contact',
          local_id: guardian.id,
          xero_id: xeroContactId,
        });
    }

    // (e) Create or update invoice in Xero
    const org = invoice.org as any;
    const invoiceItems = (invoice.invoice_items as any[]) || [];

    const xeroInvoiceBody = {
      Type: 'ACCREC',
      Contact: { ContactID: xeroContactId },
      Date: toXeroDate(invoice.created_at),
      DueDate: toXeroDate(invoice.due_date),
      Reference: `LL-${invoice.invoice_number}`,
      Status: mapInvoiceStatus(invoice.status),
      LineItems: invoiceItems.map((item: any) => ({
        Description: item.description,
        Quantity: item.quantity,
        UnitAmount: item.unit_price_minor / 100,
        AccountCode: '200',
      })),
      CurrencyCode: org.currency_code || 'USD',
    };

    // Check if invoice is already mapped
    const { data: invoiceMapping } = await supabase
      .from('xero_entity_mappings')
      .select('xero_id')
      .eq('org_id', orgId)
      .eq('entity_type', 'invoice')
      .eq('local_id', invoice_id)
      .maybeSingle();

    let xeroInvoiceId: string;

    if (invoiceMapping) {
      // Update existing Xero invoice
      const updateRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices/${invoiceMapping.xero_id}`,
        {
          method: 'POST', // Xero uses POST for updates too
          headers: xeroHeaders,
          body: JSON.stringify(xeroInvoiceBody),
        },
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('Xero update invoice failed:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to update Xero invoice' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData = await updateRes.json();
      xeroInvoiceId = updateData.Invoices[0].InvoiceID;
    } else {
      // Create new Xero invoice
      const createRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
        method: 'POST',
        headers: xeroHeaders,
        body: JSON.stringify(xeroInvoiceBody),
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        console.error('Xero create invoice failed:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to create Xero invoice' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const createData = await createRes.json();
      xeroInvoiceId = createData.Invoices[0].InvoiceID;

      // Save mapping
      await supabase
        .from('xero_entity_mappings')
        .insert({
          org_id: orgId,
          entity_type: 'invoice',
          local_id: invoice_id,
          xero_id: xeroInvoiceId,
        });
    }

    // (f) Update last_sync_at
    await supabase
      .from('xero_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    // (g) Return success
    return new Response(JSON.stringify({ success: true, xero_invoice_id: xeroInvoiceId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Xero sync invoice error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
