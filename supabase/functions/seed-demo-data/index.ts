// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "5b905216-85ae-4aca-8c50-9757d0444b60";
const OWNER_USER_ID = "b633da13-0599-4ab0-bfd8-c5a686b5d684";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const log: string[] = [];
  const L = (msg: string) => { log.push(msg); console.log(msg); };

  try {
    // ─── Helpers ───
    async function findOrInsert(table: string, match: Record<string, any>, data: Record<string, any>): Promise<string> {
      const q = admin.from(table).select("id");
      for (const [k, v] of Object.entries(match)) {
        if (v === null) q.is(k, null);
        else q.eq(k, v);
      }
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

    async function ensureUser(email: string, name: string): Promise<string> {
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === email);
      if (found) return found.id;
      const { data, error } = await admin.auth.admin.createUser({
        email, password: "DemoTeacher2026!", email_confirm: true,
      });
      if (error) throw new Error(`Create user ${email}: ${error.message}`);
      await admin.from("profiles").upsert({ id: data.user.id, full_name: name, has_completed_onboarding: true, current_org_id: ORG_ID }, { onConflict: "id" });
      const { data: existingMem } = await admin.from("org_memberships").select("id").eq("org_id", ORG_ID).eq("user_id", data.user.id).maybeSingle();
      if (!existingMem) {
        await admin.from("org_memberships").insert({ org_id: ORG_ID, user_id: data.user.id, role: "teacher", status: "active" });
      }
      return data.user.id;
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. ORGANISATION SETTINGS
    // ═══════════════════════════════════════════════════════════════
    await admin.from("organisations").update({
      name: "Harmony Music Studios",
      timezone: "Europe/London",
      currency_code: "GBP",
      vat_enabled: true,
      vat_rate: 20,
      cancellation_notice_hours: 24,
      overdue_reminder_days: [7, 14, 30],
      continuation_notice_weeks: 4,
      continuation_assumed_continuing: true,
      parent_can_message_teacher: true,
      subscription_status: "active",
      subscription_plan: "academy",
      max_students: 9999,
      max_teachers: 10,
      default_lesson_length_mins: 30,
    }).eq("id", ORG_ID);
    L("1. Org settings updated");

    // ═══════════════════════════════════════════════════════════════
    // 2. TERMS
    // ═══════════════════════════════════════════════════════════════
    const autumnTermId = await findOrInsert("terms", { org_id: ORG_ID, name: "Autumn 2025" }, { start_date: "2025-09-01", end_date: "2025-12-19", created_by: OWNER_USER_ID });
    const springTermId = await findOrInsert("terms", { org_id: ORG_ID, name: "Spring 2026" }, { start_date: "2026-01-05", end_date: "2026-03-27", created_by: OWNER_USER_ID });
    const summerTermId = await findOrInsert("terms", { org_id: ORG_ID, name: "Summer 2026" }, { start_date: "2026-04-20", end_date: "2026-07-17", created_by: OWNER_USER_ID });
    L(`2. Terms: ${autumnTermId}, ${springTermId}, ${summerTermId}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. TEACHERS
    // ═══════════════════════════════════════════════════════════════
    await admin.from("profiles").upsert({ id: OWNER_USER_ID, full_name: "Lauren Twilley", has_completed_onboarding: true, current_org_id: ORG_ID }, { onConflict: "id" });
    const marcusUserId = await ensureUser("marcus@lessonloop.test", "Marcus Chen");
    const priyaUserId = await ensureUser("priya@lessonloop.test", "Priya Sharma");

    const ownerTeacherId = await findOrInsert("teachers", { org_id: ORG_ID, user_id: OWNER_USER_ID }, { display_name: "Lauren Twilley", status: "active" });
    const marcusTeacherId = await findOrInsert("teachers", { org_id: ORG_ID, user_id: marcusUserId }, { display_name: "Marcus Chen", status: "active" });
    const priyaTeacherId = await findOrInsert("teachers", { org_id: ORG_ID, user_id: priyaUserId }, { display_name: "Priya Sharma", status: "active" });
    L(`3. Teachers: lauren=${ownerTeacherId}, marcus=${marcusTeacherId}, priya=${priyaTeacherId}`);

    // ═══════════════════════════════════════════════════════════════
    // 4. LOCATIONS + ROOMS
    // ═══════════════════════════════════════════════════════════════
    const harmonyLocId = await findOrInsert("locations", { org_id: ORG_ID, name: "Harmony Studios" }, { location_type: "studio", address_line_1: "123 High Street", city: "Richmond", postcode: "TW9 1DN", country_code: "GB" });
    const onlineLocId = await findOrInsert("locations", { org_id: ORG_ID, name: "Online" }, { location_type: "online" });
    const room1Id = await findOrInsert("rooms", { location_id: harmonyLocId, org_id: ORG_ID, name: "Room 1" }, { capacity: 1 });
    const room2Id = await findOrInsert("rooms", { location_id: harmonyLocId, org_id: ORG_ID, name: "Room 2" }, { capacity: 1 });
    const ensembleRoomId = await findOrInsert("rooms", { location_id: harmonyLocId, org_id: ORG_ID, name: "Ensemble Room" }, { capacity: 8 });
    L(`4. Locations + rooms done`);

    // ═══════════════════════════════════════════════════════════════
    // 5. INSTRUMENTS
    // ═══════════════════════════════════════════════════════════════
    const instrumentNames = ["Piano", "Guitar", "Violin", "Voice", "Drums", "Bass", "Cello", "Ukulele"];
    const instruments: Record<string, string> = {};
    for (const name of instrumentNames) {
      const { data: existing } = await admin.from("instruments").select("id").eq("name", name).or(`org_id.is.null,org_id.eq.${ORG_ID}`).maybeSingle();
      if (existing) { instruments[name] = (existing as any).id; }
      else {
        const { data: created } = await admin.from("instruments").insert({ name, category: "standard", org_id: ORG_ID, is_custom: true }).select("id").single();
        instruments[name] = (created as any).id;
      }
    }
    L("5. Instruments done");

    // ═══════════════════════════════════════════════════════════════
    // 6. STUDENTS
    // ═══════════════════════════════════════════════════════════════
    const studentDefs = [
      { first_name: "Ella", last_name: "Whitmore", status: "active" },
      { first_name: "Noah", last_name: "Patel", status: "active" },
      { first_name: "Amelia", last_name: "Brooks", status: "active" },
      { first_name: "Oscar", last_name: "Chen", status: "active" },
      { first_name: "Isla", last_name: "Martinez", status: "active" },
      { first_name: "Freddie", last_name: "Young", status: "active" },
      { first_name: "Sophia", last_name: "Okafor", status: "active" },
      { first_name: "Liam", last_name: "Bennett", status: "active" },
      { first_name: "Ruby", last_name: "Kowalski", status: "active" },
      { first_name: "George", last_name: "Taylor", status: "inactive" },
      { first_name: "Maisie", last_name: "Green", status: "active" },
      { first_name: "Harry", last_name: "Evans", status: "active" },
    ];
    const students: Record<string, string> = {};
    for (const sd of studentDefs) {
      students[sd.first_name] = await findOrInsert("students", { org_id: ORG_ID, first_name: sd.first_name, last_name: sd.last_name }, { status: sd.status });
    }
    L(`6. Students: ${Object.keys(students).join(", ")}`);

    // ═══════════════════════════════════════════════════════════════
    // 7. GUARDIANS + LINKS
    // ═══════════════════════════════════════════════════════════════
    const guardianDefs = [
      { name: "Sarah Whitmore", email: "sarah.whitmore@example.com", phone: "+447700100001", children: ["Ella", "Harry"] },
      { name: "Raj Patel", email: "raj.patel@example.com", phone: "+447700100002", children: ["Noah"] },
      { name: "Claire Brooks", email: "claire.brooks@example.com", phone: "+447700100003", children: ["Amelia", "George"] },
      { name: "David Martinez", email: "david.martinez@example.com", phone: "+447700100004", children: ["Isla", "Oscar"] },
      { name: "Jenny Okafor", email: "jenny.okafor@example.com", phone: "+447700100005", children: ["Sophia"] },
      { name: "Anna Bennett", email: "anna.bennett@example.com", phone: "+447700100006", children: ["Liam", "Ruby"] },
    ];
    const guardians: Record<string, string> = {};
    for (const gd of guardianDefs) {
      guardians[gd.name] = await findOrInsert("guardians", { org_id: ORG_ID, full_name: gd.name }, { email: gd.email, phone: gd.phone });
      for (const child of gd.children) {
        const { data: ex } = await admin.from("student_guardians").select("id").eq("guardian_id", guardians[gd.name]).eq("student_id", students[child]).maybeSingle();
        if (!ex) {
          await admin.from("student_guardians").insert({ guardian_id: guardians[gd.name], student_id: students[child], relationship: "parent", is_primary_payer: true, org_id: ORG_ID });
        }
      }
    }
    L("7. Guardians + links done");

    // ═══════════════════════════════════════════════════════════════
    // 7b. PARENT PORTAL TEST USER (Sarah Whitmore)
    // ═══════════════════════════════════════════════════════════════
    const PARENT_EMAIL = "demo-parent@lessonloop.test";
    const PARENT_PASSWORD = "DemoParent2026!";
    const { data: existingParentUsers } = await admin.auth.admin.listUsers();
    const existingParent = existingParentUsers?.users?.find((u: any) => u.email === PARENT_EMAIL);
    let parentUserId: string;
    if (existingParent) {
      parentUserId = existingParent.id;
    } else {
      const { data: newParent, error: parentErr } = await admin.auth.admin.createUser({
        email: PARENT_EMAIL, password: PARENT_PASSWORD, email_confirm: true,
      });
      if (parentErr) throw new Error(`Create parent user: ${parentErr.message}`);
      parentUserId = newParent.user.id;
    }
    // Profile
    await admin.from("profiles").upsert({
      id: parentUserId, full_name: "Sarah Whitmore",
      has_completed_onboarding: true, current_org_id: ORG_ID,
    }, { onConflict: "id" });
    // Membership as parent
    const { data: existingParentMem } = await admin.from("org_memberships").select("id")
      .eq("org_id", ORG_ID).eq("user_id", parentUserId).maybeSingle();
    if (!existingParentMem) {
      await admin.from("org_memberships").insert({ org_id: ORG_ID, user_id: parentUserId, role: "parent", status: "active" });
    }
    // Link guardian record to this user
    await admin.from("guardians").update({ user_id: parentUserId }).eq("id", guardians["Sarah Whitmore"]);
    L(`7b. Parent user created: ${PARENT_EMAIL} / ${PARENT_PASSWORD} (linked to Sarah Whitmore → Ella + Harry)`);

    // ═══════════════════════════════════════════════════════════════
    // 8. ASSIGNMENTS + STUDENT-INSTRUMENTS
    // ═══════════════════════════════════════════════════════════════
    const assignments = [
      { s: "Ella", t: ownerTeacherId, u: OWNER_USER_ID, i: "Piano" },
      { s: "Noah", t: ownerTeacherId, u: OWNER_USER_ID, i: "Piano" },
      { s: "Amelia", t: ownerTeacherId, u: OWNER_USER_ID, i: "Voice" },
      { s: "Harry", t: ownerTeacherId, u: OWNER_USER_ID, i: "Drums" },
      { s: "George", t: ownerTeacherId, u: OWNER_USER_ID, i: "Piano" },
      { s: "Oscar", t: marcusTeacherId, u: marcusUserId, i: "Guitar" },
      { s: "Isla", t: marcusTeacherId, u: marcusUserId, i: "Guitar" },
      { s: "Freddie", t: marcusTeacherId, u: marcusUserId, i: "Bass" },
      { s: "Maisie", t: marcusTeacherId, u: marcusUserId, i: "Guitar" },
      { s: "Sophia", t: priyaTeacherId, u: priyaUserId, i: "Violin" },
      { s: "Liam", t: priyaTeacherId, u: priyaUserId, i: "Violin" },
      { s: "Ruby", t: priyaTeacherId, u: priyaUserId, i: "Cello" },
    ];
    for (const a of assignments) {
      const { data: exSTA } = await admin.from("student_teacher_assignments").select("id").eq("teacher_id", a.t).eq("student_id", students[a.s]).eq("org_id", ORG_ID).maybeSingle();
      if (!exSTA) await admin.from("student_teacher_assignments").insert({ teacher_id: a.t, teacher_user_id: a.u, student_id: students[a.s], org_id: ORG_ID, instrument_id: instruments[a.i] });
      const { data: exSI } = await admin.from("student_instruments").select("id").eq("student_id", students[a.s]).eq("instrument_id", instruments[a.i]).maybeSingle();
      if (!exSI) await admin.from("student_instruments").insert({ student_id: students[a.s], instrument_id: instruments[a.i], org_id: ORG_ID, is_primary: true });
    }
    L("8. Assignments done");

    // ═══════════════════════════════════════════════════════════════
    // 9. RATE CARDS
    // ═══════════════════════════════════════════════════════════════
    const rateCardDefs = [
      { name: "Standard 30-min", duration_mins: 30, rate_amount: 35, is_default: true },
      { name: "Standard 45-min", duration_mins: 45, rate_amount: 48, is_default: false },
      { name: "Standard 60-min", duration_mins: 60, rate_amount: 60, is_default: false },
      { name: "Group 60-min", duration_mins: 60, rate_amount: 20, is_default: false },
    ];
    for (const rc of rateCardDefs) {
      await findOrInsert("rate_cards", { org_id: ORG_ID, name: rc.name }, { duration_mins: rc.duration_mins, rate_amount: rc.rate_amount, is_default: rc.is_default });
    }
    L("9. Rate cards done");

    // ═══════════════════════════════════════════════════════════════
    // 10. CLOSURE DATES
    // ═══════════════════════════════════════════════════════════════
    const closureRanges = [
      { start: "2025-12-20", end: "2026-01-04", reason: "Christmas closure" },
      { start: "2026-02-16", end: "2026-02-20", reason: "Half-term" },
      { start: "2026-04-03", end: "2026-04-18", reason: "Easter holiday" },
    ];
    const bankHolidays = [
      { date: "2026-05-04", reason: "Early May Bank Holiday" },
      { date: "2026-05-25", reason: "Spring Bank Holiday" },
      { date: "2026-08-31", reason: "Summer Bank Holiday" },
    ];
    const allClosures = new Set<string>();

    for (const range of closureRanges) {
      const cur = new Date(range.start + "T00:00:00Z");
      const end = new Date(range.end + "T23:59:59Z");
      while (cur <= end) {
        const d = cur.toISOString().slice(0, 10);
        allClosures.add(d);
        const { data: ex } = await admin.from("closure_dates").select("id").eq("org_id", ORG_ID).eq("date", d).maybeSingle();
        if (!ex) await admin.from("closure_dates").insert({ org_id: ORG_ID, date: d, reason: range.reason, applies_to_all_locations: true, created_by: OWNER_USER_ID });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    for (const bh of bankHolidays) {
      allClosures.add(bh.date);
      const { data: ex } = await admin.from("closure_dates").select("id").eq("org_id", ORG_ID).eq("date", bh.date).maybeSingle();
      if (!ex) await admin.from("closure_dates").insert({ org_id: ORG_ID, date: bh.date, reason: bh.reason, applies_to_all_locations: true, created_by: OWNER_USER_ID });
    }
    L(`10. Closure dates: ${allClosures.size}`);

    // ═══════════════════════════════════════════════════════════════
    // 11. LESSONS + PARTICIPANTS + ATTENDANCE
    // ═══════════════════════════════════════════════════════════════
    const termDates: Record<string, { start: string; end: string }> = {
      autumn: { start: "2025-09-01", end: "2025-12-19" },
      spring: { start: "2026-01-05", end: "2026-03-27" },
    };
    const NOW = new Date("2026-03-02T12:00:00Z");

    type Sched = { students: string[]; tId: string; tUId: string; day: number; hr: number; min: number; dur: number; inst: string; roomId: string | null; locId: string; terms: string[]; isGroup?: boolean; title?: string };
    const schedules: Sched[] = [
      { students: ["Ella"], tId: ownerTeacherId, tUId: OWNER_USER_ID, day: 1, hr: 10, min: 0, dur: 30, inst: "Piano", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Noah"], tId: ownerTeacherId, tUId: OWNER_USER_ID, day: 1, hr: 11, min: 0, dur: 30, inst: "Piano", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Amelia"], tId: ownerTeacherId, tUId: OWNER_USER_ID, day: 2, hr: 10, min: 0, dur: 30, inst: "Voice", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Harry"], tId: ownerTeacherId, tUId: OWNER_USER_ID, day: 2, hr: 11, min: 0, dur: 30, inst: "Drums", roomId: room2Id, locId: harmonyLocId, terms: ["spring"] },
      { students: ["George"], tId: ownerTeacherId, tUId: OWNER_USER_ID, day: 3, hr: 10, min: 0, dur: 30, inst: "Piano", roomId: room1Id, locId: harmonyLocId, terms: ["autumn"] },
      { students: ["Oscar"], tId: marcusTeacherId, tUId: marcusUserId, day: 1, hr: 14, min: 0, dur: 30, inst: "Guitar", roomId: room2Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Isla"], tId: marcusTeacherId, tUId: marcusUserId, day: 1, hr: 15, min: 0, dur: 30, inst: "Guitar", roomId: room2Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Freddie"], tId: marcusTeacherId, tUId: marcusUserId, day: 3, hr: 14, min: 0, dur: 30, inst: "Bass", roomId: room2Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Maisie"], tId: marcusTeacherId, tUId: marcusUserId, day: 5, hr: 14, min: 0, dur: 30, inst: "Guitar", roomId: room2Id, locId: harmonyLocId, terms: ["spring"] },
      { students: ["Sophia"], tId: priyaTeacherId, tUId: priyaUserId, day: 2, hr: 14, min: 0, dur: 30, inst: "Violin", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Liam"], tId: priyaTeacherId, tUId: priyaUserId, day: 4, hr: 10, min: 0, dur: 30, inst: "Violin", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Ruby"], tId: priyaTeacherId, tUId: priyaUserId, day: 4, hr: 11, min: 0, dur: 30, inst: "Cello", roomId: room1Id, locId: harmonyLocId, terms: ["autumn", "spring"] },
      { students: ["Sophia", "Liam", "Ruby"], tId: priyaTeacherId, tUId: priyaUserId, day: 6, hr: 10, min: 0, dur: 60, inst: "Violin", roomId: ensembleRoomId, locId: harmonyLocId, terms: ["spring"], isGroup: true, title: "Saturday Ensemble" },
    ];

    let totalLessons = 0;
    const lessonIdsByStudent: Record<string, string[]> = {};
    let ellaCancelledLessonId: string | null = null;
    let noahAbsentLessonId: string | null = null;
    let ameliaAbsentLessonId: string | null = null;

    // Batch all recurrence rules first
    const recurrenceIds: string[] = [];
    for (const sched of schedules) {
      const { data: rec } = await admin.from("recurrence_rules").insert({
        org_id: ORG_ID, pattern_type: "weekly", interval_weeks: 1, days_of_week: [sched.day],
        start_date: termDates[sched.terms[0]].start, timezone: "Europe/London",
      }).select("id").single();
      recurrenceIds.push((rec as any).id);
    }

    // Build all lesson rows
    type LessonMeta = { schedIdx: number; date: string; termKey: string; studentNames: string[]; isEllaCancelDate: boolean; status: string; tUId: string };
    const lessonRows: any[] = [];
    const lessonMetas: LessonMeta[] = [];

    for (let si = 0; si < schedules.length; si++) {
      const sched = schedules[si];
      for (const termKey of sched.terms) {
        const term = termDates[termKey];
        const dates = weeklyDates(term.start, term.end, sched.day, allClosures);
        for (const date of dates) {
          const startAt = `${date}T${String(sched.hr).padStart(2, "0")}:${String(sched.min).padStart(2, "0")}:00Z`;
          const endAt = new Date(new Date(startAt).getTime() + sched.dur * 60000).toISOString();
          const isPast = new Date(startAt) < NOW;
          const title = sched.title || `${sched.inst} Lesson — ${sched.students.join(", ")}`;
          const isEllaCancelDate = sched.students[0] === "Ella" && !sched.isGroup && date === "2026-02-09";
          const status = isEllaCancelDate ? "cancelled" : isPast ? "completed" : "scheduled";

          lessonRows.push({
            org_id: ORG_ID, title, teacher_id: sched.tId, teacher_user_id: sched.tUId,
            created_by: OWNER_USER_ID, location_id: sched.locId, room_id: sched.roomId,
            start_at: startAt, end_at: endAt, status, recurrence_id: recurrenceIds[si],
            max_participants: sched.isGroup ? 8 : 1,
            lesson_type: sched.isGroup ? "group" : "private",
          });
          lessonMetas.push({ schedIdx: si, date, termKey, studentNames: sched.students, isEllaCancelDate, status, tUId: sched.tUId });
        }
      }
    }

    // Batch insert lessons in chunks of 50
    const allLessonIds: string[] = [];
    for (let i = 0; i < lessonRows.length; i += 50) {
      const chunk = lessonRows.slice(i, i + 50);
      const { data: created, error } = await admin.from("lessons").insert(chunk).select("id");
      if (error) { L(`Lesson batch error at ${i}: ${error.message}`); break; }
      for (const c of (created || [])) allLessonIds.push((c as any).id);
    }
    totalLessons = allLessonIds.length;

    // Build participants and attendance in bulk
    const participantRows: any[] = [];
    const attendanceRows: any[] = [];

    for (let li = 0; li < allLessonIds.length; li++) {
      const lessonId = allLessonIds[li];
      const meta = lessonMetas[li];
      if (!meta) continue;

      if (meta.isEllaCancelDate) ellaCancelledLessonId = lessonId;

      for (const studentName of meta.studentNames) {
        participantRows.push({ lesson_id: lessonId, student_id: students[studentName], org_id: ORG_ID });
        if (!lessonIdsByStudent[studentName]) lessonIdsByStudent[studentName] = [];
        lessonIdsByStudent[studentName].push(lessonId);

        if (meta.status === "completed" || meta.isEllaCancelDate) {
          const isNoahAbsent = studentName === "Noah" && meta.termKey === "autumn" && meta.date === "2025-11-10";
          const isAmeliaAbsent = studentName === "Amelia" && meta.termKey === "autumn" && meta.date === "2025-11-11";

          let attStatus = "present";
          let absReason: string | null = null;

          if (meta.isEllaCancelDate && studentName === "Ella") {
            attStatus = "cancelled_by_teacher"; absReason = "teacher_cancelled";
          } else if (isNoahAbsent) {
            attStatus = "absent"; absReason = "sick"; noahAbsentLessonId = lessonId;
          } else if (isAmeliaAbsent) {
            attStatus = "absent"; absReason = "holiday"; ameliaAbsentLessonId = lessonId;
          } else if (meta.status === "completed") {
            attStatus = Math.random() < 0.92 ? "present" : "late";
          } else {
            continue;
          }

          attendanceRows.push({
            lesson_id: lessonId, student_id: students[studentName], org_id: ORG_ID,
            attendance_status: attStatus, absence_reason_category: absReason, recorded_by: meta.tUId,
          });
        }
      }
    }

    // Batch insert participants and attendance
    for (let i = 0; i < participantRows.length; i += 100) {
      await admin.from("lesson_participants").insert(participantRows.slice(i, i + 100));
    }
    for (let i = 0; i < attendanceRows.length; i += 100) {
      await admin.from("attendance_records").insert(attendanceRows.slice(i, i + 100));
    }
    L(`11. Lessons: ${totalLessons}`);

    // ═══════════════════════════════════════════════════════════════
    // 12. INVOICES + ITEMS + PAYMENTS
    // ═══════════════════════════════════════════════════════════════
    async function createInvoice(opts: {
      payerGuardianId?: string; payerStudentId?: string; status: string;
      subtotalMinor: number; issueDate: string; dueDate: string; notes?: string;
      termId?: string; items: Array<{ desc: string; qty: number; price: number; studentId?: string }>;
    }): Promise<string> {
      const taxMinor = Math.round(opts.subtotalMinor * 0.2);
      const totalMinor = opts.subtotalMinor + taxMinor;

      const { data: inv, error } = await admin.from("invoices").insert({
        org_id: ORG_ID, invoice_number: "",
        payer_guardian_id: opts.payerGuardianId || null, payer_student_id: opts.payerStudentId || null,
        subtotal_minor: opts.subtotalMinor, tax_minor: taxMinor, total_minor: totalMinor,
        vat_rate: 20, currency_code: "GBP", due_date: opts.dueDate, issue_date: opts.issueDate,
        notes: opts.notes || null, term_id: opts.termId || null,
      }).select("id, total_minor").single();
      if (error) throw new Error(`Invoice: ${error.message}`);
      const invId = (inv as any).id;
      const invTotal = (inv as any).total_minor;

      // Items
      for (const item of opts.items) {
        await admin.from("invoice_items").insert({
          invoice_id: invId, org_id: ORG_ID, description: item.desc,
          quantity: item.qty, unit_price_minor: item.price, amount_minor: item.qty * item.price,
          student_id: item.studentId || null,
        });
      }

      // Status transitions: draft → sent → paid/overdue
      if (opts.status !== "draft") {
        await admin.from("invoices").update({ status: "sent" }).eq("id", invId);
        if (opts.status === "paid") {
          await admin.from("invoices").update({ status: "paid", paid_minor: invTotal }).eq("id", invId);
        } else if (opts.status === "overdue") {
          await admin.from("invoices").update({ status: "overdue" }).eq("id", invId);
        }
      }
      return invId;
    }

    // Autumn paid invoices
    const inv1 = await createInvoice({ payerGuardianId: guardians["Sarah Whitmore"], status: "paid", subtotalMinor: 42000, issueDate: "2025-09-01", dueDate: "2025-09-15", notes: "Autumn 2025 — Ella Whitmore (Piano)", termId: autumnTermId, items: [{ desc: "Piano Lessons — Ella Whitmore (12 × 30min)", qty: 12, price: 3500, studentId: students["Ella"] }] });
    await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: inv1, amount_minor: 50400, currency_code: "GBP", method: "bank_transfer", provider: "manual" });

    const inv2 = await createInvoice({ payerGuardianId: guardians["Raj Patel"], status: "paid", subtotalMinor: 35000, issueDate: "2025-09-01", dueDate: "2025-09-15", notes: "Autumn 2025 — Noah Patel (Piano)", termId: autumnTermId, items: [{ desc: "Piano Lessons — Noah Patel (10 × 30min)", qty: 10, price: 3500, studentId: students["Noah"] }] });
    await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: inv2, amount_minor: 42000, currency_code: "GBP", method: "card", provider: "manual" });

    const inv8 = await createInvoice({ payerGuardianId: guardians["Jenny Okafor"], status: "paid", subtotalMinor: 35000, issueDate: "2025-09-01", dueDate: "2025-09-15", notes: "Autumn 2025 — Sophia Okafor (Violin)", termId: autumnTermId, items: [{ desc: "Violin Lessons — Sophia Okafor (10 × 30min)", qty: 10, price: 3500, studentId: students["Sophia"] }] });
    await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: inv8, amount_minor: 42000, currency_code: "GBP", method: "bank_transfer", provider: "manual" });

    // Spring invoices
    const inv3 = await createInvoice({ payerGuardianId: guardians["Sarah Whitmore"], status: "sent", subtotalMinor: 45500, issueDate: "2026-01-05", dueDate: "2026-01-19", notes: "Spring 2026 — Ella + Harry", termId: springTermId, items: [{ desc: "Piano Lessons — Ella (10 × 30min)", qty: 10, price: 3500, studentId: students["Ella"] }, { desc: "Drums Lessons — Harry (3 × 30min)", qty: 3, price: 3500, studentId: students["Harry"] }] });
    // Partial payment on Sarah's spring invoice
    await admin.from("payments").insert({ org_id: ORG_ID, invoice_id: inv3, amount_minor: 20000, currency_code: "GBP", method: "card", provider: "manual" });
    await admin.from("invoices").update({ paid_minor: 20000 }).eq("id", inv3);

    await createInvoice({ payerGuardianId: guardians["Raj Patel"], status: "sent", subtotalMinor: 35000, issueDate: "2026-01-05", dueDate: "2026-01-19", notes: "Spring 2026 — Noah Patel (Piano)", termId: springTermId, items: [{ desc: "Piano Lessons — Noah (10 × 30min)", qty: 10, price: 3500, studentId: students["Noah"] }] });

    await createInvoice({ payerGuardianId: guardians["Claire Brooks"], status: "overdue", subtotalMinor: 35000, issueDate: "2026-01-05", dueDate: "2026-01-19", notes: "Spring 2026 — Amelia Brooks (Voice)", termId: springTermId, items: [{ desc: "Voice Lessons — Amelia (10 × 30min)", qty: 10, price: 3500, studentId: students["Amelia"] }] });

    await createInvoice({ payerGuardianId: guardians["David Martinez"], status: "draft", subtotalMinor: 70000, issueDate: "2026-01-05", dueDate: "2026-02-01", notes: "Spring 2026 — Isla + Oscar (Guitar)", termId: springTermId, items: [{ desc: "Guitar Lessons — Oscar (10 × 30min)", qty: 10, price: 3500, studentId: students["Oscar"] }, { desc: "Guitar Lessons — Isla (10 × 30min)", qty: 10, price: 3500, studentId: students["Isla"] }] });

    await createInvoice({ payerStudentId: students["Freddie"], status: "sent", subtotalMinor: 35000, issueDate: "2026-01-05", dueDate: "2026-01-19", notes: "Spring 2026 — Freddie Young (Bass)", termId: springTermId, items: [{ desc: "Bass Lessons — Freddie (10 × 30min)", qty: 10, price: 3500, studentId: students["Freddie"] }] });

    L("12. Invoices + items + payments done");

    // ═══════════════════════════════════════════════════════════════
    // 13. MAKE-UP POLICIES + CREDITS + WAITLIST
    // ═══════════════════════════════════════════════════════════════
    await admin.rpc("seed_make_up_policies", { _org_id: ORG_ID });

    if (ellaCancelledLessonId) {
      await admin.from("make_up_credits").insert({ org_id: ORG_ID, student_id: students["Ella"], teacher_id: ownerTeacherId, source_lesson_id: ellaCancelledLessonId, source_absence_reason: "teacher_cancelled", credit_value_minor: 3500, expires_at: "2026-04-06T00:00:00Z" });
    }
    if (noahAbsentLessonId) {
      const noahFuture = lessonIdsByStudent["Noah"]?.[lessonIdsByStudent["Noah"].length - 1];
      await admin.from("make_up_credits").insert({ org_id: ORG_ID, student_id: students["Noah"], teacher_id: ownerTeacherId, source_lesson_id: noahAbsentLessonId, source_absence_reason: "sick", credit_value_minor: 3500, redeemed_at: "2025-12-01T10:00:00Z", redeemed_lesson_id: noahFuture || null });
    }
    if (ameliaAbsentLessonId) {
      await admin.from("make_up_credits").insert({ org_id: ORG_ID, student_id: students["Amelia"], teacher_id: ownerTeacherId, source_lesson_id: ameliaAbsentLessonId, source_absence_reason: "holiday", credit_value_minor: 3500, expired_at: "2026-01-15T00:00:00Z", expires_at: "2026-01-15T00:00:00Z" });
    }

    await admin.from("make_up_waitlist").insert({ org_id: ORG_ID, student_id: students["Ella"], guardian_id: guardians["Sarah Whitmore"], teacher_id: ownerTeacherId, lesson_title: "Piano Lesson — Ella", missed_lesson_date: "2026-02-09", lesson_duration_minutes: 30, status: "waiting" });
    await admin.from("make_up_waitlist").insert({ org_id: ORG_ID, student_id: students["Oscar"], guardian_id: guardians["David Martinez"], teacher_id: marcusTeacherId, lesson_title: "Guitar Lesson — Oscar", missed_lesson_date: "2025-11-10", lesson_duration_minutes: 30, status: "matched", matched_lesson_id: lessonIdsByStudent["Oscar"]?.[lessonIdsByStudent["Oscar"].length - 1] || null, matched_at: "2025-11-20T10:00:00Z" });
    await admin.from("make_up_waitlist").insert({ org_id: ORG_ID, student_id: students["Sophia"], guardian_id: guardians["Jenny Okafor"], teacher_id: priyaTeacherId, lesson_title: "Violin Lesson — Sophia", missed_lesson_date: "2025-11-18", lesson_duration_minutes: 30, status: "offered", offered_at: "2025-11-25T10:00:00Z" });
    L("13. Make-up credits + waitlist done");

    // ═══════════════════════════════════════════════════════════════
    // 14. LEADS
    // ═══════════════════════════════════════════════════════════════
    const leadDefs = [
      { name: "Tom Henderson", email: "tom.henderson@example.com", stage: "enquiry", source: "website", instrument: "Piano", notes: "Interested in weekly piano lessons for son aged 8" },
      { name: "Lisa Park", email: "lisa.park@example.com", stage: "contacted", source: "referral", instrument: "Violin", notes: "Referred by Sarah Whitmore" },
      { name: "James Cooper", email: "james.cooper@example.com", stage: "trial_booked", source: "website", instrument: "Guitar", notes: "Trial booked for Guitar", trial_date: "2026-03-10" },
      { name: "Fatima Hassan", email: "fatima.hassan@example.com", stage: "trial_completed", source: "other", instrument: "Voice", notes: "Enjoyed trial via social media referral, considering enrolling", trial_date: "2026-02-24" },
      { name: "Ben Wright", email: "ben.wright@example.com", stage: "enrolled", source: "referral", instrument: "Drums", notes: "Enrolled and active", converted_at: "2026-01-15T10:00:00Z" },
    ];
    for (const ld of leadDefs) {
      await findOrInsert("leads", { org_id: ORG_ID, contact_name: ld.name }, {
        contact_email: ld.email, stage: ld.stage, source: ld.source, preferred_instrument: ld.instrument,
        notes: ld.notes, trial_date: (ld as any).trial_date || null, converted_at: (ld as any).converted_at || null, created_by: OWNER_USER_ID,
      });
    }
    L("14. Leads done");

    // ═══════════════════════════════════════════════════════════════
    // 15. PRACTICE ASSIGNMENTS + LOGS
    // ═══════════════════════════════════════════════════════════════
    const practiceDefs = [
      { s: "Ella", title: "Scales & Arpeggios", desc: "C major, G major, D major — hands together, 2 octaves", targetMins: 20, targetDays: 5, tUId: OWNER_USER_ID },
      { s: "Noah", title: "Grade 2 Pieces", desc: "Pieces 1 and 2, focus on dynamics", targetMins: 15, targetDays: 4, tUId: OWNER_USER_ID },
      { s: "Sophia", title: "Suzuki Book 2 — Minuet", desc: "Bowing technique bars 8-16", targetMins: 20, targetDays: 5, tUId: priyaUserId },
      { s: "Oscar", title: "Chord Progressions", desc: "G-C-D-G, smooth transitions", targetMins: 15, targetDays: 4, tUId: marcusUserId },
    ];
    for (const pd of practiceDefs) {
      const paId = await findOrInsert("practice_assignments", { org_id: ORG_ID, student_id: students[pd.s], title: pd.title }, {
        description: pd.desc, target_minutes_per_day: pd.targetMins, target_days_per_week: pd.targetDays,
        end_date: "2026-03-15", status: "active", teacher_user_id: pd.tUId,
      });
      // Ella: daily streak (14 days)
      if (pd.s === "Ella") {
        for (let d = 0; d < 14; d++) {
          const date = new Date("2026-02-16"); date.setDate(date.getDate() + d);
          const ds = date.toISOString().slice(0, 10);
          if (allClosures.has(ds)) continue;
          await admin.from("practice_logs").insert({ org_id: ORG_ID, student_id: students["Ella"], assignment_id: paId, practice_date: ds, duration_minutes: 15 + Math.floor(Math.random() * 15), logged_by_user_id: OWNER_USER_ID });
        }
      }
      // Noah: sporadic
      if (pd.s === "Noah") {
        for (const ds of ["2026-02-17", "2026-02-19", "2026-02-23", "2026-02-25", "2026-03-01"]) {
          await admin.from("practice_logs").insert({ org_id: ORG_ID, student_id: students["Noah"], assignment_id: paId, practice_date: ds, duration_minutes: 10 + Math.floor(Math.random() * 10), logged_by_user_id: OWNER_USER_ID });
        }
      }
    }
    L("15. Practice done");

    // ═══════════════════════════════════════════════════════════════
    // 16. AVAILABILITY BLOCKS
    // ═══════════════════════════════════════════════════════════════
    const availDefs = [
      ...["monday", "tuesday", "wednesday", "thursday", "friday"].map(d => ({ tId: ownerTeacherId, tUId: OWNER_USER_ID, day: d, start: "09:00", end: "17:00" })),
      ...["monday", "wednesday", "friday"].map(d => ({ tId: marcusTeacherId, tUId: marcusUserId, day: d, start: "14:00", end: "20:00" })),
      ...["tuesday", "thursday"].map(d => ({ tId: priyaTeacherId, tUId: priyaUserId, day: d, start: "10:00", end: "18:00" })),
      { tId: priyaTeacherId, tUId: priyaUserId, day: "saturday", start: "09:00", end: "13:00" },
    ];
    for (const ab of availDefs) {
      const { data: ex } = await admin.from("availability_blocks").select("id").eq("org_id", ORG_ID).eq("teacher_id", ab.tId).eq("day_of_week", ab.day).maybeSingle();
      if (!ex) await admin.from("availability_blocks").insert({ org_id: ORG_ID, teacher_id: ab.tId, teacher_user_id: ab.tUId, day_of_week: ab.day, start_time_local: ab.start, end_time_local: ab.end });
    }
    L("16. Availability done");

    // ═══════════════════════════════════════════════════════════════
    // 17. BOOKING PAGE
    // ═══════════════════════════════════════════════════════════════
    await findOrInsert("booking_pages", { org_id: ORG_ID, slug: "harmony-studios" }, {
      enabled: true, title: "Harmony Music Studios", description: "Book a trial music lesson at Harmony Studios in Richmond",
      welcome_message: "Welcome! Choose a time and we'll confirm your trial within 24 hours.",
      confirmation_message: "Thank you for booking! We'll send a confirmation email shortly.",
      lesson_duration_mins: 30, advance_booking_days: 28, min_notice_hours: 24, buffer_minutes: 15,
    });
    L("17. Booking page done");

    // ═══════════════════════════════════════════════════════════════
    // 18. ENROLMENT WAITLIST
    // ═══════════════════════════════════════════════════════════════
    // Enrolment waitlist table doesn't exist yet — skipping
    L("18. Enrolment waitlist skipped (table not yet created)");

    // ═══════════════════════════════════════════════════════════════
    // 19. RESOURCES
    // ═══════════════════════════════════════════════════════════════
    const resDefs = [
      { title: "Beginner Scales PDF", desc: "Major and minor scales for beginners", shares: ["Ella", "Noah"] },
      { title: "Grade 3 Pieces", desc: "ABRSM Grade 3 violin repertoire", shares: ["Sophia"] },
      { title: "Guitar Chord Chart", desc: "Common open and barre chords", shares: ["Oscar", "Isla"] },
    ];
    for (const rd of resDefs) {
      const resId = await findOrInsert("resources", { org_id: ORG_ID, title: rd.title }, {
        description: rd.desc, file_type: "application/pdf", file_size_bytes: 51200,
        file_name: `${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`,
        file_path: `resources/${rd.title.toLowerCase().replace(/ /g, "-")}.pdf`,
        uploaded_by: OWNER_USER_ID,
      });
      for (const s of rd.shares) {
        const { data: ex } = await admin.from("resource_shares").select("id").eq("resource_id", resId).eq("student_id", students[s]).maybeSingle();
        if (!ex) await admin.from("resource_shares").insert({ resource_id: resId, student_id: students[s], org_id: ORG_ID, shared_by: OWNER_USER_ID });
      }
    }
    L("19. Resources done");

    // ═══════════════════════════════════════════════════════════════
    // 20. TERM CONTINUATION RUN
    // ═══════════════════════════════════════════════════════════════
    // Term continuation tables don't exist yet — skipping
    L("20. Term continuation skipped (tables not yet created)");

    // ═══════════════════════════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════════════════════════
    L("✅ All seed data created successfully!");
    return new Response(JSON.stringify({ success: true, log, lessons: totalLessons }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    L(`❌ ERROR: ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message, log }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
