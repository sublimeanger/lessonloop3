-- BR9: Add unique constraint on xero_entity_mappings to support
-- upsert of sync attempts keyed on (org_id, entity_type, local_id).
--
-- Each local entity (invoice, payment) should have at most one sync
-- mapping row per org. Retrying a sync updates the existing row
-- rather than creating duplicates.

BEGIN;

-- Idempotent: only add if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.xero_entity_mappings'::regclass
    AND conname = 'xero_entity_mappings_org_entity_local_key'
  ) THEN
    ALTER TABLE xero_entity_mappings
      ADD CONSTRAINT xero_entity_mappings_org_entity_local_key
      UNIQUE (org_id, entity_type, local_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
