import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const record = payload.record;

    // Only process matched status
    if (!record || record.status !== "matched") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch waitlist entry with joins
    const { data: entry, error: entryError } = await supabase
      .from("make_up_waitlist")
      .select(`
        *,
        students!make_up_waitlist_student_id_fkey (first_name, last_name),
        guardians!make_up_waitlist_guardian_id_fkey (full_name, email)
      `)
      .eq("id", record.id)
      .single();

    if (entryError || !entry) {
      console.error("Failed to fetch waitlist entry:", entryError);
      return new Response(JSON.stringify({ error: "Entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch matched lesson details
    let matchedLessonInfo = "";
    if (entry.matched_lesson_id) {
      const { data: matchedLesson } = await supabase
        .from("lessons")
        .select(`
          title, start_at, end_at,
          locations!lessons_location_id_fkey (name),
          teachers!lessons_teacher_id_fkey (display_name)
        `)
        .eq("id", entry.matched_lesson_id)
        .single();

      if (matchedLesson) {
        const date = new Date(matchedLesson.start_at).toLocaleDateString(
          "en-GB",
          { weekday: "long", day: "numeric", month: "long" }
        );
        const time = new Date(matchedLesson.start_at).toLocaleTimeString(
          "en-GB",
          { hour: "2-digit", minute: "2-digit" }
        );
        const lessonTeachers = matchedLesson.teachers as { display_name: string } | null;
        const lessonLocations = matchedLesson.locations as { name: string } | null;
        const teacher = lessonTeachers?.display_name || "their teacher";
        const location = lessonLocations?.name || "the usual location";
        matchedLessonInfo = `${date} at ${time} with ${teacher} at ${location}`;
      }
    }

    const entryStudents = entry.students as { first_name: string; last_name: string } | null;
    const studentName = `${entryStudents?.first_name || ""} ${entryStudents?.last_name || ""}`.trim();
    const missedDate = new Date(entry.missed_lesson_date).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "long" }
    );

    const body = `${studentName} (missed ${entry.lesson_title} on ${missedDate}) can take the open slot on ${matchedLessonInfo}. Review and offer this to the parent.`;
    const subject = `Make-up match: ${studentName} → open slot`;

    // Get org admins
    const { data: admins } = await supabase
      .from("org_memberships")
      .select("user_id, profiles!inner(email, full_name)")
      .eq("org_id", entry.org_id)
      .in("role", ["owner", "admin"])
      .eq("status", "active");

    if (!admins || admins.length === 0) {
      console.log("No admins found for org", entry.org_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert internal_messages for each admin (the channel admins actually read)
    interface AdminWithProfile {
      user_id: string;
      role?: string;
      profiles: { email: string; full_name: string };
    }
    const messages = (admins as AdminWithProfile[]).map((admin) => ({
      org_id: entry.org_id,
      sender_user_id: admin.user_id,
      sender_role: "system",
      recipient_user_id: admin.user_id,
      recipient_role: admin.role || "admin",
      subject,
      body,
    }));

    const { error: insertError } = await supabase
      .from("internal_messages")
      .insert(messages);

    if (insertError) {
      console.error("Failed to insert internal_messages:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, notified: admins.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
