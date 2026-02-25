import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { matchHeaderToField, detectSourceSoftware, type SourceSoftware } from "../_shared/csv-field-aliases.ts";

// ─── Target fields for import mapping (expanded: 17 → 32) ───

const STUDENT_FIELDS = [
  { name: "first_name", required: true, description: "Student's first name" },
  { name: "last_name", required: true, description: "Student's last name" },
  { name: "email", required: false, description: "Student email address" },
  { name: "phone", required: false, description: "Student phone number" },
  { name: "dob", required: false, description: "Date of birth (any format)" },
  { name: "notes", required: false, description: "Notes about the student" },
  { name: "status", required: false, description: "Student status (Active/Inactive)" },
  { name: "gender", required: false, description: "Student gender" },
  { name: "start_date", required: false, description: "Date student started lessons" },
  { name: "tags", required: false, description: "Tags or categories (comma-separated)" },
];

const GUARDIAN_FIELDS = [
  { name: "guardian_name", required: false, description: "Full name of primary guardian/parent" },
  { name: "guardian_first_name", required: false, description: "Guardian/parent first name (auto-combined with last name)" },
  { name: "guardian_last_name", required: false, description: "Guardian/parent last name (auto-combined with first name)" },
  { name: "guardian_email", required: false, description: "Guardian email address" },
  { name: "guardian_phone", required: false, description: "Guardian phone number" },
  { name: "relationship", required: false, description: "Relationship (mother, father, guardian, other)" },
];

const GUARDIAN2_FIELDS = [
  { name: "guardian2_name", required: false, description: "Second guardian/parent full name" },
  { name: "guardian2_first_name", required: false, description: "Second guardian first name (auto-combined)" },
  { name: "guardian2_last_name", required: false, description: "Second guardian last name (auto-combined)" },
  { name: "guardian2_email", required: false, description: "Second guardian email address" },
  { name: "guardian2_phone", required: false, description: "Second guardian phone number" },
  { name: "guardian2_relationship", required: false, description: "Relationship of second guardian" },
];

const TEACHING_FIELDS = [
  { name: "instrument", required: false, description: "Instrument being taught" },
  { name: "lesson_duration", required: false, description: "Default lesson duration in minutes" },
  { name: "teacher_name", required: false, description: "Teacher name for assignment" },
  { name: "location_name", required: false, description: "Location/school name" },
  { name: "price", required: false, description: "Lesson price (e.g., £24.50)" },
  { name: "grade_level", required: false, description: "Skill level or exam grade (e.g., Grade 3, Beginner)" },
];

const LESSON_FIELDS = [
  { name: "lesson_day", required: false, description: "Day of the week for recurring lesson (Monday-Sunday)" },
  { name: "lesson_time", required: false, description: "Start time for lesson (HH:MM format)" },
];

const ADDRESS_FIELDS = [
  { name: "address_line_1", required: false, description: "Street address line 1" },
  { name: "address_line_2", required: false, description: "Street address line 2" },
  { name: "city", required: false, description: "City or town" },
  { name: "postcode", required: false, description: "Postal/zip code" },
  { name: "country", required: false, description: "Country" },
];

const ALL_TARGET_FIELDS = [
  ...STUDENT_FIELDS, ...GUARDIAN_FIELDS, ...GUARDIAN2_FIELDS,
  ...TEACHING_FIELDS, ...LESSON_FIELDS, ...ADDRESS_FIELDS,
];

// ─── AI Mapping Prompt (comprehensive) ───

