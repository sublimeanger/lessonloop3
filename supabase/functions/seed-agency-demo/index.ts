import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// CONFIGURATION
// ============================================================
const OWNER_USER_ID = 'b633da13-0599-4ab0-bfd8-c5a686b5d684';
const ORG_ID = '5b905216-85ae-4aca-8c50-9757d0444b60';

const SCHOOLS = [
  { name: 'Oakwood Primary School', city: 'London', postcode: 'SE15 4QN', address: '42 Oakwood Lane', rooms: ['Music Room', 'Hall'] },
  { name: "St Mary's Academy", city: 'Manchester', postcode: 'M1 2JQ', address: '15 Cathedral Street', rooms: ['Room A', 'Room B', 'Hall'] },
  { name: 'Riverside Secondary School', city: 'Birmingham', postcode: 'B1 1BB', address: '88 River Road', rooms: ['Music Suite', 'Practice Room'] },
  { name: 'The Willows Prep', city: 'Bristol', postcode: 'BS1 5TT', address: '3 Willow Close', rooms: ['Studio 1', 'Studio 2'] },
  { name: 'Kingsgate Grammar', city: 'Leeds', postcode: 'LS1 4AP', address: '27 Kingsgate Avenue', rooms: ['Music Block', 'Drama Hall'] },
  { name: 'Elmhurst Community School', city: 'Liverpool', postcode: 'L1 8JQ', address: '61 Elm Street', rooms: ['Teaching Room', 'Assembly Hall'] },
  { name: 'Briarwood College', city: 'Sheffield', postcode: 'S1 2EL', address: '9 Briar Lane', rooms: ['Music Dept', 'Rehearsal Room'] },
  { name: 'Ashford Park School', city: 'Nottingham', postcode: 'NG1 5FT', address: '14 Park Road', rooms: ['Room 1', 'Room 2', 'Room 3'] },
  { name: 'Westfield Junior School', city: 'Cambridge', postcode: 'CB1 2AB', address: '55 West Field Road', rooms: ['Music Room', 'Practice Room'] },
];

// 18 teachers: index 0 & 1 are loginable, rest are data-only
const TEACHER_DEFS = [
  { name: 'James Fletcher', email: 'teacher1@lessonloop.test', pw: 'Teacher1Demo2026!', instruments: ['Piano', 'Violin'], emp: 'employee', payType: 'per_lesson', payVal: 3500 },
  { name: 'Sarah Mitchell', email: 'teacher2@lessonloop.test', pw: 'Teacher2Demo2026!', instruments: ['Guitar', 'Piano'], emp: 'contractor', payType: 'per_lesson', payVal: 3200 },
  { name: 'Robert Clarke', email: 'robert.clarke@lessonloop.test', pw: null, instruments: ['Cello', 'Violin'], emp: 'employee', payType: 'hourly', payVal: 2500 },
  { name: 'Emma Whitfield', email: 'emma.whitfield@lessonloop.test', pw: null, instruments: ['Flute', 'Clarinet'], emp: 'contractor', payType: 'per_lesson', payVal: 3500 },
  { name: 'David Harrison', email: 'david.harrison@lessonloop.test', pw: null, instruments: ['Drums', 'Guitar'], emp: 'employee', payType: 'per_lesson', payVal: 3000 },
  { name: 'Catherine Patel', email: 'catherine.patel@lessonloop.test', pw: null, instruments: ['Piano', 'Saxophone'], emp: 'contractor', payType: 'per_lesson', payVal: 3500 },
  { name: 'Thomas Wright', email: 'thomas.wright@lessonloop.test', pw: null, instruments: ['Violin', 'Piano'], emp: 'employee', payType: 'hourly', payVal: 2800 },
  { name: 'Lucy Bennett', email: 'lucy.bennett@lessonloop.test', pw: null, instruments: ['Guitar', 'Piano'], emp: 'contractor', payType: 'per_lesson', payVal: 3200 },
  { name: "Michael O'Brien", email: 'michael.obrien@lessonloop.test', pw: null, instruments: ['Saxophone', 'Clarinet'], emp: 'employee', payType: 'per_lesson', payVal: 3500 },
  { name: 'Hannah Foster', email: 'hannah.foster@lessonloop.test', pw: null, instruments: ['Flute', 'Clarinet'], emp: 'contractor', payType: 'per_lesson', payVal: 3500 },
  { name: 'Daniel Morgan', email: 'daniel.morgan@lessonloop.test', pw: null, instruments: ['Piano', 'Cello'], emp: 'employee', payType: 'hourly', payVal: 2600 },
  { name: 'Sophie Turner', email: 'sophie.turner@lessonloop.test', pw: null, instruments: ['Clarinet', 'Flute'], emp: 'contractor', payType: 'per_lesson', payVal: 3500 },
  { name: 'William Chambers', email: 'william.chambers@lessonloop.test', pw: null, instruments: ['Guitar', 'Drums'], emp: 'employee', payType: 'per_lesson', payVal: 3000 },
  { name: 'Olivia Grant', email: 'olivia.grant@lessonloop.test', pw: null, instruments: ['Piano', 'Violin'], emp: 'contractor', payType: 'per_lesson', payVal: 3800 },
  { name: 'Christopher Bell', email: 'christopher.bell@lessonloop.test', pw: null, instruments: ['Saxophone', 'Clarinet'], emp: 'employee', payType: 'per_lesson', payVal: 3500 },
  { name: 'Rachel Cooper', email: 'rachel.cooper@lessonloop.test', pw: null, instruments: ['Piano', 'Flute'], emp: 'contractor', payType: 'per_lesson', payVal: 3500 },
  { name: 'Alexander Reid', email: 'alexander.reid@lessonloop.test', pw: null, instruments: ['Guitar', 'Piano'], emp: 'employee', payType: 'hourly', payVal: 2700 },
  { name: 'Jessica Murray', email: 'jessica.murray@lessonloop.test', pw: null, instruments: ['Drums', 'Guitar'], emp: 'contractor', payType: 'per_lesson', payVal: 3000 },
];

