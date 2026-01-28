-- Track first-run completion and path
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_run_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS first_run_path TEXT;

-- Scheduling policy for parent portal
ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS parent_reschedule_policy TEXT DEFAULT 'request_only';

-- Add constraint for valid values
ALTER TABLE organisations 
ADD CONSTRAINT organisations_parent_reschedule_policy_check 
CHECK (parent_reschedule_policy IN ('self_service', 'request_only', 'admin_locked'));

-- Location-level override for mixed contexts (agencies with both school and studio locations)
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS parent_reschedule_policy_override TEXT DEFAULT NULL;

-- Add constraint for valid values (allowing NULL)
ALTER TABLE locations 
ADD CONSTRAINT locations_parent_reschedule_policy_override_check 
CHECK (parent_reschedule_policy_override IS NULL OR parent_reschedule_policy_override IN ('self_service', 'request_only', 'admin_locked'));

-- Set smart defaults based on org_type for existing organisations
UPDATE organisations 
SET parent_reschedule_policy = CASE 
  WHEN org_type = 'solo_teacher' THEN 'self_service'
  WHEN org_type = 'agency' THEN 'admin_locked'
  ELSE 'request_only'
END
WHERE parent_reschedule_policy IS NULL OR parent_reschedule_policy = 'request_only';

-- Comment for documentation
COMMENT ON COLUMN organisations.parent_reschedule_policy IS 'Controls how parents can request lesson changes: self_service (pick slots), request_only (message admin), admin_locked (no portal reschedule)';
COMMENT ON COLUMN locations.parent_reschedule_policy_override IS 'Per-location override for parent reschedule policy (e.g., lock school locations while allowing self-service at studio)';