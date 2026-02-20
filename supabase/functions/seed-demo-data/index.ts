import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Jamie's account details
const JAMIE_USER_ID = '29ae9f1e-c528-40ea-b9e8-84c2f03b15a9';
const JAMIE_ORG_ID = 'ab483977-e53b-450a-ab1b-b64c921cae9b';

// Demo students with UK-centric names
const STUDENTS = [
  { first_name: 'Oliver', last_name: 'Thompson', instrument: 'Piano', duration_mins: 30 },
  { first_name: 'Sophie', last_name: 'Williams', instrument: 'Violin', duration_mins: 45 },
  { first_name: 'Jack', last_name: 'Brown', instrument: 'Guitar', duration_mins: 30 },
  { first_name: 'Emily', last_name: 'Davies', instrument: 'Piano', duration_mins: 45 },
  { first_name: 'Harry', last_name: 'Wilson', instrument: 'Drums', duration_mins: 45 },
  { first_name: 'Amelia', last_name: 'Taylor', instrument: 'Flute', duration_mins: 30 },
  { first_name: 'George', last_name: 'Anderson', instrument: 'Piano', duration_mins: 30 },
  { first_name: 'Isabella', last_name: 'Thomas', instrument: 'Cello', duration_mins: 45 },
  { first_name: 'Noah', last_name: 'Roberts', instrument: 'Guitar', duration_mins: 45 },
  { first_name: 'Mia', last_name: 'Johnson', instrument: 'Violin', duration_mins: 30 },
  { first_name: 'Oscar', last_name: 'Evans', instrument: 'Saxophone', duration_mins: 45 },
  { first_name: 'Charlotte', last_name: 'Lewis', instrument: 'Piano', duration_mins: 30 },
  { first_name: 'Alfie', last_name: 'Walker', instrument: 'Drums', duration_mins: 45 },
  { first_name: 'Lily', last_name: 'Hall', instrument: 'Clarinet', duration_mins: 30 },
  { first_name: 'Freddie', last_name: 'Green', instrument: 'Guitar', duration_mins: 30 },
];

const GUARDIAN_FIRST_NAMES = [
  'Sarah', 'David', 'Emma', 'Michael', 'Claire', 
  'James', 'Rachel', 'Andrew', 'Victoria', 'Mark',
  'Helen', 'Chris', 'Laura', 'Simon', 'Catherine'
];