const MAPPING_PROMPT = `You are an expert AI that maps CSV column headers to database fields for LessonLoop, a music lesson management system. You must handle exports from all major competitors.

Given CSV headers, sample data, and optionally a source software identifier, determine the best mapping.

TARGET FIELDS:
${ALL_TARGET_FIELDS.map(f => `- ${f.name} (${f.required ? "REQUIRED" : "optional"}): ${f.description}`).join("\n")}

KNOWN SOURCE SOFTWARE COLUMN FORMATS:

[MyMusicStaff]
First Name, Last Name, Email, Mobile Phone, Birthday, Status, Instrument, Default Duration, School, Teacher, Price, Note
Parent Contact 1 First Name, Parent Contact 1 Last Name, Parent Contact 1 Email, Parent Contact 1 Mobile Phone
Parent Contact 2 First Name, Parent Contact 2 Last Name, Parent Contact 2 Email, Parent Contact 2 Mobile Phone

[Opus1]
student_first_name, student_last_name, student_email, student_gender, student_birthdate
student_full_address, student_street, student_zip, student_city, student_state, student_country
student_phone_1, student_phone_2, student_note, student_status, student_start_date, student_end_date, student_tag

[Teachworks]
First Name, Last Name, Email, Phone, Family (combined guardian name)

[Duet Partner]
Contact info, Birthday, School, Skill level, Age

CRITICAL RULES:
1. Each CSV header maps to at most ONE target field
2. Each target field can only be mapped from ONE CSV header
3. first_name and last_name are REQUIRED
4. COMBINED NAME: If you see "Student Name", "Name", "Full Name" — map to first_name with transform: "split_name". The system splits "John Smith" → first_name + last_name
5. GUARDIAN NAMES: "Parent Contact 1 First Name" → guardian_first_name, "Parent Contact 1 Last Name" → guardian_last_name (system combines)
6. SECOND GUARDIAN: "Parent Contact 2 *" fields → guardian2_* fields
7. AMBIGUOUS EMAIL: Just "Email" → student email. Contains "parent"/"guardian"/"family" → guardian_email
8. AMBIGUOUS PHONE: Same logic as email
9. DATE DETECTION: Accept any format — DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
10. ADDRESS: street/city/postcode/country → address_* fields
11. SKILL LEVEL: "Skill level", "Grade", "Level" → grade_level
12. CONSERVATIVE: If genuinely unsure, set target to null. Better to skip than mis-map
13. If sourceSoftware is provided, prioritize that platform's known format

Respond with ONLY a JSON object:
{
  "mappings": [
    { "csv_header": "Column Name", "target_field": "field_name" | null, "confidence": 0.0-1.0, "transform": "split_name" | null }
  ],
  "warnings": ["Any issues or suggestions"],
  "has_guardian_data": true/false,
  "has_lesson_data": true/false,
  "has_teaching_data": true/false,
  "detected_source": "mymusicstaff" | "opus1" | "teachworks" | null
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

    const { headers, sampleRows, orgId, sourceSoftware } = await req.json();

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

    // Auto-detect source software if not explicitly specified
    const effectiveSource: SourceSoftware | undefined =
      (sourceSoftware && sourceSoftware !== "auto" ? sourceSoftware : undefined) as SourceSoftware | undefined
      || detectSourceSoftware(headers) || undefined;

    // Build context for AI
    const sampleDataContext = headers.map((header: string, idx: number) => {
      const samples = (sampleRows || [])
        .slice(0, 3)
        .map((row: string[]) => row[idx] || "")
        .filter(Boolean);
      return `"${header}": ${samples.length > 0 ? samples.map((s: string) => `"${s}"`).join(", ") : "(no samples)"}`;
    }).join("\n");

    const userPrompt = `Map these CSV columns to target fields.
${effectiveSource ? `Source software: ${effectiveSource}` : "Source software: auto-detect from headers and data."}

CSV HEADERS AND SAMPLE DATA:
${sampleDataContext}

Analyze the headers and sample values to determine the best mapping.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // ─── Heuristic fallback using comprehensive alias dictionary ───
      const usedTargets = new Set<string>();
      const heuristicMappings = headers.map((header: string) => {
        const match = matchHeaderToField(header, usedTargets, effectiveSource);
        if (match.targetField) {
          usedTargets.add(match.targetField);
        }
        return {
          csv_header: header,
          target_field: match.targetField,
          confidence: match.confidence,
          transform: match.transform || null,
        };
      });

      // Auto-combine split guardian first/last names into guardian_name
      const g1First = heuristicMappings.find((m: any) => m.target_field === "guardian_first_name");
      const g1Last = heuristicMappings.find((m: any) => m.target_field === "guardian_last_name");
      if (g1First && g1Last) {
        g1First.target_field = "guardian_name";
        g1First.transform = "combine_guardian_name";
        (g1First as any).combine_with = g1Last.csv_header;
        g1Last.target_field = null;
        g1Last.confidence = 0;
        g1Last.transform = null;
      }

      // Same for guardian 2
      const g2First = heuristicMappings.find((m: any) => m.target_field === "guardian2_first_name");
      const g2Last = heuristicMappings.find((m: any) => m.target_field === "guardian2_last_name");
      if (g2First && g2Last) {
        g2First.target_field = "guardian2_name";
        g2First.transform = "combine_guardian2_name";
        (g2First as any).combine_with = g2Last.csv_header;
        g2Last.target_field = null;
        g2Last.confidence = 0;
        g2Last.transform = null;
      }

      const warnings: string[] = [];
      if (!LOVABLE_API_KEY) {
        warnings.push("Using smart heuristic matching. Please verify mappings.");
      }
      if (effectiveSource) {
        warnings.push(`Detected source format: ${effectiveSource}`);
      }

      return new Response(JSON.stringify({
        mappings: heuristicMappings,
        warnings,
        has_guardian_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("guardian")),
        has_lesson_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("lesson")),
        has_teaching_data: heuristicMappings.some((m: any) => ["instrument", "lesson_duration", "teacher_name", "location_name", "price", "grade_level"].includes(m.target_field)),
        detected_source: effectiveSource || null,
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
      detected_source: mappingResult.detected_source || effectiveSource || null,
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
