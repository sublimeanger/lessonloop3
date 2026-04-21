BEGIN;

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