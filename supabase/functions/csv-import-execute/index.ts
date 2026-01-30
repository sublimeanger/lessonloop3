import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

interface ImportRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  notes?: string;
  status?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  relationship?: string;
  lesson_day?: string;
  lesson_time?: string;
  lesson_duration?: string;
  instrument?: string;
  teacher_name?: string;
  location_name?: string;
  price?: string;
}

interface DuplicateInfo {
  row: number;
  name: string;
  isDbDuplicate: boolean;
  dbMatchType: "name" | "email" | null;
  existingStudentId: string | null;
  isCsvDuplicate: boolean;
  csvDuplicateOf: number | null;
}

interface ValidationError {
  row: number;
  errors: string[];
}

interface ValidationResult {
  valid: number;
  duplicatesInCsv: { row: number; duplicateOf: number; name: string }[];
  duplicatesInDatabase: { row: number; existingStudentId: string; name: string; matchType: string }[];
  errors: ValidationError[];
}

interface DryRunResult {
  dryRun: true;
  validation: ValidationResult;
  preview: {
    studentsToCreate: number;
    studentsToSkip: number;
    guardiansToCreate: number;
    lessonsToCreate: number;
  };
  rowStatuses: RowStatus[];
}

interface RowStatus {
  row: number;
  name: string;
  status: "ready" | "duplicate_csv" | "duplicate_db" | "invalid";
  duplicateOf?: number;
  existingStudentId?: string;
  matchType?: string;
  errors?: string[];
}

interface ImportResult {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
  lessonsCreated: number;
  teachersCreated: number;
  locationsCreated: number;
  rateCardsCreated: number;
  errors: string[];
  details: { row: number; student: string; status: string; error?: string }[];
}

// Parse UK date format (DD/MM/YYYY) or ISO format
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try UK format first (with or without time)
  const ukMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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

// Parse UK price format (£24.50 → 2450 minor units)
function parsePriceToMinor(priceStr: string): number | null {
  if (!priceStr) return null;
  // Remove currency symbols and whitespace
  const cleaned = priceStr.replace(/[£$€\s,]/g, "").trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100); // Convert to pence/cents
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

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate a single row
function validateRow(row: ImportRow): string[] {
  const errors: string[] = [];
  
  if (!row.first_name?.trim()) {
    errors.push("Missing first_name");
  }
  if (!row.last_name?.trim()) {
    errors.push("Missing last_name");
  }
  if (row.email && !isValidEmail(row.email.trim())) {
    errors.push("Invalid email format");
  }
  if (row.guardian_email && !isValidEmail(row.guardian_email.trim())) {
    errors.push("Invalid guardian email format");
  }
  if (row.dob) {
    const parsed = parseDate(row.dob);
    if (!parsed) {
      errors.push("Invalid date format for DOB (use DD/MM/YYYY)");
    }
  }
  if (row.lesson_time) {
    const parsed = parseTime(row.lesson_time);
    if (!parsed) {
      errors.push("Invalid time format (use HH:MM)");
    }
  }
  if (row.lesson_day) {
    const parsed = parseDayOfWeek(row.lesson_day);
    if (!parsed) {
      errors.push("Invalid day of week");
    }
  }
  
  return errors;
}

