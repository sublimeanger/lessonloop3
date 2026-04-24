-- J9 Phase 2 C1 — message_log.source column for send-path tracking.
-- Prerequisite for shared-core send pipeline refactor (C2) which
-- writes source='user_manual' from existing send-invoice-email fn
-- and source='recurring_scheduler'|'recurring_manual_run' from
-- the new internal wrapper (C3) onwards.
--
-- Design doc §4 scheduler sequence, §5 Run-now sequence.
-- Idempotent.

ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS source text
  DEFAULT 'user_manual';

-- Add CHECK constraint only if it doesn't already exist.
-- IF NOT EXISTS on constraints isn't available pre-PG16 in all
-- Supabase tiers, so wrap in a defensive DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_log_source_check'
      AND conrelid = 'public.message_log'::regclass
  ) THEN
    ALTER TABLE public.message_log
      ADD CONSTRAINT message_log_source_check
      CHECK (source IN (
        'user_manual',
        'recurring_scheduler',
        'recurring_manual_run',
        'parent_portal'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.message_log.source IS
  'Trigger context for the send: user_manual (default, authenticated user send), recurring_scheduler (cron-initiated recurring send), recurring_manual_run (operator-triggered Run-now for recurring template), parent_portal (future — parent-initiated resend).';
