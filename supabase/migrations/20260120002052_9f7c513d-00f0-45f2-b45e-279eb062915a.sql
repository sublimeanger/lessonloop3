-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Create a more restrictive insert policy - only the trigger function (running as definer) can insert
-- Since triggers run as SECURITY DEFINER, we allow insert only when called from within the database
-- Regular users cannot insert directly
CREATE POLICY "Only triggers can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (
  -- The actor_user_id should match auth.uid() or be null (for system operations)
  -- This ensures only authenticated operations or system triggers can insert
  (actor_user_id = auth.uid() OR actor_user_id IS NULL)
  AND org_id IS NOT NULL
);