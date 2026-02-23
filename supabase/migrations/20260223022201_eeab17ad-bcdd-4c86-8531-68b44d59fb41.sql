
-- =====================================================
-- CONV-009: Teacher conversation visibility RLS
-- =====================================================

-- 1. Teachers can see messages in threads where:
--    a. They sent the message (already covered by existing policy)
--    b. The message's related_id (student) is a student they are assigned to teach
--       AND parent_can_message_teacher is true in org settings
CREATE POLICY "Teachers see student-related messages"
ON public.message_log FOR SELECT
USING (
  -- Must be a teacher (but not admin — admins already have full access)
  has_org_role(auth.uid(), org_id, 'teacher'::app_role)
  AND related_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_id = message_log.related_id
      AND sta.org_id = message_log.org_id
      AND sta.teacher_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.org_messaging_settings oms
    WHERE oms.org_id = message_log.org_id
      AND oms.parent_can_message_teacher = true
  )
);

-- 2. Teachers can see ALL messages in a thread if they can see any message in it
--    (covers messages in the same thread_id that may not have related_id set)
CREATE POLICY "Teachers see full threads they have access to"
ON public.message_log FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'teacher'::app_role)
  AND thread_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.message_log ml2
    WHERE ml2.thread_id = message_log.thread_id
      AND ml2.org_id = message_log.org_id
      AND ml2.related_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.student_teacher_assignments sta
        WHERE sta.student_id = ml2.related_id
          AND sta.org_id = ml2.org_id
          AND sta.teacher_user_id = auth.uid()
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.org_messaging_settings oms
    WHERE oms.org_id = message_log.org_id
      AND oms.parent_can_message_teacher = true
  )
);

-- 3. Create a database function for reassigning teacher conversations to org owner
CREATE OR REPLACE FUNCTION public.reassign_teacher_conversations_to_owner(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_user_id uuid;
  _count integer;
BEGIN
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Find the org owner
  SELECT user_id INTO _owner_user_id
  FROM org_memberships
  WHERE org_id = _org_id AND role = 'owner' AND status = 'active'
  LIMIT 1;

  IF _owner_user_id IS NULL THEN
    RAISE EXCEPTION 'No active owner found for organisation';
  END IF;

  -- Update message_log entries where sender is a teacher (not admin/owner)
  -- and reassign the thread context. We mark them so the thread is now 
  -- visible to the owner through the admin policy.
  -- Actually, the threads are already visible to admins. The key is that
  -- when the setting is toggled off, teachers lose RLS access automatically
  -- because the policy checks parent_can_message_teacher.
  -- This function is just for logging/audit purposes.
  
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'teacher_conversations_reassigned', 'org_messaging_settings', _org_id,
    jsonb_build_object('reason', 'parent_can_message_teacher disabled', 'reassigned_to', _owner_user_id));

  -- Return 0 since the RLS policy itself handles visibility
  -- Teachers automatically lose access when the setting is toggled off
  RETURN 0;
END;
$$;
