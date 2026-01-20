import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Target fields for import mapping
const STUDENT_FIELDS = [
  { name: "first_name", required: true, description: "Student's first name" },
  { name: "last_name", required: true, description: "Student's last name" },
  { name: "email", required: false, description: "Student email address" },
  { name: "phone", required: false, description: "Student phone number" },
  { name: "dob", required: false, description: "Date of birth (YYYY-MM-DD or DD/MM/YYYY)" },
  { name: "notes", required: false, description: "Notes about the student" },
];

const GUARDIAN_FIELDS = [
  { name: "guardian_name", required: false, description: "Full name of guardian/parent" },
  { name: "guardian_email", required: false, description: "Guardian email address" },
  { name: "guardian_phone", required: false, description: "Guardian phone number" },
  { name: "relationship", required: false, description: "Relationship (mother, father, guardian, other)" },
];

const LESSON_FIELDS = [
  { name: "lesson_day", required: false, description: "Day of the week for recurring lesson (Monday-Sunday)" },
  { name: "lesson_time", required: false, description: "Start time for lesson (HH:MM format)" },
  { name: "lesson_duration", required: false, description: "Duration in minutes (default 30)" },
  { name: "instrument", required: false, description: "Instrument being taught (for lesson title)" },
];

const ALL_TARGET_FIELDS = [...STUDENT_FIELDS, ...GUARDIAN_FIELDS, ...LESSON_FIELDS];

const MAPPING_PROMPT = `You are an AI assistant that maps CSV column headers to database fields for a music lesson management system.

Given CSV headers and sample data, determine the best mapping to these target fields:

STUDENT FIELDS (primary):
${STUDENT_FIELDS.map(f => `- ${f.name} (${f.required ? "REQUIRED" : "optional"}): ${f.description}`).join("\n")}

GUARDIAN FIELDS (optional - for linking parents/guardians):
${GUARDIAN_FIELDS.map(f => `- ${f.name}: ${f.description}`).join("\n")}

LESSON FIELDS (optional - for creating recurring lesson schedules):
${LESSON_FIELDS.map(f => `- ${f.name}: ${f.description}`).join("\n")}

RULES:
1. Each CSV header can map to at most ONE target field
2. Each target field can be mapped from at most ONE CSV header
3. first_name and last_name are REQUIRED for students
4. If a column clearly contains full names, split into first_name and last_name
5. Be conservative - if unsure, set target to null (user will map manually)
6. Use UK date formats (DD/MM/YYYY) when interpreting dates
7. Phone numbers should be UK format

Respond with a JSON object containing:
{
  "mappings": [
    { "csv_header": "Column Name", "target_field": "first_name" | null, "confidence": 0.0-1.0 }
  ],
  "warnings": ["Any issues or suggestions"],
  "has_guardian_data": true/false,
  "has_lesson_data": true/false
}`;

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
      // Fallback to simple heuristic mapping
      const heuristicMappings = headers.map((header: string) => {
        const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        let target: string | null = null;
        let confidence = 0;

        if (h.includes("firstname") || h === "first") {
          target = "first_name"; confidence = 0.9;
        } else if (h.includes("lastname") || h === "last" || h === "surname") {
          target = "last_name"; confidence = 0.9;
        } else if (h.includes("email") && !h.includes("parent") && !h.includes("guardian")) {
          target = "email"; confidence = 0.8;
        } else if (h.includes("phone") && !h.includes("parent") && !h.includes("guardian")) {
          target = "phone"; confidence = 0.7;
        } else if (h.includes("dob") || h.includes("birth") || h.includes("dateofbirth")) {
          target = "dob"; confidence = 0.8;
        } else if (h.includes("parentname") || h.includes("guardianname") || h.includes("parentfull")) {
          target = "guardian_name"; confidence = 0.8;
        } else if ((h.includes("parent") || h.includes("guardian")) && h.includes("email")) {
          target = "guardian_email"; confidence = 0.8;
        } else if ((h.includes("parent") || h.includes("guardian")) && h.includes("phone")) {
          target = "guardian_phone"; confidence = 0.7;
        } else if (h.includes("instrument")) {
          target = "instrument"; confidence = 0.8;
        } else if (h === "day" || h.includes("lessonday")) {
          target = "lesson_day"; confidence = 0.7;
        } else if (h === "time" || h.includes("lessontime") || h.includes("starttime")) {
          target = "lesson_time"; confidence = 0.7;
        } else if (h.includes("duration") || h.includes("length")) {
          target = "lesson_duration"; confidence = 0.7;
        } else if (h.includes("note") || h.includes("comment")) {
          target = "notes"; confidence = 0.6;
        }

        return { csv_header: header, target_field: target, confidence };
      });

      return new Response(JSON.stringify({
        mappings: heuristicMappings,
        warnings: ["AI mapping unavailable - using heuristic matching. Please verify mappings."],
        has_guardian_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("guardian")),
        has_lesson_data: heuristicMappings.some((m: any) => m.target_field?.startsWith("lesson") || m.target_field === "instrument"),
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
    const message = error instanceof Error ? error.message : "Mapping failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
