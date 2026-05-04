// One-shot migration dump.
// Auth: requires service-role bearer token (we check it ourselves; verify_jwt=false).
// Dumps every table in public + selected system tables to JSON files in the
// `migration-dump` storage bucket and returns a manifest with 7-day signed URLs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "migration-dump";
const SIGN_EXPIRES = 60 * 60 * 24 * 7; // 7 days

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// PostgREST is only exposed for `public`. For non-public schemas we use
// the admin REST shape (auth.users, auth.identities) or read via SQL via
// the Storage REST proxy. To keep this self-contained we hit PostgREST
// for public.* and use the Admin API + `from('schema.table')` workaround
// for system tables.

async function fetchAllRows(
  schema: string,
  table: string,
  pageSize = 1000,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let from = 0;
  // Build a per-schema client so PostgREST routes correctly.
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: schema as "public" },
  });
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${schema}.${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function fetchAuthUsers(): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      all.push({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: u.phone_confirmed_at,
        confirmed_at: u.confirmed_at,
        invited_at: u.invited_at,
        banned_until: (u as { banned_until?: string }).banned_until,
        is_anonymous: (u as { is_anonymous?: boolean }).is_anonymous,
        role: u.role,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
        identities: u.identities?.map((i) => ({
          id: i.id,
          user_id: i.user_id,
          provider: i.provider,
          identity_data: i.identity_data,
          last_sign_in_at: i.last_sign_in_at,
          created_at: i.created_at,
          updated_at: i.updated_at,
        })),
      });
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function uploadJson(
  filename: string,
  rows: unknown[],
): Promise<{ size: number; signed_url: string | null }> {
  const body = JSON.stringify(rows);
  const blob = new Blob([body], { type: "application/json" });
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, { upsert: true, contentType: "application/json" });
  if (upErr) throw new Error(`upload ${filename}: ${upErr.message}`);
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filename, SIGN_EXPIRES);
  if (signErr) {
    return { size: body.length, signed_url: null };
  }
  return { size: body.length, signed_url: signed?.signedUrl ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Service-role bearer required.
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token !== SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — provide service-role key" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Discover all public tables.
  const { data: tablesData, error: tablesErr } = await supabase
    .schema("information_schema" as "public")
    .from("tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_type", "BASE TABLE");
  if (tablesErr) {
    return new Response(
      JSON.stringify({ error: `discover tables: ${tablesErr.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const publicTables = (tablesData as { table_name: string }[])
    .map((r) => r.table_name)
    .sort();

  const manifest: Array<{
    schema: string;
    table: string;
    row_count: number;
    file: string;
    size_bytes: number;
    signed_url: string | null;
    error?: string;
  }> = [];

  // Public schema
  for (const table of publicTables) {
    try {
      const rows = await fetchAllRows("public", table);
      const file = `public.${table}.json`;
      const { size, signed_url } = await uploadJson(file, rows);
      manifest.push({
        schema: "public",
        table,
        row_count: rows.length,
        file,
        size_bytes: size,
        signed_url,
      });
    } catch (e) {
      manifest.push({
        schema: "public",
        table,
        row_count: 0,
        file: `public.${table}.json`,
        size_bytes: 0,
        signed_url: null,
        error: (e as Error).message,
      });
    }
  }

  // auth.users (sanitised — no password hashes)
  try {
    const users = await fetchAuthUsers();
    const { size, signed_url } = await uploadJson("auth.users.json", users);
    manifest.push({
      schema: "auth",
      table: "users",
      row_count: users.length,
      file: "auth.users.json",
      size_bytes: size,
      signed_url,
    });
    // identities are nested in users — also export flat for convenience
    const flatIdent: unknown[] = [];
    for (const u of users as Array<{ identities?: unknown[] }>) {
      if (Array.isArray(u.identities)) flatIdent.push(...u.identities);
    }
    const { size: s2, signed_url: u2 } = await uploadJson(
      "auth.identities.json",
      flatIdent,
    );
    manifest.push({
      schema: "auth",
      table: "identities",
      row_count: flatIdent.length,
      file: "auth.identities.json",
      size_bytes: s2,
      signed_url: u2,
    });
  } catch (e) {
    manifest.push({
      schema: "auth",
      table: "users",
      row_count: 0,
      file: "auth.users.json",
      size_bytes: 0,
      signed_url: null,
      error: (e as Error).message,
    });
  }

  // System tables: cron.job, storage.buckets, storage.objects
  const systemTables: Array<{ schema: string; table: string }> = [
    { schema: "cron", table: "job" },
    { schema: "storage", table: "buckets" },
    { schema: "storage", table: "objects" },
  ];
  for (const { schema, table } of systemTables) {
    try {
      const rows = await fetchAllRows(schema, table);
      const file = `${schema}.${table}.json`;
      const { size, signed_url } = await uploadJson(file, rows);
      manifest.push({
        schema,
        table,
        row_count: rows.length,
        file,
        size_bytes: size,
        signed_url,
      });
    } catch (e) {
      manifest.push({
        schema,
        table,
        row_count: 0,
        file: `${schema}.${table}.json`,
        size_bytes: 0,
        signed_url: null,
        error: (e as Error).message,
      });
    }
  }

  // Upload manifest itself
  const manifestBody = JSON.stringify(
    { generated_at: new Date().toISOString(), entries: manifest },
    null,
    2,
  );
  await supabase.storage
    .from(BUCKET)
    .upload("_manifest.json", new Blob([manifestBody], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  const { data: manifestSigned } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl("_manifest.json", SIGN_EXPIRES);

  return new Response(
    JSON.stringify(
      {
        ok: true,
        bucket: BUCKET,
        manifest_url: manifestSigned?.signedUrl ?? null,
        entries: manifest,
        totals: {
          tables: manifest.length,
          rows: manifest.reduce((a, m) => a + m.row_count, 0),
          bytes: manifest.reduce((a, m) => a + m.size_bytes, 0),
          errors: manifest.filter((m) => m.error).length,
        },
      },
      null,
      2,
    ),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
