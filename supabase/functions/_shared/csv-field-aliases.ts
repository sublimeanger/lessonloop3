/**
 * Comprehensive CSV field alias dictionary for student import.
 * Maps 200+ column header variations from all major music lesson management software
 * (MyMusicStaff, Opus1, Teachworks, Duet Partner, Fons, Jackrabbit, etc.) to LessonLoop target fields.
 */

export type SourceSoftware =
  | "mymusicstaff"
  | "opus1"
  | "teachworks"
  | "duetpartner"
  | "fons"
  | "jackrabbit"
  | "generic";

export interface FieldAlias {
  /** Normalized header pattern (lowercase, special chars stripped) */
  pattern: string;
  /** LessonLoop target field name */
  targetField: string;
  /** Base confidence when matched (0.0-1.0) */
  confidence: number;
  /** Source software this alias is specific to (omit = universal) */
  source?: SourceSoftware;
  /** Post-processing transform hint */
  transform?: "split_name" | "combine_guardian_name" | "combine_guardian2_name";
}

export const FIELD_ALIASES: FieldAlias[] = [
  // ═══════════════════════════════════════════════════════════════
  // STUDENT FIRST NAME
  // ═══════════════════════════════════════════════════════════════
  { pattern: "first name", targetField: "first_name", confidence: 0.95 },
  { pattern: "firstname", targetField: "first_name", confidence: 0.95 },
  { pattern: "first", targetField: "first_name", confidence: 0.75 },
  { pattern: "given name", targetField: "first_name", confidence: 0.90 },
  { pattern: "givenname", targetField: "first_name", confidence: 0.90 },
  { pattern: "forename", targetField: "first_name", confidence: 0.90 },
  { pattern: "fname", targetField: "first_name", confidence: 0.85 },
  { pattern: "f name", targetField: "first_name", confidence: 0.85 },
  { pattern: "student first name", targetField: "first_name", confidence: 0.98 },
  { pattern: "student first", targetField: "first_name", confidence: 0.90 },
  { pattern: "child first name", targetField: "first_name", confidence: 0.90 },
  { pattern: "child first", targetField: "first_name", confidence: 0.85 },
  { pattern: "pupil first name", targetField: "first_name", confidence: 0.90 },
  { pattern: "pupil first", targetField: "first_name", confidence: 0.85 },
  { pattern: "client first name", targetField: "first_name", confidence: 0.85 },
  // Opus1 specific
  { pattern: "student_first_name", targetField: "first_name", confidence: 0.98, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // STUDENT LAST NAME
  // ═══════════════════════════════════════════════════════════════
  { pattern: "last name", targetField: "last_name", confidence: 0.95 },
  { pattern: "lastname", targetField: "last_name", confidence: 0.95 },
  { pattern: "last", targetField: "last_name", confidence: 0.75 },
  { pattern: "surname", targetField: "last_name", confidence: 0.95 },
  { pattern: "family name", targetField: "last_name", confidence: 0.90 },
  { pattern: "familyname", targetField: "last_name", confidence: 0.90 },
  { pattern: "lname", targetField: "last_name", confidence: 0.85 },
  { pattern: "l name", targetField: "last_name", confidence: 0.85 },
  { pattern: "student last name", targetField: "last_name", confidence: 0.98 },
  { pattern: "student last", targetField: "last_name", confidence: 0.90 },
  { pattern: "student surname", targetField: "last_name", confidence: 0.95 },
  { pattern: "child last name", targetField: "last_name", confidence: 0.90 },
  { pattern: "child last", targetField: "last_name", confidence: 0.85 },
  { pattern: "child surname", targetField: "last_name", confidence: 0.90 },
  { pattern: "pupil last name", targetField: "last_name", confidence: 0.90 },
  { pattern: "pupil surname", targetField: "last_name", confidence: 0.90 },
  { pattern: "client last name", targetField: "last_name", confidence: 0.85 },
  // Opus1 specific
  { pattern: "student_last_name", targetField: "last_name", confidence: 0.98, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // COMBINED STUDENT NAME (needs split_name transform)
  // ═══════════════════════════════════════════════════════════════
  { pattern: "student name", targetField: "first_name", confidence: 0.90, transform: "split_name" },
  { pattern: "full name", targetField: "first_name", confidence: 0.85, transform: "split_name" },
  { pattern: "fullname", targetField: "first_name", confidence: 0.85, transform: "split_name" },
  { pattern: "name", targetField: "first_name", confidence: 0.65, transform: "split_name" },
  { pattern: "student full name", targetField: "first_name", confidence: 0.90, transform: "split_name" },
  { pattern: "pupil name", targetField: "first_name", confidence: 0.85, transform: "split_name" },
  { pattern: "child name", targetField: "first_name", confidence: 0.80, transform: "split_name" },
  { pattern: "client name", targetField: "first_name", confidence: 0.75, transform: "split_name" },
  { pattern: "student", targetField: "first_name", confidence: 0.60, transform: "split_name" },

  // ═══════════════════════════════════════════════════════════════
  // STUDENT EMAIL
  // ═══════════════════════════════════════════════════════════════
  { pattern: "email", targetField: "email", confidence: 0.80 },
  { pattern: "email address", targetField: "email", confidence: 0.85 },
  { pattern: "e-mail", targetField: "email", confidence: 0.85 },
  { pattern: "e mail", targetField: "email", confidence: 0.85 },
  { pattern: "student email", targetField: "email", confidence: 0.95 },
  { pattern: "student email address", targetField: "email", confidence: 0.95 },
  { pattern: "pupil email", targetField: "email", confidence: 0.90 },
  { pattern: "child email", targetField: "email", confidence: 0.85 },
  { pattern: "client email", targetField: "email", confidence: 0.85 },
  // Opus1 specific
  { pattern: "student_email", targetField: "email", confidence: 0.98, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // STUDENT PHONE
  // ═══════════════════════════════════════════════════════════════
  { pattern: "mobile phone", targetField: "phone", confidence: 0.90 },
  { pattern: "phone", targetField: "phone", confidence: 0.75 },
  { pattern: "phone number", targetField: "phone", confidence: 0.80 },
  { pattern: "mobile", targetField: "phone", confidence: 0.80 },
  { pattern: "cell", targetField: "phone", confidence: 0.75 },
  { pattern: "cell phone", targetField: "phone", confidence: 0.85 },
  { pattern: "telephone", targetField: "phone", confidence: 0.80 },
  { pattern: "tel", targetField: "phone", confidence: 0.70 },
  { pattern: "student phone", targetField: "phone", confidence: 0.90 },
  { pattern: "student mobile", targetField: "phone", confidence: 0.90 },
  { pattern: "student phone number", targetField: "phone", confidence: 0.90 },
  { pattern: "contact number", targetField: "phone", confidence: 0.70 },
  { pattern: "pupil phone", targetField: "phone", confidence: 0.85 },
  { pattern: "child phone", targetField: "phone", confidence: 0.80 },
  // Opus1 specific
  { pattern: "student_phone_1", targetField: "phone", confidence: 0.95, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // DATE OF BIRTH
  // ═══════════════════════════════════════════════════════════════
  { pattern: "birthday", targetField: "dob", confidence: 0.95 },
  { pattern: "dob", targetField: "dob", confidence: 0.95 },
  { pattern: "date of birth", targetField: "dob", confidence: 0.95 },
  { pattern: "dateofbirth", targetField: "dob", confidence: 0.95 },
  { pattern: "birthdate", targetField: "dob", confidence: 0.95 },
  { pattern: "birth date", targetField: "dob", confidence: 0.95 },
  { pattern: "student birthday", targetField: "dob", confidence: 0.95 },
  { pattern: "student dob", targetField: "dob", confidence: 0.95 },
  { pattern: "student date of birth", targetField: "dob", confidence: 0.95 },
  { pattern: "born", targetField: "dob", confidence: 0.70 },
  { pattern: "birth", targetField: "dob", confidence: 0.65 },
  { pattern: "age", targetField: "dob", confidence: 0.50 },
  // Opus1 specific
  { pattern: "student_birthdate", targetField: "dob", confidence: 0.98, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════
  { pattern: "status", targetField: "status", confidence: 0.85 },
  { pattern: "student status", targetField: "status", confidence: 0.95 },
  { pattern: "enrollment status", targetField: "status", confidence: 0.90 },
  { pattern: "enrolment status", targetField: "status", confidence: 0.90 },
  { pattern: "active status", targetField: "status", confidence: 0.85 },
  { pattern: "account status", targetField: "status", confidence: 0.80 },
  // Opus1 specific
  { pattern: "student_status", targetField: "status", confidence: 0.95, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════════════════════════
  { pattern: "note", targetField: "notes", confidence: 0.85 },
  { pattern: "notes", targetField: "notes", confidence: 0.85 },
  { pattern: "student notes", targetField: "notes", confidence: 0.90 },
  { pattern: "student note", targetField: "notes", confidence: 0.90 },
  { pattern: "comments", targetField: "notes", confidence: 0.80 },
  { pattern: "comment", targetField: "notes", confidence: 0.80 },
  { pattern: "memo", targetField: "notes", confidence: 0.75 },
  { pattern: "description", targetField: "notes", confidence: 0.65 },
  { pattern: "additional info", targetField: "notes", confidence: 0.75 },
  { pattern: "additional notes", targetField: "notes", confidence: 0.80 },
  { pattern: "internal notes", targetField: "notes", confidence: 0.80 },
  { pattern: "other notes", targetField: "notes", confidence: 0.75 },
  { pattern: "private notes", targetField: "notes", confidence: 0.75 },
  // Opus1 specific
  { pattern: "student_note", targetField: "notes", confidence: 0.95, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // GENDER
  // ═══════════════════════════════════════════════════════════════
  { pattern: "gender", targetField: "gender", confidence: 0.90 },
  { pattern: "sex", targetField: "gender", confidence: 0.80 },
  { pattern: "student gender", targetField: "gender", confidence: 0.95 },
  // Opus1 specific
  { pattern: "student_gender", targetField: "gender", confidence: 0.95, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // START DATE
  // ═══════════════════════════════════════════════════════════════
  { pattern: "start date", targetField: "start_date", confidence: 0.85 },
  { pattern: "start", targetField: "start_date", confidence: 0.60 },
  { pattern: "enrollment date", targetField: "start_date", confidence: 0.85 },
  { pattern: "enrolment date", targetField: "start_date", confidence: 0.85 },
  { pattern: "joined", targetField: "start_date", confidence: 0.75 },
  { pattern: "joined date", targetField: "start_date", confidence: 0.80 },
  { pattern: "date joined", targetField: "start_date", confidence: 0.80 },
  { pattern: "registration date", targetField: "start_date", confidence: 0.80 },
  { pattern: "student start date", targetField: "start_date", confidence: 0.90 },
  { pattern: "date started", targetField: "start_date", confidence: 0.80 },
  { pattern: "first lesson", targetField: "start_date", confidence: 0.65 },
  // Opus1 specific
  { pattern: "student_start_date", targetField: "start_date", confidence: 0.95, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // TAGS
  // ═══════════════════════════════════════════════════════════════
  { pattern: "tags", targetField: "tags", confidence: 0.85 },
  { pattern: "tag", targetField: "tags", confidence: 0.80 },
  { pattern: "categories", targetField: "tags", confidence: 0.75 },
  { pattern: "category", targetField: "tags", confidence: 0.70 },
  { pattern: "labels", targetField: "tags", confidence: 0.75 },
  { pattern: "groups", targetField: "tags", confidence: 0.65 },
  // Opus1 specific
  { pattern: "student_tag", targetField: "tags", confidence: 0.90, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // GUARDIAN / PARENT 1 — FULL NAME
  // ═══════════════════════════════════════════════════════════════
  { pattern: "parent name", targetField: "guardian_name", confidence: 0.90 },
  { pattern: "guardian name", targetField: "guardian_name", confidence: 0.90 },
  { pattern: "parent", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "guardian", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "parent/guardian", targetField: "guardian_name", confidence: 0.85 },
  { pattern: "parent guardian", targetField: "guardian_name", confidence: 0.85 },
  { pattern: "parent 1 name", targetField: "guardian_name", confidence: 0.90 },
  { pattern: "parent 1", targetField: "guardian_name", confidence: 0.80 },
  { pattern: "primary contact", targetField: "guardian_name", confidence: 0.80 },
  { pattern: "primary contact name", targetField: "guardian_name", confidence: 0.85 },
  { pattern: "emergency contact", targetField: "guardian_name", confidence: 0.65 },
  { pattern: "emergency contact name", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "contact name", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "parent full name", targetField: "guardian_name", confidence: 0.90 },
  { pattern: "guardian full name", targetField: "guardian_name", confidence: 0.90 },
  { pattern: "billing contact", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "payer name", targetField: "guardian_name", confidence: 0.70 },
  { pattern: "payer", targetField: "guardian_name", confidence: 0.60 },
  { pattern: "mother name", targetField: "guardian_name", confidence: 0.80 },
  { pattern: "father name", targetField: "guardian_name", confidence: 0.80 },

  // ═══════════════════════════════════════════════════════════════
  // GUARDIAN / PARENT 1 — SPLIT FIRST/LAST (MyMusicStaff pattern)
  // ═══════════════════════════════════════════════════════════════
  // MyMusicStaff specific
  { pattern: "parent contact 1 first name", targetField: "guardian_first_name", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 1 last name", targetField: "guardian_last_name", confidence: 0.98, source: "mymusicstaff" },
  // Generic split
  { pattern: "parent first name", targetField: "guardian_first_name", confidence: 0.90 },
  { pattern: "parent last name", targetField: "guardian_last_name", confidence: 0.90 },
  { pattern: "guardian first name", targetField: "guardian_first_name", confidence: 0.90 },
  { pattern: "guardian last name", targetField: "guardian_last_name", confidence: 0.90 },
  { pattern: "parent firstname", targetField: "guardian_first_name", confidence: 0.85 },
  { pattern: "parent lastname", targetField: "guardian_last_name", confidence: 0.85 },
  { pattern: "parent surname", targetField: "guardian_last_name", confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // GUARDIAN / PARENT 1 — EMAIL
  // ═══════════════════════════════════════════════════════════════
  { pattern: "parent contact 1 email", targetField: "guardian_email", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent email", targetField: "guardian_email", confidence: 0.90 },
  { pattern: "guardian email", targetField: "guardian_email", confidence: 0.90 },
  { pattern: "parent 1 email", targetField: "guardian_email", confidence: 0.90 },
  { pattern: "primary contact email", targetField: "guardian_email", confidence: 0.85 },
  { pattern: "family email", targetField: "guardian_email", confidence: 0.80 },
  { pattern: "parent/guardian email", targetField: "guardian_email", confidence: 0.85 },
  { pattern: "parent guardian email", targetField: "guardian_email", confidence: 0.85 },
  { pattern: "contact email", targetField: "guardian_email", confidence: 0.70 },
  { pattern: "billing email", targetField: "guardian_email", confidence: 0.70 },
  { pattern: "payer email", targetField: "guardian_email", confidence: 0.70 },

  // ═══════════════════════════════════════════════════════════════
  // GUARDIAN / PARENT 1 — PHONE
  // ═══════════════════════════════════════════════════════════════
  { pattern: "parent contact 1 mobile phone", targetField: "guardian_phone", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 1 phone", targetField: "guardian_phone", confidence: 0.95, source: "mymusicstaff" },
  { pattern: "parent phone", targetField: "guardian_phone", confidence: 0.85 },
  { pattern: "guardian phone", targetField: "guardian_phone", confidence: 0.85 },
  { pattern: "parent 1 phone", targetField: "guardian_phone", confidence: 0.85 },
  { pattern: "parent mobile", targetField: "guardian_phone", confidence: 0.85 },
  { pattern: "guardian mobile", targetField: "guardian_phone", confidence: 0.85 },
  { pattern: "primary contact phone", targetField: "guardian_phone", confidence: 0.80 },
  { pattern: "family phone", targetField: "guardian_phone", confidence: 0.75 },
  { pattern: "parent/guardian phone", targetField: "guardian_phone", confidence: 0.80 },
  { pattern: "contact phone", targetField: "guardian_phone", confidence: 0.65 },
  { pattern: "billing phone", targetField: "guardian_phone", confidence: 0.65 },
  { pattern: "payer phone", targetField: "guardian_phone", confidence: 0.65 },
  { pattern: "home phone", targetField: "guardian_phone", confidence: 0.60 },
  { pattern: "emergency phone", targetField: "guardian_phone", confidence: 0.55 },

  // ═══════════════════════════════════════════════════════════════
  // RELATIONSHIP
  // ═══════════════════════════════════════════════════════════════
  { pattern: "relationship", targetField: "relationship", confidence: 0.85 },
  { pattern: "relation", targetField: "relationship", confidence: 0.80 },
  { pattern: "parent type", targetField: "relationship", confidence: 0.80 },
  { pattern: "contact type", targetField: "relationship", confidence: 0.70 },
  { pattern: "guardian type", targetField: "relationship", confidence: 0.80 },
  { pattern: "relationship type", targetField: "relationship", confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // GUARDIAN / PARENT 2
  // ═══════════════════════════════════════════════════════════════
  // MyMusicStaff specific - split names
  { pattern: "parent contact 2 first name", targetField: "guardian2_first_name", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 2 last name", targetField: "guardian2_last_name", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 2 email", targetField: "guardian2_email", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 2 mobile phone", targetField: "guardian2_phone", confidence: 0.98, source: "mymusicstaff" },
  { pattern: "parent contact 2 phone", targetField: "guardian2_phone", confidence: 0.95, source: "mymusicstaff" },
  // Generic second guardian
  { pattern: "parent 2 name", targetField: "guardian2_name", confidence: 0.85 },
  { pattern: "parent 2", targetField: "guardian2_name", confidence: 0.75 },
  { pattern: "second parent name", targetField: "guardian2_name", confidence: 0.85 },
  { pattern: "second parent", targetField: "guardian2_name", confidence: 0.75 },
  { pattern: "other parent", targetField: "guardian2_name", confidence: 0.75 },
  { pattern: "other guardian", targetField: "guardian2_name", confidence: 0.75 },
  { pattern: "guardian 2", targetField: "guardian2_name", confidence: 0.80 },
  { pattern: "guardian 2 name", targetField: "guardian2_name", confidence: 0.85 },
  { pattern: "secondary contact", targetField: "guardian2_name", confidence: 0.75 },
  { pattern: "secondary contact name", targetField: "guardian2_name", confidence: 0.80 },
  { pattern: "parent 2 first name", targetField: "guardian2_first_name", confidence: 0.85 },
  { pattern: "parent 2 last name", targetField: "guardian2_last_name", confidence: 0.85 },
  { pattern: "parent 2 email", targetField: "guardian2_email", confidence: 0.85 },
  { pattern: "parent 2 phone", targetField: "guardian2_phone", confidence: 0.85 },
  { pattern: "parent 2 mobile", targetField: "guardian2_phone", confidence: 0.80 },
  { pattern: "secondary contact email", targetField: "guardian2_email", confidence: 0.80 },
  { pattern: "secondary contact phone", targetField: "guardian2_phone", confidence: 0.80 },
  { pattern: "guardian 2 email", targetField: "guardian2_email", confidence: 0.85 },
  { pattern: "guardian 2 phone", targetField: "guardian2_phone", confidence: 0.85 },
  { pattern: "guardian2_relationship", targetField: "guardian2_relationship", confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // INSTRUMENT / SUBJECT
  // ═══════════════════════════════════════════════════════════════
  { pattern: "instrument", targetField: "instrument", confidence: 0.95 },
  { pattern: "instruments", targetField: "instrument", confidence: 0.90 },
  { pattern: "primary instrument", targetField: "instrument", confidence: 0.95 },
  { pattern: "main instrument", targetField: "instrument", confidence: 0.90 },
  { pattern: "subject", targetField: "instrument", confidence: 0.75 },
  { pattern: "course", targetField: "instrument", confidence: 0.65 },
  { pattern: "discipline", targetField: "instrument", confidence: 0.65 },
  { pattern: "lesson type", targetField: "instrument", confidence: 0.60 },
  { pattern: "study", targetField: "instrument", confidence: 0.55 },

  // ═══════════════════════════════════════════════════════════════
  // LESSON DURATION
  // ═══════════════════════════════════════════════════════════════
  { pattern: "default duration", targetField: "lesson_duration", confidence: 0.95 },
  { pattern: "lesson duration", targetField: "lesson_duration", confidence: 0.95 },
  { pattern: "duration", targetField: "lesson_duration", confidence: 0.75 },
  { pattern: "lesson length", targetField: "lesson_duration", confidence: 0.90 },
  { pattern: "length", targetField: "lesson_duration", confidence: 0.60 },
  { pattern: "minutes", targetField: "lesson_duration", confidence: 0.65 },
  { pattern: "lesson minutes", targetField: "lesson_duration", confidence: 0.85 },
  { pattern: "session length", targetField: "lesson_duration", confidence: 0.80 },
  { pattern: "duration minutes", targetField: "lesson_duration", confidence: 0.85 },

  // ═══════════════════════════════════════════════════════════════
  // TEACHER NAME
  // ═══════════════════════════════════════════════════════════════
  { pattern: "teacher", targetField: "teacher_name", confidence: 0.90 },
  { pattern: "teacher name", targetField: "teacher_name", confidence: 0.95 },
  { pattern: "instructor", targetField: "teacher_name", confidence: 0.85 },
  { pattern: "instructor name", targetField: "teacher_name", confidence: 0.90 },
  { pattern: "tutor", targetField: "teacher_name", confidence: 0.80 },
  { pattern: "tutor name", targetField: "teacher_name", confidence: 0.85 },
  { pattern: "assigned teacher", targetField: "teacher_name", confidence: 0.90 },
  { pattern: "default teacher", targetField: "teacher_name", confidence: 0.90 },
  { pattern: "staff", targetField: "teacher_name", confidence: 0.55 },
  { pattern: "staff name", targetField: "teacher_name", confidence: 0.70 },

  // ═══════════════════════════════════════════════════════════════
  // LOCATION / SCHOOL
  // ═══════════════════════════════════════════════════════════════
  { pattern: "school", targetField: "location_name", confidence: 0.85 },
  { pattern: "location", targetField: "location_name", confidence: 0.85 },
  { pattern: "location name", targetField: "location_name", confidence: 0.95 },
  { pattern: "venue", targetField: "location_name", confidence: 0.75 },
  { pattern: "studio", targetField: "location_name", confidence: 0.75 },
  { pattern: "branch", targetField: "location_name", confidence: 0.70 },
  { pattern: "campus", targetField: "location_name", confidence: 0.70 },
  { pattern: "site", targetField: "location_name", confidence: 0.60 },
  { pattern: "lesson location", targetField: "location_name", confidence: 0.90 },

  // ═══════════════════════════════════════════════════════════════
  // PRICE / RATE
  // ═══════════════════════════════════════════════════════════════
  { pattern: "price", targetField: "price", confidence: 0.90 },
  { pattern: "rate", targetField: "price", confidence: 0.75 },
  { pattern: "fee", targetField: "price", confidence: 0.75 },
  { pattern: "lesson price", targetField: "price", confidence: 0.95 },
  { pattern: "lesson fee", targetField: "price", confidence: 0.90 },
  { pattern: "lesson rate", targetField: "price", confidence: 0.90 },
  { pattern: "cost", targetField: "price", confidence: 0.70 },
  { pattern: "lesson cost", targetField: "price", confidence: 0.85 },
  { pattern: "amount", targetField: "price", confidence: 0.65 },
  { pattern: "charge", targetField: "price", confidence: 0.65 },
  { pattern: "hourly rate", targetField: "price", confidence: 0.70 },

  // ═══════════════════════════════════════════════════════════════
  // LESSON SCHEDULE
  // ═══════════════════════════════════════════════════════════════
  { pattern: "lesson day", targetField: "lesson_day", confidence: 0.95 },
  { pattern: "day", targetField: "lesson_day", confidence: 0.60 },
  { pattern: "day of week", targetField: "lesson_day", confidence: 0.85 },
  { pattern: "schedule day", targetField: "lesson_day", confidence: 0.85 },
  { pattern: "regular day", targetField: "lesson_day", confidence: 0.80 },
  { pattern: "recurring day", targetField: "lesson_day", confidence: 0.80 },

  { pattern: "lesson time", targetField: "lesson_time", confidence: 0.95 },
  { pattern: "time", targetField: "lesson_time", confidence: 0.60 },
  { pattern: "start time", targetField: "lesson_time", confidence: 0.85 },
  { pattern: "schedule time", targetField: "lesson_time", confidence: 0.85 },
  { pattern: "regular time", targetField: "lesson_time", confidence: 0.80 },
  { pattern: "recurring time", targetField: "lesson_time", confidence: 0.80 },
  { pattern: "lesson start", targetField: "lesson_time", confidence: 0.80 },

  // ═══════════════════════════════════════════════════════════════
  // ADDRESS FIELDS
  // ═══════════════════════════════════════════════════════════════
  { pattern: "address", targetField: "address_line_1", confidence: 0.80 },
  { pattern: "street", targetField: "address_line_1", confidence: 0.80 },
  { pattern: "street address", targetField: "address_line_1", confidence: 0.85 },
  { pattern: "address line 1", targetField: "address_line_1", confidence: 0.95 },
  { pattern: "address 1", targetField: "address_line_1", confidence: 0.90 },
  { pattern: "home address", targetField: "address_line_1", confidence: 0.80 },
  { pattern: "address line 2", targetField: "address_line_2", confidence: 0.95 },
  { pattern: "address 2", targetField: "address_line_2", confidence: 0.90 },
  { pattern: "city", targetField: "city", confidence: 0.90 },
  { pattern: "town", targetField: "city", confidence: 0.85 },
  { pattern: "suburb", targetField: "city", confidence: 0.75 },
  { pattern: "postcode", targetField: "postcode", confidence: 0.95 },
  { pattern: "zip", targetField: "postcode", confidence: 0.85 },
  { pattern: "zip code", targetField: "postcode", confidence: 0.90 },
  { pattern: "zipcode", targetField: "postcode", confidence: 0.90 },
  { pattern: "postal code", targetField: "postcode", confidence: 0.90 },
  { pattern: "post code", targetField: "postcode", confidence: 0.90 },
  { pattern: "country", targetField: "country", confidence: 0.85 },
  { pattern: "state", targetField: "state", confidence: 0.75 },
  { pattern: "province", targetField: "state", confidence: 0.75 },
  { pattern: "county", targetField: "state", confidence: 0.70 },
  { pattern: "region", targetField: "state", confidence: 0.65 },
  // Opus1 specific
  { pattern: "student_full_address", targetField: "address_line_1", confidence: 0.90, source: "opus1" },
  { pattern: "student_street", targetField: "address_line_1", confidence: 0.90, source: "opus1" },
  { pattern: "student_city", targetField: "city", confidence: 0.95, source: "opus1" },
  { pattern: "student_zip", targetField: "postcode", confidence: 0.90, source: "opus1" },
  { pattern: "student_state", targetField: "state", confidence: 0.85, source: "opus1" },
  { pattern: "student_country", targetField: "country", confidence: 0.85, source: "opus1" },

  // ═══════════════════════════════════════════════════════════════
  // GRADE / SKILL LEVEL
  // ═══════════════════════════════════════════════════════════════
  { pattern: "skill level", targetField: "grade_level", confidence: 0.80 },
  { pattern: "grade", targetField: "grade_level", confidence: 0.70 },
  { pattern: "level", targetField: "grade_level", confidence: 0.60 },
  { pattern: "current grade", targetField: "grade_level", confidence: 0.90 },
  { pattern: "grade level", targetField: "grade_level", confidence: 0.90 },
  { pattern: "experience level", targetField: "grade_level", confidence: 0.80 },
  { pattern: "experience", targetField: "grade_level", confidence: 0.65 },
  { pattern: "proficiency", targetField: "grade_level", confidence: 0.75 },
  { pattern: "ability", targetField: "grade_level", confidence: 0.65 },
  { pattern: "skill", targetField: "grade_level", confidence: 0.60 },
];

/**
 * Normalize a CSV header for matching against the alias dictionary.
 * Lowercases, strips special characters, collapses whitespace.
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9 _]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a CSV header to a LessonLoop target field using the alias dictionary.
 *
 * Priority: 1) Exact source-specific match 2) Exact universal match 3) Contains match
 * Prevents duplicate target assignments via the usedTargets set.
 */
export function matchHeaderToField(
  header: string,
  usedTargets: Set<string>,
  sourceSoftware?: SourceSoftware
): { targetField: string | null; confidence: number; transform?: string } {
  const normalized = normalizeHeader(header);

  // Priority 1: Exact match for the selected source software
  if (sourceSoftware) {
    const sourceMatch = FIELD_ALIASES.find(
      (a) =>
        a.source === sourceSoftware &&
        a.pattern === normalized &&
        !usedTargets.has(a.targetField)
    );
    if (sourceMatch) {
      return {
        targetField: sourceMatch.targetField,
        confidence: sourceMatch.confidence,
        transform: sourceMatch.transform,
      };
    }
  }

  // Priority 2: Exact match (universal — no source or matching source)
  const exactMatch = FIELD_ALIASES.find(
    (a) => a.pattern === normalized && !usedTargets.has(a.targetField)
  );
  if (exactMatch) {
    return {
      targetField: exactMatch.targetField,
      confidence: exactMatch.confidence,
      transform: exactMatch.transform,
    };
  }

  // Priority 3: Contains match (partial, with confidence penalty)
  // Only try if normalized is at least 3 chars to avoid spurious matches
  if (normalized.length >= 3) {
    const containsMatch = FIELD_ALIASES
      .filter((a) => !usedTargets.has(a.targetField))
      .find(
        (a) =>
          (normalized.includes(a.pattern) || a.pattern.includes(normalized)) &&
          a.pattern.length >= 3
      );
    if (containsMatch) {
      return {
        targetField: containsMatch.targetField,
        confidence: Math.round(containsMatch.confidence * 0.8 * 100) / 100,
        transform: containsMatch.transform,
      };
    }
  }

  return { targetField: null, confidence: 0 };
}

/**
 * Auto-detect source software from CSV headers.
 */
export function detectSourceSoftware(headers: string[]): SourceSoftware | null {
  const normalized = headers.map(normalizeHeader);

  // MyMusicStaff: has "parent contact 1" pattern
  if (normalized.some((h) => h.includes("parent contact 1"))) {
    return "mymusicstaff";
  }

  // Opus1: has "student_" underscore pattern
  if (normalized.filter((h) => h.startsWith("student_")).length >= 3) {
    return "opus1";
  }

  return null;
}
