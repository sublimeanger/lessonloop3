-- s38 Phase 0 — add 'executing' to ai_action_proposals.status CHECK constraint.
--
-- Background: looopassist-execute/index.ts:130-138 performs an atomic claim:
--   UPDATE ai_action_proposals SET status='executing' WHERE status='proposed' ... RETURNING id
-- The original CHECK constraint allowed only
--   ['proposed','confirmed','executed','failed','cancelled']
-- so 'executing' was rejected, the UPDATE matched zero rows, .single() returned
-- PGRST116, and the code returned 409 "Proposal already processed" — every
-- LoopAssist write-action confirm click had silently failed since ~2026-03-04.
--
-- Applied live via Supabase MCP on 2026-05-11 (chat-applied hotfix). Recorded
-- here for schema-as-code tracking. Idempotent: safe to re-apply.

ALTER TABLE ai_action_proposals DROP CONSTRAINT IF EXISTS ai_action_proposals_status_check;

ALTER TABLE ai_action_proposals ADD CONSTRAINT ai_action_proposals_status_check
  CHECK (status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'executing'::text, 'executed'::text, 'failed'::text, 'cancelled'::text]));

COMMENT ON CONSTRAINT ai_action_proposals_status_check ON ai_action_proposals IS
  'Allowed proposal lifecycle states. proposed -> executing (atomic claim by looopassist-execute) -> executed | failed. cancelled is set by user cancel. confirmed is legacy unused.';
