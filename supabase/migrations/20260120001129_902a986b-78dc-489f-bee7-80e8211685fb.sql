-- Create pay rate type enum
CREATE TYPE public.pay_rate_type AS ENUM ('per_lesson', 'hourly', 'percentage');

-- Extend teacher_profiles with payroll fields
ALTER TABLE public.teacher_profiles
ADD COLUMN pay_rate_type public.pay_rate_type DEFAULT 'per_lesson',
ADD COLUMN pay_rate_value numeric DEFAULT 0,
ADD COLUMN payroll_notes text;

-- Add index for payroll queries
CREATE INDEX idx_lessons_teacher_completed ON public.lessons(teacher_user_id, status) WHERE status = 'completed';