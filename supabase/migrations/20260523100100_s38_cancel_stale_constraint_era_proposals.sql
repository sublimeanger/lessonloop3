-- s38 Phase 0.3 — bulk-cancel stale 'proposed' rows from the constraint-bug era.
--
-- The ai_action_proposals CHECK constraint blocked the 'executing' transition
-- from at least 2026-03-04 until the s38 hotfix on 2026-05-11. During that
-- window every confirm click silently returned 409 ("Proposal already
-- processed") and the proposal stayed in status='proposed' forever.
--
-- Those rows reference data (invoices, lessons, students) that has since
-- changed; auto-running them now would be unsafe. They should retire as
-- cancelled with an audit reason. Proposals created on or after 2026-05-11
-- are excluded — they're either fresh tests post-fix or the live shadow
-- studio proposal Jamie is mid-way verifying.

INSERT INTO audit_log (org_id, actor_user_id, entity_type, entity_id, action, after)
SELECT
  org_id,
  NULL,
  'ai_action_proposal',
  id,
  'bulk_cancel_stale_from_constraint_bug',
  jsonb_build_object(
    'reason',
    's38 cleanup — proposal created during the window where CHECK constraint blocked the executing transition; never actually run; retiring as cancelled.'
  )
FROM ai_action_proposals
WHERE status = 'proposed'
  AND created_at < '2026-05-11'::timestamptz;

UPDATE ai_action_proposals
SET
  status = 'cancelled',
  result = jsonb_build_object(
    'reason',
    's38 cleanup: stale proposal from CHECK constraint bug era'
  )
WHERE status = 'proposed'
  AND created_at < '2026-05-11'::timestamptz;
