import { z } from 'zod';

// ─── Shared refinements ───────────────────────────────────────────
const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().email('Please enter a valid email address.').optional());

const optionalPhone = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(
    z
      .string()
      .regex(/^\+?[\d\s\-().]{7,20}$/, 'Please enter a valid phone number.')
      .optional(),
  );

const optionalUUID = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .pipe(z.string().uuid().optional());

// ─── Teacher ──────────────────────────────────────────────────────
export const teacherSchema = z.object({
  display_name: z.string().trim().min(1, 'Display name is required.').max(200),
  email: optionalEmail,
  phone: optionalPhone,
  instruments: z.string().trim().optional(), // comma-separated, parsed by caller
  employment_type: z.enum(['contractor', 'employee']).default('contractor'),
  bio: z.string().trim().max(2000).optional(),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;

// ─── Student ──────────────────────────────────────────────────────
export const studentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: optionalEmail,
  phone: optionalPhone,
  dob: z.string().optional(),
  notes: z.string().trim().max(5000).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

// ─── Lesson ───────────────────────────────────────────────────────
export const lessonSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  start_at: z.string().min(1, 'Start time is required.'),
  duration_mins: z.coerce.number().int().min(15, 'Minimum 15 minutes.').max(480, 'Maximum 8 hours.'),
  teacher_id: z.string().uuid('Please select a teacher.'),
  location_id: optionalUUID,
});

export type LessonFormValues = z.infer<typeof lessonSchema>;

// ─── Invoice item ─────────────────────────────────────────────────
export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.').max(500),
  quantity: z.coerce.number().min(0, 'Quantity must be 0 or more.'),
  unit_price: z.coerce.number().min(0, 'Price must be 0 or more.'),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>;

// ─── Organisation settings ────────────────────────────────────────
export const organisationSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  timezone: z.string().min(1, 'Timezone is required.'),
  currency_code: z.string().length(3, 'Currency code must be 3 characters.'),
  cancellation_notice_hours: z.coerce.number().int().min(0, 'Must be 0 or more.').default(0),
});

export type OrganisationSettingsFormValues = z.infer<typeof organisationSettingsSchema>;

// ─── Guardian (new) ───────────────────────────────────────────────
export const newGuardianSchema = z.object({
  full_name: z.string().trim().min(1, 'Guardian name is required.').max(200),
  email: optionalEmail,
  phone: optionalPhone,
});

export type NewGuardianFormValues = z.infer<typeof newGuardianSchema>;
