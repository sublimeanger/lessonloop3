-- Fix infinite recursion: the "Teachers see full threads" policy queries message_log inside message_log RLS.
-- Replace with a security definer function that bypasses RLS.

CREATE OR REPLACE FUNCTION public.teacher_has_thread_access(_teacher_user_id uuid, _thread_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.message_log ml
    WHERE ml.thread_id = _thread_id
      AND ml.org_id = _org_id
      AND ml.related_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.student_teacher_assignments sta
        WHERE sta.student_id = ml.related_id
          AND sta.org_id = ml.org_id
          AND sta.teacher_user_id = _teacher_user_id
      )
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Teachers see full threads they have access to" ON public.message_log;

-- Recreate it using the security definer function
CREATE POLICY "Teachers see full threads they have access to"
ON public.message_log
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher'::app_role)
  AND thread_id IS NOT NULL
  AND teacher_has_thread_access(auth.uid(), thread_id, org_id)
  AND EXISTS (
    SELECT 1 FROM org_messaging_settings oms
    WHERE oms.org_id = message_log.org_id AND oms.parent_can_message_teacher = true
  )
);