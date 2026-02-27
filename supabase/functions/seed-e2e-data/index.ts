// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // ─── 1. Create test users ───
    const users: Record<string, { email: string; id?: string }> = {
      owner:   { email: "e2e-owner@test.lessonloop.net" },
      admin_u: { email: "e2e-admin@test.lessonloop.net" },
      teacher: { email: "e2e-teacher@test.lessonloop.net" },
      finance: { email: "e2e-finance@test.lessonloop.net" },
      parent1: { email: "e2e-parent@test.lessonloop.net" },
      parent2: { email: "e2e-parent2@test.lessonloop.net" },
    };

    for (const [key, u] of Object.entries(users)) {
      // Check if user already exists
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((x: any) => x.email === u.email);
      if (found) {
        users[key].id = found.id;
        L(`User ${key} already exists: ${found.id}`);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: "TestPass123!",
          email_confirm: true,
        });
        if (error) throw new Error(`Failed to create ${key}: ${error.message}`);
        users[key].id = data.user.id;
        L(`Created user ${key}: ${data.user.id}`);
      }
    }

    const ownerId = users.owner.id!;
    const adminId = users.admin_u.id!;
    const teacherId = users.teacher.id!;
    const financeId = users.finance.id!;
    const parent1Id = users.parent1.id!;
    const parent2Id = users.parent2.id!;

    // ─── 2. Ensure profiles exist ───
    for (const [key, u] of Object.entries(users)) {
      await admin.from("profiles").upsert({
        id: u.id!,
        full_name: `E2E ${key.charAt(0).toUpperCase() + key.slice(1).replace("_u", "")}`,
        has_completed_onboarding: key === "owner",
      }, { onConflict: "id" });
    }
    L("Profiles upserted");

    // ─── 3. Create organisation ───
    let orgId: string;
    const { data: existingOrg } = await admin
      .from("organisations")
      .select("id")
      .eq("name", "E2E Test Academy")
      .maybeSingle();

    if (existingOrg) {
      orgId = existingOrg.id;
      L(`Org already exists: ${orgId}`);
    } else {
      const { data: newOrg, error: orgErr } = await admin
        .from("organisations")
        .insert({
          name: "E2E Test Academy",
          org_type: "academy",
          country_code: "GB",
          currency_code: "GBP",
          timezone: "Europe/London",
          created_by: ownerId,
          subscription_plan: "academy",
          subscription_status: "active",
          max_students: 9999,
          max_teachers: 10,
          vat_enabled: true,
          vat_rate: 20,
          default_lesson_length_mins: 30,
        })
        .select("id")
        .single();
      if (orgErr) throw new Error(`Org create failed: ${orgErr.message}`);
      orgId = newOrg.id;
      L(`Created org: ${orgId}`);
    }

    // Update owner profile current_org_id
    await admin.from("profiles").update({ current_org_id: orgId, has_completed_onboarding: true }).eq("id", ownerId);

    // ─── 4. Org memberships ───
    const membershipRows = [
      { org_id: orgId, user_id: ownerId, role: "owner", status: "active" },
      { org_id: orgId, user_id: adminId, role: "admin", status: "active" },
      { org_id: orgId, user_id: teacherId, role: "teacher", status: "active" },
      { org_id: orgId, user_id: financeId, role: "finance", status: "active" },
      { org_id: orgId, user_id: parent1Id, role: "parent", status: "active" },
      { org_id: orgId, user_id: parent2Id, role: "parent", status: "active" },
    ];

    for (const m of membershipRows) {
      const { data: existing } = await admin
        .from("org_memberships")
        .select("id")
        .eq("org_id", m.org_id)
        .eq("user_id", m.user_id)
        .maybeSingle();
      if (!existing) {
        await admin.from("org_memberships").insert(m);
      }
    }
    // Also set current_org_id for all staff
    for (const u of [adminId, teacherId, financeId, parent1Id, parent2Id]) {
      await admin.from("profiles").update({
        current_org_id: orgId,
        has_completed_onboarding: true,
      }).eq("id", u);
    }
    L("Memberships created");

    // ─── 5. Teacher record ───
    let teacherRecordId: string;
    const { data: existingTeacher } = await admin
      .from("teachers")
      .select("id")
      .eq("user_id", teacherId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existingTeacher) {
      teacherRecordId = existingTeacher.id;
    } else {
      const { data: tRec, error: tErr } = await admin
        .from("teachers")
        .insert({
          org_id: orgId,
          user_id: teacherId,
          display_name: "E2E Teacher",
          status: "active",
        })
        .select("id")
        .single();
      if (tErr) throw new Error(`Teacher create failed: ${tErr.message}`);
      teacherRecordId = tRec.id;
    }

    // Also create owner as teacher (solo-teacher pattern)
    const { data: ownerTeacher } = await admin
      .from("teachers")
      .select("id")
      .eq("user_id", ownerId)
      .eq("org_id", orgId)
      .maybeSingle();

    let ownerTeacherId: string;
    if (ownerTeacher) {
      ownerTeacherId = ownerTeacher.id;
    } else {
      const { data: otRec } = await admin
        .from("teachers")
        .insert({
          org_id: orgId,
          user_id: ownerId,
          display_name: "E2E Owner",
          status: "active",
        })
        .select("id")
        .single();
      ownerTeacherId = otRec!.id;
    }
    L(`Teacher records: teacher=${teacherRecordId}, owner=${ownerTeacherId}`);

    // ─── 6. Instruments ───
    const instrumentNames = ["Piano", "Guitar", "Violin", "Drums"];
    const instrumentIds: Record<string, string> = {};

    for (const name of instrumentNames) {
      const { data: existing } = await admin
        .from("instruments")
        .select("id")
        .eq("name", name)
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .maybeSingle();

      if (existing) {
        instrumentIds[name] = existing.id;
      } else {
        const { data: inst } = await admin
          .from("instruments")
          .insert({ name, category: "standard", org_id: orgId, is_custom: true })
          .select("id")
          .single();
        instrumentIds[name] = inst!.id;
      }
    }
    L(`Instruments: ${JSON.stringify(instrumentIds)}`);

    // ─── 7. Students ───
    const studentDefs = [
      { first_name: "Emma", last_name: "Wilson", instrument: "Piano", status: "active" },
      { first_name: "James", last_name: "Smith", instrument: "Guitar", status: "active" },
      { first_name: "Sophie", last_name: "Brown", instrument: "Violin", status: "active" },
      { first_name: "Oliver", last_name: "Davis", instrument: "Piano", status: "inactive" },
      { first_name: "Lily", last_name: "Thompson", instrument: "Drums", status: "active" },
    ];
    const studentIds: Record<string, string> = {};

    for (const sd of studentDefs) {
      const { data: existing } = await admin
        .from("students")
        .select("id")
        .eq("org_id", orgId)
        .eq("first_name", sd.first_name)
        .eq("last_name", sd.last_name)
        .maybeSingle();

      if (existing) {
        studentIds[sd.first_name] = existing.id;
      } else {
        const { data: st } = await admin
          .from("students")
          .insert({
            org_id: orgId,
            first_name: sd.first_name,
            last_name: sd.last_name,
            status: sd.status,
          })
          .select("id")
          .single();
        studentIds[sd.first_name] = st!.id;
      }

      // Student instrument
      const { data: existingSI } = await admin
        .from("student_instruments")
        .select("id")
        .eq("student_id", studentIds[sd.first_name])
        .eq("instrument_id", instrumentIds[sd.instrument])
        .maybeSingle();

      if (!existingSI) {
        await admin.from("student_instruments").insert({
          student_id: studentIds[sd.first_name],
          instrument_id: instrumentIds[sd.instrument],
          org_id: orgId,
          is_primary: true,
        });
      }
    }
    L(`Students: ${JSON.stringify(studentIds)}`);

    // ─── 8. Guardians ───
    let guardian1Id: string;
    let guardian2Id: string;

    const { data: g1 } = await admin
      .from("guardians")
      .select("id")
      .eq("user_id", parent1Id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (g1) {
      guardian1Id = g1.id;
    } else {
      const { data: ng1 } = await admin
        .from("guardians")
        .insert({
          org_id: orgId,
          user_id: parent1Id,
          full_name: "E2E Parent One",
          email: "e2e-parent@test.lessonloop.net",
          phone: "+447700000001",
        })
        .select("id")
        .single();
      guardian1Id = ng1!.id;
    }

    const { data: g2 } = await admin
      .from("guardians")
      .select("id")
      .eq("user_id", parent2Id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (g2) {
      guardian2Id = g2.id;
    } else {
      const { data: ng2 } = await admin
        .from("guardians")
        .insert({
          org_id: orgId,
          user_id: parent2Id,
          full_name: "E2E Parent Two",
          email: "e2e-parent2@test.lessonloop.net",
          phone: "+447700000002",
        })
        .select("id")
        .single();
      guardian2Id = ng2!.id;
    }
    L(`Guardians: parent1=${guardian1Id}, parent2=${guardian2Id}`);

    // ─── 9. Student-Guardian links ───
    // Parent1 → Emma + James
    for (const studentName of ["Emma", "James"]) {
      const { data: existing } = await admin
        .from("student_guardians")
        .select("id")
        .eq("guardian_id", guardian1Id)
        .eq("student_id", studentIds[studentName])
        .maybeSingle();
      if (!existing) {
        await admin.from("student_guardians").insert({
          guardian_id: guardian1Id,
          student_id: studentIds[studentName],
          relationship: "parent",
          is_primary_payer: true,
          org_id: orgId,
        });
      }
    }
    // Parent2 → Sophie
    {
      const { data: existing } = await admin
        .from("student_guardians")
        .select("id")
        .eq("guardian_id", guardian2Id)
        .eq("student_id", studentIds.Sophie)
        .maybeSingle();
      if (!existing) {
        await admin.from("student_guardians").insert({
          guardian_id: guardian2Id,
          student_id: studentIds.Sophie,
          relationship: "parent",
          is_primary_payer: true,
          org_id: orgId,
        });
      }
    }
    L("Student-guardian links created");

    // ─── 10. Teacher assignments ───
    for (const studentName of ["Emma", "James", "Lily"]) {
      const { data: existing } = await admin
        .from("student_teacher_assignments")
        .select("id")
        .eq("teacher_id", teacherRecordId)
        .eq("student_id", studentIds[studentName])
        .eq("org_id", orgId)
        .maybeSingle();
      if (!existing) {
        await admin.from("student_teacher_assignments").insert({
          teacher_id: teacherRecordId,
          teacher_user_id: teacherId,
          student_id: studentIds[studentName],
          org_id: orgId,
          instrument_id: instrumentIds[studentName === "Emma" ? "Piano" : studentName === "James" ? "Guitar" : "Drums"],
        });
      }
    }
    L("Teacher assignments created");

    // ─── 11. Location + Room ───
    let locationId: string;
    const { data: existingLoc } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "Main Studio")
      .maybeSingle();

    if (existingLoc) {
      locationId = existingLoc.id;
    } else {
      const { data: loc, error: locErr } = await admin
        .from("locations")
        .insert({
          org_id: orgId,
          name: "Main Studio",
          location_type: "studio",
          address_line_1: "123 Music Lane",
          city: "London",
          postcode: "SE1 1AA",
          country_code: "GB",
        })
        .select("id")
        .single();
      if (locErr) throw new Error(`Location create failed: ${locErr.message}`);
      locationId = loc!.id;
    }

    const { data: existingRoom } = await admin
      .from("rooms")
      .select("id")
      .eq("location_id", locationId)
      .eq("name", "Room A")
      .maybeSingle();

    let roomId: string;
    if (existingRoom) {
      roomId = existingRoom.id;
    } else {
      const { data: room, error: roomErr } = await admin
        .from("rooms")
        .insert({
          location_id: locationId,
          org_id: orgId,
          name: "Room A",
          capacity: 1,
        })
        .select("id")
        .single();
      if (roomErr) throw new Error(`Room create failed: ${roomErr.message}`);
      roomId = room!.id;
    }
    L(`Location: ${locationId}, Room: ${roomId}`);

    // ─── 12. Recurring lessons ───
    // Create a recurrence and lessons for next 4 weeks
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1); // This week's Monday

    const lessonDefs = [
      { student: "Emma", day: 1, hour: 10, instrument: "Piano" },  // Monday 10am
      { student: "James", day: 2, hour: 14, instrument: "Guitar" }, // Tuesday 2pm
      { student: "Lily", day: 3, hour: 11, instrument: "Drums" },  // Wednesday 11am
    ];

    for (const ld of lessonDefs) {
      // Create recurrence rule
      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][ld.day];
      const startDate = new Date(monday);
      startDate.setDate(monday.getDate() + ld.day - 1);

      const { data: rec, error: recErr } = await admin
        .from("recurrence_rules")
        .insert({
          org_id: orgId,
          pattern_type: "weekly",
          interval_weeks: 1,
          days_of_week: [ld.day],
          start_date: startDate.toISOString().slice(0, 10),
          timezone: "Europe/London",
        })
        .select("id")
        .single();

      if (recErr) {
        L(`Recurrence warning: ${recErr.message}`);
        continue;
      }
      const recurrenceId = rec!.id;

      // Create 4 weeks of lessons (1 past + 3 future)
      for (let w = -1; w < 3; w++) {
        const lessonDate = new Date(monday);
        lessonDate.setDate(monday.getDate() + ld.day - 1 + w * 7);
        const startAt = new Date(lessonDate);
        startAt.setHours(ld.hour, 0, 0, 0);
        const endAt = new Date(startAt);
        endAt.setMinutes(endAt.getMinutes() + 30);

        const isPast = startAt < now;
        const status = isPast ? "completed" : "scheduled";

        const { data: lesson, error: lessonErr } = await admin
          .from("lessons")
          .insert({
            org_id: orgId,
            title: `${ld.instrument} Lesson — ${ld.student}`,
            teacher_id: teacherRecordId,
            teacher_user_id: teacherId,
            created_by: ownerId,
            location_id: locationId,
            room_id: roomId,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status,
            lesson_type: "private",
            recurrence_id: recurrenceId,
          })
          .select("id")
          .single();

        if (lessonErr) {
          L(`Lesson insert warning (${ld.student} w${w}): ${lessonErr.message}`);
          continue;
        }

        // Add participant
        if (lesson) {
          await admin.from("lesson_participants").insert({
            lesson_id: lesson.id,
            student_id: studentIds[ld.student],
            org_id: orgId,
          }).then(() => {});

          // Mark attendance for past lessons
          if (isPast) {
            await admin.from("attendance_records").insert({
              lesson_id: lesson.id,
              student_id: studentIds[ld.student],
              org_id: orgId,
              attendance_status: "present",
              recorded_by: teacherId,
            }).then(() => {});
          }
        }
      }
    }
    L("Lessons and attendance created");

    // ─── 13. Rate cards ───
    let rateCardId: string;
    const { data: existingRC } = await admin
      .from("rate_cards")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "Standard 30-min")
      .maybeSingle();

    if (existingRC) {
      rateCardId = existingRC.id;
    } else {
      const { data: rc, error: rcErr } = await admin
        .from("rate_cards")
        .insert({
          org_id: orgId,
          name: "Standard 30-min",
          rate_amount: 35.00,
          currency_code: "GBP",
          duration_mins: 30,
          is_default: true,
        })
        .select("id")
        .single();
      if (rcErr) { L(`Rate card warning: ${rcErr.message}`); rateCardId = ""; }
      else { rateCardId = rc!.id; }
    }
    L(`Rate card: ${rateCardId}`);

    // ─── 14. Invoices ───
    // Create a few manual invoices
    const invoiceDefs = [
      { guardian: guardian1Id, student: null, status: "sent", total: 14000, label: "January 2026 — Emma & James" },
      { guardian: guardian1Id, student: null, status: "paid", total: 14000, label: "December 2025 — Emma & James" },
      { guardian: guardian2Id, student: null, status: "overdue", total: 7000, label: "January 2026 — Sophie" },
    ];

    for (const inv of invoiceDefs) {
      const dueDate = inv.status === "paid" ? "2025-12-15" : inv.status === "overdue" ? "2026-01-15" : "2026-03-01";
      const { data: invoice, error: invErr } = await admin
        .from("invoices")
        .insert({
          org_id: orgId,
          invoice_number: "",
          payer_guardian_id: inv.guardian,
          payer_student_id: inv.student,
          due_date: dueDate,
          subtotal_minor: inv.total,
          tax_minor: Math.round(inv.total * 0.2),
          total_minor: inv.total + Math.round(inv.total * 0.2),
          currency_code: "GBP",
          vat_rate: 20,
          status: "draft",
          notes: inv.label,
        })
        .select("id")
        .single();

      if (invErr) {
        L(`Invoice warning: ${invErr.message}`);
        continue;
      }

      if (invoice) {
        // Add invoice item
        await admin.from("invoice_items").insert({
          invoice_id: invoice.id,
          org_id: orgId,
          description: inv.label,
          quantity: 1,
          unit_price_minor: inv.total,
          amount_minor: inv.total,
        });

        // Transition status: draft → sent → (paid/overdue)
        if (inv.status !== "draft") {
          await admin.from("invoices").update({ status: "sent" }).eq("id", invoice.id);
        }
        if (inv.status === "paid") {
          // Record payment
          await admin.from("payments").insert({
            org_id: orgId,
            invoice_id: invoice.id,
            amount_minor: inv.total + Math.round(inv.total * 0.2),
            currency_code: "GBP",
            method: "bank_transfer",
            provider: "manual",
          });
          await admin.from("invoices").update({
            status: "paid",
            paid_minor: inv.total + Math.round(inv.total * 0.2),
          }).eq("id", invoice.id);
        } else if (inv.status === "overdue") {
          await admin.from("invoices").update({ status: "overdue" }).eq("id", invoice.id);
        }
      }
    }
    L("Invoices created");

    // ─── 15. Leads ───
    const leadDefs = [
      { name: "Alice Green", stage: "new", instrument: "Piano", email: "alice.green@example.com" },
      { name: "Bob Taylor", stage: "contacted", instrument: "Guitar", email: "bob.taylor@example.com" },
      { name: "Carol White", stage: "trial_booked", instrument: "Violin", email: "carol.white@example.com" },
    ];

    for (const ld of leadDefs) {
      const { data: existing } = await admin
        .from("leads")
        .select("id")
        .eq("org_id", orgId)
        .eq("contact_name", ld.name)
        .maybeSingle();
      if (!existing) {
        await admin.from("leads").insert({
          org_id: orgId,
          contact_name: ld.name,
          contact_email: ld.email,
          stage: ld.stage,
          preferred_instrument: ld.instrument,
          source: "website",
          created_by: ownerId,
        });
      }
    }
    L("Leads created");

    // ─── 16. Make-up waitlist ───
    const { data: existingWL } = await admin
      .from("make_up_waitlist")
      .select("id")
      .eq("org_id", orgId)
      .eq("student_id", studentIds.Emma)
      .eq("status", "waiting")
      .maybeSingle();

    if (!existingWL) {
      await admin.from("make_up_waitlist").insert({
        org_id: orgId,
        student_id: studentIds.Emma,
        guardian_id: guardian1Id,
        teacher_id: teacherRecordId,
        lesson_title: "Piano Lesson — Emma",
        missed_lesson_date: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10),
        lesson_duration_minutes: 30,
        location_id: locationId,
        status: "waiting",
      });
    }
    L("Waitlist entry created");

    // ─── 17. Practice assignment ───
    const { data: existingPA } = await admin
      .from("practice_assignments")
      .select("id")
      .eq("org_id", orgId)
      .eq("student_id", studentIds.Emma)
      .limit(1)
      .maybeSingle();

    if (!existingPA) {
      await admin.from("practice_assignments").insert({
        org_id: orgId,
        student_id: studentIds.Emma,
        teacher_id: teacherRecordId,
        teacher_user_id: teacherId,
        title: "Scales — C Major, G Major",
        description: "Practice each scale hands together, 4 octaves, at 80 BPM. Focus on even tone.",
        target_minutes_per_day: 15,
        status: "active",
      });
    }
    L("Practice assignment created");

    // ─── 18. Messaging ───
    const { data: existingMsg } = await admin
      .from("message_log")
      .select("id")
      .eq("org_id", orgId)
      .eq("sender_user_id", ownerId)
      .limit(1)
      .maybeSingle();

    if (!existingMsg) {
      const threadId = crypto.randomUUID();
      await admin.from("message_log").insert({
        org_id: orgId,
        thread_id: threadId,
        sender_user_id: ownerId,
        recipient_id: parent1Id,
        recipient_type: "guardian",
        recipient_email: "e2e-parent@test.lessonloop.net",
        recipient_name: "E2E Parent One",
        channel: "in_app",
        message_type: "general",
        subject: "Welcome to E2E Test Academy!",
        body: "Hi, welcome aboard! Please feel free to reach out if you have any questions about Emma or James's lessons.",
        status: "sent",
        related_id: studentIds.Emma,
      });
    }
    L("Message created");

    // ─── 19. Booking page ───
    const { data: existingBP } = await admin
      .from("booking_pages")
      .select("id")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!existingBP) {
      await admin.from("booking_pages").insert({
        org_id: orgId,
        slug: "e2e-test-academy",
        enabled: true,
        title: "E2E Test Academy",
        description: "Book a trial lesson with us!",
        welcome_message: "Thanks for your interest in music lessons.",
        confirmation_message: "We'll be in touch shortly to confirm your lesson time.",
      });
    }
    L("Booking page created");

    // ─── 20. Seed make-up policies ───
    await admin.rpc("seed_make_up_policies", { _org_id: orgId });
    L("Make-up policies seeded");

    // ─── Done ───
    L("✅ E2E seed complete!");

    return new Response(
      JSON.stringify({
        success: true,
        org_id: orgId,
        users: Object.fromEntries(Object.entries(users).map(([k, v]) => [k, { email: v.email, id: v.id }])),
        students: studentIds,
        log,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    L(`❌ Error: ${err.message}`);
    return new Response(
      JSON.stringify({ success: false, error: err.message, log }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
