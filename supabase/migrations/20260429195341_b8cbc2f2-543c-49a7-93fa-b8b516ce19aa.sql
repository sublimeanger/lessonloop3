-- Test data setup for Batch 2D verification (J2-F24 location reschedule policy override)
-- Set 3 Crescendo Music Agency demo orgs to self_service at org level,
-- and configure per-location overrides to test all three precedence paths.

UPDATE organisations
SET parent_reschedule_policy = 'self_service'
WHERE id IN (
  '50357e06-1178-463c-a715-d35404832225',
  '7c75af4b-cdd4-4bd6-a487-51cb246720e2',
  'ff6940b6-ae0e-4abd-9fd8-52d4d544bc19'
);

-- Location A (Crescendo Central): NULL override -> inherits org self_service
UPDATE locations SET parent_reschedule_policy_override = NULL
WHERE name = 'Crescendo Central'
  AND org_id IN ('50357e06-1178-463c-a715-d35404832225','7c75af4b-cdd4-4bd6-a487-51cb246720e2','ff6940b6-ae0e-4abd-9fd8-52d4d544bc19');

-- Location B (Crescendo North): admin_locked
UPDATE locations SET parent_reschedule_policy_override = 'admin_locked'
WHERE name = 'Crescendo North'
  AND org_id IN ('50357e06-1178-463c-a715-d35404832225','7c75af4b-cdd4-4bd6-a487-51cb246720e2','ff6940b6-ae0e-4abd-9fd8-52d4d544bc19');

-- Location C (Online): request_only
UPDATE locations SET parent_reschedule_policy_override = 'request_only'
WHERE name = 'Online'
  AND org_id IN ('50357e06-1178-463c-a715-d35404832225','7c75af4b-cdd4-4bd6-a487-51cb246720e2','ff6940b6-ae0e-4abd-9fd8-52d4d544bc19');