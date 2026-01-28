-- Phase 1: Rock-Steady System Hardening - Schema Changes

-- 1. Lessons table: Add cancellation tracking
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Rooms table: Add capacity for group lesson validation
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 10;

-- 3. Organisations table: Add hardening settings
ALTER TABLE public.organisations 
ADD COLUMN IF NOT EXISTS buffer_minutes_between_locations INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overdue_reminder_days INTEGER[] DEFAULT '{7, 14, 30}',
ADD COLUMN IF NOT EXISTS auto_pause_lessons_after_days INTEGER;

-- 4. Student_guardians table: Add notification preferences for multi-guardian support
ALTER TABLE public.student_guardians 
ADD COLUMN IF NOT EXISTS receives_billing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receives_schedule BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS receives_practice BOOLEAN DEFAULT true;

-- 5. Recurrence_rules table: Add exception dates for skip functionality
ALTER TABLE public.recurrence_rules 
ADD COLUMN IF NOT EXISTS exception_dates DATE[];

-- 6. Invoice_items table: Add audit trail for ledger integrity
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS source_rate_card_id UUID REFERENCES public.rate_cards(id),
ADD COLUMN IF NOT EXISTS calculation_notes TEXT;