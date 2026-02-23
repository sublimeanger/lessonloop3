-- Drop unused get_user_id_by_email function that enables email enumeration.
-- This SECURITY DEFINER function queries auth.users directly and is callable
-- by any authenticated user, allowing attackers to discover which email
-- addresses exist in the system.
-- No application code references this function.
DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);