const PARENT_DEFS = [
  { email: 'parent1@lessonloop.test', pw: 'Parent1Demo2026!', name: 'Victoria Thompson' },
  { email: 'parent2@lessonloop.test', pw: 'Parent2Demo2026!', name: 'Mark Harrison' },
  { email: 'parent3@lessonloop.test', pw: 'Parent3Demo2026!', name: 'Claire Williams' },
];

const BOY_NAMES = ['Oliver','Jack','Harry','George','Noah','Freddie','Oscar','Alfie','Leo','Charlie','Archie','Theo','Thomas','James','Ethan','Arthur','Max','Lucas','Finley','Henry'];
const GIRL_NAMES = ['Sophia','Emily','Amelia','Isabella','Mia','Charlotte','Lily','Ava','Ella','Grace','Chloe','Daisy','Ruby','Poppy','Evie','Florence','Willow','Freya','Millie','Ivy'];
const LAST_NAMES = ['Thompson','Williams','Brown','Davies','Wilson','Taylor','Anderson','Thomas','Roberts','Johnson','Lewis','Walker','Hall','Green','Evans','King','Baker','Harris','Clark','Turner','Scott','Adams','Moore','White','Martin'];
const INSTRUMENTS = ['Piano','Guitar','Violin','Cello','Drums','Flute','Clarinet','Saxophone'];
const GUARDIAN_FIRST = ['Sarah','David','Emma','Michael','Claire','Andrew','Rachel','Simon','Victoria','Mark','Helen','Chris','Laura','Richard','Catherine','Paul','Amanda','Stephen','Julie','Peter'];

const RATES: Record<string, Record<number, number>> = {
  Piano: { 30: 3500, 45: 5000 }, Guitar: { 30: 3200, 45: 4500 },
  Violin: { 30: 3800, 45: 5500 }, Cello: { 30: 3800, 45: 5500 },
  Drums: { 30: 3000, 45: 4200 }, Flute: { 30: 3500, 45: 5000 },
  Clarinet: { 30: 3500, 45: 5000 }, Saxophone: { 30: 3500, 45: 5000 },
};

const TIMES = [
  { h: 9, m: 0 }, { h: 9, m: 45 }, { h: 10, m: 30 }, { h: 11, m: 15 },
  { h: 13, m: 0 }, { h: 13, m: 45 }, { h: 14, m: 30 }, { h: 15, m: 15 },
];

// ============================================================
// HELPERS
// ============================================================

async function batchInsert(supabase: any, table: string, rows: any[], size = 500): Promise<any[]> {
  const all: any[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { data, error } = await supabase.from(table).insert(batch).select();
    if (error) throw new Error(`Insert ${table} batch ${Math.floor(i/size)}: ${error.message}`);
    if (data) all.push(...data);
  }
  return all;
}

