import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  notes?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  relationship?: string;
  lesson_day?: string;
  lesson_time?: string;
  lesson_duration?: string;
  instrument?: string;
}

interface ImportResult {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
  lessonsCreated: number;
  errors: string[];
  details: { row: number; student: string; status: string; error?: string }[];
}

// Parse UK date format (DD/MM/YYYY) or ISO format
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try UK format first
  const ukMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Try ISO format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return dateStr.split("T")[0];
  }
  
  return null;
}

// Parse time format (HH:MM or H:MM)
function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return null;
}

// Map day name to ISO day number (1=Monday)
function parseDayOfWeek(day: string): number | null {
  const days: Record<string, number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 7,
    mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7,
  };
  return days[day.toLowerCase().trim()] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Use anon client for auth check
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rows, mappings, orgId, teacherUserId } = await req.json();

    if (!orgId || !rows || !Array.isArray(rows) || !mappings) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org access
    const { data: membership } = await supabaseAuth
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Import requires owner or admin role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for inserts to bypass RLS during bulk import
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: ImportResult = {
      studentsCreated: 0,
      guardiansCreated: 0,
      linksCreated: 0,
      lessonsCreated: 0,
      errors: [],
      details: [],
    };

    // Process each row
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx] as ImportRow;
      
      try {
        // Validate required fields
        if (!row.first_name || !row.last_name) {
          result.errors.push(`Row ${rowIdx + 1}: Missing first_name or last_name`);
          result.details.push({
            row: rowIdx + 1,
            student: "Unknown",
            status: "error",
            error: "Missing required name fields",
          });
          continue;
        }

        const studentName = `${row.first_name} ${row.last_name}`;

        // 1. Create student
        const studentData: any = {
          org_id: orgId,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          status: "active",
        };
        
        if (row.email) studentData.email = row.email.trim();
        if (row.phone) studentData.phone = row.phone.trim();
        if (row.dob) {
          const parsedDob = parseDate(row.dob);
          if (parsedDob) studentData.dob = parsedDob;
        }
        if (row.notes) studentData.notes = row.notes.trim();

        const { data: student, error: studentError } = await supabase
          .from("students")
          .insert(studentData)
          .select("id")
          .single();

        if (studentError) {
          throw new Error(`Student insert failed: ${studentError.message}`);
        }

        result.studentsCreated++;

        // 2. Create guardian if provided
        let guardianId: string | null = null;
        if (row.guardian_name?.trim()) {
          const guardianData: any = {
            org_id: orgId,
            full_name: row.guardian_name.trim(),
          };
          if (row.guardian_email) guardianData.email = row.guardian_email.trim();
          if (row.guardian_phone) guardianData.phone = row.guardian_phone.trim();

          // Check if guardian with same email exists
          if (guardianData.email) {
            const { data: existingGuardian } = await supabase
              .from("guardians")
              .select("id")
              .eq("org_id", orgId)
              .eq("email", guardianData.email)
              .maybeSingle();

            if (existingGuardian) {
              guardianId = existingGuardian.id;
            }
          }

          if (!guardianId) {
            const { data: guardian, error: guardianError } = await supabase
              .from("guardians")
              .insert(guardianData)
              .select("id")
              .single();

            if (guardianError) {
              result.errors.push(`Row ${rowIdx + 1}: Guardian creation failed - ${guardianError.message}`);
            } else {
              guardianId = guardian.id;
              result.guardiansCreated++;
            }
          }

          // 3. Link student to guardian
          if (guardianId) {
            const relationship = row.relationship?.toLowerCase().trim() || "guardian";
            const validRelationships = ["mother", "father", "guardian", "other"];
            const finalRelationship = validRelationships.includes(relationship) ? relationship : "guardian";

            const { error: linkError } = await supabase
              .from("student_guardians")
              .insert({
                org_id: orgId,
                student_id: student.id,
                guardian_id: guardianId,
                relationship: finalRelationship,
                is_primary_payer: true,
              });

            if (linkError) {
              result.errors.push(`Row ${rowIdx + 1}: Guardian link failed - ${linkError.message}`);
            } else {
              result.linksCreated++;
            }
          }
        }

        // 4. Create recurring lesson if provided
        if (row.lesson_day && row.lesson_time && teacherUserId) {
          const dayOfWeek = parseDayOfWeek(row.lesson_day);
          const lessonTime = parseTime(row.lesson_time);
          const duration = parseInt(row.lesson_duration || "30", 10) || 30;

          if (dayOfWeek && lessonTime) {
            // Calculate next occurrence of this day
            const today = new Date();
            const todayDay = today.getDay() === 0 ? 7 : today.getDay(); // Convert to ISO
            let daysUntilLesson = dayOfWeek - todayDay;
            if (daysUntilLesson <= 0) daysUntilLesson += 7;

            const lessonDate = new Date(today);
            lessonDate.setDate(today.getDate() + daysUntilLesson);
            const [hours, minutes] = lessonTime.split(":").map(Number);
            lessonDate.setHours(hours, minutes, 0, 0);

            const endDate = new Date(lessonDate);
            endDate.setMinutes(endDate.getMinutes() + duration);

            const lessonTitle = row.instrument 
              ? `${row.instrument} lesson - ${studentName}`
              : `Lesson - ${studentName}`;

            // Create recurrence rule first
            const { data: recurrence, error: recurrenceError } = await supabase
              .from("recurrence_rules")
              .insert({
                org_id: orgId,
                pattern_type: "weekly",
                days_of_week: [dayOfWeek],
                interval_weeks: 1,
                start_date: lessonDate.toISOString().split("T")[0],
                timezone: "Europe/London",
              })
              .select("id")
              .single();

            if (!recurrenceError && recurrence) {
              const { data: lesson, error: lessonError } = await supabase
                .from("lessons")
                .insert({
                  org_id: orgId,
                  title: lessonTitle,
                  start_at: lessonDate.toISOString(),
                  end_at: endDate.toISOString(),
                  teacher_user_id: teacherUserId,
                  lesson_type: "private",
                  status: "scheduled",
                  created_by: user.id,
                  recurrence_id: recurrence.id,
                })
                .select("id")
                .single();

              if (lessonError) {
                result.errors.push(`Row ${rowIdx + 1}: Lesson creation failed - ${lessonError.message}`);
              } else if (lesson) {
                // Add student as participant
                await supabase.from("lesson_participants").insert({
                  org_id: orgId,
                  lesson_id: lesson.id,
                  student_id: student.id,
                });
                result.lessonsCreated++;
              }
            }
          }
        }

        result.details.push({
          row: rowIdx + 1,
          student: studentName,
          status: "success",
        });

      } catch (error: any) {
        result.errors.push(`Row ${rowIdx + 1}: ${error.message}`);
        result.details.push({
          row: rowIdx + 1,
          student: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unknown",
          status: "error",
          error: error.message,
        });
      }
    }

    // Log to audit
    await supabase.from("audit_log").insert({
      org_id: orgId,
      entity_type: "import",
      action: "csv_import",
      actor_user_id: user.id,
      after: {
        students_created: result.studentsCreated,
        guardians_created: result.guardiansCreated,
        links_created: result.linksCreated,
        lessons_created: result.lessonsCreated,
        error_count: result.errors.length,
      },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("CSV import error:", error);
    const message = error instanceof Error ? error.message : "Import failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