// Detect duplicates in CSV and database
async function detectDuplicates(
  rows: ImportRow[],
  orgId: string,
  supabase: any
): Promise<{ duplicates: DuplicateInfo[]; validation: ValidationResult }> {
  // Fetch existing students
  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, email")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  // Build lookup maps
  const nameMap = new Map<string, string>();
  const emailMap = new Map<string, string>();
  
  existingStudents?.forEach((s: any) => {
    const nameKey = `${s.first_name?.toLowerCase().trim()}|${s.last_name?.toLowerCase().trim()}`;
    nameMap.set(nameKey, s.id);
    if (s.email) emailMap.set(s.email.toLowerCase().trim(), s.id);
  });

  // Track duplicates within CSV
  const csvNamesSeen = new Map<string, number>();
  const csvEmailsSeen = new Map<string, number>();
  
  const duplicates: DuplicateInfo[] = [];
  const validation: ValidationResult = {
    valid: 0,
    duplicatesInCsv: [],
    duplicatesInDatabase: [],
    errors: [],
  };

  rows.forEach((row, idx) => {
    const firstName = row.first_name?.toLowerCase().trim() || "";
    const lastName = row.last_name?.toLowerCase().trim() || "";
    const nameKey = `${firstName}|${lastName}`;
    const email = row.email?.toLowerCase().trim() || "";
    const displayName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
    
    // Check database duplicates
    const dbMatchByName = nameMap.get(nameKey);
    const dbMatchByEmail = email ? emailMap.get(email) : undefined;
    const isDbDuplicate = !!(dbMatchByName || dbMatchByEmail);
    
    // Check CSV duplicates
    const csvDuplicateOfByName = csvNamesSeen.get(nameKey);
    const csvDuplicateOfByEmail = email ? csvEmailsSeen.get(email) : undefined;
    const csvDuplicateOf = csvDuplicateOfByName !== undefined ? csvDuplicateOfByName : csvDuplicateOfByEmail;
    const isCsvDuplicate = csvDuplicateOf !== undefined;
    
    // Record this row for future duplicate checks
    if (!csvNamesSeen.has(nameKey) && firstName && lastName) {
      csvNamesSeen.set(nameKey, idx);
    }
    if (!csvEmailsSeen.has(email) && email) {
      csvEmailsSeen.set(email, idx);
    }
    
    // Validate the row
    const rowErrors = validateRow(row);
    
    const duplicateInfo: DuplicateInfo = {
      row: idx + 1,
      name: displayName,
      isDbDuplicate,
      dbMatchType: dbMatchByName ? "name" : dbMatchByEmail ? "email" : null,
      existingStudentId: dbMatchByName || dbMatchByEmail || null,
      isCsvDuplicate,
      csvDuplicateOf: csvDuplicateOf !== undefined ? csvDuplicateOf + 1 : null,
    };
    
    duplicates.push(duplicateInfo);
    
    // Populate validation summary
    if (rowErrors.length > 0) {
      validation.errors.push({ row: idx + 1, errors: rowErrors });
    } else if (isCsvDuplicate) {
      validation.duplicatesInCsv.push({
        row: idx + 1,
        duplicateOf: (csvDuplicateOf || 0) + 1,
        name: displayName,
      });
    } else if (isDbDuplicate) {
      validation.duplicatesInDatabase.push({
        row: idx + 1,
        existingStudentId: duplicateInfo.existingStudentId || "",
        name: displayName,
        matchType: duplicateInfo.dbMatchType || "name",
      });
    } else {
      validation.valid++;
    }
  });

  return { duplicates, validation };
}

