UPDATE locations SET parent_reschedule_policy_override = 'self_service'
WHERE name = 'Crescendo North'
  AND org_id IN ('50357e06-1178-463c-a715-d35404832225','7c75af4b-cdd4-4bd6-a487-51cb246720e2','ff6940b6-ae0e-4abd-9fd8-52d4d544bc19');