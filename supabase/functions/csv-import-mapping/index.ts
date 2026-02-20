import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";

// Target fields for import mapping
const STUDENT_FIELDS = [
  { name: "first_name", required: true, description: "Student's first name" },
  { name: "last_name", required: true, description: "Student's last name" },
  { name: "email", required: false, description: "Student email address" },
  { name: "phone", required: false, description: "Student phone number" },
  { name: "dob", required: false, description: "Date of birth (YYYY-MM-DD or DD/MM/YYYY)" },
  { name: "notes", required: false, description: "Notes about the student" },
  { name: "status", required: false, description: "Student status (Active/Inactive)" },
];

const GUARDIAN_FIELDS = [
  { name: "guardian_name", required: false, description: "Full name of guardian/parent" },
  { name: "guardian_email", required: false, description: "Guardian email address" },
  { name: "guardian_phone", required: false, description: "Guardian phone number" },
  { name: "relationship", required: false, description: "Relationship (mother, father, guardian, other)" },
];

const TEACHING_FIELDS = [
  { name: "instrument", required: false, description: "Instrument being taught" },
  { name: "lesson_duration", required: false, description: "Default lesson duration in minutes" },
  { name: "teacher_name", required: false, description: "Teacher name for assignment" },
  { name: "location_name", required: false, description: "Location/school name" },
  { name: "price", required: false, description: "Lesson price (e.g., £24.50)" },
];

const LESSON_FIELDS = [
  { name: "lesson_day", required: false, description: "Day of the week for recurring lesson (Monday-Sunday)" },
  { name: "lesson_time", required: false, description: "Start time for lesson (HH:MM format)" },
];

const ALL_TARGET_FIELDS = [...STUDENT_FIELDS, ...GUARDIAN_FIELDS, ...TEACHING_FIELDS, ...LESSON_FIELDS];

