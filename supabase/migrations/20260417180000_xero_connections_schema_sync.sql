-- =============================================================================
-- xero_connections schema sync
--
-- Sync migration — xero_connections table was created outside of version
-- control (pre-2026-04-17). These columns existed in live DB state at the
-- time this migration was written.
--
-- Purpose: allow fresh environment setup to reach the same state as
-- production. Without this, a new Supabase project set up from this repo
-- would lack the connected_by column (causing PGRST204 on Xero connect) and
-- would enforce user_id NOT NULL (causing constraint violations because no
-- code path actually writes to user_id — only connected_by is written).
--
-- Applied live via Lovable SQL editor on 2026-04-17 to unblock Xero OAuth
-- connect. This file retrofits the same DDL into version-controlled form.
--
-- Idempotent: safe to re-run. Each statement guards against double-apply.
-- =============================================================================

-- Add connected_by column if not present (references auth.users).
ALTER TABLE public.xero_connections
  ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id);

-- Drop NOT NULL on user_id only if it is currently set, to avoid errors on
-- re-run or on environments where the constraint has already been relaxed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'xero_connections'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.xero_connections ALTER COLUMN user_id DROP NOT NULL';
  END IF;
END;
$$;

-- Refresh PostgREST schema cache so the API recognises the new column shape.
NOTIFY pgrst, 'reload schema';
