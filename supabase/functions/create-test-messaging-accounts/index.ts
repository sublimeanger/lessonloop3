import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const TEST_TEACHER_EMAIL = "test-teacher-msg@lessonloop.test";
const TEST_TEACHER_PASSWORD = "TestTeacher2026!";
const TEST_PARENT_EMAIL = "test-parent-msg@lessonloop.test";
const TEST_PARENT_PASSWORD = "TestParent2026!";

Deno.serve(async (req) => {
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
    // Verify authorization - must have valid JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, owner_user_id, student_id } = await req.json();

    if (!org_id || !owner_user_id) {
      return new Response(
        JSON.stringify({ error: "org_id and owner_user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the caller is actually an owner of the org
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is owner of this org
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", org_id)
      .eq("status", "active")
      .single();

    if (memberError || !membership || membership.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only organization owners can create test accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get a student to link the parent to if not provided
    let targetStudentId = student_id;
    if (!targetStudentId) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, first_name, last_name")
        .eq("org_id", org_id)
        .limit(1);
      
      if (students && students.length > 0) {
        targetStudentId = students[0].id;
        console.log(`Using student: ${students[0].first_name} ${students[0].last_name}`);
      }
    }

    const results: {
      teacher?: { email: string; password: string; user_id: string };
      parent?: { email: string; password: string; user_id: string; guardian_id?: string; student_id?: string };
      seeded_data?: { internal_messages: number; message_requests: number; outbound_messages: number };
      errors: string[];
    } = { errors: [] };

    // ============================================
    // Step 1: Create Test Teacher Account
    // ============================================
    console.log("Creating test teacher account...");
    
    // Check if teacher already exists
    const { data: existingTeacherAuth } = await supabaseAdmin.auth.admin.listUsers();
    const existingTeacher = existingTeacherAuth?.users?.find(u => u.email === TEST_TEACHER_EMAIL);
    
    let teacherUserId: string | null = null;
    
    if (existingTeacher) {
      teacherUserId = existingTeacher.id;
      console.log("Teacher account already exists, reusing:", teacherUserId);
    } else {
      // Create auth user for teacher
      const { data: teacherAuth, error: teacherAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_TEACHER_EMAIL,
        password: TEST_TEACHER_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Test Teacher" }
      });

      if (teacherAuthError) {
        results.errors.push(`Teacher auth error: ${teacherAuthError.message}`);
      } else {
        teacherUserId = teacherAuth.user?.id ?? null;
      }
    }

    if (teacherUserId) {
      // Create invite for teacher
      const teacherToken = crypto.randomUUID();
      const { error: teacherInviteError } = await supabaseAdmin
        .from("invites")
        .upsert({
          org_id,
          email: TEST_TEACHER_EMAIL,
          role: "teacher",
          token: teacherToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          accepted_at: new Date().toISOString() // Mark as already accepted
        }, { onConflict: "token" });

      if (teacherInviteError) {
        results.errors.push(`Teacher invite error: ${teacherInviteError.message}`);
      }

      // Create org membership
      await supabaseAdmin.from("org_memberships").upsert(
        { org_id, user_id: teacherUserId, role: "teacher", status: "active" },
        { onConflict: "org_id,user_id" }
      );

      // Create teacher record
      const { error: teacherRecordError } = await supabaseAdmin
        .from("teachers")
        .upsert({
          org_id,
          user_id: teacherUserId,
          display_name: "Test Teacher",
          email: TEST_TEACHER_EMAIL,
          status: "active",
        }, { onConflict: "org_id,user_id" });

      if (teacherRecordError) {
        console.error("Teacher record error:", teacherRecordError);
      }

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: teacherUserId,
          email: TEST_TEACHER_EMAIL,
          full_name: "Test Teacher",
          current_org_id: org_id,
          has_completed_onboarding: true
        }, { onConflict: "id" });

      results.teacher = {
        email: TEST_TEACHER_EMAIL,
        password: TEST_TEACHER_PASSWORD,
        user_id: teacherUserId
      };
    }

    // ============================================
    // Step 2: Create Test Parent Account
    // ============================================
    console.log("Creating test parent account...");
    
    const existingParent = existingTeacherAuth?.users?.find(u => u.email === TEST_PARENT_EMAIL);
    
    let parentUserId: string | null = null;
    
    if (existingParent) {
      parentUserId = existingParent.id;
      console.log("Parent account already exists, reusing:", parentUserId);
    } else {
      // Create auth user for parent
      const { data: parentAuth, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_PARENT_EMAIL,
        password: TEST_PARENT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Test Parent" }
      });

      if (parentAuthError) {
        results.errors.push(`Parent auth error: ${parentAuthError.message}`);
      } else {
        parentUserId = parentAuth.user?.id ?? null;
      }
    }

    if (parentUserId) {
      // Create invite for parent
      const parentToken = crypto.randomUUID();
      await supabaseAdmin
        .from("invites")
        .upsert({
          org_id,
          email: TEST_PARENT_EMAIL,
          role: "parent",
          token: parentToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          accepted_at: new Date().toISOString(),
          related_student_id: targetStudentId
        }, { onConflict: "token" });

      // Create org membership
      await supabaseAdmin.from("org_memberships").upsert(
        { org_id, user_id: parentUserId, role: "parent", status: "active" },
        { onConflict: "org_id,user_id" }
      );

      // Create guardian record
      let guardianId: string | null = null;
      const { data: existingGuardian } = await supabaseAdmin
        .from("guardians")
        .select("id")
        .eq("org_id", org_id)
        .eq("user_id", parentUserId)
        .maybeSingle();

      if (existingGuardian) {
        guardianId = existingGuardian.id;
      } else {
        const { data: newGuardian } = await supabaseAdmin
          .from("guardians")
          .insert({
            org_id,
            user_id: parentUserId,
            full_name: "Test Parent",
            email: TEST_PARENT_EMAIL,
          })
          .select("id")
          .single();
        
        guardianId = newGuardian?.id ?? null;
      }

      // Link guardian to student
      if (guardianId && targetStudentId) {
        const { data: existingLink } = await supabaseAdmin
          .from("student_guardians")
          .select("id")
          .eq("guardian_id", guardianId)
          .eq("student_id", targetStudentId)
          .maybeSingle();

        if (!existingLink) {
          await supabaseAdmin.from("student_guardians").insert({
            guardian_id: guardianId,
            student_id: targetStudentId,
            relationship: "parent",
            is_primary_payer: true,
          });
        }
      }

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: parentUserId,
          email: TEST_PARENT_EMAIL,
          full_name: "Test Parent",
          current_org_id: org_id,
          has_completed_onboarding: true
        }, { onConflict: "id" });

      results.parent = {
        email: TEST_PARENT_EMAIL,
        password: TEST_PARENT_PASSWORD,
        user_id: parentUserId,
        guardian_id: guardianId ?? undefined,
        student_id: targetStudentId ?? undefined
      };
    }

    // ============================================
    // Step 3: Seed Test Messaging Data
    // ============================================
    console.log("Seeding test messaging data...");
    
    let internalMsgCount = 0;
    let requestCount = 0;
    let outboundCount = 0;

    // Seed internal messages (if teacher exists)
    if (teacherUserId) {
      // Teacher -> Owner message
      const { error: intMsg1Error } = await supabaseAdmin
        .from("internal_messages")
        .insert({
          org_id,
          sender_user_id: teacherUserId,
          sender_role: "teacher",
          recipient_user_id: owner_user_id,
          recipient_role: "owner",
          subject: "Question about next term schedule",
          body: "Hi, I wanted to ask about the schedule for next term. Will my Monday slots remain the same?",
        });
      
      if (!intMsg1Error) internalMsgCount++;

      // Owner -> Teacher reply
      const { error: intMsg2Error } = await supabaseAdmin
        .from("internal_messages")
        .insert({
          org_id,
          sender_user_id: owner_user_id,
          sender_role: "owner",
          recipient_user_id: teacherUserId,
          recipient_role: "teacher",
          subject: "Re: Question about next term schedule",
          body: "Hi Test Teacher, yes your Monday slots will remain the same. Let me know if you need any changes!",
        });
      
      if (!intMsg2Error) internalMsgCount++;
    }

    // Seed message requests (if parent exists with guardian)
    if (parentUserId && results.parent?.guardian_id) {
      // Get a lesson for the student
      let lessonId: string | null = null;
      if (targetStudentId) {
        const { data: lessons } = await supabaseAdmin
          .from("lessons")
          .select("id")
          .eq("org_id", org_id)
          .gte("start_at", new Date().toISOString())
          .limit(1);
        
        lessonId = lessons?.[0]?.id ?? null;
      }

      // Parent submits a request
      const { error: req1Error } = await supabaseAdmin
        .from("message_requests")
        .insert({
          org_id,
          guardian_id: results.parent.guardian_id,
          student_id: targetStudentId,
          lesson_id: lessonId,
          request_type: "general",
          subject: "Question about practice materials",
          message: "Could you please send me the practice materials for this week's lessons? Thank you!",
          status: "pending",
        });
      
      if (!req1Error) requestCount++;

      // Another request that's already responded to
      const { error: req2Error } = await supabaseAdmin
        .from("message_requests")
        .insert({
          org_id,
          guardian_id: results.parent.guardian_id,
          student_id: targetStudentId,
          request_type: "cancellation",
          subject: "Need to cancel lesson on Friday",
          message: "We have a family commitment and need to cancel the Friday lesson. Is this possible?",
          status: "approved",
          admin_response: "No problem, I've cancelled the Friday lesson. A make-up credit has been added to your account.",
          responded_by: owner_user_id,
          responded_at: new Date().toISOString(),
        });
      
      if (!req2Error) requestCount++;
    }

    // Seed outbound messages (if parent guardian exists)
    if (results.parent?.guardian_id) {
      const { error: outMsg1Error } = await supabaseAdmin
        .from("message_log")
        .insert({
          org_id,
          channel: "email",
          subject: "Welcome to our music school!",
          body: "Dear Test Parent,\n\nWelcome to Jamie McKaye's Teaching Agency! We're excited to have your child join us.\n\nBest regards,\nJamie",
          sender_user_id: owner_user_id,
          recipient_type: "guardian",
          recipient_id: results.parent.guardian_id,
          recipient_email: TEST_PARENT_EMAIL,
          recipient_name: "Test Parent",
          message_type: "manual",
          status: "sent",
          sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        });
      
      if (!outMsg1Error) outboundCount++;

      const { error: outMsg2Error } = await supabaseAdmin
        .from("message_log")
        .insert({
          org_id,
          channel: "email",
          subject: "Reminder: Lesson tomorrow at 3pm",
          body: "Hi Test Parent,\n\nJust a friendly reminder that your child has a lesson scheduled for tomorrow at 3pm.\n\nSee you then!",
          sender_user_id: owner_user_id,
          recipient_type: "guardian",
          recipient_id: results.parent.guardian_id,
          recipient_email: TEST_PARENT_EMAIL,
          recipient_name: "Test Parent",
          message_type: "reminder",
          status: "sent",
          sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        });
      
      if (!outMsg2Error) outboundCount++;
    }

    results.seeded_data = {
      internal_messages: internalMsgCount,
      message_requests: requestCount,
      outbound_messages: outboundCount,
    };

    console.log("Test accounts created successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        instructions: {
          teacher: `Login with ${TEST_TEACHER_EMAIL} / ${TEST_TEACHER_PASSWORD}`,
          parent: `Login with ${TEST_PARENT_EMAIL} / ${TEST_PARENT_PASSWORD}`,
          owner: "Use your existing owner account"
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
