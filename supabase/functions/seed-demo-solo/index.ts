// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ALLOW_SEED = Deno.env.get("ALLOW_SEED");
  if (!ALLOW_SEED) return new Response("Seed disabled", { status: 403, headers: corsHeaders });

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
    // 1. CREATE OWNER USER FIRST
    // ═══════════════════════════════════════════════════════════════
    const ownerEmail = "demo-solo-owner@lessonloop.test";
    const ownerPassword = "DemoSolo2026!";
    const ownerName = "Rebecca Taylor";
    let ownerUid: string;
    {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === ownerEmail);
      if (found) { ownerUid = found.id; }
      else {
        const { data, error } = await admin.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true });
        if (error) throw new Error(`Create owner: ${error.message}`);
        ownerUid = data.user.id;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. ORG
    // ═══════════════════════════════════════════════════════════════
    const ORG_ID = crypto.randomUUID();
    const { error: orgErr } = await admin.from("organisations").insert({
      id: ORG_ID, name: "Ms Taylor's Music", timezone: "Europe/London", currency_code: "GBP",
      vat_enabled: false, org_type: "solo_teacher", created_by: ownerUid,
      cancellation_notice_hours: 24, overdue_reminder_days: [7, 14],
      continuation_notice_weeks: 3, continuation_assumed_continuing: true,
      subscription_status: "active", subscription_plan: "solo_teacher",
      max_students: 9999, max_teachers: 1, default_lesson_length_mins: 30,
    });
    if (orgErr) throw new Error(`Org: ${orgErr.message}`);
    L(`1. Org: ${ORG_ID}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. REMAINING USERS
    // ═══════════════════════════════════════════════════════════════
    await admin.from("profiles").upsert({ id: ownerUid, full_name: ownerName, has_completed_onboarding: true, current_org_id: ORG_ID }, { onConflict: "id" });
    const { data: ownerMem } = await admin.from("org_memberships").select("id").eq("org_id", ORG_ID).eq("user_id", ownerUid).maybeSingle();
    if (!ownerMem) await admin.from("org_memberships").insert({ org_id: ORG_ID, user_id: ownerUid, role: "owner", status: "active" });

    const p1Uid = await ensureUser("demo-solo-parent-1@lessonloop.test", "DemoParent2026!", "Jennifer Adams", ORG_ID, "parent");
    const p2Uid = await ensureUser("demo-solo-parent-2@lessonloop.test", "DemoParent2026!", "Michael Harris", ORG_ID, "parent");
    L("2. Users created");

    // ═══════════════════════════════════════════════════════════════
    // 3. TEACHER + LOCATIONS
    // ═══════════════════════════════════════════════════════════════
    const teacherId = await findOrInsert("teachers", { org_id: ORG_ID, user_id: ownerUid }, { display_name: "Rebecca Taylor", status: "active" });
    const loc1 = await findOrInsert("locations", { org_id: ORG_ID, name: "Home Studio" }, { location_type: "studio", address_line_1: "8 Maple Lane", city: "Bath", postcode: "BA1 5BG", country_code: "GB" });
    const loc2 = await findOrInsert("locations", { org_id: ORG_ID, name: "Online" }, { location_type: "online" });
    const room1 = await findOrInsert("rooms", { location_id: loc1, org_id: ORG_ID, name: "Teaching Room" }, { capacity: 2 });
    L("3. Teacher + locations done");

    // ═══════════════════════════════════════════════════════════════
    // 4. INSTRUMENTS + TERMS
    // ═══════════════════════════════════════════════════════════════
    const instNames = ["Piano", "Voice", "Music Theory"];
    const instruments: Record<string, string> = {};
    for (const name of instNames) {
      const { data: ex } = await admin.from("instruments").select("id").eq("name", name).or(`org_id.is.null,org_id.eq.${ORG_ID}`).maybeSingle();
      if (ex) instruments[name] = (ex as any).id;
      else {
        const { data: cr } = await admin.from("instruments").insert({ name, category: "standard", org_id: ORG_ID, is_custom: true }).select("id").single();
        instruments[name] = (cr as any).id;
      }
    }
    const t1 = await findOrInsert("terms", { org_id: ORG_ID, name: "Autumn 2025" }, { start_date: "2025-09-01", end_date: "2025-12-19", created_by: ownerUid });
    const t2 = await findOrInsert("terms", { org_id: ORG_ID, name: "Spring 2026" }, { start_date: "2026-01-05", end_date: "2026-03-27", created_by: ownerUid });
    const t3 = await findOrInsert("terms", { org_id: ORG_ID, name: "Summer 2026" }, { start_date: "2026-04-20", end_date: "2026-07-17", created_by: ownerUid });
    L("4. Instruments + terms done");

    // ═══════════════════════════════════════════════════════════════
    // 5. STUDENTS (12)
    // ═══════════════════════════════════════════════════════════════
    const studentDefs = [
      { fn: "Emma", ln: "Adams", status: "active" }, { fn: "Jake", ln: "Adams", status: "active" },
      { fn: "Sophia", ln: "Harris", status: "active" }, { fn: "Liam", ln: "Harris", status: "active" },
      { fn: "Chloe", ln: "Bennett", status: "active" }, { fn: "Oliver", ln: "Webb", status: "active" },
      { fn: "Maisie", ln: "Clarke", status: "active" }, { fn: "Archie", ln: "Morgan", status: "active" },
      { fn: "Isla", ln: "Price", status: "active" }, { fn: "Henry", ln: "Scott", status: "active" },
      { fn: "Ruby", ln: "Foster", status: "inactive" }, { fn: "George", ln: "Hall", status: "inactive" },
    ];
    const students: Record<string, string> = {};
    for (const s of studentDefs) {
      const key = `${s.fn} ${s.ln}`;
      students[key] = await findOrInsert("students", { org_id: ORG_ID, first_name: s.fn, last_name: s.ln }, { status: s.status });
    }
    L(`5. ${Object.keys(students).length} students`);

    // ═══════════════════════════════════════════════════════════════
    // 6. GUARDIANS + LINKS
    // ═══════════════════════════════════════════════════════════════
    const guardianDefs: Array<{ name: string; email: string; phone: string; children: string[]; uid: string | null }> = [
      { name: "Jennifer Adams", email: "jennifer.adams@example.com", phone: "+447700300001", children: ["Emma Adams", "Jake Adams"], uid: p1Uid },
      { name: "Michael Harris", email: "michael.harris@example.com", phone: "+447700300002", children: ["Sophia Harris", "Liam Harris"], uid: p2Uid },
      { name: "Sarah Bennett", email: "sarah.bennett@example.com", phone: "+447700300003", children: ["Chloe Bennett"], uid: null },
      { name: "Lisa Webb", email: "lisa.webb@example.com", phone: "+447700300004", children: ["Oliver Webb"], uid: null },
      { name: "Rachel Clarke", email: "rachel.clarke@example.com", phone: "+447700300005", children: ["Maisie Clarke"], uid: null },
      { name: "Tom Morgan", email: "tom.morgan@example.com", phone: "+447700300006", children: ["Archie Morgan"], uid: null },
      { name: "Amanda Price", email: "amanda.price@example.com", phone: "+447700300007", children: ["Isla Price"], uid: null },
      { name: "Paul Scott", email: "paul.scott@example.com", phone: "+447700300008", children: ["Henry Scott"], uid: null },
    ];
    const guardians: Record<string, string> = {};
    for (const gd of guardianDefs) {
      guardians[gd.name] = await findOrInsert("guardians", { org_id: ORG_ID, full_name: gd.name }, { email: gd.email, phone: gd.phone, user_id: gd.uid });
      for (const child of gd.children) {
        if (!students[child]) continue;
        const { data: ex } = await admin.from("student_guardians").select("id").eq("guardian_id", guardians[gd.name]).eq("student_id", students[child]).maybeSingle();
        if (!ex) await admin.from("student_guardians").insert({ guardian_id: guardians[gd.name], student_id: students[child], relationship: "mother", is_primary_payer: true, org_id: ORG_ID });
      }
    }
    L("6. Guardians done");

    // ═══════════════════════════════════════════════════════════════
    // 7. ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════════
    const assignDefs = [
      { s: "Emma Adams", inst: "Piano" }, { s: "Jake Adams", inst: "Piano" },
      { s: "Sophia Harris", inst: "Voice" }, { s: "Liam Harris", inst: "Piano" },
      { s: "Chloe Bennett", inst: "Piano" }, { s: "Oliver Webb", inst: "Voice" },
      { s: "Maisie Clarke", inst: "Piano" }, { s: "Archie Morgan", inst: "Piano" },
      { s: "Isla Price", inst: "Voice" }, { s: "Henry Scott", inst: "Music Theory" },
    ];
    for (const a of assignDefs) {
      if (!students[a.s]) continue;
      const { data: exSTA } = await admin.from("student_teacher_assignments").select("id").eq("teacher_id", teacherId).eq("student_id", students[a.s]).eq("org_id", ORG_ID).maybeSingle();
      if (!exSTA) await admin.from("student_teacher_assignments").insert({ teacher_id: teacherId, teacher_user_id: ownerUid, student_id: students[a.s], org_id: ORG_ID, instrument_id: instruments[a.inst] });
      const { data: exSI } = await admin.from("student_instruments").select("id").eq("student_id", students[a.s]).eq("instrument_id", instruments[a.inst]).maybeSingle();
      if (!exSI) await admin.from("student_instruments").insert({ student_id: students[a.s], instrument_id: instruments[a.inst], org_id: ORG_ID, is_primary: true });
    }
    L("7. Assignments done");

    // ═══════════════════════════════════════════════════════════════
    // 8. RATE CARDS + CLOSURES
    // ═══════════════════════════════════════════════════════════════
    await findOrInsert("rate_cards", { org_id: ORG_ID, name: "30-min Private" }, { duration_mins: 30, rate_amount: 30, is_default: true });
    await findOrInsert("rate_cards", { org_id: ORG_ID, name: "45-min Private" }, { duration_mins: 45, rate_amount: 42, is_default: false });
    await findOrInsert("rate_cards", { org_id: ORG_ID, name: "Online 30-min" }, { duration_mins: 30, rate_amount: 25, is_default: false });

    const closureRanges = [
      { start: "2025-10-27", end: "2025-10-31", reason: "October Half Term" },
      { start: "2025-12-20", end: "2026-01-04", reason: "Christmas" },
      { start: "2026-02-16", end: "2026-02-20", reason: "February Half Term" },
      { start: "2026-04-03", end: "2026-04-18", reason: "Easter" },
      { start: "2026-05-25", end: "2026-05-29", reason: "May Half Term" },
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
    L("8. Rate cards + closures done");

    // ═══════════════════════════════════════════════════════════════
    // 9. LESSONS
    // ═══════════════════════════════════════════════════════════════
    const termDates: Record<string, { start: string; end: string; id: string }> = {
      autumn: { start: "2025-09-01", end: "2025-12-19", id: t1 },
      spring: { start: "2026-01-05", end: "2026-03-27", id: t2 },
      summer: { start: "2026-04-20", end: "2026-07-17", id: t3 },
    };
    const NOW = new Date("2026-04-10T12:00:00Z");

    type Sched = { students: string[]; day: number; hr: number; min: number; dur: number; inst: string; locId: string; roomId: string | null; terms: string[] };
    const schedules: Sched[] = [
      { students: ["Emma Adams"], day: 1, hr: 9, min: 0, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring", "summer"] },
      { students: ["Jake Adams"], day: 1, hr: 9, min: 45, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring", "summer"] },
      { students: ["Sophia Harris"], day: 1, hr: 10, min: 30, dur: 30, inst: "Voice", locId: loc1, roomId: room1, terms: ["autumn", "spring", "summer"] },
      { students: ["Liam Harris"], day: 2, hr: 9, min: 0, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring"] },
      { students: ["Chloe Bennett"], day: 2, hr: 9, min: 45, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring", "summer"] },
      { students: ["Oliver Webb"], day: 3, hr: 9, min: 0, dur: 30, inst: "Voice", locId: loc2, roomId: null, terms: ["spring", "summer"] },
      { students: ["Maisie Clarke"], day: 3, hr: 10, min: 0, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring", "summer"] },
      { students: ["Archie Morgan"], day: 4, hr: 9, min: 0, dur: 30, inst: "Piano", locId: loc1, roomId: room1, terms: ["autumn", "spring"] },
      { students: ["Isla Price"], day: 4, hr: 9, min: 45, dur: 30, inst: "Voice", locId: loc1, roomId: room1, terms: ["spring", "summer"] },
      { students: ["Henry Scott"], day: 4, hr: 10, min: 30, dur: 45, inst: "Music Theory", locId: loc2, roomId: null, terms: ["autumn", "spring", "summer"] },
    ];

    const recurrenceIds: string[] = [];
    for (const sched of schedules) {
      const { data: rec } = await admin.from("recurrence_rules").insert({
        org_id: ORG_ID, pattern_type: "weekly", interval_weeks: 1, days_of_week: [sched.day],
        start_date: termDates[sched.terms[0]].start, timezone: "Europe/London",
      }).select("id").single();
      recurrenceIds.push((rec as any).id);
    }

    const lessonRows: any[] = [];
    type LMeta = { date: string; termKey: string; studentNames: string[]; status: string };
    const lessonMetas: LMeta[] = [];

    for (let si = 0; si < schedules.length; si++) {
      const sched = schedules[si];
      for (const termKey of sched.terms) {
        const term = termDates[termKey];
        const dates = weeklyDates(term.start, term.end, sched.day, allClosures);
        for (const date of dates) {
          const startAt = `${date}T${String(sched.hr).padStart(2, "0")}:${String(sched.min).padStart(2, "0")}:00Z`;
          const endAt = new Date(new Date(startAt).getTime() + sched.dur * 60000).toISOString();
          const isPast = new Date(startAt) < NOW;
          const status = isPast ? "completed" : "scheduled";
          lessonRows.push({
            org_id: ORG_ID, title: `${sched.inst} — ${sched.students[0]}`, teacher_id: teacherId, teacher_user_id: ownerUid,
            created_by: ownerUid, location_id: sched.locId, room_id: sched.roomId,
            start_at: startAt, end_at: endAt, status, recurrence_id: recurrenceIds[si],
            max_participants: 1, lesson_type: "private",
          });
          lessonMetas.push({ date, termKey, studentNames: sched.students, status });
        }
      }
    }

    const allLessonIds: string[] = [];
    for (let i = 0; i < lessonRows.length; i += 50) {
      const { data: created, error } = await admin.from("lessons").insert(lessonRows.slice(i, i + 50)).select("id");
      if (error) { L(`Lesson err: ${error.message}`); break; }
      for (const c of (created || [])) allLessonIds.push((c as any).id);
    }

    const participantRows: any[] = [];
    const attendanceRows: any[] = [];
    const lessonIdsByStudent: Record<string, string[]> = {};

    for (let li = 0; li < allLessonIds.length; li++) {
      const meta = lessonMetas[li];
      if (!meta) continue;
      for (const sName of meta.studentNames) {
        if (!students[sName]) continue;
        participantRows.push({ lesson_id: allLessonIds[li], student_id: students[sName], org_id: ORG_ID });
        if (!lessonIdsByStudent[sName]) lessonIdsByStudent[sName] = [];
        lessonIdsByStudent[sName].push(allLessonIds[li]);
        if (meta.status === "completed") {
          attendanceRows.push({
            lesson_id: allLessonIds[li], student_id: students[sName], org_id: ORG_ID,
            attendance_status: Math.random() < 0.92 ? "present" : "late",
            absence_reason_category: null, recorded_by: ownerUid,
          });
        }
      }
    }
    for (let i = 0; i < participantRows.length; i += 100) await admin.from("lesson_participants").insert(participantRows.slice(i, i + 100));
    for (let i = 0; i < attendanceRows.length; i += 100) await admin.from("attendance_records").insert(attendanceRows.slice(i, i + 100));
    L(`9. Lessons: ${allLessonIds.length}`);

    // ═══════════════════════════════════════════════════════════════
    // 10. INVOICES
    // ═══════════════════════════════════════════════════════════════
    async function createInvoice(opts: { payerGuardianId: string; status: string; subtotalMinor: number; issueDate: string; dueDate: string; notes: string; termId: string; items: Array<{ desc: string; qty: number; price: number; studentId: string }> }): Promise<string> {
      const totalMinor = opts.subtotalMinor; // no VAT for solo
      const { data: inv, error } = await admin.from("invoices").insert({
        org_id: ORG_ID, invoice_number: "", payer_guardian_id: opts.payerGuardianId,
        subtotal_minor: opts.subtotalMinor, tax_minor: 0, total_minor: totalMinor,
        vat_rate: 0, currency_code: "GBP", due_date: opts.dueDate, issue_date: opts.issueDate,
        notes: opts.notes, term_id: opts.termId,
      }).select("id, total_minor").single();
      if (error) throw new Error(`Invoice: ${error.message}`);
      const invId = (inv as any).id;
      for (const item of opts.items) {
        await admin.from("invoice_items").insert({ invoice_id: invId, org_id: ORG_ID, description: item.desc, quantity: item.qty, unit_price_minor: item.price, amount_minor: item.qty * item.price, student_id: item.studentId });
      }
      if (opts.status !== "draft") {
        await admin.from("invoices").update({ status: "sent" }).eq("id", invId);
        if (opts.status === "paid") await admin.from("invoices").update({ status: "paid", paid_minor: totalMinor }).eq("id", invId);
        else if (opts.status === "overdue") await admin.from("invoices").update({ status: "overdue" }).eq("id", invId);
      }
      return invId;
    }

    // Autumn — all paid
    for (const gd of guardianDefs) {
      const items = gd.children.filter(c => students[c]).map(c => ({ desc: `Autumn — ${c}`, qty: 12, price: 3000, studentId: students[c] }));
      if (items.length === 0) continue;
      const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
      const invId = await createInvoice({ payerGuardianId: guardians[gd.name], status: "paid", subtotalMinor: subtotal, issueDate: "2025-09-01", dueDate: "2025-09-15", notes: "Autumn 2025", termId: t1, items });
      await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: invId, amount_minor: subtotal, currency_code: "GBP", method: "bank_transfer", provider: "manual" });
    }

    // Spring — mixed
    const springStatuses = ["paid", "paid", "sent", "sent", "overdue", "overdue", "draft", "draft"];
    for (let gi = 0; gi < guardianDefs.length; gi++) {
      const gd = guardianDefs[gi];
      const items = gd.children.filter(c => students[c]).map(c => ({ desc: `Spring — ${c}`, qty: 11, price: 3000, studentId: students[c] }));
      if (items.length === 0) continue;
      const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
      const status = springStatuses[gi] || "draft";
      const invId = await createInvoice({ payerGuardianId: guardians[gd.name], status, subtotalMinor: subtotal, issueDate: "2026-01-05", dueDate: "2026-01-19", notes: "Spring 2026", termId: t2, items });
      if (status === "paid") await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: invId, amount_minor: subtotal, currency_code: "GBP", method: "card", provider: "manual" });
    }
    L("10. Invoices done");

    // ═══════════════════════════════════════════════════════════════
    // 11. MAKE-UP CREDITS
    // ═══════════════════════════════════════════════════════════════
    const creditStudents = ["Emma Adams", "Sophia Harris", "Chloe Bennett"];
    for (let ci = 0; ci < creditStudents.length; ci++) {
      const s = creditStudents[ci];
      const sLessons = lessonIdsByStudent[s] || [];
      if (sLessons.length < 2) continue;
      await admin.from("make_up_credits").insert({
        org_id: ORG_ID, student_id: students[s], teacher_id: teacherId,
        source_lesson_id: sLessons[Math.floor(sLessons.length / 3)],
        source_absence_reason: ci === 0 ? "teacher_cancelled" : "sick",
        credit_value_minor: 3000,
        expires_at: ci === 2 ? "2026-02-01T00:00:00Z" : "2026-06-01T00:00:00Z",
        redeemed_at: ci === 1 ? "2026-02-15T10:00:00Z" : null,
        redeemed_lesson_id: ci === 1 ? sLessons[sLessons.length - 1] : null,
        expired_at: ci === 2 ? "2026-02-01T00:00:00Z" : null,
      });
    }
    L("11. Make-up credits done");

    // ═══════════════════════════════════════════════════════════════
    // 12. LEADS + RESOURCES + AVAILABILITY + BILLING RUN
    // ═══════════════════════════════════════════════════════════════
    const leadDefs = [
      { name: "Amy Watson", email: "amy.w@example.com", stage: "enquiry", source: "website", instrument: "Piano", notes: "Daughter aged 7" },
      { name: "Chris Brown", email: "chris.b@example.com", stage: "trial_booked", source: "referral", instrument: "Voice", notes: "Trial next week", trial_date: "2026-04-15" },
      { name: "Diana Lee", email: "diana.l@example.com", stage: "lost", source: "website", instrument: "Piano", notes: "Decided on another teacher" },
    ];
    for (const ld of leadDefs) {
      await findOrInsert("leads", { org_id: ORG_ID, contact_name: ld.name }, { contact_email: ld.email, stage: ld.stage, source: ld.source, preferred_instrument: ld.instrument, notes: ld.notes, trial_date: (ld as any).trial_date || null, created_by: ownerUid });
    }

    const resDefs = [
      { title: "Piano Scales for Beginners", desc: "All major scales", shares: ["Emma Adams", "Jake Adams", "Liam Harris"] },
      { title: "Vocal Warm-ups", desc: "5-minute daily warm-up routine", shares: ["Sophia Harris", "Oliver Webb"] },
      { title: "Grade 1 Theory Worksheets", desc: "ABRSM theory exercises", shares: ["Henry Scott"] },
    ];
    for (const rd of resDefs) {
      const resId = await findOrInsert("resources", { org_id: ORG_ID, title: rd.title }, {
        description: rd.desc, file_type: "application/pdf", file_size_bytes: 32768,
        file_name: `${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`, file_path: `resources/${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`, uploaded_by: ownerUid,
      });
      for (const s of rd.shares) {
        if (!students[s]) continue;
        const { data: ex } = await admin.from("resource_shares").select("id").eq("resource_id", resId).eq("student_id", students[s]).maybeSingle();
        if (!ex) await admin.from("resource_shares").insert({ resource_id: resId, student_id: students[s], org_id: ORG_ID, shared_by: ownerUid });
      }
    }

    for (const day of ["monday", "tuesday", "wednesday", "thursday"]) {
      const { data: ex } = await admin.from("availability_blocks").select("id").eq("org_id", ORG_ID).eq("teacher_id", teacherId).eq("day_of_week", day).maybeSingle();
      if (!ex) await admin.from("availability_blocks").insert({ org_id: ORG_ID, teacher_id: teacherId, teacher_user_id: ownerUid, day_of_week: day, start_time_local: "09:00", end_time_local: "15:00" });
    }

    await findOrInsert("billing_runs", { org_id: ORG_ID, start_date: "2025-09-01", end_date: "2025-12-19" }, { created_by: ownerUid, status: "completed", run_type: "term", billing_mode: "upfront", term_id: t1, summary: { total_invoices: 8, total_amount_minor: 288000 } });
    await findOrInsert("billing_runs", { org_id: ORG_ID, start_date: "2026-01-05", end_date: "2026-03-27" }, { created_by: ownerUid, status: "completed", run_type: "term", billing_mode: "upfront", term_id: t2, summary: { total_invoices: 8, total_amount_minor: 264000 } });
    L("12. Leads, resources, availability, billing runs done");

    // ═══════════════════════════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════════════════════════
    L("✅ Solo teacher seed complete!");
    return new Response(JSON.stringify({ success: true, log, org_id: ORG_ID, lessons: allLessonIds.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    L(`❌ ERROR: ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