async function batchInsertNoReturn(supabase: any, table: string, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Insert ${table} batch ${Math.floor(i/size)}: ${error.message}`);
  }
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ============================================================
// MAIN
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonday = getMonday(today);

    console.log('=== SEED AGENCY DEMO START ===');

    // ===== IDEMPOTENCY CHECK =====
    const { data: existingLocs } = await supabase
      .from('locations').select('id').eq('org_id', ORG_ID).limit(1);
    if (existingLocs && existingLocs.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Agency demo data already exists. Use cleanup function first to reseed.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const summary: Record<string, number> = {};

    // ===== PHASE 1: ORG UPGRADE =====
    console.log('Phase 1: Upgrading organisation...');
    const { error: orgErr } = await supabase.from('organisations').update({
      org_type: 'agency',
      name: 'Harmony Music Education Agency',
      subscription_plan: 'agency',
      subscription_status: 'active',
      max_students: 9999,
      max_teachers: 9999,
      vat_enabled: true,
      vat_rate: 20,
      invoice_from_name: 'Harmony Music Education Agency',
      invoice_from_address_line1: '12 Handel Street',
      invoice_from_city: 'London',
      invoice_from_postcode: 'WC1N 1PD',
      invoice_from_country: 'GB',
      invoice_footer_note: 'Thank you for choosing Harmony Music Education.',
      default_payment_terms_days: 14,
      overdue_reminder_days: [7, 14, 30],
    }).eq('id', ORG_ID);
    if (orgErr) throw new Error(`Phase 1: ${orgErr.message}`);
    summary.org_upgraded = 1;

    // ===== PHASE 2: LOCATIONS + ROOMS =====
    console.log('Phase 2: Creating locations and rooms...');
    const locationInserts = SCHOOLS.map((s, i) => ({
      org_id: ORG_ID,
      name: s.name,
      city: s.city,
      postcode: s.postcode,
      address_line_1: s.address,
      country_code: 'GB',
      location_type: 'school' as const,
      is_primary: i === 0,
    }));
    const locations = await batchInsert(supabase, 'locations', locationInserts);
    summary.locations = locations.length;

    const roomInserts: any[] = [];
    for (let i = 0; i < SCHOOLS.length; i++) {
      for (const rName of SCHOOLS[i].rooms) {
        roomInserts.push({
          org_id: ORG_ID,
          location_id: locations[i].id,
          name: rName,
        });
      }
    }
    const rooms = await batchInsert(supabase, 'rooms', roomInserts);
    summary.rooms = rooms.length;

    // Build room lookup: locationId -> [roomIds]
    const roomsByLoc: Record<string, string[]> = {};
    for (const r of rooms) {
      if (!roomsByLoc[r.location_id]) roomsByLoc[r.location_id] = [];
      roomsByLoc[r.location_id].push(r.id);
    }

    // ===== PHASE 3: AUTH ACCOUNTS =====
    console.log('Phase 3: Creating auth accounts (21 users)...');
    const teacherUserIds: string[] = [];
    const parentUserIds: string[] = [];

    // Create teacher auth accounts (in batches of 5)
    for (let i = 0; i < TEACHER_DEFS.length; i += 5) {
      const batch = TEACHER_DEFS.slice(i, i + 5);
      const results = await Promise.all(batch.map(t =>
        supabase.auth.admin.createUser({
          email: t.email,
          password: t.pw || crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: t.name },
        })
      ));
      for (const r of results) {
        if (r.error) throw new Error(`Teacher auth: ${r.error.message}`);
        teacherUserIds.push(r.data.user.id);
      }
    }

    // Create parent auth accounts
    const parentResults = await Promise.all(PARENT_DEFS.map(p =>
      supabase.auth.admin.createUser({
        email: p.email,
        password: p.pw,
        email_confirm: true,
        user_metadata: { full_name: p.name },
      })
    ));
    for (const r of parentResults) {
      if (r.error) throw new Error(`Parent auth: ${r.error.message}`);
      parentUserIds.push(r.data.user.id);
    }
    summary.auth_accounts = teacherUserIds.length + parentUserIds.length;

    // ===== PHASE 4: FIX ROLES + PROFILES + MEMBERSHIPS =====
    console.log('Phase 4: Configuring roles and memberships...');

    // Fix auto-created 'owner' roles → correct roles
    // Delete auto-created owner roles for teachers
    for (const uid of teacherUserIds) {
      await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'owner');
    }
    await batchInsertNoReturn(supabase, 'user_roles',
      teacherUserIds.map(uid => ({ user_id: uid, role: 'teacher' }))
    );

    // Delete auto-created owner roles for parents
    for (const uid of parentUserIds) {
      await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'owner');
    }
    await batchInsertNoReturn(supabase, 'user_roles',
      parentUserIds.map(uid => ({ user_id: uid, role: 'parent' }))
    );

    // Update profiles
    const allNewIds = [...teacherUserIds, ...parentUserIds];
    for (const uid of allNewIds) {
      await supabase.from('profiles').update({
        current_org_id: ORG_ID,
        has_completed_onboarding: true,
        first_run_completed: true,
      }).eq('id', uid);
    }

    // Create org memberships
    const membershipInserts = [
      ...teacherUserIds.map(uid => ({ org_id: ORG_ID, user_id: uid, role: 'teacher' as const, status: 'active' as const })),
      ...parentUserIds.map(uid => ({ org_id: ORG_ID, user_id: uid, role: 'parent' as const, status: 'active' as const })),
    ];
    await batchInsertNoReturn(supabase, 'org_memberships', membershipInserts);

    // ===== PHASE 5: TEACHER RECORDS =====
    console.log('Phase 5: Creating teacher records...');
    const teacherInserts = TEACHER_DEFS.map((t, i) => ({
      org_id: ORG_ID,
      user_id: teacherUserIds[i],
      display_name: t.name,
      email: t.email,
      instruments: t.instruments,
      employment_type: t.emp as 'employee' | 'contractor',
      pay_rate_type: t.payType as 'per_lesson' | 'hourly',
      pay_rate_value: t.payVal,
      default_lesson_length_mins: 30,
      status: 'active' as const,
      phone: `07${String(700000000 + i * 1111111).padStart(9, '0')}`,
    }));
    const teachers = await batchInsert(supabase, 'teachers', teacherInserts);
    summary.teachers = teachers.length;

    // ===== PHASE 6: STUDENTS =====
    console.log('Phase 6: Creating 315 students...');
    const studentInserts: any[] = [];
    const studentMeta: { instrument: string; duration: number; schoolIdx: number; withinSchool: number }[] = [];

    for (let school = 0; school < 9; school++) {
      for (let j = 0; j < 35; j++) {
        const gi = school * 35 + j; // global index
        const isBoy = gi % 2 === 0;
        const firstName = isBoy ? BOY_NAMES[gi % BOY_NAMES.length] : GIRL_NAMES[gi % GIRL_NAMES.length];
        const lastName = LAST_NAMES[(gi * 7 + school * 3) % LAST_NAMES.length];
        const instrument = INSTRUMENTS[(gi + school) % INSTRUMENTS.length];
        const duration = gi % 3 === 0 ? 45 : 30;
        const teacherIdx = school * 2 + (j < 18 ? 0 : 1);

        studentInserts.push({
          org_id: ORG_ID,
          first_name: firstName,
          last_name: lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${gi}@example.com`,
          status: (gi % 22 === 0) ? 'inactive' : 'active',
          notes: `Studies ${instrument}. ${duration}-minute weekly lessons.`,
          default_location_id: locations[school].id,
          default_teacher_id: teachers[teacherIdx].id,
          default_teacher_user_id: teacherUserIds[teacherIdx],
        });
        studentMeta.push({ instrument, duration, schoolIdx: school, withinSchool: j });
      }
    }
    const students = await batchInsert(supabase, 'students', studentInserts);
    summary.students = students.length;

    // ===== PHASE 7: GUARDIANS + LINKS =====
    console.log('Phase 7: Creating guardians and links...');
    const guardianInserts: any[] = [];
    // Track which guardian index each student maps to
    const studentToGuardianIdx: number[] = [];

    // For each school, students 0-1 share guardian, 2-3 share, 4-5 share (3 sibling pairs)
    // Rest get individual guardians
    let guardianCount = 0;
    for (let school = 0; school < 9; school++) {
      for (let j = 0; j < 35; j++) {
        const gi = school * 35 + j;
        const studentLastName = students[gi].last_name;

        if (j < 6 && j % 2 === 0) {
          // First of a sibling pair: create the guardian
          const gFirstName = GUARDIAN_FIRST[(guardianCount * 3) % GUARDIAN_FIRST.length];
          guardianInserts.push({
            org_id: ORG_ID,
            full_name: `${gFirstName} ${studentLastName}`,
            email: `${gFirstName.toLowerCase()}.${studentLastName.toLowerCase()}.g${guardianCount}@example.com`,
            phone: `07${String(800000000 + guardianCount * 7777).padStart(9, '0')}`,
          });
          studentToGuardianIdx.push(guardianCount);
          guardianCount++;
        } else if (j < 6 && j % 2 === 1) {
          // Second of sibling pair: share previous guardian
          studentToGuardianIdx.push(guardianCount - 1);
        } else {
          // Individual guardian
          const gFirstName = GUARDIAN_FIRST[(guardianCount * 3 + 1) % GUARDIAN_FIRST.length];
          guardianInserts.push({
            org_id: ORG_ID,
            full_name: `${gFirstName} ${studentLastName}`,
            email: `${gFirstName.toLowerCase()}.${studentLastName.toLowerCase()}.g${guardianCount}@example.com`,
            phone: `07${String(800000000 + guardianCount * 7777).padStart(9, '0')}`,
          });
          studentToGuardianIdx.push(guardianCount);
          guardianCount++;
        }
      }
    }

    const guardians = await batchInsert(supabase, 'guardians', guardianInserts);
    summary.guardians = guardians.length;

    // Link students to guardians
    const sgLinks = students.map((s: any, i: number) => ({
      student_id: s.id,
      guardian_id: guardians[studentToGuardianIdx[i]].id,
      org_id: ORG_ID,
      is_primary_payer: true,
      relationship: (i % 4 === 0 ? 'father' : i % 4 === 1 ? 'mother' : 'guardian') as 'father' | 'mother' | 'guardian',
    }));
    await batchInsertNoReturn(supabase, 'student_guardians', sgLinks);

    // Link parent auth accounts to their guardian records
    // Parent1 → guardian for school 0, students 0-1 (guardian index for school 0, first pair = index 0)
    const parent1GuardianIdx = 0; // first guardian created (school 0, pair 0-1)
    await supabase.from('guardians').update({ user_id: parentUserIds[0] }).eq('id', guardians[parent1GuardianIdx].id);

    // Parent2 → guardian for school 3, student 6 (first individual guardian after 3 sibling pairs at school 3)
    // School 3 starts at global student index 105, guardian offset...
    // Let me find the guardian for school 3, student index 6
    const parent2StudentGi = 3 * 35 + 6;
    const parent2GuardianIdx = studentToGuardianIdx[parent2StudentGi];
    await supabase.from('guardians').update({ user_id: parentUserIds[1] }).eq('id', guardians[parent2GuardianIdx].id);

    // Parent3 → guardian for school 1, students 0-1 (they already share a guardian)
    const parent3GuardianIdx = studentToGuardianIdx[1 * 35]; // school 1, student 0
    await supabase.from('guardians').update({ user_id: parentUserIds[2] }).eq('id', guardians[parent3GuardianIdx].id);
    // Also link parent3 to a student at school 4
    const extraStudentId = students[4 * 35 + 6].id; // school 4, student 6
    await supabase.from('student_guardians').insert({
      student_id: extraStudentId,
      guardian_id: guardians[parent3GuardianIdx].id,
      org_id: ORG_ID,
      is_primary_payer: false,
      relationship: 'mother' as const,
    });

    // ===== PHASE 8: STUDENT-TEACHER ASSIGNMENTS =====
    console.log('Phase 8: Creating student-teacher assignments...');
    const assignmentInserts = students.map((s: any, i: number) => {
      const schoolIdx = Math.floor(i / 35);
      const withinSchool = i % 35;
      const teacherIdx = schoolIdx * 2 + (withinSchool < 18 ? 0 : 1);
      return {
        student_id: s.id,
        teacher_user_id: teacherUserIds[teacherIdx],
        teacher_id: teachers[teacherIdx].id,
        org_id: ORG_ID,
        is_primary: true,
      };
    });
    await batchInsertNoReturn(supabase, 'student_teacher_assignments', assignmentInserts);
    summary.assignments = assignmentInserts.length;

    // ===== PHASE 9: RATE CARDS =====
    console.log('Phase 9: Creating rate cards...');
    const rateCardInserts: any[] = [];
    for (const [inst, prices] of Object.entries(RATES)) {
      rateCardInserts.push({
        org_id: ORG_ID, name: `${inst} - 30 mins`, duration_mins: 30,
        rate_amount: prices[30], currency_code: 'GBP', is_default: inst === 'Piano' && true,
      });
      rateCardInserts.push({
        org_id: ORG_ID, name: `${inst} - 45 mins`, duration_mins: 45,
        rate_amount: prices[45], currency_code: 'GBP', is_default: false,
      });
    }
    const rateCards = await batchInsert(supabase, 'rate_cards', rateCardInserts);
    summary.rate_cards = rateCards.length;

    // Build rate lookup
    const rateLookup: Record<string, number> = {};
    for (const rc of rateCards) {
      rateLookup[rc.name] = rc.rate_amount;
    }

    // ===== PHASE 10: LESSONS =====
    console.log('Phase 10: Generating lessons...');
    const lessonInserts: any[] = [];
    const lessonStudentIds: string[] = []; // parallel array to map lessons → students

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      if (student.status === 'inactive') continue;

      const meta = studentMeta[i];
      const schoolIdx = meta.schoolIdx;
      const withinSchool = meta.withinSchool;
      const teacherIdx = schoolIdx * 2 + (withinSchool < 18 ? 0 : 1);
      const locationId = locations[schoolIdx].id;
      const locRooms = roomsByLoc[locationId] || [];
      const roomId = locRooms[withinSchool % locRooms.length] || locRooms[0];

      const dayOfWeek = withinSchool % 5; // 0=Mon to 4=Fri
      const timeSlotIdx = Math.floor(withinSchool / 5) % TIMES.length;
      const instrument = meta.instrument;
      const duration = meta.duration;
      const isGroup = withinSchool % 15 === 0;

      // Generate lessons for 13 weeks: -8 to +4
      for (let week = -8; week <= 4; week++) {
        // Skip some weeks deterministically for variety (~25% skip rate)
        const skipSeed = i * 100 + week + 42;
        if (seededRandom(skipSeed) < 0.15 && week !== 0) continue;

        const weekMon = addDays(thisMonday, week * 7);
        const lessonDate = addDays(weekMon, dayOfWeek);
        const start = new Date(lessonDate);
        start.setHours(TIMES[timeSlotIdx].h, TIMES[timeSlotIdx].m, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + duration);

        const isPast = start < now;
        const isCancelled = isPast && seededRandom(skipSeed + 999) < 0.02;
        let status: string;
        if (isCancelled) status = 'cancelled';
        else if (isPast) status = 'completed';
        else status = 'scheduled';

        lessonInserts.push({
          org_id: ORG_ID,
          teacher_user_id: teacherUserIds[teacherIdx],
          teacher_id: teachers[teacherIdx].id,
          created_by: OWNER_USER_ID,
          title: `${instrument} Lesson - ${student.first_name} ${student.last_name}`,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status,
          lesson_type: isGroup ? 'group' : 'private',
          location_id: locationId,
          room_id: roomId,
          ...(isCancelled ? {
            cancellation_reason: 'Student unavailable',
            cancelled_at: start.toISOString(),
            cancelled_by: OWNER_USER_ID,
          } : {}),
          ...(status === 'completed' ? {
            notes_private: `Good progress on ${instrument} today.`,
          } : {}),
        });
        lessonStudentIds.push(student.id);
      }
    }

    console.log(`Inserting ${lessonInserts.length} lessons in batches...`);
    const lessons = await batchInsert(supabase, 'lessons', lessonInserts);
    summary.lessons = lessons.length;

    // ===== PHASE 11: LESSON PARTICIPANTS =====
    console.log('Phase 11: Creating lesson participants...');
    const participantInserts = lessons.map((lesson: any, idx: number) => ({
      lesson_id: lesson.id,
      student_id: lessonStudentIds[idx],
      org_id: ORG_ID,
    }));
    await batchInsertNoReturn(supabase, 'lesson_participants', participantInserts);
    summary.participants = participantInserts.length;

    // Add extra participants to group lessons
    const groupLessons = lessons.filter((l: any) => l.lesson_type === 'group');
    if (groupLessons.length > 0) {
      const extraParticipants: any[] = [];
      for (const gl of groupLessons) {
        const idx = lessons.indexOf(gl);
        const primaryStudentIdx = students.findIndex((s: any) => s.id === lessonStudentIds[idx]);
        if (primaryStudentIdx >= 0) {
          // Add 1-2 nearby students from same school
          const schoolStart = Math.floor(primaryStudentIdx / 35) * 35;
          for (let offset = 1; offset <= 2; offset++) {
            const extraIdx = schoolStart + ((primaryStudentIdx - schoolStart + offset) % 35);
            if (students[extraIdx] && students[extraIdx].status === 'active') {
              extraParticipants.push({
                lesson_id: gl.id,
                student_id: students[extraIdx].id,
                org_id: ORG_ID,
              });
            }
          }
        }
      }
      if (extraParticipants.length > 0) {
        await batchInsertNoReturn(supabase, 'lesson_participants', extraParticipants);
        summary.extra_group_participants = extraParticipants.length;
      }
    }

    // ===== PHASE 12: ATTENDANCE RECORDS =====
    console.log('Phase 12: Creating attendance records...');
    const completedLessons = lessons.filter((l: any) => l.status === 'completed');
    const attendanceInserts = completedLessons.map((lesson: any, idx: number) => {
      const realIdx = lessons.indexOf(lesson);
      const seed = realIdx * 7 + 13;
      const rand = seededRandom(seed);
      let status: string;
      if (rand < 0.90) status = 'present';
      else if (rand < 0.95) status = 'absent';
      else if (rand < 0.98) status = 'late';
      else status = 'cancelled_by_student';

      return {
        lesson_id: lesson.id,
        student_id: lessonStudentIds[realIdx],
        org_id: ORG_ID,
        attendance_status: status,
        recorded_by: OWNER_USER_ID,
        recorded_at: lesson.end_at,
        ...(status === 'cancelled_by_student' ? { cancellation_reason: 'Family commitment' } : {}),
      };
    });
    await batchInsertNoReturn(supabase, 'attendance_records', attendanceInserts);
    summary.attendance = attendanceInserts.length;

    // ===== PHASE 13: INVOICES =====
    console.log('Phase 13: Creating invoices...');
    // Generate invoices for 3 months, for students at schools 0-5 (210 students → ~175 unique guardians)
    const invoiceInserts: any[] = [];
    const invoiceItemsAll: any[][] = []; // parallel to invoiceInserts
    const invoicedGuardians = new Map<string, { studentIds: string[]; instruments: string[]; durations: number[] }>();

    // Collect payers for schools 0-5
    for (let i = 0; i < students.length; i++) {
      const school = Math.floor(i / 35);
      if (school >= 6) continue; // only schools 0-5 for invoicing
      if (students[i].status === 'inactive') continue;

      const guardianId = guardians[studentToGuardianIdx[i]].id;
      if (!invoicedGuardians.has(guardianId)) {
        invoicedGuardians.set(guardianId, { studentIds: [], instruments: [], durations: [] });
      }
      const entry = invoicedGuardians.get(guardianId)!;
      entry.studentIds.push(students[i].id);
      entry.instruments.push(studentMeta[i].instrument);
      entry.durations.push(studentMeta[i].duration);
    }

    const guardianEntries = Array.from(invoicedGuardians.entries());
    let invoiceNum = 1;

    for (let month = 0; month < 3; month++) {
      const monthOffset = -(2 - month); // -2, -1, 0
      const issueDate = new Date(today);
      issueDate.setMonth(issueDate.getMonth() + monthOffset);
      issueDate.setDate(1);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);

      // Status distribution per month
      const statusDist = month === 0
        ? ['paid','paid','paid','paid','paid','paid','paid','paid','overdue','void']
        : month === 1
        ? ['paid','paid','paid','paid','paid','sent','sent','overdue','overdue','void']
        : ['paid','sent','sent','sent','draft','draft','overdue','sent','sent','draft'];

      for (let g = 0; g < guardianEntries.length; g++) {
        const [guardianId, info] = guardianEntries[g];
        const status = statusDist[g % statusDist.length] as any;
        const lessonsPerStudent = 4;

        // Calculate total
        let subtotal = 0;
        const items: any[] = [];
        for (let s = 0; s < info.studentIds.length; s++) {
          const inst = info.instruments[s];
          const dur = info.durations[s] as 30 | 45;
          const rate = RATES[inst]?.[dur] || 3500;
          for (let w = 1; w <= lessonsPerStudent; w++) {
            items.push({
              description: `${inst} lesson (${dur} mins) - Week ${w}`,
              quantity: 1,
              unit_price_minor: rate,
              amount_minor: rate,
              student_id: info.studentIds[s],
            });
            subtotal += rate;
          }
        }

        const vatAmount = Math.round(subtotal * 0.2);
        const total = subtotal + vatAmount;

        invoiceInserts.push({
          org_id: ORG_ID,
          invoice_number: `LL-2026-${String(invoiceNum).padStart(5, '0')}`,
          payer_guardian_id: guardianId,
          payer_student_id: info.studentIds[0],
          status,
          issue_date: issueDate.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal_minor: subtotal,
          tax_minor: vatAmount,
          total_minor: total,
          currency_code: 'GBP',
          vat_rate: 20,
          notes: `Music lessons - ${issueDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
        });
        invoiceItemsAll.push(items);
        invoiceNum++;
      }
    }

    const invoices = await batchInsert(supabase, 'invoices', invoiceInserts);
    summary.invoices = invoices.length;

    // Create invoice items
    const allItemInserts: any[] = [];
    for (let i = 0; i < invoices.length; i++) {
      for (const item of invoiceItemsAll[i]) {
        allItemInserts.push({
          invoice_id: invoices[i].id,
          org_id: ORG_ID,
          description: item.description,
          quantity: item.quantity,
          unit_price_minor: item.unit_price_minor,
          amount_minor: item.amount_minor,
          student_id: item.student_id,
        });
      }
    }
    await batchInsertNoReturn(supabase, 'invoice_items', allItemInserts);
    summary.invoice_items = allItemInserts.length;

    // ===== PHASE 14: PAYMENTS =====
    console.log('Phase 14: Creating payments...');
    const paidInvoices = invoices.filter((inv: any) => inv.status === 'paid');
    const paymentInserts = paidInvoices.map((inv: any, idx: number) => {
      const methods = ['bank_transfer', 'card', 'cash'] as const;
      const paidDate = new Date(inv.issue_date);
      paidDate.setDate(paidDate.getDate() + 3 + (idx % 7));
      return {
        invoice_id: inv.id,
        org_id: ORG_ID,
        amount_minor: inv.total_minor,
        method: methods[idx % methods.length],
        paid_at: paidDate.toISOString(),
        currency_code: 'GBP',
        provider: 'manual' as const,
      };
    });
    if (paymentInserts.length > 0) {
      await batchInsertNoReturn(supabase, 'payments', paymentInserts);
    }
    summary.payments = paymentInserts.length;

    // ===== PHASE 15: MAKE-UP CREDITS =====
    console.log('Phase 15: Creating make-up credits...');
    const cancelledLessons = lessons.filter((l: any) => l.status === 'cancelled');
    const creditInserts = cancelledLessons.slice(0, 20).map((lesson: any, idx: number) => {
      const realIdx = lessons.indexOf(lesson);
      const studentId = lessonStudentIds[realIdx];
      const isRedeemed = idx >= 15;
      const redeemLesson = isRedeemed ? lessons.find((l: any) => l.status === 'scheduled') : null;

      return {
        org_id: ORG_ID,
        student_id: studentId,
        credit_value_minor: 3500,
        issued_for_lesson_id: lesson.id,
        notes: isRedeemed ? 'Redeemed for make-up lesson' : 'Available for make-up',
        created_by: OWNER_USER_ID,
        ...(isRedeemed && redeemLesson ? {
          redeemed_at: new Date().toISOString(),
          redeemed_lesson_id: redeemLesson.id,
        } : {}),
        expires_at: addDays(today, 90).toISOString(),
      };
    });
    if (creditInserts.length > 0) {
      await batchInsertNoReturn(supabase, 'make_up_credits', creditInserts);
    }
    summary.make_up_credits = creditInserts.length;

    // ===== PHASE 16: MESSAGING =====
    console.log('Phase 16: Creating messaging data...');

    // Internal messages: teacher-owner conversations
    const internalMsgs: any[] = [];
    const subjects = [
      'Schedule change request for next week',
      'Student progress update - Oliver Thompson',
      'Room booking conflict on Thursday',
      'Holiday cover needed - 15th Feb',
      'New student starting Monday',
      'Exam preparation schedule',
      'Equipment request for music room',
      'Parent feedback - positive!',
      'Cancellation policy query',
      'Term dates confirmation',
    ];
    for (let i = 0; i < 10; i++) {
      const teacherUid = teacherUserIds[i % teacherUserIds.length];
      const threadId = crypto.randomUUID();
      internalMsgs.push({
        org_id: ORG_ID,
        sender_user_id: teacherUid,
        recipient_user_id: OWNER_USER_ID,
        sender_role: 'teacher',
        recipient_role: 'owner',
        subject: subjects[i],
        body: `Hi, I wanted to discuss ${subjects[i].toLowerCase()}. Could we arrange a quick call this week?`,
        thread_id: threadId,
        read_at: i < 6 ? new Date().toISOString() : null,
      });
      // Reply from owner
      if (i < 7) {
        internalMsgs.push({
          org_id: ORG_ID,
          sender_user_id: OWNER_USER_ID,
          recipient_user_id: teacherUid,
          sender_role: 'owner',
          recipient_role: 'teacher',
          subject: `Re: ${subjects[i]}`,
          body: `Thanks for letting me know. I'll look into this and get back to you shortly.`,
          thread_id: threadId,
          parent_message_id: null, // will be set after insert if needed
          read_at: i < 4 ? new Date().toISOString() : null,
        });
      }
    }
    await batchInsertNoReturn(supabase, 'internal_messages', internalMsgs);
    summary.internal_messages = internalMsgs.length;

    // Message requests from parents
    const requestTypes = ['reschedule', 'cancellation', 'general', 'reschedule', 'cancellation', 'general', 'reschedule', 'cancellation'];
    const requestStatuses = ['pending', 'approved', 'declined', 'pending', 'approved', 'pending', 'approved', 'declined'];
    const requestSubjects = [
      'Reschedule Tuesday lesson',
      'Cancel next week - family holiday',
      'Question about exam preparation',
      'Move lesson to Thursday',
      'Cancel 3 weeks - medical',
      'Instrument upgrade advice',
      'Swap lesson time with sibling',
      'Cancel this Friday please',
    ];
    const messageRequests: any[] = [];
    for (let i = 0; i < 8; i++) {
      const guardianIdx = i * 10; // spread across different guardians
      if (guardianIdx >= guardians.length) break;
      const studentIdx = Math.min(i * 10, students.length - 1);
      messageRequests.push({
        org_id: ORG_ID,
        guardian_id: guardians[guardianIdx].id,
        student_id: students[studentIdx].id,
        request_type: requestTypes[i],
        subject: requestSubjects[i],
        message: `Hello, I'd like to request: ${requestSubjects[i].toLowerCase()}. Please let me know if this is possible. Thank you.`,
        status: requestStatuses[i],
        ...(requestStatuses[i] !== 'pending' ? {
          admin_response: requestStatuses[i] === 'approved'
            ? 'No problem, this has been arranged.'
            : 'Unfortunately we cannot accommodate this request at this time.',
          responded_by: OWNER_USER_ID,
          responded_at: new Date().toISOString(),
        } : {}),
      });
    }
    await batchInsertNoReturn(supabase, 'message_requests', messageRequests);
    summary.message_requests = messageRequests.length;

    // Outbound message log
    const outboundMsgs: any[] = [];
    const msgTypes = ['invoice_reminder', 'lesson_confirmation', 'welcome', 'invoice_reminder', 'lesson_confirmation'];
    for (let i = 0; i < 15; i++) {
      const guardianIdx = (i * 15) % guardians.length;
      outboundMsgs.push({
        org_id: ORG_ID,
        channel: 'email',
        message_type: msgTypes[i % msgTypes.length],
        subject: msgTypes[i % msgTypes.length] === 'invoice_reminder'
          ? 'Payment reminder - Invoice due'
          : msgTypes[i % msgTypes.length] === 'welcome'
          ? 'Welcome to Harmony Music Education'
          : 'Lesson confirmation for next week',
        body: 'This is an automated message from Harmony Music Education Agency.',
        recipient_email: guardians[guardianIdx].email || 'noreply@example.com',
        recipient_name: guardians[guardianIdx].full_name,
        recipient_id: guardians[guardianIdx].id,
        recipient_type: 'guardian',
        sender_user_id: OWNER_USER_ID,
        status: i < 12 ? 'sent' : 'pending',
        sent_at: i < 12 ? addDays(today, -(15 - i)).toISOString() : null,
      });
    }
    await batchInsertNoReturn(supabase, 'message_log', outboundMsgs);
    summary.outbound_messages = outboundMsgs.length;

    // ===== DONE =====
    console.log('=== SEED AGENCY DEMO COMPLETE ===');
    console.log('Summary:', JSON.stringify(summary));

    return new Response(JSON.stringify({
      success: true,
      message: 'Agency demo data created successfully!',
      summary,
      accounts: {
        owner: { email: 'demo-teacher@lessonloop.test', password: 'DemoTeacher2026!' },
        teacher1: { email: 'teacher1@lessonloop.test', password: 'Teacher1Demo2026!' },
        teacher2: { email: 'teacher2@lessonloop.test', password: 'Teacher2Demo2026!' },
        parent1: { email: 'parent1@lessonloop.test', password: 'Parent1Demo2026!' },
        parent2: { email: 'parent2@lessonloop.test', password: 'Parent2Demo2026!' },
        parent3: { email: 'parent3@lessonloop.test', password: 'Parent3Demo2026!' },
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('SEED ERROR:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