const MAPPING_PROMPT = `You are an AI assistant that maps CSV column headers to database fields for a music lesson management system.
This system is commonly used to import data from My Music Staff and similar platforms.

Given CSV headers and sample data, determine the best mapping to these target fields:

STUDENT FIELDS (primary):
${STUDENT_FIELDS.map(f => `- ${f.name} (${f.required ? "REQUIRED" : "optional"}): ${f.description}`).join("\n")}

GUARDIAN FIELDS (optional - for linking parents/guardians):
${GUARDIAN_FIELDS.map(f => `- ${f.name}: ${f.description}`).join("\n")}

TEACHING FIELDS (optional - for setting up teaching defaults):
${TEACHING_FIELDS.map(f => `- ${f.name}: ${f.description}`).join("\n")}

LESSON FIELDS (optional - for creating recurring lesson schedules):
${LESSON_FIELDS.map(f => `- ${f.name}: ${f.description}`).join("\n")}

KNOWN SOURCE MAPPINGS (My Music Staff):
- "Last Name" → last_name
- "First Name" → first_name
- "Email" → email (student email, NOT parent)
- "Mobile Phone" → phone
- "Birthday" → dob
- "Status" → status (Active/Inactive)
- "Instrument" → instrument
- "Default Duration" → lesson_duration
- "School" → location_name
- "Teacher" → teacher_name
- "Price" → price
- "Note" → notes
- "Parent Contact 1 First Name" + "Parent Contact 1 Last Name" → guardian_name (combine if needed)
- "Parent Contact 1 Email" → guardian_email
- "Parent Contact 1 Mobile Phone" → guardian_phone

RULES:
1. Each CSV header can map to at most ONE target field
2. Each target field can be mapped from at most ONE CSV header
3. first_name and last_name are REQUIRED for students
4. For "Parent Contact 1 First Name" and "Parent Contact 1 Last Name", combine them into guardian_name
5. Be conservative - if unsure, set target to null (user will map manually)
6. Use UK date formats (DD/MM/YYYY) when interpreting dates
7. Price columns contain UK currency (£ symbol)
8. Prefer "Parent Contact 1" fields over "Parent" column for guardian data

Respond with a JSON object containing:
{
  "mappings": [
    { "csv_header": "Column Name", "target_field": "first_name" | null, "confidence": 0.0-1.0 }
  ],
  "warnings": ["Any issues or suggestions"],
  "has_guardian_data": true/false,
  "has_lesson_data": true/false,
  "has_teaching_data": true/false
}`;

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, "csv-import");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const { headers, sampleRows, orgId } = await req.json();

    if (!orgId || !headers || !Array.isArray(headers)) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org access
    const { data: membership } = await supabase
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

    // Build context for AI
    const sampleDataContext = headers.map((header: string, idx: number) => {
      const samples = (sampleRows || [])
        .slice(0, 3)
        .map((row: string[]) => row[idx] || "")
        .filter(Boolean);
      return `"${header}": ${samples.length > 0 ? samples.map((s: string) => `"${s}"`).join(", ") : "(no samples)"}`;
    }).join("\n");

    const userPrompt = `Map these CSV columns to target fields:

CSV HEADERS AND SAMPLE DATA:
${sampleDataContext}

Analyze the headers and sample values to determine the best mapping.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to simple heuristic mapping (optimized for My Music Staff)
      const usedTargets = new Set<string>();
      const heuristicMappings = headers.map((header: string) => {
        const h = header.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "");
        const original = header.toLowerCase();
        let target: string | null = null;
        let confidence = 0;

        // My Music Staff specific mappings
        if (original === "first name" || h === "firstname") {
          target = "first_name"; confidence = 0.95;
        } else if (original === "last name" || h === "lastname" || h === "surname") {
          target = "last_name"; confidence = 0.95;
        } else if (original === "email" || (h.includes("email") && !h.includes("parent") && !h.includes("guardian") && !h.includes("contact"))) {
          target = "email"; confidence = 0.85;
        } else if (original === "mobile phone" || (h.includes("phone") && !h.includes("parent") && !h.includes("guardian") && !h.includes("contact"))) {
          target = "phone"; confidence = 0.8;
        } else if (original === "birthday" || h.includes("birthday") || h.includes("dob") || h.includes("dateofbirth")) {
          target = "dob"; confidence = 0.9;
        } else if (original === "status") {
          target = "status"; confidence = 0.9;
        } else if (original === "instrument") {
          target = "instrument"; confidence = 0.95;
        } else if (original === "default duration" || h === "defaultduration") {
          target = "lesson_duration"; confidence = 0.95;
        } else if (original === "school" || h === "school") {
          target = "location_name"; confidence = 0.85;
        } else if (original === "teacher") {
          target = "teacher_name"; confidence = 0.9;
        } else if (original === "price") {
          target = "price"; confidence = 0.9;
        } else if (original === "note" || h === "note") {
          target = "notes"; confidence = 0.85;
        } else if (original === "parent contact 1 email" || h === "parentcontact1email") {
          target = "guardian_email"; confidence = 0.95;
        } else if (original === "parent contact 1 mobile phone" || h === "parentcontact1mobilephone") {
          target = "guardian_phone"; confidence = 0.9;
        } else if (original === "parent contact 1 first name" || original === "parent contact 1 last name") {
          // We'll combine these - only map first name to trigger combination
          if (original === "parent contact 1 first name" && !usedTargets.has("guardian_name")) {
            target = "guardian_name"; confidence = 0.85;
          }
        }
        // Generic fallbacks
        else if (h.includes("parentname") || h.includes("guardianname")) {
          target = "guardian_name"; confidence = 0.8;
        } else if ((h.includes("parent") || h.includes("guardian")) && h.includes("email")) {
          target = "guardian_email"; confidence = 0.75;
        } else if ((h.includes("parent") || h.includes("guardian")) && h.includes("phone")) {
          target = "guardian_phone"; confidence = 0.7;
        }

        // Prevent duplicate target assignments
        if (target && usedTargets.has(target)) {
          target = null;
          confidence = 0;
        }
        if (target) usedTargets.add(target);

        return { csv_header: header, target_field: target, confidence };
      });

      return new Response(JSON.stringify({
        mappings: heuristicMappings,
        warnings: ["AI mapping unavailable - using heuristic matching. Please verify mappings."],
        has_guardian_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("guardian")),
        has_lesson_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("lesson")),
        has_teaching_data: heuristicMappings.some((m: any) => ["instrument", "lesson_duration", "teacher_name", "location_name", "price"].includes(m.target_field)),
        target_fields: ALL_TARGET_FIELDS,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI for mapping
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: MAPPING_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    let mappingResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mappingResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI mapping response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ...mappingResult,
      target_fields: ALL_TARGET_FIELDS,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("CSV mapping error:", error);
    const corsHeaders = getCorsHeaders(req);
    const message = error instanceof Error ? error.message : "Mapping failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
