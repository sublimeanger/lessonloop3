import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req: Request) => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { org_id } = await req.json();
    if (!org_id) throw new Error("org_id required");

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Fetch existing data ──────────────────────────────────
    const [guardiansRes, studentsRes, teachersRes, lessonsRes, staffRes] = await Promise.all([
      supabase.from("guardians").select("id, full_name, email").eq("org_id", org_id).not("email", "is", null).limit(20),
      supabase.from("students").select("id, first_name, last_name").eq("org_id", org_id).limit(50),
      supabase.from("teachers").select("id, user_id, full_name").eq("org_id", org_id).limit(10),
      supabase.from("lessons").select("id").eq("org_id", org_id).limit(20),
      supabase.from("org_memberships").select("user_id, role").eq("org_id", org_id).eq("status", "active").in("role", ["owner", "admin", "teacher"]),
    ]);

    const guardians = guardiansRes.data || [];
    const students = studentsRes.data || [];
    const teachers = teachersRes.data || [];
    const lessons = lessonsRes.data || [];
    const staff = staffRes.data || [];

    if (guardians.length < 3 || students.length < 3) {
      throw new Error("Need at least 3 guardians and 3 students. Run the demo seeder first.");
    }

    // Get student-guardian links
    const { data: sgLinks } = await supabase
      .from("student_guardians")
      .select("student_id, guardian_id")
      .eq("org_id", org_id)
      .limit(50);

    const studentGuardianMap = new Map<string, string>();
    (sgLinks || []).forEach(link => studentGuardianMap.set(link.guardian_id, link.student_id));

    // Helper: stagger timestamps across 14 days
    const now = new Date();
    const daysAgo = (days: number, hours = 0, mins = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(hours, mins, 0, 0);
      return d.toISOString();
    };

    const ownerUserId = user.id;
    const teacherStaff = staff.filter(s => s.role === "teacher");

    // ══════════════════════════════════════════════════════════
    // 1. PARENT MESSAGES (message_log) — ~35 messages
    // ══════════════════════════════════════════════════════════

    const parentMessages: any[] = [];

    // --- Thread 1: Lesson progress discussion (3 messages) ---
    const t1Guardian = guardians[0];
    const t1Student = studentGuardianMap.get(t1Guardian.id) || students[0].id;
    const t1Id = crypto.randomUUID();
    parentMessages.push(
      {
        org_id, channel: "email", subject: "Term 2 Progress Update",
        body: `Dear ${t1Guardian.full_name},\n\nI wanted to update you on progress this term. The pieces are coming along really well, and I'm particularly pleased with the improvement in sight-reading. We'll be looking at Grade 3 preparation next half term.\n\nBest wishes`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t1Guardian.id,
        recipient_email: t1Guardian.email, recipient_name: t1Guardian.full_name,
        related_id: t1Student, message_type: "manual", status: "sent",
        sent_at: daysAgo(12, 9, 15), created_at: daysAgo(12, 9, 15),
        thread_id: t1Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Term 2 Progress Update",
        body: `Thanks so much for the update! That's wonderful to hear. Is there anything we should be doing at home to support the sight-reading practice? We've been using the flashcard app you mentioned.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t1Guardian.id,
        recipient_email: t1Guardian.email, recipient_name: t1Guardian.full_name,
        related_id: t1Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(11, 14, 30), created_at: daysAgo(11, 14, 30),
        thread_id: t1Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Term 2 Progress Update",
        body: `The flashcard app is great, keep using it! I'd also suggest 10 minutes of rhythmic clapping exercises before practice — it really helps with time signatures. I'll send some exercise sheets next week.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t1Guardian.id,
        recipient_email: t1Guardian.email, recipient_name: t1Guardian.full_name,
        related_id: t1Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(10, 10, 45), created_at: daysAgo(10, 10, 45),
        thread_id: t1Id, parent_message_id: null,
      }
    );

    // --- Thread 2: Billing query (4 messages) ---
    const t2Guardian = guardians[1];
    const t2Student = studentGuardianMap.get(t2Guardian.id) || students[1].id;
    const t2Id = crypto.randomUUID();
    parentMessages.push(
      {
        org_id, channel: "email", subject: "Invoice Query - January Payment",
        body: `Hi ${t2Guardian.full_name},\n\nI noticed the January invoice hasn't been settled yet. Just wanted to check everything is okay and whether you received the invoice email? Happy to resend if needed.\n\nKind regards`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t2Guardian.id,
        recipient_email: t2Guardian.email, recipient_name: t2Guardian.full_name,
        related_id: t2Student, message_type: "invoice_reminder", status: "sent",
        sent_at: daysAgo(9, 8, 0), created_at: daysAgo(9, 8, 0),
        thread_id: t2Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Invoice Query - January Payment",
        body: `So sorry about that! I think the email went to spam. Could you resend it please? Also, would it be possible to pay in two instalments this month?`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t2Guardian.id,
        recipient_email: t2Guardian.email, recipient_name: t2Guardian.full_name,
        related_id: t2Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(8, 16, 20), created_at: daysAgo(8, 16, 20),
        thread_id: t2Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Invoice Query - January Payment",
        body: `Of course, that's absolutely fine. I've resent the invoice and noted the instalment arrangement. First half by the 15th and the remainder by month end would work perfectly.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t2Guardian.id,
        recipient_email: t2Guardian.email, recipient_name: t2Guardian.full_name,
        related_id: t2Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(8, 17, 0), created_at: daysAgo(8, 17, 0),
        thread_id: t2Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Invoice Query - January Payment",
        body: `Perfect, thank you for being so understanding! I'll make the first payment this week. Really appreciate the flexibility.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t2Guardian.id,
        recipient_email: t2Guardian.email, recipient_name: t2Guardian.full_name,
        related_id: t2Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(7, 11, 15), created_at: daysAgo(7, 11, 15),
        thread_id: t2Id, parent_message_id: null,
      }
    );

    // --- Thread 3: Schedule change (3 messages) ---
    const t3Guardian = guardians[2];
    const t3Student = studentGuardianMap.get(t3Guardian.id) || students[2].id;
    const t3Id = crypto.randomUUID();
    parentMessages.push(
      {
        org_id, channel: "email", subject: "Lesson Time Change Request",
        body: `Hi ${t3Guardian.full_name},\n\nDue to a timetable adjustment, I need to move the Wednesday 4pm slot. Would either 3:30pm or 4:30pm on the same day work for you? Alternatively, I have a Thursday 5pm slot available.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t3Guardian.id,
        recipient_email: t3Guardian.email, recipient_name: t3Guardian.full_name,
        related_id: t3Student, message_type: "manual", status: "sent",
        sent_at: daysAgo(6, 10, 0), created_at: daysAgo(6, 10, 0),
        thread_id: t3Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Lesson Time Change Request",
        body: `4:30pm on Wednesday would be perfect actually! That works better with the school run. Can we start from next week?`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t3Guardian.id,
        recipient_email: t3Guardian.email, recipient_name: t3Guardian.full_name,
        related_id: t3Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(6, 14, 30), created_at: daysAgo(6, 14, 30),
        thread_id: t3Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Lesson Time Change Request",
        body: `Brilliant, I've updated the schedule to Wednesday 4:30pm starting next week. You should see the change reflected in your portal. See you then!`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t3Guardian.id,
        recipient_email: t3Guardian.email, recipient_name: t3Guardian.full_name,
        related_id: t3Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(5, 9, 0), created_at: daysAgo(5, 9, 0),
        thread_id: t3Id, parent_message_id: null,
      }
    );

    // --- Thread 4: Practice concern (3 messages) ---
    const t4Guardian = guardians.length > 3 ? guardians[3] : guardians[0];
    const t4Student = studentGuardianMap.get(t4Guardian.id) || students[3]?.id || students[0].id;
    const t4Id = crypto.randomUUID();
    parentMessages.push(
      {
        org_id, channel: "email", subject: "Practice Routine Suggestion",
        body: `Dear ${t4Guardian.full_name},\n\nI've noticed the practice logs have been a bit quieter recently. This is very normal at this stage! I'd suggest breaking practice into two short 10-minute sessions rather than one longer one. Quality over quantity at this point.\n\nDo let me know if there are any concerns.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t4Guardian.id,
        recipient_email: t4Guardian.email, recipient_name: t4Guardian.full_name,
        related_id: t4Student, message_type: "practice_update", status: "sent",
        sent_at: daysAgo(4, 11, 30), created_at: daysAgo(4, 11, 30),
        thread_id: t4Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Practice Routine Suggestion",
        body: `Thank you for flagging this! We've had a busy couple of weeks with half-term activities. Will definitely try the split sessions approach — that sounds much more manageable.`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t4Guardian.id,
        recipient_email: t4Guardian.email, recipient_name: t4Guardian.full_name,
        related_id: t4Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(3, 19, 45), created_at: daysAgo(3, 19, 45),
        thread_id: t4Id, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Re: Practice Routine Suggestion",
        body: `No worries at all — half-term is always hectic! I'll also set up a fun challenge in the practice app next week to help motivate things. See you Wednesday!`,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: t4Guardian.id,
        recipient_email: t4Guardian.email, recipient_name: t4Guardian.full_name,
        related_id: t4Student, message_type: "reply", status: "sent",
        sent_at: daysAgo(3, 10, 0), created_at: daysAgo(3, 10, 0),
        thread_id: t4Id, parent_message_id: null,
      }
    );

    // --- Standalone messages (8 messages to various guardians) ---
    const standaloneSubjects = [
      { subj: "Welcome to LessonLoop!", body: "Welcome! Your child's lesson schedule is now set up. You can view upcoming lessons, invoices, and practice logs in the parent portal. Don't hesitate to reach out if you have any questions.", type: "manual", day: 13 },
      { subj: "Lesson Confirmation - This Week", body: "Just confirming this week's lesson is going ahead as normal. Please remember to bring the Grade 2 scales book as we'll be starting exam preparation.", type: "lesson_confirmation", day: 5 },
      { subj: "Holiday Closure Notice", body: "Please note that lessons will not run during the February half-term (17-21 Feb). Normal lessons resume on Monday 24th February. Have a lovely break!", type: "manual", day: 4 },
      { subj: "Payment Received - Thank You", body: "This is to confirm we've received your payment for the January invoice. Thank you for the prompt payment! The receipt has been attached to the invoice in your portal.", type: "invoice_reminder", day: 2 },
      { subj: "Exam Results!", body: "Wonderful news — the exam results are in and it's a Merit! Absolutely brilliant work. We'll discuss the feedback at next week's lesson and plan the next grade.", type: "manual", day: 1 },
      { subj: "Room Change Notification", body: "Please note that next Tuesday's lesson will be in Room 3 instead of Room 1 due to maintenance works. Everything else remains the same.", type: "manual", day: 1 },
      { subj: "Overdue Invoice Reminder", body: "This is a friendly reminder that invoice LL-2026-00015 is now 14 days overdue. Please arrange payment at your earliest convenience or get in touch if you'd like to discuss payment options.", type: "invoice_reminder", day: 3, status: "sent" },
      { subj: "Concert Invitation", body: "You're warmly invited to our Spring Showcase Concert on Saturday 15th March at 2pm. All students will be performing a piece they've been preparing this term. Refreshments provided!", type: "manual", day: 0 },
    ];

    standaloneSubjects.forEach((item, i) => {
      const g = guardians[i % guardians.length];
      const s = studentGuardianMap.get(g.id) || students[i % students.length].id;
      parentMessages.push({
        org_id, channel: "email", subject: item.subj, body: item.body,
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: g.id,
        recipient_email: g.email, recipient_name: g.full_name,
        related_id: s, message_type: item.type, status: item.status || "sent",
        sent_at: daysAgo(item.day, 9 + i, i * 7), created_at: daysAgo(item.day, 9 + i, i * 7),
        thread_id: null, parent_message_id: null,
      });
    });

    // --- Failed messages (2) ---
    parentMessages.push(
      {
        org_id, channel: "email", subject: "Lesson Reminder - Tomorrow",
        body: "Just a reminder that tomorrow's lesson is at 3:30pm. Please bring the new music book.",
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: guardians[4]?.id || guardians[0].id,
        recipient_email: "bounced@invalid-domain.test", recipient_name: guardians[4]?.full_name || guardians[0].full_name,
        related_id: students[4]?.id || students[0].id, message_type: "manual", status: "failed",
        error_message: "Email bounced: mailbox not found",
        created_at: daysAgo(2, 15, 0), thread_id: null, parent_message_id: null,
      },
      {
        org_id, channel: "email", subject: "Schedule Update",
        body: "Your lesson time has been moved to 5pm on Thursdays starting next week.",
        sender_user_id: ownerUserId, recipient_type: "guardian", recipient_id: guardians[5]?.id || guardians[1].id,
        recipient_email: "timeout@slow-server.test", recipient_name: guardians[5]?.full_name || guardians[1].full_name,
        related_id: students[5]?.id || students[1].id, message_type: "manual", status: "failed",
        error_message: "Connection timeout after 30s",
        created_at: daysAgo(1, 8, 30), thread_id: null, parent_message_id: null,
      }
    );

    // Insert parent messages
    const { data: insertedParent, error: parentError } = await supabase
      .from("message_log")
      .insert(parentMessages)
      .select("id");
    if (parentError) throw new Error(`Parent messages: ${parentError.message}`);

    // ══════════════════════════════════════════════════════════
    // 2. INTERNAL MESSAGES — ~18 messages in 4 threads
    // ══════════════════════════════════════════════════════════

    const internalMessages: any[] = [];
    const teacher1 = teacherStaff[0] || { user_id: staff[1]?.user_id || ownerUserId, role: "teacher" };
    const teacher2 = teacherStaff[1] || { user_id: staff[2]?.user_id || ownerUserId, role: "teacher" };

    // Thread A: Room booking conflict (4 msgs)
    const tAId = crypto.randomUUID();
    internalMessages.push(
      {
        org_id, sender_user_id: teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Room 2 Double Booking - Tuesday 3pm",
        body: "Hi, I've just arrived for my 3pm lesson in Room 2 and it looks like it's already being used. Is there another room available? My student is waiting.",
        thread_id: tAId, parent_message_id: null, read_at: daysAgo(7, 15, 30),
        created_at: daysAgo(8, 15, 5),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Re: Room 2 Double Booking - Tuesday 3pm",
        body: "Oh no, sorry about that! Room 4 should be free — I'll update the calendar now. Must have been a scheduling overlap when we added the new group class.",
        thread_id: tAId, parent_message_id: null, read_at: daysAgo(7, 15, 40),
        created_at: daysAgo(8, 15, 15),
      },
      {
        org_id, sender_user_id: teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Re: Room 2 Double Booking - Tuesday 3pm",
        body: "Thanks, Room 4 works fine! Might be worth adding a conflict check when new group classes are scheduled?",
        thread_id: tAId, parent_message_id: null, read_at: daysAgo(7, 16, 0),
        created_at: daysAgo(8, 15, 25),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Re: Room 2 Double Booking - Tuesday 3pm",
        body: "Good idea, I'll look into the conflict detection settings. Sorry again for the hassle!",
        thread_id: tAId, parent_message_id: null, read_at: null,
        created_at: daysAgo(8, 15, 35),
      }
    );

    // Thread B: Student progress report (3 msgs)
    const tBId = crypto.randomUUID();
    const progressStudent = students[5] || students[0];
    internalMessages.push(
      {
        org_id, sender_user_id: teacher2.user_id || teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: `Progress Concern - ${progressStudent.first_name} ${progressStudent.last_name}`,
        body: `Just wanted to flag that ${progressStudent.first_name} seems to be struggling with motivation recently. Practice logs are down and they seem distracted in lessons. Might be worth a chat with the parents?`,
        thread_id: tBId, parent_message_id: null, read_at: daysAgo(4, 10, 0),
        created_at: daysAgo(5, 16, 30),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher2.user_id || teacher1.user_id, recipient_role: "teacher",
        subject: `Re: Progress Concern - ${progressStudent.first_name} ${progressStudent.last_name}`,
        body: "Thanks for flagging. I'll reach out to the parents this week. Maybe we could try some different repertoire to re-engage interest? Something more contemporary?",
        thread_id: tBId, parent_message_id: null, read_at: null,
        created_at: daysAgo(5, 17, 0),
      },
      {
        org_id, sender_user_id: teacher2.user_id || teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: `Re: Progress Concern - ${progressStudent.first_name} ${progressStudent.last_name}`,
        body: "That's a great idea. They mentioned liking some film soundtrack pieces. I'll prepare a couple of options for next lesson.",
        thread_id: tBId, parent_message_id: null, read_at: null,
        created_at: daysAgo(4, 9, 15),
      }
    );

    // Thread C: Holiday cover (3 msgs)
    const tCId = crypto.randomUUID();
    internalMessages.push(
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Cover needed - 24th-28th Feb",
        body: "Hi, I'll be away for a training course next week. Would you be able to cover my Monday and Wednesday students? There are 6 lessons across the two days.",
        thread_id: tCId, parent_message_id: null, read_at: daysAgo(2, 10, 0),
        created_at: daysAgo(3, 14, 0),
      },
      {
        org_id, sender_user_id: teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Re: Cover needed - 24th-28th Feb",
        body: "I can do Monday but Wednesday is tricky as I have my own full schedule. Could Sarah cover Wednesday?",
        thread_id: tCId, parent_message_id: null, read_at: daysAgo(2, 11, 0),
        created_at: daysAgo(3, 15, 30),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Re: Cover needed - 24th-28th Feb",
        body: "That works! I'll ask Sarah about Wednesday. Thanks for taking Monday — I'll send you the student details and lesson plans.",
        thread_id: tCId, parent_message_id: null, read_at: null,
        created_at: daysAgo(2, 9, 0),
      }
    );

    // Thread D: Term planning (4 msgs)
    const tDId = crypto.randomUUID();
    internalMessages.push(
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Term 3 Timetable Planning",
        body: "Hi everyone! Time to start planning the Term 3 timetable. Could you let me know your availability for April-July? Any changes from the current schedule?",
        thread_id: tDId, parent_message_id: null, read_at: daysAgo(0, 12, 0),
        created_at: daysAgo(1, 10, 0),
      },
      {
        org_id, sender_user_id: teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Re: Term 3 Timetable Planning",
        body: "I can keep the same days but need to shift my Thursday start to 2pm instead of 1pm. Also, I'd like to add a new group theory class if there's room.",
        thread_id: tDId, parent_message_id: null, read_at: null,
        created_at: daysAgo(1, 14, 30),
      },
      {
        org_id, sender_user_id: teacher2.user_id || teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Re: Term 3 Timetable Planning",
        body: "My schedule stays the same. I do have 3 new students enquiring though — will we have capacity?",
        thread_id: tDId, parent_message_id: null, read_at: null,
        created_at: daysAgo(1, 16, 0),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher1.user_id, recipient_role: "teacher",
        subject: "Re: Term 3 Timetable Planning",
        body: "Great, Thursday 2pm works. And yes, we should have capacity for 3 more — I'll check room availability and get back to you both by Friday.",
        thread_id: tDId, parent_message_id: null, read_at: null,
        created_at: daysAgo(0, 9, 30),
      }
    );

    // Standalone internal messages (4)
    internalMessages.push(
      {
        org_id, sender_user_id: teacher1.user_id, sender_role: "teacher",
        recipient_user_id: ownerUserId, recipient_role: "owner",
        subject: "Piano tuning needed - Room 1",
        body: "The piano in Room 1 is sounding quite flat. Could we arrange for the tuner to come in before next week?",
        thread_id: null, parent_message_id: null, read_at: null,
        created_at: daysAgo(0, 11, 0),
      },
      {
        org_id, sender_user_id: ownerUserId, sender_role: "owner",
        recipient_user_id: teacher2.user_id || teacher1.user_id, recipient_role: "teacher",
        subject: "New sheet music order",
        body: "I've ordered the new ABRSM Grade 4 books. They should arrive by Thursday. I'll leave them in the staff room.",
        thread_id: null, parent_message_id: null, read_at: daysAgo(1, 10, 0),
        created_at: daysAgo(2, 16, 0),
      }
    );

    const { error: internalError } = await supabase
      .from("internal_messages")
      .insert(internalMessages);
    if (internalError) throw new Error(`Internal messages: ${internalError.message}`);

    // ══════════════════════════════════════════════════════════
    // 3. PARENT REQUESTS — 8 requests
    // ══════════════════════════════════════════════════════════

    const requests: any[] = [];
    const lessonIds = lessons.map(l => l.id);

    // Pending cancellation requests
    requests.push(
      {
        org_id, guardian_id: guardians[0].id, student_id: students[0].id,
        lesson_id: lessonIds[0] || null, request_type: "cancellation",
        subject: "Cancel lesson - family event",
        message: "We have a family wedding next Saturday and won't be able to make the 2pm lesson. Apologies for the short notice!",
        status: "pending", created_at: daysAgo(1, 20, 0),
      },
      {
        org_id, guardian_id: guardians[1].id, student_id: students[1].id,
        lesson_id: lessonIds[1] || null, request_type: "cancellation",
        subject: "Cancel Thursday lesson - illness",
        message: "Unfortunately the little one has come down with a cold. We'll need to cancel Thursday's lesson. Is it possible to get a make-up credit?",
        status: "pending", created_at: daysAgo(0, 8, 15),
      }
    );

    // Pending reschedule
    requests.push({
      org_id, guardian_id: guardians[2].id, student_id: students[2].id,
      lesson_id: lessonIds[2] || null, request_type: "reschedule",
      subject: "Move Monday lesson to Tuesday?",
      message: "School has changed their after-school club schedule. Could we permanently move from Monday 4pm to Tuesday 4pm?",
      status: "pending", created_at: daysAgo(2, 14, 0),
    });

    // Pending general enquiry
    requests.push({
      org_id, guardian_id: guardians[3]?.id || guardians[0].id,
      student_id: students[3]?.id || students[0].id,
      request_type: "general",
      subject: "Exam entry question",
      message: "When is the deadline for the Grade 3 exam entry? And what's the exam fee? We'd like to enter for the spring session.",
      status: "pending", created_at: daysAgo(0, 10, 30),
    });

    // Approved requests
    requests.push(
      {
        org_id, guardian_id: guardians[4]?.id || guardians[0].id,
        student_id: students[4]?.id || students[0].id,
        lesson_id: lessonIds[3] || null, request_type: "cancellation",
        subject: "Cancel next week - half term holiday",
        message: "We're going away for half term. Can we cancel next week's lesson please?",
        status: "approved", admin_response: "No problem! I've cancelled the lesson and added a make-up credit to the account. Enjoy your holiday!",
        responded_by: ownerUserId, responded_at: daysAgo(6, 10, 0),
        created_at: daysAgo(7, 19, 0),
      },
      {
        org_id, guardian_id: guardians[5]?.id || guardians[1].id,
        student_id: students[5]?.id || students[1].id,
        request_type: "reschedule",
        subject: "Can we try a later time slot?",
        message: "The 3pm slot is becoming difficult with the new school pickup time. Is there a 4:30pm slot available?",
        status: "approved", admin_response: "Yes! I've moved the lesson to Wednesdays at 4:30pm starting next week. The calendar has been updated.",
        responded_by: ownerUserId, responded_at: daysAgo(8, 11, 0),
        created_at: daysAgo(9, 10, 0),
      }
    );

    // Declined request
    requests.push({
      org_id, guardian_id: guardians[6]?.id || guardians[2].id,
      student_id: students[6]?.id || students[2].id,
      request_type: "cancellation",
      subject: "Cancel all lessons for March",
      message: "We'd like to pause lessons for the whole of March as we're evaluating whether to continue.",
      status: "declined", admin_response: "I understand you're thinking things over. Unfortunately our terms require a full term's notice for pausing. I'd love to chat about any concerns — perhaps we could adjust the lesson format instead?",
      responded_by: ownerUserId, responded_at: daysAgo(10, 14, 0),
      created_at: daysAgo(11, 9, 0),
    });

    // Resolved request
    requests.push({
      org_id, guardian_id: guardians[7]?.id || guardians[0].id,
      student_id: students[7]?.id || students[0].id,
      request_type: "general",
      subject: "Sibling discount available?",
      message: "Our younger child would also like to start piano lessons. Do you offer a sibling discount?",
      status: "approved", admin_response: "Yes! We offer 10% off the second child's lessons. I'll set up a profile for the new student — just let me know their details and we can find a suitable slot.",
      responded_by: ownerUserId, responded_at: daysAgo(4, 10, 0),
      created_at: daysAgo(5, 18, 30),
    });

    const { error: requestError } = await supabase
      .from("message_requests")
      .insert(requests);
    if (requestError) throw new Error(`Message requests: ${requestError.message}`);

    // ══════════════════════════════════════════════════════════
    // 4. BULK MESSAGE BATCH — 1 batch + 5 linked messages
    // ══════════════════════════════════════════════════════════

    const { data: batch, error: batchError } = await supabase
      .from("message_batches")
      .insert({
        org_id, name: "Spring Showcase Concert Invite", subject: "Spring Showcase Concert - 15th March",
        body: "You're warmly invited to our Spring Showcase Concert on Saturday 15th March at 2pm. All students will be performing a piece they've been preparing this term. Refreshments provided! Please RSVP by 8th March.",
        created_by: ownerUserId, status: "completed", recipient_count: 5, sent_count: 4, failed_count: 1,
        filter_criteria: { type: "all_guardians" },
      })
      .select("id")
      .single();

    if (batchError) throw new Error(`Batch: ${batchError.message}`);

    // 5 messages linked to the batch
    const batchMessages = guardians.slice(0, 5).map((g, i) => ({
      org_id, channel: "email", subject: "Spring Showcase Concert - 15th March",
      body: "You're warmly invited to our Spring Showcase Concert on Saturday 15th March at 2pm. All students will be performing a piece they've been preparing this term. Refreshments provided! Please RSVP by 8th March.",
      sender_user_id: ownerUserId, recipient_type: "guardian" as const, recipient_id: g.id,
      recipient_email: g.email!, recipient_name: g.full_name,
      related_id: studentGuardianMap.get(g.id) || students[i]?.id || students[0].id,
      message_type: "bulk", status: i === 3 ? "failed" : "sent",
      error_message: i === 3 ? "Recipient mailbox full" : null,
      sent_at: i === 3 ? null : daysAgo(3, 10, i * 2),
      created_at: daysAgo(3, 10, i * 2),
      batch_id: batch!.id, thread_id: null, parent_message_id: null,
    }));

    const { error: batchMsgError } = await supabase.from("message_log").insert(batchMessages);
    if (batchMsgError) throw new Error(`Batch messages: ${batchMsgError.message}`);

    const summary = {
      parent_messages: parentMessages.length,
      internal_messages: internalMessages.length,
      parent_requests: requests.length,
      batch_messages: batchMessages.length,
      total: parentMessages.length + internalMessages.length + requests.length + batchMessages.length,
    };

    console.log("Messaging stress test seeded:", summary);

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
