// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ALLOW_SEED = Deno.env.get("ALLOW_SEED");
  if (ALLOW_SEED !== "true") return new Response("Seed disabled", { status: 403, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const log: string[] = [];
  const L = (msg: string) => { log.push(msg); console.log(msg); };

  try {
    // ─── Helpers ───
    async function findOrInsert(table: string, match: Record<string, any>, data: Record<string, any>): Promise<string> {
      const q = admin.from(table).select("id");
      for (const [k, v] of Object.entries(match)) { if (v === null) q.is(k, null); else q.eq(k, v); }
      const { data: existing } = await q.maybeSingle();
      if (existing) return (existing as any).id;
      const { data: created, error } = await admin.from(table).insert({ ...match, ...data }).select("id").single();
      if (error) throw new Error(`Insert ${table}: ${error.message}`);
      return (created as any).id;
    }

    function weeklyDates(startDate: string, endDate: string, dayOfWeek: number, closures: Set<string>): string[] {
      const dates: string[] = [];
      const cur = new Date(startDate + "T00:00:00Z");
      const end = new Date(endDate + "T23:59:59Z");
      while (cur.getUTCDay() !== dayOfWeek) cur.setUTCDate(cur.getUTCDate() + 1);
      while (cur <= end) {
        const d = cur.toISOString().slice(0, 10);
        if (!closures.has(d)) dates.push(d);
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
      return dates;
    }

    async function ensureUser(email: string, password: string, name: string, orgId: string, role: string): Promise<string> {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === email);
      let uid: string;
      if (found) { uid = found.id; }
      else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw new Error(`Create user ${email}: ${error.message}`);
        uid = data.user.id;
      }
      await admin.from("profiles").upsert({ id: uid, full_name: name, has_completed_onboarding: true, current_org_id: orgId }, { onConflict: "id" });
      const { data: mem } = await admin.from("org_memberships").select("id").eq("org_id", orgId).eq("user_id", uid).maybeSingle();
      if (!mem) await admin.from("org_memberships").insert({ org_id: orgId, user_id: uid, role, status: "active" });
      return uid;
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. ORG
    // ═══════════════════════════════════════════════════════════════
    const ORG_ID = crypto.randomUUID();
    const { error: orgErr } = await admin.from("organisations").insert({
      id: ORG_ID, name: "Crescendo Music Agency", timezone: "Europe/London", currency_code: "GBP",
      vat_enabled: true, vat_rate: 20, org_type: "agency",
      cancellation_notice_hours: 24, overdue_reminder_days: [7, 14, 30],
      continuation_notice_weeks: 4, continuation_assumed_continuing: true,
      parent_can_message_teacher: true, subscription_status: "active", subscription_plan: "agency",
      max_students: 9999, max_teachers: 9999, default_lesson_length_mins: 30,
    });
    if (orgErr) throw new Error(`Org: ${orgErr.message}`);
    L(`1. Org created: ${ORG_ID}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. USERS — Owner, Admin, 5 Teachers, 10 Parents
    // ═══════════════════════════════════════════════════════════════
    const ownerUid = await ensureUser("demo-agency-owner@lessonloop.test", "DemoAgency2026!", "Victoria Hargreaves", ORG_ID, "owner");
    const adminUid = await ensureUser("demo-agency-admin@lessonloop.test", "DemoAgency2026!", "Daniel Cooper", ORG_ID, "admin");

    const teacherEmails = [
      { email: "demo-teacher-1@lessonloop.test", name: "James Whitfield" },
      { email: "demo-teacher-2@lessonloop.test", name: "Emily Nakamura" },
      { email: "demo-teacher-3@lessonloop.test", name: "Kwame Asante" },
      { email: "demo-teacher-4@lessonloop.test", name: "Sophie Brennan" },
      { email: "demo-teacher-5@lessonloop.test", name: "Oliver Varga" },
    ];
    const teacherUids: string[] = [];
    for (const t of teacherEmails) {
      teacherUids.push(await ensureUser(t.email, "DemoTeacher2026!", t.name, ORG_ID, "teacher"));
    }

    const parentDefs = [
      { email: "demo-parent-1@lessonloop.test", name: "Caroline Fletcher" },
      { email: "demo-parent-2@lessonloop.test", name: "Amir Rahman" },
      { email: "demo-parent-3@lessonloop.test", name: "Helen Douglas" },
      { email: "demo-parent-4@lessonloop.test", name: "Tomasz Kowalski" },
      { email: "demo-parent-5@lessonloop.test", name: "Nkechi Okonkwo" },
      { email: "demo-parent-6@lessonloop.test", name: "Margaret Chen" },
      { email: "demo-parent-7@lessonloop.test", name: "David Sharma" },
      { email: "demo-parent-8@lessonloop.test", name: "Fiona MacLeod" },
      { email: "demo-parent-9@lessonloop.test", name: "Richard Appiah" },
      { email: "demo-parent-10@lessonloop.test", name: "Yuki Tanaka" },
    ];
    const parentUids: string[] = [];
    for (const p of parentDefs) {
      parentUids.push(await ensureUser(p.email, "DemoParent2026!", p.name, ORG_ID, "parent"));
    }
    L("2. Users created");

    // ═══════════════════════════════════════════════════════════════
    // 3. TEACHERS
    // ═══════════════════════════════════════════════════════════════
    // Owner is also a teacher
    const ownerTeacherId = await findOrInsert("teachers", { org_id: ORG_ID, user_id: ownerUid }, { display_name: "Victoria Hargreaves", status: "active" });
    const teacherIds: string[] = [];
    for (let i = 0; i < teacherEmails.length; i++) {
      teacherIds.push(await findOrInsert("teachers", { org_id: ORG_ID, user_id: teacherUids[i] }, { display_name: teacherEmails[i].name, status: "active" }));
    }
    L("3. Teacher records created");

    // ═══════════════════════════════════════════════════════════════
    // 4. LOCATIONS + ROOMS
    // ═══════════════════════════════════════════════════════════════
    const loc1 = await findOrInsert("locations", { org_id: ORG_ID, name: "Crescendo Central" }, { location_type: "studio", address_line_1: "42 King's Road", city: "London", postcode: "SW3 4ND", country_code: "GB" });
    const loc2 = await findOrInsert("locations", { org_id: ORG_ID, name: "Crescendo North" }, { location_type: "studio", address_line_1: "15 Highbury Grove", city: "London", postcode: "N5 1RA", country_code: "GB" });
    const loc3 = await findOrInsert("locations", { org_id: ORG_ID, name: "Online" }, { location_type: "online" });
    // Rooms at Central
    const roomC1 = await findOrInsert("rooms", { location_id: loc1, org_id: ORG_ID, name: "Studio A" }, { capacity: 1 });
    const roomC2 = await findOrInsert("rooms", { location_id: loc1, org_id: ORG_ID, name: "Studio B" }, { capacity: 1 });
    const roomC3 = await findOrInsert("rooms", { location_id: loc1, org_id: ORG_ID, name: "Ensemble Hall" }, { capacity: 12 });
    const roomC4 = await findOrInsert("rooms", { location_id: loc1, org_id: ORG_ID, name: "Practice Room" }, { capacity: 2 });
    // Rooms at North
    const roomN1 = await findOrInsert("rooms", { location_id: loc2, org_id: ORG_ID, name: "Room 1" }, { capacity: 1 });
    const roomN2 = await findOrInsert("rooms", { location_id: loc2, org_id: ORG_ID, name: "Room 2" }, { capacity: 1 });
    L("4. Locations + rooms done");

    // ═══════════════════════════════════════════════════════════════
    // 5. INSTRUMENTS
    // ═══════════════════════════════════════════════════════════════
    const instNames = ["Piano", "Guitar", "Violin", "Voice", "Drums", "Bass", "Cello", "Flute", "Clarinet", "Saxophone", "Ukulele", "Trumpet"];
    const instruments: Record<string, string> = {};
    for (const name of instNames) {
      const { data: ex } = await admin.from("instruments").select("id").eq("name", name).or(`org_id.is.null,org_id.eq.${ORG_ID}`).maybeSingle();
      if (ex) instruments[name] = (ex as any).id;
      else {
        const { data: cr } = await admin.from("instruments").insert({ name, category: "standard", org_id: ORG_ID, is_custom: true }).select("id").single();
        instruments[name] = (cr as any).id;
      }
    }
    L("5. Instruments done");

    // ═══════════════════════════════════════════════════════════════
    // 6. TERMS
    // ═══════════════════════════════════════════════════════════════
    const t1 = await findOrInsert("terms", { org_id: ORG_ID, name: "Autumn 2025" }, { start_date: "2025-09-01", end_date: "2025-12-19", created_by: ownerUid });
    const t2 = await findOrInsert("terms", { org_id: ORG_ID, name: "Spring 2026" }, { start_date: "2026-01-05", end_date: "2026-03-27", created_by: ownerUid });
    const t3 = await findOrInsert("terms", { org_id: ORG_ID, name: "Summer 2026" }, { start_date: "2026-04-20", end_date: "2026-07-17", created_by: ownerUid });
    const t4 = await findOrInsert("terms", { org_id: ORG_ID, name: "Autumn 2026" }, { start_date: "2026-09-07", end_date: "2026-12-18", created_by: ownerUid });
    L("6. Terms done");

    // ═══════════════════════════════════════════════════════════════
    // 7. STUDENTS (40)
    // ═══════════════════════════════════════════════════════════════
    const studentDefs = [
      // Active students (35)
      { fn: "Oliver", ln: "Fletcher", status: "active" }, { fn: "Charlotte", ln: "Fletcher", status: "active" },
      { fn: "Zara", ln: "Rahman", status: "active" }, { fn: "Tariq", ln: "Rahman", status: "active" },
      { fn: "Emily", ln: "Douglas", status: "active" }, { fn: "Jack", ln: "Douglas", status: "active" }, { fn: "Lily", ln: "Douglas", status: "active" },
      { fn: "Jakub", ln: "Kowalski", status: "active" }, { fn: "Anna", ln: "Kowalski", status: "active" },
      { fn: "Chioma", ln: "Okonkwo", status: "active" }, { fn: "Emeka", ln: "Okonkwo", status: "active" },
      { fn: "Henry", ln: "Chen", status: "active" }, { fn: "Grace", ln: "Chen", status: "active" },
      { fn: "Arjun", ln: "Sharma", status: "active" }, { fn: "Priya", ln: "Sharma", status: "active" },
      { fn: "Isla", ln: "MacLeod", status: "active" }, { fn: "Callum", ln: "MacLeod", status: "active" },
      { fn: "Kwesi", ln: "Appiah", status: "active" }, { fn: "Ama", ln: "Appiah", status: "active" },
      { fn: "Sakura", ln: "Tanaka", status: "active" }, { fn: "Ren", ln: "Tanaka", status: "active" },
      { fn: "Thomas", ln: "Wright", status: "active" }, { fn: "Sophie", ln: "Wright", status: "active" },
      { fn: "Noah", ln: "Patel", status: "active" }, { fn: "Maya", ln: "Patel", status: "active" },
      { fn: "Ethan", ln: "Jones", status: "active" }, { fn: "Freya", ln: "Jones", status: "active" },
      { fn: "Oscar", ln: "Williams", status: "active" }, { fn: "Amelia", ln: "Williams", status: "active" },
      { fn: "Leo", ln: "Taylor", status: "active" },
      { fn: "Mia", ln: "Brown", status: "active" }, { fn: "Harry", ln: "Brown", status: "active" },
      { fn: "Evie", ln: "Wilson", status: "active" }, { fn: "George", ln: "Davies", status: "active" },
      { fn: "Poppy", ln: "Evans", status: "active" },
      // Inactive (5)
      { fn: "Max", ln: "Robinson", status: "inactive" }, { fn: "Ruby", ln: "Clark", status: "inactive" },
      { fn: "Archie", ln: "Lewis", status: "inactive" }, { fn: "Daisy", ln: "Walker", status: "inactive" },
      { fn: "Alfie", ln: "Hall", status: "inactive" },
    ];
    const students: Record<string, string> = {};
    for (const s of studentDefs) {
      const key = `${s.fn} ${s.ln}`;
      students[key] = await findOrInsert("students", { org_id: ORG_ID, first_name: s.fn, last_name: s.ln }, { status: s.status });
    }
    L(`7. ${Object.keys(students).length} students created`);

    // ═══════════════════════════════════════════════════════════════
    // 8. GUARDIANS + LINKS + PARENT PORTAL
    // ═══════════════════════════════════════════════════════════════
    const guardianDefs: Array<{ name: string; email: string; phone: string; children: string[]; parentIdx: number | null }> = [
      { name: "Caroline Fletcher", email: "caroline.fletcher@example.com", phone: "+447700200001", children: ["Oliver Fletcher", "Charlotte Fletcher"], parentIdx: 0 },
      { name: "Amir Rahman", email: "amir.rahman@example.com", phone: "+447700200002", children: ["Zara Rahman", "Tariq Rahman"], parentIdx: 1 },
      { name: "Helen Douglas", email: "helen.douglas@example.com", phone: "+447700200003", children: ["Emily Douglas", "Jack Douglas", "Lily Douglas"], parentIdx: 2 },
      { name: "Tomasz Kowalski", email: "tomasz.kowalski@example.com", phone: "+447700200004", children: ["Jakub Kowalski", "Anna Kowalski"], parentIdx: 3 },
      { name: "Nkechi Okonkwo", email: "nkechi.okonkwo@example.com", phone: "+447700200005", children: ["Chioma Okonkwo", "Emeka Okonkwo"], parentIdx: 4 },
      { name: "Margaret Chen", email: "margaret.chen@example.com", phone: "+447700200006", children: ["Henry Chen", "Grace Chen"], parentIdx: 5 },
      { name: "David Sharma", email: "david.sharma@example.com", phone: "+447700200007", children: ["Arjun Sharma", "Priya Sharma"], parentIdx: 6 },
      { name: "Fiona MacLeod", email: "fiona.macleod@example.com", phone: "+447700200008", children: ["Isla MacLeod", "Callum MacLeod"], parentIdx: 7 },
      { name: "Richard Appiah", email: "richard.appiah@example.com", phone: "+447700200009", children: ["Kwesi Appiah", "Ama Appiah"], parentIdx: 8 },
      { name: "Yuki Tanaka", email: "yuki.tanaka@example.com", phone: "+447700200010", children: ["Sakura Tanaka", "Ren Tanaka"], parentIdx: 9 },
      // Non-portal guardians
      { name: "Peter Wright", email: "peter.wright@example.com", phone: "+447700200011", children: ["Thomas Wright", "Sophie Wright"], parentIdx: null },
      { name: "Sunita Patel", email: "sunita.patel@example.com", phone: "+447700200012", children: ["Noah Patel", "Maya Patel"], parentIdx: null },
      { name: "Karen Jones", email: "karen.jones@example.com", phone: "+447700200013", children: ["Ethan Jones", "Freya Jones"], parentIdx: null },
      { name: "Mark Williams", email: "mark.williams@example.com", phone: "+447700200014", children: ["Oscar Williams", "Amelia Williams"], parentIdx: null },
      { name: "Jane Taylor", email: "jane.taylor@example.com", phone: "+447700200015", children: ["Leo Taylor"], parentIdx: null },
      { name: "Sarah Brown", email: "sarah.brown@example.com", phone: "+447700200016", children: ["Mia Brown", "Harry Brown"], parentIdx: null },
      { name: "Claire Wilson", email: "claire.wilson@example.com", phone: "+447700200017", children: ["Evie Wilson"], parentIdx: null },
      { name: "Ian Davies", email: "ian.davies@example.com", phone: "+447700200018", children: ["George Davies"], parentIdx: null },
      { name: "Louise Evans", email: "louise.evans@example.com", phone: "+447700200019", children: ["Poppy Evans"], parentIdx: null },
      // Second guardians for some families
      { name: "Robert Fletcher", email: "robert.fletcher@example.com", phone: "+447700200020", children: ["Oliver Fletcher", "Charlotte Fletcher"], parentIdx: null },
      { name: "Fatima Rahman", email: "fatima.rahman@example.com", phone: "+447700200021", children: ["Zara Rahman", "Tariq Rahman"], parentIdx: null },
      { name: "Michael Douglas", email: "michael.douglas@example.com", phone: "+447700200022", children: ["Emily Douglas", "Jack Douglas", "Lily Douglas"], parentIdx: null },
      { name: "Ewa Kowalski", email: "ewa.kowalski@example.com", phone: "+447700200023", children: ["Jakub Kowalski", "Anna Kowalski"], parentIdx: null },
      { name: "Chukwu Okonkwo", email: "chukwu.okonkwo@example.com", phone: "+447700200024", children: ["Chioma Okonkwo", "Emeka Okonkwo"], parentIdx: null },
      { name: "William Chen", email: "william.chen@example.com", phone: "+447700200025", children: ["Henry Chen", "Grace Chen"], parentIdx: null },
    ];
    const guardians: Record<string, string> = {};
    for (const gd of guardianDefs) {
      const gId = await findOrInsert("guardians", { org_id: ORG_ID, full_name: gd.name }, { email: gd.email, phone: gd.phone, user_id: gd.parentIdx !== null ? parentUids[gd.parentIdx] : null });
      guardians[gd.name] = gId;
      const relationship = gd.name.startsWith("Robert") || gd.name.startsWith("Michael") || gd.name.startsWith("Chukwu") || gd.name.startsWith("William") || gd.name === "Amir Rahman" || gd.name === "David Sharma" || gd.name === "Richard Appiah" || gd.name === "Tomasz Kowalski" || gd.name === "Ian Davies" || gd.name === "Mark Williams" || gd.name === "Peter Wright" ? "father" : "mother";
      const isPrimary = gd.parentIdx !== null || !["Robert Fletcher","Fatima Rahman","Michael Douglas","Ewa Kowalski","Chukwu Okonkwo","William Chen"].includes(gd.name);
      for (const child of gd.children) {
        if (!students[child]) continue;
        const { data: ex } = await admin.from("student_guardians").select("id").eq("guardian_id", gId).eq("student_id", students[child]).maybeSingle();
        if (!ex) await admin.from("student_guardians").insert({ guardian_id: gId, student_id: students[child], relationship, is_primary_payer: isPrimary, org_id: ORG_ID });
      }
    }
    L("8. Guardians + links + portal done");

    // ═══════════════════════════════════════════════════════════════
    // 9. ASSIGNMENTS + STUDENT-INSTRUMENTS
    // ═══════════════════════════════════════════════════════════════
    // Teacher 0 = James Whitfield (Piano, Voice) — 10 students
    // Teacher 1 = Emily Nakamura (Violin, Cello) — 8 students
    // Teacher 2 = Kwame Asante (Guitar, Bass, Ukulele) — 8 students
    // Teacher 3 = Sophie Brennan (Flute, Clarinet) — 7 students
    // Teacher 4 = Oliver Varga (Drums, Saxophone, Trumpet) — 7 students
    const assignDefs: Array<{ student: string; tIdx: number; inst: string }> = [
      // James - Piano/Voice
      { student: "Oliver Fletcher", tIdx: 0, inst: "Piano" }, { student: "Charlotte Fletcher", tIdx: 0, inst: "Voice" },
      { student: "Zara Rahman", tIdx: 0, inst: "Piano" }, { student: "Emily Douglas", tIdx: 0, inst: "Piano" },
      { student: "Jakub Kowalski", tIdx: 0, inst: "Piano" }, { student: "Henry Chen", tIdx: 0, inst: "Piano" },
      { student: "Arjun Sharma", tIdx: 0, inst: "Voice" }, { student: "Sakura Tanaka", tIdx: 0, inst: "Piano" },
      { student: "Thomas Wright", tIdx: 0, inst: "Piano" }, { student: "Mia Brown", tIdx: 0, inst: "Voice" },
      // Emily - Violin/Cello
      { student: "Tariq Rahman", tIdx: 1, inst: "Violin" }, { student: "Jack Douglas", tIdx: 1, inst: "Violin" },
      { student: "Anna Kowalski", tIdx: 1, inst: "Cello" }, { student: "Chioma Okonkwo", tIdx: 1, inst: "Violin" },
      { student: "Grace Chen", tIdx: 1, inst: "Cello" }, { student: "Priya Sharma", tIdx: 1, inst: "Violin" },
      { student: "Isla MacLeod", tIdx: 1, inst: "Violin" }, { student: "Ama Appiah", tIdx: 1, inst: "Cello" },
      // Kwame - Guitar/Bass/Ukulele
      { student: "Emeka Okonkwo", tIdx: 2, inst: "Guitar" }, { student: "Callum MacLeod", tIdx: 2, inst: "Guitar" },
      { student: "Kwesi Appiah", tIdx: 2, inst: "Bass" }, { student: "Ren Tanaka", tIdx: 2, inst: "Guitar" },
      { student: "Sophie Wright", tIdx: 2, inst: "Ukulele" }, { student: "Noah Patel", tIdx: 2, inst: "Guitar" },
      { student: "Ethan Jones", tIdx: 2, inst: "Guitar" }, { student: "Oscar Williams", tIdx: 2, inst: "Bass" },
      // Sophie B - Flute/Clarinet
      { student: "Lily Douglas", tIdx: 3, inst: "Flute" }, { student: "Maya Patel", tIdx: 3, inst: "Clarinet" },
      { student: "Freya Jones", tIdx: 3, inst: "Flute" }, { student: "Amelia Williams", tIdx: 3, inst: "Clarinet" },
      { student: "Leo Taylor", tIdx: 3, inst: "Flute" }, { student: "Harry Brown", tIdx: 3, inst: "Clarinet" },
      { student: "Evie Wilson", tIdx: 3, inst: "Flute" },
      // Oliver V - Drums/Sax/Trumpet
      { student: "George Davies", tIdx: 4, inst: "Drums" }, { student: "Poppy Evans", tIdx: 4, inst: "Saxophone" },
      { student: "Oliver Fletcher", tIdx: 4, inst: "Drums" }, // Oliver does drums + piano
      { student: "Tariq Rahman", tIdx: 4, inst: "Trumpet" }, // Tariq does trumpet + violin
      { student: "Callum MacLeod", tIdx: 4, inst: "Drums" }, // Callum does drums + guitar
      { student: "Kwesi Appiah", tIdx: 4, inst: "Saxophone" }, // Kwesi does sax + bass
      { student: "Ren Tanaka", tIdx: 4, inst: "Drums" },
    ];
    for (const a of assignDefs) {
      if (!students[a.student]) continue;
      const tId = a.tIdx === -1 ? ownerTeacherId : teacherIds[a.tIdx];
      const tUid = a.tIdx === -1 ? ownerUid : teacherUids[a.tIdx];
      const { data: exSTA } = await admin.from("student_teacher_assignments").select("id").eq("teacher_id", tId).eq("student_id", students[a.student]).eq("instrument_id", instruments[a.inst]).eq("org_id", ORG_ID).maybeSingle();
      if (!exSTA) await admin.from("student_teacher_assignments").insert({ teacher_id: tId, teacher_user_id: tUid, student_id: students[a.student], org_id: ORG_ID, instrument_id: instruments[a.inst] });
      const { data: exSI } = await admin.from("student_instruments").select("id").eq("student_id", students[a.student]).eq("instrument_id", instruments[a.inst]).maybeSingle();
      if (!exSI) await admin.from("student_instruments").insert({ student_id: students[a.student], instrument_id: instruments[a.inst], org_id: ORG_ID, is_primary: true });
    }
    L("9. Assignments done");

    // ═══════════════════════════════════════════════════════════════
    // 10. RATE CARDS
    // ═══════════════════════════════════════════════════════════════
    const rcDefs = [
      { name: "Private 30-min", duration_mins: 30, rate_amount: 38, is_default: true },
      { name: "Private 45-min", duration_mins: 45, rate_amount: 52, is_default: false },
      { name: "Private 60-min", duration_mins: 60, rate_amount: 65, is_default: false },
      { name: "Group 60-min", duration_mins: 60, rate_amount: 22, is_default: false },
      { name: "Online 30-min", duration_mins: 30, rate_amount: 32, is_default: false },
      { name: "Online 60-min", duration_mins: 60, rate_amount: 55, is_default: false },
    ];
    for (const rc of rcDefs) {
      await findOrInsert("rate_cards", { org_id: ORG_ID, name: rc.name }, { duration_mins: rc.duration_mins, rate_amount: rc.rate_amount, is_default: rc.is_default });
    }
    L("10. Rate cards done");

    // ═══════════════════════════════════════════════════════════════
    // 11. CLOSURE DATES
    // ═══════════════════════════════════════════════════════════════
    const closureRanges = [
      { start: "2025-10-27", end: "2025-10-31", reason: "October Half Term" },
      { start: "2025-12-20", end: "2026-01-04", reason: "Christmas Closure" },
      { start: "2026-02-16", end: "2026-02-20", reason: "February Half Term" },
      { start: "2026-04-03", end: "2026-04-18", reason: "Easter Holiday" },
      { start: "2026-05-25", end: "2026-05-29", reason: "May Half Term" },
      { start: "2026-07-20", end: "2026-09-04", reason: "Summer Holiday" },
    ];
    const bankHolidays = [
      { date: "2025-12-25", reason: "Christmas Day" }, { date: "2025-12-26", reason: "Boxing Day" },
      { date: "2026-01-01", reason: "New Year's Day" }, { date: "2026-04-03", reason: "Good Friday" },
      { date: "2026-04-06", reason: "Easter Monday" }, { date: "2026-05-04", reason: "Early May Bank Holiday" },
      { date: "2026-05-25", reason: "Spring Bank Holiday" }, { date: "2026-08-31", reason: "Summer Bank Holiday" },
    ];
    const allClosures = new Set<string>();
    for (const range of closureRanges) {
      const cur = new Date(range.start + "T00:00:00Z");
      const end = new Date(range.end + "T23:59:59Z");
      while (cur <= end) {
        const d = cur.toISOString().slice(0, 10);
        allClosures.add(d);
        const { data: ex } = await admin.from("closure_dates").select("id").eq("org_id", ORG_ID).eq("date", d).maybeSingle();
        if (!ex) await admin.from("closure_dates").insert({ org_id: ORG_ID, date: d, reason: range.reason, applies_to_all_locations: true, created_by: ownerUid });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    for (const bh of bankHolidays) {
      allClosures.add(bh.date);
      const { data: ex } = await admin.from("closure_dates").select("id").eq("org_id", ORG_ID).eq("date", bh.date).maybeSingle();
      if (!ex) await admin.from("closure_dates").insert({ org_id: ORG_ID, date: bh.date, reason: bh.reason, applies_to_all_locations: true, created_by: ownerUid });
    }
    L(`11. Closure dates: ${allClosures.size}`);

    // ═══════════════════════════════════════════════════════════════
    // 12. LESSONS + PARTICIPANTS + ATTENDANCE
    // ═══════════════════════════════════════════════════════════════
    const termDates: Record<string, { start: string; end: string; id: string }> = {
      autumn: { start: "2025-09-01", end: "2025-12-19", id: t1 },
      spring: { start: "2026-01-05", end: "2026-03-27", id: t2 },
      summer: { start: "2026-04-20", end: "2026-07-17", id: t3 },
    };
    const NOW = new Date("2026-04-10T12:00:00Z");

    type Sched = { students: string[]; tIdx: number; day: number; hr: number; min: number; dur: number; inst: string; roomId: string | null; locId: string; terms: string[]; isGroup?: boolean; title?: string };
    const schedules: Sched[] = [
      // James Whitfield (tIdx 0) — Piano/Voice at Central, Studio A — Mon/Tue/Wed/Thu
      { students: ["Oliver Fletcher"], tIdx: 0, day: 1, hr: 9, min: 0, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Charlotte Fletcher"], tIdx: 0, day: 1, hr: 9, min: 45, dur: 30, inst: "Voice", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Zara Rahman"], tIdx: 0, day: 1, hr: 10, min: 30, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Emily Douglas"], tIdx: 0, day: 2, hr: 9, min: 0, dur: 45, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Jakub Kowalski"], tIdx: 0, day: 2, hr: 10, min: 0, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Henry Chen"], tIdx: 0, day: 3, hr: 9, min: 0, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring"] },
      { students: ["Arjun Sharma"], tIdx: 0, day: 3, hr: 10, min: 0, dur: 30, inst: "Voice", roomId: roomC1, locId: loc1, terms: ["spring", "summer"] },
      { students: ["Sakura Tanaka"], tIdx: 0, day: 4, hr: 9, min: 0, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Thomas Wright"], tIdx: 0, day: 4, hr: 10, min: 0, dur: 30, inst: "Piano", roomId: roomC1, locId: loc1, terms: ["spring", "summer"] },
      { students: ["Mia Brown"], tIdx: 0, day: 4, hr: 11, min: 0, dur: 30, inst: "Voice", roomId: roomC1, locId: loc1, terms: ["autumn", "spring"] },

      // Emily Nakamura (tIdx 1) — Violin/Cello at Central, Studio B — Mon/Tue/Wed/Sat
      { students: ["Tariq Rahman"], tIdx: 1, day: 1, hr: 14, min: 0, dur: 30, inst: "Violin", roomId: roomC2, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Jack Douglas"], tIdx: 1, day: 1, hr: 14, min: 45, dur: 30, inst: "Violin", roomId: roomC2, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Anna Kowalski"], tIdx: 1, day: 2, hr: 14, min: 0, dur: 45, inst: "Cello", roomId: roomC2, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Chioma Okonkwo"], tIdx: 1, day: 2, hr: 15, min: 0, dur: 30, inst: "Violin", roomId: roomC2, locId: loc1, terms: ["autumn", "spring"] },
      { students: ["Grace Chen"], tIdx: 1, day: 3, hr: 14, min: 0, dur: 45, inst: "Cello", roomId: roomC2, locId: loc1, terms: ["autumn", "spring", "summer"] },
      { students: ["Priya Sharma"], tIdx: 1, day: 3, hr: 15, min: 0, dur: 30, inst: "Violin", roomId: roomC2, locId: loc1, terms: ["spring", "summer"] },
      { students: ["Isla MacLeod"], tIdx: 1, day: 4, hr: 14, min: 0, dur: 30, inst: "Violin", roomId: roomC2, locId: loc1, terms: ["autumn", "spring"] },
      { students: ["Ama Appiah"], tIdx: 1, day: 4, hr: 15, min: 0, dur: 45, inst: "Cello", roomId: roomC2, locId: loc1, terms: ["spring", "summer"] },
      // Saturday ensemble
      { students: ["Tariq Rahman", "Jack Douglas", "Chioma Okonkwo", "Priya Sharma", "Isla MacLeod"], tIdx: 1, day: 6, hr: 10, min: 0, dur: 60, inst: "Violin", roomId: roomC3, locId: loc1, terms: ["spring"], isGroup: true, title: "Saturday String Ensemble" },

      // Kwame Asante (tIdx 2) — Guitar/Bass at North — Mon/Wed/Fri
      { students: ["Emeka Okonkwo"], tIdx: 2, day: 1, hr: 15, min: 0, dur: 30, inst: "Guitar", roomId: roomN1, locId: loc2, terms: ["autumn", "spring", "summer"] },
      { students: ["Callum MacLeod"], tIdx: 2, day: 1, hr: 15, min: 45, dur: 30, inst: "Guitar", roomId: roomN1, locId: loc2, terms: ["autumn", "spring", "summer"] },
      { students: ["Kwesi Appiah"], tIdx: 2, day: 3, hr: 15, min: 0, dur: 30, inst: "Bass", roomId: roomN1, locId: loc2, terms: ["autumn", "spring"] },
      { students: ["Ren Tanaka"], tIdx: 2, day: 3, hr: 15, min: 45, dur: 30, inst: "Guitar", roomId: roomN1, locId: loc2, terms: ["autumn", "spring", "summer"] },
      { students: ["Sophie Wright"], tIdx: 2, day: 5, hr: 15, min: 0, dur: 30, inst: "Ukulele", roomId: roomN1, locId: loc2, terms: ["spring", "summer"] },
      { students: ["Noah Patel"], tIdx: 2, day: 5, hr: 15, min: 45, dur: 30, inst: "Guitar", roomId: roomN1, locId: loc2, terms: ["autumn", "spring", "summer"] },
      { students: ["Ethan Jones"], tIdx: 2, day: 5, hr: 16, min: 30, dur: 30, inst: "Guitar", roomId: roomN1, locId: loc2, terms: ["spring"] },
      { students: ["Oscar Williams"], tIdx: 2, day: 3, hr: 16, min: 30, dur: 30, inst: "Bass", roomId: roomN1, locId: loc2, terms: ["spring", "summer"] },

      // Sophie Brennan (tIdx 3) — Flute/Clarinet Online — Tue/Thu
      { students: ["Lily Douglas"], tIdx: 3, day: 2, hr: 16, min: 0, dur: 30, inst: "Flute", roomId: null, locId: loc3, terms: ["autumn", "spring", "summer"] },
      { students: ["Maya Patel"], tIdx: 3, day: 2, hr: 16, min: 45, dur: 30, inst: "Clarinet", roomId: null, locId: loc3, terms: ["autumn", "spring"] },
      { students: ["Freya Jones"], tIdx: 3, day: 4, hr: 16, min: 0, dur: 30, inst: "Flute", roomId: null, locId: loc3, terms: ["spring", "summer"] },
      { students: ["Amelia Williams"], tIdx: 3, day: 4, hr: 16, min: 45, dur: 30, inst: "Clarinet", roomId: null, locId: loc3, terms: ["autumn", "spring", "summer"] },
      { students: ["Leo Taylor"], tIdx: 3, day: 2, hr: 17, min: 30, dur: 30, inst: "Flute", roomId: null, locId: loc3, terms: ["spring"] },
      { students: ["Harry Brown"], tIdx: 3, day: 4, hr: 17, min: 30, dur: 30, inst: "Clarinet", roomId: null, locId: loc3, terms: ["autumn", "spring"] },
      { students: ["Evie Wilson"], tIdx: 3, day: 2, hr: 18, min: 0, dur: 30, inst: "Flute", roomId: null, locId: loc3, terms: ["spring", "summer"] },

      // Oliver Varga (tIdx 4) — Drums/Sax/Trumpet at North Room 2 — Tue/Thu/Sat
      { students: ["George Davies"], tIdx: 4, day: 2, hr: 15, min: 0, dur: 30, inst: "Drums", roomId: roomN2, locId: loc2, terms: ["autumn", "spring", "summer"] },
      { students: ["Poppy Evans"], tIdx: 4, day: 2, hr: 15, min: 45, dur: 30, inst: "Saxophone", roomId: roomN2, locId: loc2, terms: ["spring", "summer"] },
      { students: ["Oliver Fletcher"], tIdx: 4, day: 4, hr: 15, min: 0, dur: 30, inst: "Drums", roomId: roomN2, locId: loc2, terms: ["autumn", "spring"] },
      { students: ["Tariq Rahman"], tIdx: 4, day: 4, hr: 15, min: 45, dur: 30, inst: "Trumpet", roomId: roomN2, locId: loc2, terms: ["spring"] },
      { students: ["Callum MacLeod"], tIdx: 4, day: 4, hr: 16, min: 30, dur: 30, inst: "Drums", roomId: roomN2, locId: loc2, terms: ["spring", "summer"] },
      { students: ["Kwesi Appiah"], tIdx: 4, day: 6, hr: 10, min: 0, dur: 30, inst: "Saxophone", roomId: roomN2, locId: loc2, terms: ["spring"] },
      { students: ["Ren Tanaka"], tIdx: 4, day: 6, hr: 10, min: 45, dur: 30, inst: "Drums", roomId: roomN2, locId: loc2, terms: ["spring"] },
    ];

    // Build recurrence rules
    const recurrenceIds: string[] = [];
    for (const sched of schedules) {
      const { data: rec } = await admin.from("recurrence_rules").insert({
        org_id: ORG_ID, pattern_type: "weekly", interval_weeks: 1, days_of_week: [sched.day],
        start_date: termDates[sched.terms[0]].start, timezone: "Europe/London",
      }).select("id").single();
      recurrenceIds.push((rec as any).id);
    }

    // Build lesson rows
    type LessonMeta = { schedIdx: number; date: string; termKey: string; studentNames: string[]; status: string; tUId: string };
    const lessonRows: any[] = [];
    const lessonMetas: LessonMeta[] = [];
    // Track specific lessons for make-up credits
    const cancelDates = new Set(["2026-02-09", "2026-01-19", "2026-03-02"]);
    const absentDates = new Set(["2025-11-10", "2025-11-17", "2025-12-01", "2026-01-12", "2026-02-02"]);

    for (let si = 0; si < schedules.length; si++) {
      const sched = schedules[si];
      const tUid = teacherUids[sched.tIdx];
      for (const termKey of sched.terms) {
        const term = termDates[termKey];
        const dates = weeklyDates(term.start, term.end, sched.day, allClosures);
        for (const date of dates) {
          const startAt = `${date}T${String(sched.hr).padStart(2, "0")}:${String(sched.min).padStart(2, "0")}:00Z`;
          const endAt = new Date(new Date(startAt).getTime() + sched.dur * 60000).toISOString();
          const isPast = new Date(startAt) < NOW;
          const isCancelled = !sched.isGroup && cancelDates.has(date) && si % 3 === 0;
          const status = isCancelled ? "cancelled" : isPast ? "completed" : "scheduled";
          const title = sched.title || `${sched.inst} Lesson — ${sched.students.join(", ")}`;

          lessonRows.push({
            org_id: ORG_ID, title, teacher_id: teacherIds[sched.tIdx], teacher_user_id: tUid,
            created_by: ownerUid, location_id: sched.locId, room_id: sched.roomId,
            start_at: startAt, end_at: endAt, status, recurrence_id: recurrenceIds[si],
            max_participants: sched.isGroup ? 12 : 1,
            lesson_type: sched.isGroup ? "group" : "private",
          });
          lessonMetas.push({ schedIdx: si, date, termKey, studentNames: sched.students, status, tUId: tUid });
        }
      }
    }

    // Batch insert lessons
    const allLessonIds: string[] = [];
    for (let i = 0; i < lessonRows.length; i += 50) {
      const chunk = lessonRows.slice(i, i + 50);
      const { data: created, error } = await admin.from("lessons").insert(chunk).select("id");
      if (error) { L(`Lesson batch error at ${i}: ${error.message}`); break; }
      for (const c of (created || [])) allLessonIds.push((c as any).id);
    }
    const totalLessons = allLessonIds.length;

    // Build participants and attendance
    const participantRows: any[] = [];
    const attendanceRows: any[] = [];
    const lessonIdsByStudent: Record<string, string[]> = {};
    const cancelledLessons: Array<{ lessonId: string; student: string; tIdx: number }> = [];

    for (let li = 0; li < allLessonIds.length; li++) {
      const lessonId = allLessonIds[li];
      const meta = lessonMetas[li];
      if (!meta) continue;

      for (const studentName of meta.studentNames) {
        if (!students[studentName]) continue;
        participantRows.push({ lesson_id: lessonId, student_id: students[studentName], org_id: ORG_ID });
        if (!lessonIdsByStudent[studentName]) lessonIdsByStudent[studentName] = [];
        lessonIdsByStudent[studentName].push(lessonId);

        if (meta.status === "completed" || meta.status === "cancelled") {
          const isAbsent = absentDates.has(meta.date) && !meta.studentNames[0].includes("Group");
          let attStatus = "present";
          let absReason: string | null = null;

          if (meta.status === "cancelled") {
            attStatus = "cancelled_by_teacher"; absReason = "teacher_cancelled";
            cancelledLessons.push({ lessonId, student: studentName, tIdx: schedules[meta.schedIdx].tIdx });
          } else if (isAbsent && Math.random() < 0.3) {
            attStatus = "absent"; absReason = ["sick", "holiday", "other"][Math.floor(Math.random() * 3)];
          } else {
            attStatus = Math.random() < 0.92 ? "present" : "late";
          }

          attendanceRows.push({
            lesson_id: lessonId, student_id: students[studentName], org_id: ORG_ID,
            attendance_status: attStatus, absence_reason_category: absReason, recorded_by: meta.tUId,
          });
        }
      }
    }

    for (let i = 0; i < participantRows.length; i += 100) {
      await admin.from("lesson_participants").insert(participantRows.slice(i, i + 100));
    }
    for (let i = 0; i < attendanceRows.length; i += 100) {
      await admin.from("attendance_records").insert(attendanceRows.slice(i, i + 100));
    }
    L(`12. Lessons: ${totalLessons}, participants: ${participantRows.length}, attendance: ${attendanceRows.length}`);

    // ═══════════════════════════════════════════════════════════════
    // 13. INVOICES + ITEMS + PAYMENTS + PAYMENT PLANS
    // ═══════════════════════════════════════════════════════════════
    async function createInvoice(opts: {
      payerGuardianId?: string; status: string; subtotalMinor: number;
      issueDate: string; dueDate: string; notes?: string; termId?: string;
      items: Array<{ desc: string; qty: number; price: number; studentId?: string }>;
      paymentPlan?: boolean; installmentCount?: number;
    }): Promise<string> {
      const taxMinor = Math.round(opts.subtotalMinor * 0.2);
      const totalMinor = opts.subtotalMinor + taxMinor;
      const { data: inv, error } = await admin.from("invoices").insert({
        org_id: ORG_ID, invoice_number: "",
        payer_guardian_id: opts.payerGuardianId || null,
        subtotal_minor: opts.subtotalMinor, tax_minor: taxMinor, total_minor: totalMinor,
        vat_rate: 20, currency_code: "GBP", due_date: opts.dueDate, issue_date: opts.issueDate,
        notes: opts.notes || null, term_id: opts.termId || null,
        payment_plan_enabled: opts.paymentPlan || false, installment_count: opts.installmentCount || null,
      }).select("id, total_minor").single();
      if (error) throw new Error(`Invoice: ${error.message}`);
      const invId = (inv as any).id;
      const invTotal = (inv as any).total_minor;

      for (const item of opts.items) {
        await admin.from("invoice_items").insert({
          invoice_id: invId, org_id: ORG_ID, description: item.desc,
          quantity: item.qty, unit_price_minor: item.price, amount_minor: item.qty * item.price,
          student_id: item.studentId || null,
        });
      }

      if (opts.status !== "draft") {
        await admin.from("invoices").update({ status: "sent" }).eq("id", invId);
        if (opts.status === "paid") {
          await admin.from("invoices").update({ status: "paid", paid_minor: invTotal }).eq("id", invId);
        } else if (opts.status === "overdue") {
          await admin.from("invoices").update({ status: "overdue" }).eq("id", invId);
        } else if (opts.status === "voided") {
          await admin.from("invoices").update({ status: "voided" }).eq("id", invId);
        }
      }
      return invId;
    }

    // Helper to get first guardian for a student
    function guardianFor(studentName: string): string | undefined {
      for (const gd of guardianDefs) {
        if (gd.children.includes(studentName)) return guardians[gd.name];
      }
      return undefined;
    }

    // -- AUTUMN 2025: ALL PAID --
    const autumnStudents = [
      "Oliver Fletcher", "Charlotte Fletcher", "Zara Rahman", "Emily Douglas", "Jakub Kowalski",
      "Henry Chen", "Sakura Tanaka", "Mia Brown", "Tariq Rahman", "Jack Douglas",
      "Anna Kowalski", "Chioma Okonkwo", "Grace Chen", "Isla MacLeod",
      "Emeka Okonkwo", "Callum MacLeod", "Kwesi Appiah", "Ren Tanaka", "Noah Patel",
      "Lily Douglas", "Maya Patel", "Amelia Williams", "Harry Brown",
      "George Davies", "Oliver Fletcher",
    ];
    // Group by guardian for autumn invoices
    const autumnByGuardian: Record<string, string[]> = {};
    for (const s of autumnStudents) {
      const g = guardianFor(s);
      if (!g) continue;
      if (!autumnByGuardian[g]) autumnByGuardian[g] = [];
      if (!autumnByGuardian[g].includes(s)) autumnByGuardian[g].push(s);
    }
    let invCount = 0;
    for (const [gId, studs] of Object.entries(autumnByGuardian)) {
      const items = studs.map(s => {
        const lessons = (lessonIdsByStudent[s] || []).length;
        const perLesson = 3800; // ~£38
        return { desc: `Lessons — ${s} (${Math.min(lessons, 12)} sessions)`, qty: Math.min(lessons, 12), price: perLesson, studentId: students[s] };
      });
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
      const invId = await createInvoice({
        payerGuardianId: gId, status: "paid", subtotalMinor: subtotal,
        issueDate: "2025-09-01", dueDate: "2025-09-15", notes: `Autumn 2025`, termId: t1,
        items,
      });
      await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: invId, amount_minor: Math.round(subtotal * 1.2), currency_code: "GBP", method: invCount % 2 === 0 ? "bank_transfer" : "card", provider: "manual" });
      invCount++;
    }
    L(`13a. Autumn invoices: ${invCount} (all paid)`);

    // -- SPRING 2026: MIX OF STATUSES --
    const springGuardians = Object.entries(autumnByGuardian);
    let springInvCount = 0;
    for (let gi = 0; gi < springGuardians.length; gi++) {
      const [gId, studs] = springGuardians[gi];
      const items = studs.map(s => ({ desc: `Spring Lessons — ${s}`, qty: 11, price: 3800, studentId: students[s] }));
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
      let status: string;
      if (gi < 5) status = "paid";
      else if (gi < 8) status = "sent";
      else if (gi < 11) status = "overdue";
      else if (gi < 13) status = "draft";
      else status = "voided";

      const invId = await createInvoice({
        payerGuardianId: gId, status, subtotalMinor: subtotal,
        issueDate: "2026-01-05", dueDate: "2026-01-19", notes: `Spring 2026`, termId: t2,
        items,
      });

      if (status === "paid") {
        await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: invId, amount_minor: Math.round(subtotal * 1.2), currency_code: "GBP", method: "card", provider: "manual" });
      }
      springInvCount++;
    }

    // Payment plan invoices (5)
    const planGuardians = springGuardians.slice(0, 5);
    for (let pi = 0; pi < planGuardians.length; pi++) {
      const [gId, studs] = planGuardians[pi];
      const items = studs.map(s => ({ desc: `Spring Plan — ${s}`, qty: 11, price: 3800, studentId: students[s] }));
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
      const invId = await createInvoice({
        payerGuardianId: gId, status: "sent", subtotalMinor: subtotal,
        issueDate: "2026-01-05", dueDate: "2026-04-01", notes: `Spring 2026 — Payment Plan`, termId: t2,
        items, paymentPlan: true, installmentCount: 3,
      });
      // Create installments
      const totalMinor = Math.round(subtotal * 1.2);
      const installmentAmount = Math.floor(totalMinor / 3);
      for (let inst = 0; inst < 3; inst++) {
        const dueDate = new Date("2026-01-15");
        dueDate.setMonth(dueDate.getMonth() + inst);
        const isPaid = inst === 0;
        const isOverdue = inst === 1 && pi < 2;
        await admin.from("invoice_installments").insert({
          invoice_id: invId, org_id: ORG_ID, installment_number: inst + 1,
          amount_minor: inst === 2 ? totalMinor - installmentAmount * 2 : installmentAmount,
          due_date: dueDate.toISOString().slice(0, 10),
          status: isPaid ? "paid" : isOverdue ? "overdue" : "pending",
          paid_at: isPaid ? "2026-01-15T10:00:00Z" : null,
        });
      }
      // Partial payment
      await admin.from("invoices").update({ paid_minor: installmentAmount }).eq("id", invId);
    }
    L(`13b. Spring invoices: ${springInvCount} + 5 payment plans`);

    // -- SUMMER 2026: DRAFTS --
    for (let gi = 0; gi < Math.min(8, springGuardians.length); gi++) {
      const [gId, studs] = springGuardians[gi];
      const items = studs.map(s => ({ desc: `Summer Lessons — ${s}`, qty: 10, price: 3800, studentId: students[s] }));
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
      await createInvoice({
        payerGuardianId: gId, status: "draft", subtotalMinor: subtotal,
        issueDate: "2026-04-20", dueDate: "2026-05-04", notes: `Summer 2026`, termId: t3, items,
      });
    }
    L("13c. Summer draft invoices done");

    // ═══════════════════════════════════════════════════════════════
    // 14. BILLING RUNS
    // ═══════════════════════════════════════════════════════════════
    await findOrInsert("billing_runs", { org_id: ORG_ID, start_date: "2025-09-01", end_date: "2025-12-19" }, {
      created_by: ownerUid, status: "completed", run_type: "standard", billing_mode: "upfront", term_id: t1,
      summary: { total_invoices: invCount, total_amount_minor: invCount * 50000 },
    });
    await findOrInsert("billing_runs", { org_id: ORG_ID, start_date: "2026-01-05", end_date: "2026-03-27" }, {
      created_by: ownerUid, status: "completed", run_type: "standard", billing_mode: "upfront", term_id: t2,
      summary: { total_invoices: springInvCount, total_amount_minor: springInvCount * 50000 },
    });
    await findOrInsert("billing_runs", { org_id: ORG_ID, start_date: "2026-04-20", end_date: "2026-07-17" }, {
      created_by: ownerUid, status: "draft", run_type: "standard", billing_mode: "upfront", term_id: t3,
      summary: { total_invoices: 8, total_amount_minor: 400000 },
    });
    L("14. Billing runs done");

    // ═══════════════════════════════════════════════════════════════
    // 15. MAKE-UP CREDITS
    // ═══════════════════════════════════════════════════════════════
    const creditStudents = ["Oliver Fletcher", "Zara Rahman", "Tariq Rahman", "Emeka Okonkwo", "Lily Douglas", "George Davies", "Anna Kowalski", "Sakura Tanaka"];
    for (let ci = 0; ci < creditStudents.length; ci++) {
      const s = creditStudents[ci];
      const sLessons = lessonIdsByStudent[s] || [];
      if (sLessons.length < 2) continue;
      const sourceLessonId = sLessons[Math.floor(sLessons.length / 3)];
      const tIdx = assignDefs.find(a => a.student === s)?.tIdx ?? 0;
      await admin.from("make_up_credits").insert({
        org_id: ORG_ID, student_id: students[s], teacher_id: teacherIds[tIdx],
        source_lesson_id: sourceLessonId, source_absence_reason: ci < 3 ? "teacher_cancelled" : "sick",
        credit_value_minor: 3800,
        expires_at: ci < 3 ? "2026-06-01T00:00:00Z" : "2026-03-01T00:00:00Z",
        redeemed_at: ci >= 3 && ci < 5 ? "2026-02-15T10:00:00Z" : null,
        redeemed_lesson_id: ci >= 3 && ci < 5 ? sLessons[sLessons.length - 1] : null,
        expired_at: ci >= 5 && ci < 7 ? "2026-03-01T00:00:00Z" : null,
        voided_at: ci === 7 ? "2026-02-20T10:00:00Z" : null,
      });
    }
    L("15. Make-up credits done");

    // ═══════════════════════════════════════════════════════════════
    // 16. ENROLMENT WAITLIST
    // ═══════════════════════════════════════════════════════════════
    const waitlistDefs = [
      { child: "Sophie Miller", contact: "Karen Miller", email: "karen.miller@example.com", inst: "Piano", status: "waiting" },
      { child: "James Wilson", contact: "Paul Wilson", email: "paul.wilson@example.com", inst: "Guitar", status: "waiting" },
      { child: "Olivia Brown", contact: "Sarah Brown", email: "sarah.brown2@example.com", inst: "Violin", status: "offered" },
      { child: "William Lee", contact: "Jenny Lee", email: "jenny.lee@example.com", inst: "Drums", status: "accepted" },
      { child: "Ava Green", contact: "Tom Green", email: "tom.green@example.com", inst: "Flute", status: "expired" },
      { child: "Lucas Hall", contact: "Maria Hall", email: "maria.hall@example.com", inst: "Cello", status: "cancelled" },
    ];
    for (let wi = 0; wi < waitlistDefs.length; wi++) {
      const w = waitlistDefs[wi];
      await findOrInsert("enrolment_waitlist", { org_id: ORG_ID, child_first_name: w.child.split(" ")[0], contact_name: w.contact }, {
        child_last_name: w.child.split(" ")[1], contact_email: w.email, instrument_name: w.inst,
        status: w.status, position: wi + 1, source: "website",
        preferred_days: ["monday", "wednesday"], preferred_time_earliest: "15:00", preferred_time_latest: "18:00",
      });
    }
    L("16. Enrolment waitlist done");

    // ═══════════════════════════════════════════════════════════════
    // 17. LEADS
    // ═══════════════════════════════════════════════════════════════
    const leadDefs = [
      { name: "Tom Henderson", email: "tom.h@example.com", stage: "enquiry", source: "website", instrument: "Piano", notes: "Son aged 8, wants weekly" },
      { name: "Lisa Park", email: "lisa.p@example.com", stage: "contacted", source: "referral", instrument: "Violin", notes: "Referred by Caroline Fletcher" },
      { name: "James Cooper", email: "james.c@example.com", stage: "trial_booked", source: "website", instrument: "Guitar", notes: "Trial 10 March", trial_date: "2026-03-10" },
      { name: "Fatima Hassan", email: "fatima.h@example.com", stage: "trial_completed", source: "social_media", instrument: "Voice", notes: "Enjoyed trial, considering", trial_date: "2026-02-24" },
      { name: "Ben Wright", email: "ben.w@example.com", stage: "enrolled", source: "referral", instrument: "Drums", notes: "Enrolled and active", converted_at: "2026-01-15T10:00:00Z" },
      { name: "Sophie Adams", email: "sophie.a@example.com", stage: "lost", source: "website", instrument: "Flute", notes: "Too expensive" },
      { name: "Chris Taylor", email: "chris.t@example.com", stage: "enquiry", source: "google", instrument: "Saxophone", notes: "Adult beginner" },
      { name: "Rachel Kim", email: "rachel.k@example.com", stage: "contacted", source: "referral", instrument: "Cello", notes: "Daughter aged 11" },
    ];
    for (const ld of leadDefs) {
      await findOrInsert("leads", { org_id: ORG_ID, contact_name: ld.name }, {
        contact_email: ld.email, stage: ld.stage, source: ld.source, preferred_instrument: ld.instrument,
        notes: ld.notes, trial_date: (ld as any).trial_date || null, converted_at: (ld as any).converted_at || null, created_by: ownerUid,
      });
    }
    L("17. Leads done");

    // ═══════════════════════════════════════════════════════════════
    // 18. PRACTICE ASSIGNMENTS + LOGS
    // ═══════════════════════════════════════════════════════════════
    const practiceDefs = [
      { s: "Oliver Fletcher", title: "Scales & Arpeggios", desc: "C, G, D major — hands together", targetMins: 20, targetDays: 5, tIdx: 0 },
      { s: "Zara Rahman", title: "Grade 2 Pieces", desc: "Pieces 1 and 2, focus on dynamics", targetMins: 15, targetDays: 4, tIdx: 0 },
      { s: "Tariq Rahman", title: "Suzuki Book 2", desc: "Minuet in G — bowing bars 8-16", targetMins: 20, targetDays: 5, tIdx: 1 },
      { s: "Emeka Okonkwo", title: "Chord Progressions", desc: "G-C-D-G smooth transitions", targetMins: 15, targetDays: 4, tIdx: 2 },
      { s: "Lily Douglas", title: "Long Tones", desc: "Breath support exercises p.12", targetMins: 10, targetDays: 5, tIdx: 3 },
      { s: "George Davies", title: "Drum Rudiments", desc: "Single and double paradiddle", targetMins: 15, targetDays: 5, tIdx: 4 },
      { s: "Anna Kowalski", title: "Bach Suite No. 1", desc: "Prelude, measures 1-20", targetMins: 25, targetDays: 5, tIdx: 1 },
      { s: "Grace Chen", title: "Cello Scales", desc: "Two-octave scales in first position", targetMins: 15, targetDays: 4, tIdx: 1 },
      { s: "Noah Patel", title: "Fingerpicking Patterns", desc: "Travis picking exercises", targetMins: 15, targetDays: 4, tIdx: 2 },
      { s: "Poppy Evans", title: "Saxophone Tone", desc: "Long tones on all registers", targetMins: 10, targetDays: 5, tIdx: 4 },
    ];
    for (const pd of practiceDefs) {
      if (!students[pd.s]) continue;
      const paId = await findOrInsert("practice_assignments", { org_id: ORG_ID, student_id: students[pd.s], title: pd.title }, {
        description: pd.desc, target_minutes_per_day: pd.targetMins, target_days_per_week: pd.targetDays,
        end_date: "2026-04-15", status: "active", teacher_user_id: teacherUids[pd.tIdx],
      });
      // Varied practice logs
      if (pd.s === "Oliver Fletcher") {
        for (let d = 0; d < 14; d++) {
          const date = new Date("2026-03-20"); date.setDate(date.getDate() + d);
          const ds = date.toISOString().slice(0, 10);
          await admin.from("practice_logs").insert({ org_id: ORG_ID, student_id: students[pd.s], assignment_id: paId, practice_date: ds, duration_minutes: 15 + Math.floor(Math.random() * 15), logged_by_user_id: teacherUids[pd.tIdx] });
        }
      } else if (pd.s === "Tariq Rahman" || pd.s === "Anna Kowalski") {
        for (const ds of ["2026-03-20", "2026-03-22", "2026-03-25", "2026-03-28", "2026-04-01"]) {
          await admin.from("practice_logs").insert({ org_id: ORG_ID, student_id: students[pd.s], assignment_id: paId, practice_date: ds, duration_minutes: 10 + Math.floor(Math.random() * 10), logged_by_user_id: teacherUids[pd.tIdx] });
        }
      }
    }
    L("18. Practice done");

    // ═══════════════════════════════════════════════════════════════
    // 19. RESOURCES
    // ═══════════════════════════════════════════════════════════════
    const resDefs = [
      { title: "Beginner Piano Scales", desc: "Major and minor scales for beginners", shares: ["Oliver Fletcher", "Zara Rahman", "Emily Douglas"] },
      { title: "ABRSM Grade 3 Violin", desc: "Exam repertoire and scales", shares: ["Tariq Rahman", "Chioma Okonkwo"] },
      { title: "Guitar Chord Chart", desc: "Open and barre chords reference", shares: ["Emeka Okonkwo", "Callum MacLeod", "Noah Patel"] },
      { title: "Flute Tone Exercises", desc: "Long tones and embouchure drills", shares: ["Lily Douglas", "Freya Jones"] },
      { title: "Drum Rudiments Sheet", desc: "26 essential drum rudiments", shares: ["George Davies", "Oliver Fletcher"] },
      { title: "Music Theory Basics", desc: "Key signatures, time signatures, intervals", shares: ["Oliver Fletcher", "Zara Rahman", "Tariq Rahman", "Emeka Okonkwo"] },
      { title: "Cello Position Chart", desc: "First through fourth position reference", shares: ["Anna Kowalski", "Grace Chen", "Ama Appiah"] },
      { title: "Saxophone Fingering Guide", desc: "Full range fingering chart", shares: ["Poppy Evans", "Kwesi Appiah"] },
    ];
    for (const rd of resDefs) {
      const resId = await findOrInsert("resources", { org_id: ORG_ID, title: rd.title }, {
        description: rd.desc, file_type: "application/pdf", file_size_bytes: 51200,
        file_name: `${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`,
        file_path: `resources/${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`,
        uploaded_by: ownerUid,
      });
      for (const s of rd.shares) {
        if (!students[s]) continue;
        const { data: ex } = await admin.from("resource_shares").select("id").eq("resource_id", resId).eq("student_id", students[s]).maybeSingle();
        if (!ex) await admin.from("resource_shares").insert({ resource_id: resId, student_id: students[s], org_id: ORG_ID, shared_by: ownerUid });
      }
    }
    L("19. Resources done");

    // ═══════════════════════════════════════════════════════════════
    // 20. AVAILABILITY BLOCKS
    // ═══════════════════════════════════════════════════════════════
    const availDefs = [
      // James - Mon-Thu 9-17
      ...["monday", "tuesday", "wednesday", "thursday"].map(d => ({ tIdx: 0, day: d, start: "09:00", end: "17:00" })),
      // Emily - Mon-Wed 14-20, Sat 9-13
      ...["monday", "tuesday", "wednesday"].map(d => ({ tIdx: 1, day: d, start: "14:00", end: "20:00" })),
      { tIdx: 1, day: "thursday", start: "14:00", end: "18:00" },
      { tIdx: 1, day: "saturday", start: "09:00", end: "13:00" },
      // Kwame - Mon/Wed/Fri 14-20
      ...["monday", "wednesday", "friday"].map(d => ({ tIdx: 2, day: d, start: "14:00", end: "20:00" })),
      // Sophie B - Tue/Thu 15-20
      ...["tuesday", "thursday"].map(d => ({ tIdx: 3, day: d, start: "15:00", end: "20:00" })),
      // Oliver V - Tue/Thu 14-20, Sat 9-14
      ...["tuesday", "thursday"].map(d => ({ tIdx: 4, day: d, start: "14:00", end: "20:00" })),
      { tIdx: 4, day: "saturday", start: "09:00", end: "14:00" },
    ];
    for (const ab of availDefs) {
      const { data: ex } = await admin.from("availability_blocks").select("id").eq("org_id", ORG_ID).eq("teacher_id", teacherIds[ab.tIdx]).eq("day_of_week", ab.day).maybeSingle();
      if (!ex) await admin.from("availability_blocks").insert({ org_id: ORG_ID, teacher_id: teacherIds[ab.tIdx], teacher_user_id: teacherUids[ab.tIdx], day_of_week: ab.day, start_time_local: ab.start, end_time_local: ab.end });
    }
    L("20. Availability done");

    // ═══════════════════════════════════════════════════════════════
    // 21. BOOKING PAGE
    // ═══════════════════════════════════════════════════════════════
    await findOrInsert("booking_pages", { org_id: ORG_ID, slug: "crescendo-agency" }, {
      enabled: true, title: "Crescendo Music Agency", description: "Book a trial lesson with our expert teachers",
      welcome_message: "Welcome! Choose your preferred instrument and we'll match you with the perfect teacher.",
      confirmation_message: "Booking confirmed! We'll email you shortly with details.",
      lesson_duration_mins: 30, advance_booking_days: 28, min_notice_hours: 24, buffer_minutes: 15,
    });
    L("21. Booking page done");

    // ═══════════════════════════════════════════════════════════════
    // 22. MESSAGE LOG (simulated)
    // ═══════════════════════════════════════════════════════════════
    const msgDefs = [
      { type: "invoice_sent", recipientEmail: "caroline.fletcher@example.com", subject: "Invoice for Autumn 2025", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "amir.rahman@example.com", subject: "Invoice for Autumn 2025", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "helen.douglas@example.com", subject: "Invoice for Spring 2026", status: "delivered" },
      { type: "payment_reminder", recipientEmail: "helen.douglas@example.com", subject: "Payment Reminder — Spring 2026", status: "delivered" },
      { type: "overdue_reminder", recipientEmail: "helen.douglas@example.com", subject: "Overdue — Spring Invoice", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "tomasz.kowalski@example.com", subject: "Invoice for Spring 2026", status: "delivered" },
      { type: "custom", recipientEmail: "nkechi.okonkwo@example.com", subject: "Chioma's violin progress update", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "margaret.chen@example.com", subject: "Invoice for Autumn 2025", status: "delivered" },
      { type: "lesson_reminder", recipientEmail: "david.sharma@example.com", subject: "Lesson Tomorrow — Arjun", status: "delivered" },
      { type: "custom", recipientEmail: "fiona.macleod@example.com", subject: "Isla's recital preparation", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "richard.appiah@example.com", subject: "Invoice for Spring 2026", status: "bounced" },
      { type: "payment_confirmation", recipientEmail: "yuki.tanaka@example.com", subject: "Payment received — thank you", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "peter.wright@example.com", subject: "Invoice for Spring 2026", status: "delivered" },
      { type: "custom", recipientEmail: "sunita.patel@example.com", subject: "Noah's guitar exam registration", status: "delivered" },
      { type: "overdue_reminder", recipientEmail: "karen.jones@example.com", subject: "Overdue — Ethan Jones", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "mark.williams@example.com", subject: "Invoice for Spring 2026", status: "delivered" },
      { type: "lesson_reminder", recipientEmail: "jane.taylor@example.com", subject: "Lesson Tomorrow — Leo", status: "delivered" },
      { type: "custom", recipientEmail: "sarah.brown@example.com", subject: "Mia's singing progress", status: "delivered" },
      { type: "invoice_sent", recipientEmail: "claire.wilson@example.com", subject: "Invoice for Spring 2026", status: "delivered" },
      { type: "welcome", recipientEmail: "ian.davies@example.com", subject: "Welcome to Crescendo Music", status: "delivered" },
    ];
    for (const m of msgDefs) {
      await findOrInsert("message_log", { org_id: ORG_ID, recipient_email: m.recipientEmail, subject: m.subject }, {
        message_type: m.type, body_html: `<p>${m.subject}</p>`, status: m.status, sent_by: ownerUid,
      });
    }
    L("22. Message log done");

    // ═══════════════════════════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════════════════════════
    L("✅ Agency seed complete!");
    return new Response(JSON.stringify({ success: true, log, org_id: ORG_ID, lessons: totalLessons }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    L(`❌ ERROR: ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
