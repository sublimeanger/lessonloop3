// deno-lint-ignore-file no-explicit-any
/**
 * Seed a shadow-mode organisation for Lauren's shadow programme.
 *
 * Usage:
 *   POST /functions/v1/seed-shadow-org
 *   Authorization: Bearer <SERVICE_ROLE_KEY or SHADOW_ADMIN_KEY>
 *   {
 *     "tier": "teacher" | "studio" | "agency",
 *     "jamie_user_id": "<uuid>",
 *     "lauren_user_id": "<uuid>",
 *     "org_name": "Lauren's Shadow Studio",  // optional override
 *     "reset": false                          // if true, delete existing shadow org first
 *   }
 *
 * SCOPE (s31 minimal — functional foundation):
 * - 1 organisation (shadow_mode=true, stripe_test_mode=true)
 * - Jamie (owner) + Lauren (admin) memberships + profiles
 * - 2 teachers, 1 location, 2 rooms
 * - 3 terms (autumn/spring/summer) + 3 UK half-term closures
 *
 * NOT seeded in s31 (deferred to s32 once schema constraints are
 * fully mapped against this evolving prod schema):
 * - students + guardians (need rate_cards + payment_plan_preference)
 * - lessons + recurrence (need lesson_type, is_online, is_open_slot)
 * - invoices + payments (need issue_date, subtotal_minor, tax_minor,
 *   vat_rate, credit_applied_minor, is_credit_note, pdf_rev, provider)
 *
 * s32 will expand seed clusters once Lauren completes initial onboarding
 * walkthrough (so we have empirical signal on which paths matter most).
 * For s31 end-state: Lauren can log in, see the empty Studio org, and
 * the shadow-email layer can be smoke-tested by send-bulk-message
 * against the seeded org (with empty guardian filter falling through
 * gracefully).
 *
 * Service-role only. Idempotent via reset=true.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { wrapEdgeFn } from "../_shared/sentry.ts";

const TIER_CONFIG = {
  teacher: { teachers: 1, locations: 1, rooms: 1 },
  studio: { teachers: 2, locations: 1, rooms: 2 },
  agency: { teachers: 3, locations: 2, rooms: 3 },
} as const;

type Tier = keyof typeof TIER_CONFIG;

const TEACHER_FIRST = ["Sarah", "James", "Rachel"];
const TEACHER_LAST = ["Mitchell", "Coleman", "Patel"];

serve(wrapEdgeFn("seed-shadow-org", async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shadowAdminKey = Deno.env.get("SHADOW_ADMIN_KEY") || "";

    // Auth: accept EITHER service-role bearer OR SHADOW_ADMIN_KEY.
    // SHADOW_ADMIN_KEY exists because Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    // inside the fn isn't byte-equal to the dashboard service-role JWT on
    // this project (audit/findings/2026-05-09-edge-fn-env-injection-mismatch.md).
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
    const isShadowAdmin = !!shadowAdminKey && authHeader === `Bearer ${shadowAdminKey}`;
    if (!authHeader || (!isServiceRole && !isShadowAdmin)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — service role or shadow admin key required" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    let body: {
      tier?: Tier;
      jamie_user_id?: string;
      lauren_user_id?: string;
      org_name?: string;
      reset?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const tier = body.tier;
    if (!tier || !(tier in TIER_CONFIG)) {
      return new Response(
        JSON.stringify({ error: "tier must be one of: teacher, studio, agency" }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const jamieUserId = body.jamie_user_id;
    const laurenUserId = body.lauren_user_id;
    if (!jamieUserId || !laurenUserId) {
      return new Response(
        JSON.stringify({ error: "jamie_user_id and lauren_user_id are required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    async function insertReturnId(table: string, data: Record<string, any>, label: string): Promise<string> {
      const { data: row, error } = await supabase.from(table).insert(data).select("id").single();
      if (error) throw new Error(`[${label}] ${table} insert failed: ${error.message}`);
      return (row as any).id;
    }

    // ─── Idempotency check ─────────────────────────────────────────
    const { data: existingMembership } = await supabase
      .from("org_memberships")
      .select("org_id, organisations(id, subscription_plan, shadow_mode, org_type)")
      .eq("user_id", laurenUserId)
      .eq("role", "admin");

    const wantOrgType = tier === "teacher" ? "solo_teacher" : tier;
    const existingShadowOrg = (existingMembership || [])
      .map((m: any) => m.organisations)
      .find((o: any) => o?.shadow_mode === true && o?.org_type === wantOrgType);

    if (existingShadowOrg && !body.reset) {
      return new Response(
        JSON.stringify({
          error: "Shadow org already exists for this (lauren_user_id, tier)",
          existing_org_id: existingShadowOrg.id,
          hint: "Pass reset=true to delete and rebuild",
        }),
        { status: 409, headers: jsonHeaders },
      );
    }

    if (existingShadowOrg && body.reset) {
      const { error: delErr } = await supabase
        .from("organisations").delete().eq("id", existingShadowOrg.id);
      if (delErr) {
        return new Response(
          JSON.stringify({ error: `Reset delete failed: ${delErr.message}` }),
          { status: 500, headers: jsonHeaders },
        );
      }
      console.log(`[seed-shadow-org] reset: deleted org ${existingShadowOrg.id}`);
    }

    // ─── Cluster 1: organisation + memberships ─────────────────────
    const config = TIER_CONFIG[tier];
    const orgName = body.org_name ?? `Lauren's Shadow ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;

    // org_type enum: solo_teacher | studio | academy | agency.
    // subscription_plan enum: trial | solo_teacher | academy | agency
    // (no "studio" plan; studio org_type maps to academy plan).
    const orgType = tier === "teacher" ? "solo_teacher" : tier;
    const subPlan = tier === "teacher" ? "solo_teacher" : tier === "studio" ? "academy" : "agency";

    const orgId = await insertReturnId("organisations", {
      name: orgName,
      org_type: orgType,
      timezone: "Europe/London",
      country_code: "GB",
      currency_code: "GBP",
      vat_enabled: false,
      vat_rate: 20,
      cancellation_notice_hours: 24,
      subscription_status: "active",
      subscription_plan: subPlan,
      max_students: 9999,
      max_teachers: 9999,
      default_lesson_length_mins: 30,
      shadow_mode: true,
      stripe_test_mode: true,
      created_by: jamieUserId,
    }, "org");

    await supabase.from("org_memberships").insert([
      { org_id: orgId, user_id: jamieUserId, role: "owner", status: "active" },
      { org_id: orgId, user_id: laurenUserId, role: "admin", status: "active" },
    ]);

    await supabase.from("profiles").upsert([
      { id: jamieUserId, full_name: "Jamie McKaye", has_completed_onboarding: true },
      { id: laurenUserId, full_name: "Lauren Twilley", has_completed_onboarding: true },
    ], { onConflict: "id" });

    // ─── Cluster 2: teachers + location + rooms ────────────────────
    const teacherIds: string[] = [];
    for (let i = 0; i < config.teachers; i++) {
      const tid = await insertReturnId("teachers", {
        org_id: orgId,
        display_name: `${TEACHER_FIRST[i % TEACHER_FIRST.length]} ${TEACHER_LAST[i % TEACHER_LAST.length]}`,
        email: `shadow-${tier}-teacher-${i + 1}@lessonloop.test`,
        status: "active",
        instruments: [],
        employment_type: "contractor",
        default_lesson_length_mins: 30,
      }, "teacher");
      teacherIds.push(tid);
    }

    const locationId = await insertReturnId("locations", {
      org_id: orgId,
      name: `${orgName} Studio`,
      address_line_1: "1 Shadow Lane",
      city: "London",
      postcode: "SW1A 1AA",
      country_code: "GB",
      location_type: "studio",
      is_primary: true,
    }, "location");

    const roomIds: string[] = [];
    for (let r = 0; r < config.rooms; r++) {
      const rid = await insertReturnId("rooms", {
        org_id: orgId,
        location_id: locationId,
        name: `Room ${r + 1}`,
        capacity: 1,
      }, "room");
      roomIds.push(rid);
    }

    // ─── Cluster 3: terms + closure_dates ──────────────────────────
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const baseYear = now.getUTCMonth() >= 8 ? currentYear : currentYear - 1;
    const terms = [
      { name: "Autumn Term", start: `${baseYear}-09-01`, end: `${baseYear}-12-15` },
      { name: "Spring Term", start: `${baseYear + 1}-01-08`, end: `${baseYear + 1}-04-01` },
      { name: "Summer Term", start: `${baseYear + 1}-04-20`, end: `${baseYear + 1}-07-20` },
    ];
    const termIds: string[] = [];
    for (const t of terms) {
      const tid = await insertReturnId("terms", {
        org_id: orgId,
        name: t.name,
        start_date: t.start,
        end_date: t.end,
        created_by: jamieUserId,
      }, "term");
      termIds.push(tid);
    }

    const closures = [
      { date: `${baseYear}-10-28` }, { date: `${baseYear}-10-29` }, { date: `${baseYear}-10-30` },
      { date: `${baseYear + 1}-02-17` }, { date: `${baseYear + 1}-02-18` }, { date: `${baseYear + 1}-02-19` },
      { date: `${baseYear + 1}-05-26` }, { date: `${baseYear + 1}-05-27` }, { date: `${baseYear + 1}-05-28` },
    ];
    for (const c of closures) {
      try {
        await supabase.from("closure_dates").insert({
          org_id: orgId, date: c.date, reason: "School half-term",
          applies_to_all_locations: true, created_by: jamieUserId,
        });
      } catch { /* tolerate */ }
    }

    // ─── Cluster 4: notification prefs ─────────────────────────────
    try {
      await supabase.from("notification_preferences").upsert([
        { org_id: orgId, user_id: laurenUserId, email_lesson_reminders: true, email_invoice_reminders: true },
        { org_id: orgId, user_id: jamieUserId, email_lesson_reminders: true, email_invoice_reminders: true },
      ], { onConflict: "org_id,user_id" });
    } catch { /* tolerate */ }

    return new Response(
      JSON.stringify({
        success: true,
        org_id: orgId,
        org_name: orgName,
        tier,
        org_type: orgType,
        subscription_plan: subPlan,
        owner_user_id: jamieUserId,
        admin_user_id: laurenUserId,
        summary: {
          teachers: teacherIds.length,
          locations: 1,
          rooms: roomIds.length,
          terms: termIds.length,
          closure_dates: closures.length,
        },
        next_steps: "Lauren can log in and see the empty Studio org. s32 expands seed with students/lessons/invoices once Lauren onboarding signal is in hand.",
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error("[seed-shadow-org] unhandled:", msg);
    return new Response(
      JSON.stringify({ error: "Seed failed", detail: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}));
