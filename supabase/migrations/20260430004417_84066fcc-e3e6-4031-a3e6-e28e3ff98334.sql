UPDATE billing_runs
SET status = 'failed',
    summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
      'walk_note', 'Marked failed by canary walk J2 (2026-04-30): legacy pending row with no linked invoices, blocking fresh walk.'
    )
WHERE id = '781daaf5-21e1-4c46-9680-e4b020a720fb'
  AND org_id = '7c75af4b-cdd4-4bd6-a487-51cb246720e2'
  AND status = 'pending';