// Build row statuses for UI
function buildRowStatuses(
  rows: ImportRow[],
  duplicates: DuplicateInfo[],
  validation: ValidationResult
): RowStatus[] {
  return rows.map((row, idx) => {
    const dup = duplicates[idx];
    const displayName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
    const rowValidationErrors = validation.errors.find(e => e.row === idx + 1);
    
    if (rowValidationErrors) {
      return {
        row: idx + 1,
        name: displayName,
        status: "invalid" as const,
        errors: rowValidationErrors.errors,
      };
    }
    
    if (dup.isCsvDuplicate) {
      return {
        row: idx + 1,
        name: displayName,
        status: "duplicate_csv" as const,
        duplicateOf: dup.csvDuplicateOf || undefined,
      };
    }
    
    if (dup.isDbDuplicate) {
      return {
        row: idx + 1,
        name: displayName,
        status: "duplicate_db" as const,
        existingStudentId: dup.existingStudentId || undefined,
        matchType: dup.dbMatchType || undefined,
      };
    }
    
    return {
      row: idx + 1,
      name: displayName,
      status: "ready" as const,
    };
  });
}

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

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, "csv-import");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult.retryAfterSeconds);
    }

    const { rows, mappings, orgId, teacherUserId, dryRun, skipDuplicates, rowsToImport } = await req.json();

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

    // Detect duplicates
    const { duplicates, validation } = await detectDuplicates(rows, orgId, supabase);
    const rowStatuses = buildRowStatuses(rows, duplicates, validation);

    // DRY RUN MODE - return validation results without committing
    if (dryRun) {
      // Count guardians and lessons to create
      const guardiansToCreate = new Set<string>();
      const lessonsCount = rows.filter((row: ImportRow, idx: number) => {
        const status = rowStatuses[idx];
        if (status.status !== "ready") return false;
        return row.lesson_day && row.lesson_time && teacherUserId;
      }).length;
      
      rows.forEach((row: ImportRow, idx: number) => {
        const status = rowStatuses[idx];
        if (status.status === "ready" && row.guardian_name?.trim()) {
          const guardianKey = row.guardian_email?.toLowerCase().trim() || row.guardian_name.toLowerCase().trim();
          guardiansToCreate.add(guardianKey);
        }
      });

      const dryRunResult: DryRunResult = {
        dryRun: true,
        validation,
        preview: {
          studentsToCreate: validation.valid,
          studentsToSkip: validation.duplicatesInCsv.length + validation.duplicatesInDatabase.length,
          guardiansToCreate: guardiansToCreate.size,
          lessonsToCreate: lessonsCount,
        },
        rowStatuses,
      };

      return new Response(JSON.stringify(dryRunResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // EXECUTE MODE - actually import the data
    
    // Determine which rows to import
    const rowIndicesToImport = rowsToImport
      ? new Set(rowsToImport as number[])
      : new Set(
          rowStatuses
            .filter(s => s.status === "ready" || (!skipDuplicates && (s.status === "duplicate_csv" || s.status === "duplicate_db")))
            .map(s => s.row - 1)
        );

    // Check student limit before import
    const { data: org } = await supabase
      .from("organisations")
      .select("max_students")
      .eq("id", orgId)
      .single();
    
    const { count: currentStudentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null);
    
    const maxStudents = org?.max_students || 50;
    const remainingCapacity = maxStudents - (currentStudentCount || 0);
    
    if (rowIndicesToImport.size > remainingCapacity) {
      return new Response(JSON.stringify({ 
        error: `Import would exceed student limit. You have capacity for ${remainingCapacity} more student${remainingCapacity !== 1 ? 's' : ''}, but trying to import ${rowIndicesToImport.size} rows. Upgrade your plan to add more students.`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PRE-PROCESS: Build caches for teachers, locations, and rate cards
    // This prevents creating duplicates during import
    
    // Fetch existing teachers
    const { data: existingMemberships } = await supabase
      .from("org_memberships")
      .select("user_id, role")
      .eq("org_id", orgId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "teacher"]);
    
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email");
    
    // Build teacher lookup by name (case insensitive)
    const teacherByName = new Map<string, string>();
    const createdTeachers = new Map<string, string>();
    existingMemberships?.forEach((m: any) => {
      const profile = existingProfiles?.find((p: any) => p.id === m.user_id);
      if (profile?.full_name) {
        teacherByName.set(profile.full_name.toLowerCase().trim(), m.user_id);
        // Also match by first part of name (e.g., "Amy B" → "Amy Brown")
        const shortName = profile.full_name.split(" ").map((n: string) => n[0] ? n[0].toUpperCase() : "").join(" ");
        teacherByName.set(shortName.toLowerCase().trim(), m.user_id);
      }
    });
    
    // Fetch existing locations
    const { data: existingLocations } = await supabase
      .from("locations")
      .select("id, name")
      .eq("org_id", orgId);
    
    const locationByName = new Map<string, string>();
    const createdLocations = new Map<string, string>();
    existingLocations?.forEach((l: any) => {
      locationByName.set(l.name.toLowerCase().trim(), l.id);
    });
    
    // Fetch existing rate cards
    const { data: existingRateCards } = await supabase
      .from("rate_cards")
      .select("id, name, duration_minutes, amount_per_lesson_minor")
      .eq("org_id", orgId);
    
    const rateCardByDuration = new Map<number, string>();
    const createdRateCards = new Map<string, string>(); // "duration:price" → id
    existingRateCards?.forEach((r: any) => {
      rateCardByDuration.set(r.duration_minutes, r.id);
    });
    
    // Helper: Find or create teacher
    async function findOrCreateTeacher(name: string): Promise<string | null> {
      if (!name?.trim()) return null;
      const normalized = name.toLowerCase().trim();
      
      // Check existing
      if (teacherByName.has(normalized)) return teacherByName.get(normalized)!;
      if (createdTeachers.has(normalized)) return createdTeachers.get(normalized)!;
      
      // Try partial match (e.g., "Amy B" matches "Amy Brown")
      for (const [key, userId] of teacherByName.entries()) {
        const keyParts = key.split(" ");
        const nameParts = normalized.split(" ");
        if (keyParts[0] === nameParts[0] && nameParts[1]?.length === 1 && keyParts[1]?.startsWith(nameParts[1])) {
          return userId;
        }
      }
      
      // Note: We cannot create auth.users from edge functions
      // Instead, we'll log this and the admin will need to invite the teacher
      console.log(`Teacher "${name}" not found - will need to be invited manually`);
      return null;
    }
    
    // Helper: Find or create location
    async function findOrCreateLocation(name: string): Promise<string | null> {
      if (!name?.trim()) return null;
      const normalized = name.toLowerCase().trim();
      
      // Check existing
      if (locationByName.has(normalized)) return locationByName.get(normalized)!;
      if (createdLocations.has(normalized)) return createdLocations.get(normalized)!;
      
      // Create new location
      const { data: location, error } = await supabase
        .from("locations")
        .insert({
          org_id: orgId,
          name: name.trim(),
          location_type: "school",
          country_code: "GB",
        })
        .select("id")
        .single();
      
      if (error) {
        console.error(`Failed to create location "${name}":`, error);
        return null;
      }
      
      createdLocations.set(normalized, location.id);
      return location.id;
    }
    
    // Helper: Find or create rate card by duration/price
    async function findOrCreateRateCard(durationMinutes: number, priceMinor: number | null): Promise<string | null> {
      if (!durationMinutes) return null;
      
      // If we have an exact duration match, use it
      if (rateCardByDuration.has(durationMinutes)) {
        return rateCardByDuration.get(durationMinutes)!;
      }
      
      // If we have price info, create a new rate card
      if (priceMinor !== null) {
        const key = `${durationMinutes}:${priceMinor}`;
        if (createdRateCards.has(key)) return createdRateCards.get(key)!;
        
        const { data: rateCard, error } = await supabase
          .from("rate_cards")
          .insert({
            org_id: orgId,
            name: `${durationMinutes} minute lesson`,
            duration_minutes: durationMinutes,
            amount_per_lesson_minor: priceMinor,
            currency_code: "GBP",
            is_default: false,
          })
          .select("id")
          .single();
        
        if (error) {
          console.error(`Failed to create rate card for ${durationMinutes}min @ £${priceMinor/100}:`, error);
          return null;
        }
        
        rateCardByDuration.set(durationMinutes, rateCard.id);
        createdRateCards.set(key, rateCard.id);
        return rateCard.id;
      }
      
      return null;
    }

    const result: ImportResult = {
      studentsCreated: 0,
      guardiansCreated: 0,
      linksCreated: 0,
      lessonsCreated: 0,
      teachersCreated: createdTeachers.size,
      locationsCreated: 0,
      rateCardsCreated: 0,
      errors: [],
      details: [],
    };

    // Process each row
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      // Skip rows not marked for import
      if (!rowIndicesToImport.has(rowIdx)) {
        const row = rows[rowIdx] as ImportRow;
        const studentName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unknown";
        const status = rowStatuses[rowIdx];
        result.details.push({
          row: rowIdx + 1,
          student: studentName,
          status: "skipped",
          error: status.status === "duplicate_csv" 
            ? `Duplicate of row ${status.duplicateOf}` 
            : status.status === "duplicate_db"
            ? `Already exists in database`
            : status.errors?.join(", "),
        });
        continue;
      }

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

        // Resolve teaching defaults (location, teacher, rate card)
        const resolvedLocationId = row.location_name ? await findOrCreateLocation(row.location_name) : null;
        const resolvedTeacherId = row.teacher_name ? await findOrCreateTeacher(row.teacher_name) : teacherUserId;
        const lessonDuration = parseInt(row.lesson_duration || "30", 10) || 30;
        const priceMinor = row.price ? parsePriceToMinor(row.price) : null;
        const resolvedRateCardId = await findOrCreateRateCard(lessonDuration, priceMinor);

        // 1. Create student
        const studentData: any = {
          org_id: orgId,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          status: row.status?.toLowerCase() === "inactive" ? "inactive" : "active",
        };
        
        if (row.email) studentData.email = row.email.trim();
        if (row.phone) studentData.phone = row.phone.trim();
        if (row.dob) {
          const parsedDob = parseDate(row.dob);
          if (parsedDob) studentData.dob = parsedDob;
        }
        if (row.notes) studentData.notes = row.notes.trim();
        if (row.instrument) {
          // Add instrument to notes if not already a notes field
          const instrumentNote = `Instrument: ${row.instrument.trim()}`;
          studentData.notes = studentData.notes 
            ? `${instrumentNote}\n${studentData.notes}` 
            : instrumentNote;
        }
        
        // Set teaching defaults
        if (resolvedLocationId) studentData.default_location_id = resolvedLocationId;
        if (resolvedTeacherId) studentData.default_teacher_user_id = resolvedTeacherId;
        if (resolvedRateCardId) studentData.default_rate_card_id = resolvedRateCardId;

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

        // 4. Create teacher assignment if we have a resolved teacher
        if (resolvedTeacherId && student.id) {
          const { error: assignError } = await supabase
            .from("student_teacher_assignments")
            .insert({
              org_id: orgId,
              student_id: student.id,
              teacher_user_id: resolvedTeacherId,
            });
          
          if (assignError && !assignError.message.includes("duplicate")) {
            console.log(`Teacher assignment warning for ${studentName}:`, assignError.message);
          }
        }

        // 5. Create recurring lesson if provided
        const effectiveTeacherId = resolvedTeacherId || teacherUserId;
        if (row.lesson_day && row.lesson_time && effectiveTeacherId) {
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
              const lessonInsertData: any = {
                org_id: orgId,
                title: lessonTitle,
                start_at: lessonDate.toISOString(),
                end_at: endDate.toISOString(),
                teacher_user_id: effectiveTeacherId,
                lesson_type: "private",
                status: "scheduled",
                created_by: user.id,
                recurrence_id: recurrence.id,
              };
              
              // Add location if resolved
              if (resolvedLocationId) {
                lessonInsertData.location_id = resolvedLocationId;
              }
              
              const { data: lesson, error: lessonError } = await supabase
                .from("lessons")
                .insert(lessonInsertData)
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

    // Update counts from created entities
    result.locationsCreated = createdLocations.size;
    result.rateCardsCreated = createdRateCards.size;

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
        locations_created: result.locationsCreated,
        rate_cards_created: result.rateCardsCreated,
        error_count: result.errors.length,
        rows_processed: rows.length,
        rows_imported: rowIndicesToImport.size,
      },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("CSV import error:", error);
    const corsHeaders = getCorsHeaders(req);
    const message = error instanceof Error ? error.message : "Import failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
