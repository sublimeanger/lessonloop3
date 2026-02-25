import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

/** Fire-and-forget calendar sync for lesson mutations (non-critical). */
function syncLessonToCalendar(lessonId: string, action: 'create' | 'update' | 'delete') {
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-sync-lesson`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lesson_id: lessonId, action }),
  }).catch(() => { /* non-critical */ });
}

interface ImportRow {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  notes?: string;
  status?: string;
  gender?: string;
  start_date?: string;
  tags?: string;
  guardian_name?: string;
  guardian_first_name?: string;
  guardian_last_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  relationship?: string;
  guardian2_name?: string;
  guardian2_first_name?: string;
  guardian2_last_name?: string;
  guardian2_email?: string;
  guardian2_phone?: string;
  guardian2_relationship?: string;
  lesson_day?: string;
  lesson_time?: string;
  lesson_duration?: string;
  instrument?: string;
  teacher_name?: string;
  location_name?: string;
  price?: string;
  grade_level?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
  country?: string;
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

// Smart date parser supporting DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, written dates, etc.
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // ISO: YYYY-MM-DD (with optional time)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // Numeric with separators: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const numMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (numMatch) {
    let [, a, b, yearStr] = numMatch;
    let year = parseInt(yearStr, 10);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    // If first number > 12, it must be a day (DD/MM/YYYY)
    // If second number > 12, it must be a day (MM/DD/YYYY)
    // Default to DD/MM/YYYY (UK format) when ambiguous
    let day: number, month: number;
    if (aNum > 12) {
      day = aNum; month = bNum;
    } else if (bNum > 12) {
      month = aNum; day = bNum;
    } else {
      // Ambiguous: default DD/MM/YYYY
      day = aNum; month = bNum;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Written: "January 5, 2020", "5 January 2020", "Jan 5 2020", etc.
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  // "Month Day, Year" or "Month Day Year"
  const writtenMatch1 = s.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (writtenMatch1) {
    const month = months[writtenMatch1[1].toLowerCase()];
    if (month) {
      return `${writtenMatch1[3]}-${String(month).padStart(2, "0")}-${writtenMatch1[2].padStart(2, "0")}`;
    }
  }
  // "Day Month Year"
  const writtenMatch2 = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (writtenMatch2) {
    const month = months[writtenMatch2[2].toLowerCase()];
    if (month) {
      return `${writtenMatch2[3]}-${String(month).padStart(2, "0")}-${writtenMatch2[1].padStart(2, "0")}`;
    }
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
  if (row.guardian2_email && !isValidEmail(row.guardian2_email.trim())) {
    errors.push("Invalid second guardian email format");
  }
  if (row.dob) {
    const parsed = parseDate(row.dob);
    if (!parsed) {
      errors.push("Invalid date format for DOB");
    }
  }
  if (row.start_date) {
    const parsed = parseDate(row.start_date);
    if (!parsed) {
      errors.push("Invalid date format for start date");
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
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const { rows: rawRows, mappings, orgId, teacherId: reqTeacherId, teacherUserId, dryRun, skipDuplicates, rowsToImport } = await req.json();
    const effectiveTeacherIdFromRequest = reqTeacherId || teacherUserId;

    if (!orgId || !rawRows || !Array.isArray(rawRows) || !mappings) {
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

    // PRE-PROCESS: normalize rows before validation
    const rows: ImportRow[] = (rawRows as ImportRow[]).map((row) => {
      const r = { ...row };
      // Combine split guardian first+last names
      if (r.guardian_first_name && !r.guardian_name) {
        r.guardian_name = `${r.guardian_first_name} ${r.guardian_last_name || ""}`.trim();
      }
      if (r.guardian2_first_name && !r.guardian2_name) {
        r.guardian2_name = `${r.guardian2_first_name} ${r.guardian2_last_name || ""}`.trim();
      }
      // Split combined student name if only first_name provided
      if (r.first_name && !r.last_name) {
        const parts = r.first_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          r.first_name = parts[0];
          r.last_name = parts.slice(1).join(" ");
        }
      }
      return r;
    });

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
        return row.lesson_day && row.lesson_time && effectiveTeacherIdFromRequest;
      }).length;

      rows.forEach((row: ImportRow, idx: number) => {
        const status = rowStatuses[idx];
        if (status.status === "ready") {
          if (row.guardian_name?.trim()) {
            const guardianKey = row.guardian_email?.toLowerCase().trim() || row.guardian_name.toLowerCase().trim();
            guardiansToCreate.add(guardianKey);
          }
          if (row.guardian2_name?.trim()) {
            const guardian2Key = row.guardian2_email?.toLowerCase().trim() || row.guardian2_name.toLowerCase().trim();
            guardiansToCreate.add(guardian2Key);
          }
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

    // PRE-PROCESS: Build caches for instruments, teachers, locations, and rate cards
    // This prevents creating duplicates during import

    // Fetch instruments for matching CSV instrument values
    const { data: allInstruments } = await supabase
      .from("instruments")
      .select("id, name")
      .or(`org_id.is.null,org_id.eq.${orgId}`);

    const instrumentByName = new Map<string, string>();
    allInstruments?.forEach((i: any) => {
      instrumentByName.set(i.name.toLowerCase().trim(), i.id);
    });

    // Fetch existing teachers from the NEW teachers table
    const { data: existingTeachers } = await supabase
      .from("teachers")
      .select("id, display_name, email, user_id")
      .eq("org_id", orgId);
    
    // Build teacher lookup by name (case insensitive) - now returns teacher.id (not user_id)
    const teacherById = new Map<string, { id: string; userId: string | null }>();
    const teacherByName = new Map<string, string>(); // name → teacher.id
    const teacherByEmail = new Map<string, string>(); // email → teacher.id
    const createdTeachers = new Map<string, string>(); // normalized name → teacher.id
    
    existingTeachers?.forEach((t: any) => {
      teacherById.set(t.id, { id: t.id, userId: t.user_id });
      if (t.display_name) {
        const normalized = t.display_name.toLowerCase().trim();
        teacherByName.set(normalized, t.id);
        // Also match by abbreviated name (e.g., "Amy B" → "Amy Brown")
        const parts = t.display_name.split(" ");
        if (parts.length >= 2) {
          const abbrev = `${parts[0]} ${parts[1][0]}`.toLowerCase();
          teacherByName.set(abbrev, t.id);
        }
      }
      if (t.email) {
        teacherByEmail.set(t.email.toLowerCase().trim(), t.id);
      }
    });
    
    // Helper: Find or create teacher in the NEW teachers table
    // Returns teacher.id (not user_id) for linking
    async function findOrCreateTeacher(name: string): Promise<string | null> {
      if (!name?.trim()) return null;
      const normalized = name.toLowerCase().trim();
      
      // Check existing by name
      if (teacherByName.has(normalized)) return teacherByName.get(normalized)!;
      if (createdTeachers.has(normalized)) return createdTeachers.get(normalized)!;
      
      // Try partial match (e.g., "Amy B" matches "Amy Brown")
      for (const [key, teacherId] of teacherByName.entries()) {
        const keyParts = key.split(" ");
        const nameParts = normalized.split(" ");
        if (keyParts[0] === nameParts[0] && nameParts[1]?.length === 1 && keyParts[1]?.startsWith(nameParts[1])) {
          return teacherId;
        }
      }
      
      // CREATE a new unlinked teacher record (no user_id - can be linked later via invite)
      const displayName = name.trim()
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      
      const { data: newTeacher, error } = await supabase
        .from("teachers")
        .insert({
          org_id: orgId,
          display_name: displayName,
          user_id: null, // Unlinked - can accept invite later
          status: "active",
        })
        .select("id")
        .single();
      
      if (error) {
        console.error(`Failed to create teacher "${name}":`, error);
        return null;
      }
      
      createdTeachers.set(normalized, newTeacher.id);
      teacherByName.set(normalized, newTeacher.id);
      console.log(`Created unlinked teacher record: ${displayName} (${newTeacher.id})`);
      return newTeacher.id;
    }
    
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
    
    // Helper: Find or create location (with optional address enrichment)
    async function findOrCreateLocation(
      name: string,
      address?: { line1?: string; line2?: string; city?: string; postcode?: string; country?: string }
    ): Promise<string | null> {
      if (!name?.trim()) return null;
      const normalized = name.toLowerCase().trim();

      // Check existing
      if (locationByName.has(normalized)) return locationByName.get(normalized)!;
      if (createdLocations.has(normalized)) return createdLocations.get(normalized)!;

      // Create new location with address data if available
      const locationData: any = {
        org_id: orgId,
        name: name.trim(),
        location_type: "school",
        country_code: address?.country?.trim()?.substring(0, 2)?.toUpperCase() || "GB",
      };
      if (address?.line1) locationData.address_line_1 = address.line1.trim();
      if (address?.line2) locationData.address_line_2 = address.line2.trim();
      if (address?.city) locationData.city = address.city.trim();
      if (address?.postcode) locationData.postcode = address.postcode.trim();

      const { data: location, error } = await supabase
        .from("locations")
        .insert(locationData)
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

        // Resolve teaching defaults (location with address enrichment, teacher, rate card)
        const addressInfo = (row.address_line_1 || row.city || row.postcode)
          ? { line1: row.address_line_1, line2: row.address_line_2, city: row.city, postcode: row.postcode, country: row.country }
          : undefined;
        const resolvedLocationId = row.location_name ? await findOrCreateLocation(row.location_name, addressInfo) : null;
        const resolvedTeacherId = row.teacher_name ? await findOrCreateTeacher(row.teacher_name) : effectiveTeacherIdFromRequest;
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

        // New import fields: gender, start_date, tags
        if (row.gender) {
          const genderMap: Record<string, string> = {
            male: "male", m: "male", boy: "male",
            female: "female", f: "female", girl: "female",
            "non-binary": "non_binary", "non binary": "non_binary", nonbinary: "non_binary", nb: "non_binary",
            other: "other",
            "prefer not to say": "prefer_not_to_say", "not specified": "prefer_not_to_say",
          };
          const normalized = genderMap[row.gender.toLowerCase().trim()];
          if (normalized) studentData.gender = normalized;
        }
        if (row.start_date) {
          const parsedStart = parseDate(row.start_date);
          if (parsedStart) studentData.start_date = parsedStart;
        }
        if (row.tags) {
          studentData.tags = row.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        }

        // Set teaching defaults (use new teacher_id column for teachers table)
        if (resolvedLocationId) studentData.default_location_id = resolvedLocationId;
        if (resolvedTeacherId) studentData.default_teacher_id = resolvedTeacherId;
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

        // 1b. Link instrument if provided in CSV
        if (row.instrument?.trim()) {
          const instrumentName = row.instrument.trim().toLowerCase();
          let instrumentId = instrumentByName.get(instrumentName);

          // Fuzzy match: try partial matches (e.g., "piano" matches "Piano")
          if (!instrumentId) {
            for (const [name, id] of instrumentByName.entries()) {
              if (name.includes(instrumentName) || instrumentName.includes(name)) {
                instrumentId = id;
                break;
              }
            }
          }

          if (instrumentId) {
            const { error: instrError } = await supabase
              .from("student_instruments")
              .insert({
                student_id: student.id,
                org_id: orgId,
                instrument_id: instrumentId,
                is_primary: true,
              });
            if (instrError) {
              console.log(`Instrument link warning for ${studentName}:`, instrError.message);
            }
          }
          // If no match found, silently skip — don't fail the import
        }

        // 1c. Match grade_level to grade_levels table and set on student_instruments
        if (row.grade_level?.trim() && row.instrument?.trim()) {
          const { data: gradeLevels } = await supabase
            .from("grade_levels")
            .select("id, name")
            .order("sort_order", { ascending: true });

          if (gradeLevels) {
            const gradeName = row.grade_level.trim().toLowerCase();
            const matchedGrade = gradeLevels.find((g: any) =>
              g.name.toLowerCase() === gradeName ||
              g.name.toLowerCase().includes(gradeName) ||
              gradeName.includes(g.name.toLowerCase())
            );
            if (matchedGrade) {
              // Update the student_instruments record we just created
              await supabase
                .from("student_instruments")
                .update({ current_grade_id: matchedGrade.id })
                .eq("student_id", student.id)
                .eq("org_id", orgId);
            }
          }
        }

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

        // 3b. Create second guardian if provided
        if (row.guardian2_name?.trim()) {
          let guardian2Id: string | null = null;
          const guardian2Data: any = {
            org_id: orgId,
            full_name: row.guardian2_name.trim(),
          };
          if (row.guardian2_email) guardian2Data.email = row.guardian2_email.trim();
          if (row.guardian2_phone) guardian2Data.phone = row.guardian2_phone.trim();

          // Check if guardian with same email exists
          if (guardian2Data.email) {
            const { data: existingGuardian2 } = await supabase
              .from("guardians")
              .select("id")
              .eq("org_id", orgId)
              .eq("email", guardian2Data.email)
              .maybeSingle();

            if (existingGuardian2) {
              guardian2Id = existingGuardian2.id;
            }
          }

          if (!guardian2Id) {
            const { data: guardian2, error: guardian2Error } = await supabase
              .from("guardians")
              .insert(guardian2Data)
              .select("id")
              .single();

            if (guardian2Error) {
              result.errors.push(`Row ${rowIdx + 1}: Second guardian creation failed - ${guardian2Error.message}`);
            } else {
              guardian2Id = guardian2.id;
              result.guardiansCreated++;
            }
          }

          if (guardian2Id) {
            const relationship2 = row.guardian2_relationship?.toLowerCase().trim() || "guardian";
            const validRelationships2 = ["mother", "father", "guardian", "other"];
            const finalRelationship2 = validRelationships2.includes(relationship2) ? relationship2 : "guardian";

            const { error: link2Error } = await supabase
              .from("student_guardians")
              .insert({
                org_id: orgId,
                student_id: student.id,
                guardian_id: guardian2Id,
                relationship: finalRelationship2,
                is_primary_payer: false,
              });

            if (link2Error) {
              result.errors.push(`Row ${rowIdx + 1}: Second guardian link failed - ${link2Error.message}`);
            } else {
              result.linksCreated++;
            }
          }
        }

        // 4. Create teacher assignment if we have a resolved teacher (use new teacher_id column)
        if (resolvedTeacherId && student.id) {
          const { error: assignError } = await supabase
            .from("student_teacher_assignments")
            .insert({
              org_id: orgId,
              student_id: student.id,
              teacher_id: resolvedTeacherId,
            });
          
          if (assignError && !assignError.message.includes("duplicate")) {
            console.log(`Teacher assignment warning for ${studentName}:`, assignError.message);
          }
        }

        // 5. Create recurring lesson if provided
        const effectiveTeacherId = resolvedTeacherId || effectiveTeacherIdFromRequest;
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
              // Get the user_id from the teacher record for lessons (which still uses teacher_user_id)
              const teacherRecord = teacherById.get(effectiveTeacherId);
              const lessonTeacherUserId = teacherRecord?.userId || user.id;
              
              const lessonInsertData: any = {
                org_id: orgId,
                title: lessonTitle,
                start_at: lessonDate.toISOString(),
                end_at: endDate.toISOString(),
                teacher_user_id: lessonTeacherUserId, // lessons still use user_id during transition
                teacher_id: effectiveTeacherId, // new teacher_id column
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
                syncLessonToCalendar(lesson.id, 'create');
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