const RATES: Record<string, { 30: number; 45: number }> = {
  'Piano': { 30: 3500, 45: 5000 },
  'Guitar': { 30: 3200, 45: 4500 },
  'Violin': { 30: 3800, 45: 5500 },
  'Cello': { 30: 3800, 45: 5500 },
  'Drums': { 30: 3500, 45: 4000 },
  'Flute': { 30: 3500, 45: 5000 },
  'Clarinet': { 30: 3500, 45: 5000 },
  'Saxophone': { 30: 3500, 45: 5000 },
};

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (isProduction) {
    return new Response(JSON.stringify({ error: "Not available in production" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('Starting demo data seeding for Jamie...');

    // Check if lessons already exist
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('org_id', JAMIE_ORG_ID)
      .limit(1);

    if (existingLessons && existingLessons.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Demo data already exists. Delete existing lessons first if you want to reseed.' 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // Get or create students
    const { data: existingStudents } = await supabase
      .from('students')
      .select('*')
      .eq('org_id', JAMIE_ORG_ID);

    let finalStudents = existingStudents || [];
    let finalGuardians: any[] = [];
    let createdRateCards = 0;

    // Create rate cards if needed
    const { data: existingRates } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('org_id', JAMIE_ORG_ID)
      .limit(1);

    if (!existingRates || existingRates.length === 0) {
      console.log('Creating rate cards...');
      const rateCardInserts = [];
      for (const [instrument, prices] of Object.entries(RATES)) {
        rateCardInserts.push({
          org_id: JAMIE_ORG_ID,
          name: `${instrument} - 30 mins`,
          duration_mins: 30,
          rate_amount: prices[30],
          currency_code: 'GBP',
          is_default: instrument === 'Piano',
        });
        rateCardInserts.push({
          org_id: JAMIE_ORG_ID,
          name: `${instrument} - 45 mins`,
          duration_mins: 45,
          rate_amount: prices[45],
          currency_code: 'GBP',
          is_default: false,
        });
      }
      const { data: newRateCards, error: rateCardsError } = await supabase
        .from('rate_cards')
        .insert(rateCardInserts)
        .select();
      if (rateCardsError) throw rateCardsError;
      createdRateCards = newRateCards?.length || 0;
    }

    // Create students if needed
    if (finalStudents.length === 0) {
      console.log('Creating students...');
      const studentInserts = STUDENTS.map((s) => ({
        org_id: JAMIE_ORG_ID,
        first_name: s.first_name,
        last_name: s.last_name,
        email: `${s.first_name.toLowerCase()}.${s.last_name.toLowerCase()}@example.com`,
        notes: `Plays ${s.instrument}. Weekly ${s.duration_mins}-minute lessons.`,
        status: 'active',
      }));

      const { data: newStudents, error: studentsError } = await supabase
        .from('students')
        .insert(studentInserts)
        .select();
      if (studentsError) throw studentsError;
      finalStudents = newStudents || [];
      console.log(`Created ${finalStudents.length} students`);

      // Create guardians
      console.log('Creating guardians...');
      const guardianInserts = STUDENTS.map((s, i) => ({
        org_id: JAMIE_ORG_ID,
        full_name: `${GUARDIAN_FIRST_NAMES[i]} ${s.last_name}`,
        email: `${GUARDIAN_FIRST_NAMES[i].toLowerCase()}.${s.last_name.toLowerCase()}@example.com`,
        phone: `07${String(700000000 + Math.floor(Math.random() * 99999999)).padStart(9, '0')}`,
      }));

      const { data: newGuardians, error: guardiansError } = await supabase
        .from('guardians')
        .insert(guardianInserts)
        .select();
      if (guardiansError) throw guardiansError;
      finalGuardians = newGuardians || [];
      console.log(`Created ${finalGuardians.length} guardians`);

      // Link students to guardians
      console.log('Creating student_guardians links...');
      const linkInserts = finalStudents.map((student, i) => ({
        student_id: student.id,
        guardian_id: finalGuardians[i].id,
        org_id: JAMIE_ORG_ID,
        is_primary_payer: true,
        relationship: i % 2 === 0 ? 'mother' : 'father',
      }));
      console.log('Inserting student_guardians:', linkInserts.length);
      
      const { data: linkData, error: linkError } = await supabase
        .from('student_guardians')
        .insert(linkInserts)
        .select();
      
      if (linkError) {
        console.error('student_guardians error:', linkError);
        throw linkError;
      }
      console.log('Created student_guardians:', linkData?.length);
    } else {
      // Fetch existing guardians
      const { data: existingGuardians } = await supabase
        .from('guardians')
        .select('*')
        .eq('org_id', JAMIE_ORG_ID);
      finalGuardians = existingGuardians || [];
    }

    // Create Lessons
    console.log('Creating lessons...');
    const now = new Date();
    const lessons = [];
    
    const getDateAt = (daysOffset: number, hour: number, minutes = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysOffset);
      d.setHours(hour, minutes, 0, 0);
      return d;
    };

    // Helper to get student by index with their metadata
    const getStudentWithMeta = (idx: number) => {
      const normalizedIdx = idx % finalStudents.length;
      const student = finalStudents[normalizedIdx];
      const meta = STUDENTS.find(s => s.first_name === student.first_name) || STUDENTS[normalizedIdx];
      return { student, meta };
    };

    // Past lessons (last 4 weeks, ~20 lessons)
    for (let week = -4; week < 0; week++) {
      for (let i = 0; i < 5; i++) {
        const studentIdx = (Math.abs(week) * 5 + i) % finalStudents.length;
        const { student, meta } = getStudentWithMeta(studentIdx);
        const dayOffset = week * 7 + (i % 5);
        const hour = 15 + (i % 4);

        lessons.push({
          org_id: JAMIE_ORG_ID,
          teacher_user_id: JAMIE_USER_ID,
          created_by: JAMIE_USER_ID,
          title: `${meta.instrument} Lesson - ${student.first_name}`,
          start_at: getDateAt(dayOffset, hour).toISOString(),
          end_at: getDateAt(dayOffset, hour, meta.duration_mins).toISOString(),
          status: 'completed',
          lesson_type: 'private',
        });
      }
    }

    // Today's lessons (4 lessons)
    const todaySlots = [15, 16, 17, 18];
    for (let i = 0; i < 4; i++) {
      const { student, meta } = getStudentWithMeta(i);
      lessons.push({
        org_id: JAMIE_ORG_ID,
        teacher_user_id: JAMIE_USER_ID,
        created_by: JAMIE_USER_ID,
        title: `${meta.instrument} Lesson - ${student.first_name}`,
        start_at: getDateAt(0, todaySlots[i]).toISOString(),
        end_at: getDateAt(0, todaySlots[i], meta.duration_mins).toISOString(),
        status: 'scheduled',
        lesson_type: 'private',
      });
    }

    // Future lessons (next 3 weeks)
    for (let week = 1; week <= 3; week++) {
      for (let i = 0; i < 5; i++) {
        const studentIdx = (week * 5 + i) % finalStudents.length;
        const { student, meta } = getStudentWithMeta(studentIdx);
        const dayOffset = week * 7 + (i % 5);
        const hour = 15 + (i % 4);

        lessons.push({
          org_id: JAMIE_ORG_ID,
          teacher_user_id: JAMIE_USER_ID,
          created_by: JAMIE_USER_ID,
          title: `${meta.instrument} Lesson - ${student.first_name}`,
          start_at: getDateAt(dayOffset, hour).toISOString(),
          end_at: getDateAt(dayOffset, hour, meta.duration_mins).toISOString(),
          status: 'scheduled',
          lesson_type: 'private',
        });
      }
    }

    const { data: createdLessons, error: lessonsError } = await supabase
      .from('lessons')
      .insert(lessons)
      .select();
    if (lessonsError) throw lessonsError;
    console.log(`Created ${createdLessons?.length} lessons`);

    // Create lesson participants
    const participantInserts = createdLessons!.map((lesson) => {
      const studentName = lesson.title.split(' - ')[1];
      const student = finalStudents.find(s => s.first_name === studentName) || finalStudents[0];
      return {
        lesson_id: lesson.id,
        student_id: student.id,
        org_id: JAMIE_ORG_ID,
      };
    });
    const { error: participantsError } = await supabase.from('lesson_participants').insert(participantInserts);
    if (participantsError) throw participantsError;

    // Create Invoices
    console.log('Creating invoices...');
    const invoiceStatuses = ['paid', 'paid', 'paid', 'sent', 'sent', 'sent', 'overdue', 'overdue', 'draft'];
    const invoiceInserts = [];

    for (let i = 0; i < invoiceStatuses.length; i++) {
      const guardian = finalGuardians[i % finalGuardians.length];
      const student = finalStudents[i % finalStudents.length];
      const meta = STUDENTS.find(s => s.first_name === student.first_name) || STUDENTS[i % STUDENTS.length];
      const rate = RATES[meta.instrument]?.[meta.duration_mins as 30 | 45] || 3500;
      const quantity = 4;
      const subtotal = rate * quantity;
      
      const issueDate = new Date(now);
      issueDate.setDate(issueDate.getDate() - (invoiceStatuses[i] === 'draft' ? 0 : (30 - i * 3)));
      
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);

      invoiceInserts.push({
        org_id: JAMIE_ORG_ID,
        invoice_number: `INV-${String(2024001 + i).padStart(7, '0')}`,
        payer_guardian_id: guardian?.id,
        payer_student_id: student.id,
        status: invoiceStatuses[i],
        issue_date: issueDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal_minor: subtotal,
        tax_minor: 0,
        total_minor: subtotal,
        currency_code: 'GBP',
        vat_rate: 0,
        notes: `${meta.instrument} lessons for ${student.first_name}`,
      });
    }

    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .insert(invoiceInserts)
      .select();
    if (invoicesError) throw invoicesError;
    console.log(`Created ${invoices?.length} invoices`);

    // Create invoice items
    const invoiceItemInserts = invoices!.flatMap((invoice, i) => {
      const student = finalStudents[i % finalStudents.length];
      const meta = STUDENTS.find(s => s.first_name === student.first_name) || STUDENTS[i % STUDENTS.length];
      const rate = RATES[meta.instrument]?.[meta.duration_mins as 30 | 45] || 3500;
      
      return Array.from({ length: 4 }, (_, j) => ({
        invoice_id: invoice.id,
        org_id: JAMIE_ORG_ID,
        description: `${meta.instrument} lesson (${meta.duration_mins} mins) - Week ${j + 1}`,
        quantity: 1,
        unit_price_minor: rate,
        amount_minor: rate,
      }));
    });
    const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemInserts);
    if (itemsError) throw itemsError;

    // Create payments for paid invoices
    console.log('Creating payments...');
    const paidInvoices = invoices!.filter(inv => inv.status === 'paid');
    const paymentInserts = paidInvoices.map(invoice => ({
      invoice_id: invoice.id,
      org_id: JAMIE_ORG_ID,
      amount_minor: invoice.total_minor,
      method: Math.random() > 0.5 ? 'bank_transfer' : 'card',
      paid_at: new Date(new Date(invoice.issue_date).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    const { error: paymentsError } = await supabase.from('payments').insert(paymentInserts);
    if (paymentsError) throw paymentsError;

    console.log('Demo data seeding complete!');

    return new Response(JSON.stringify({
      success: true,
      message: 'Demo data created successfully!',
      summary: {
        students: finalStudents.length,
        guardians: finalGuardians.length,
        lessons: createdLessons?.length,
        invoices: invoices?.length,
        rateCards: createdRateCards,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error seeding demo data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
