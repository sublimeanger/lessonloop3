-- ============================================
-- B12) MESSAGE_TEMPLATES TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Admins can delete message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Admins can update message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Org members can view message templates" ON public.message_templates;

-- SELECT: Staff only
CREATE POLICY "Staff can view message templates"
ON public.message_templates FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

-- INSERT/UPDATE/DELETE: Admin only
CREATE POLICY "Admin can create message templates"
ON public.message_templates FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update message templates"
ON public.message_templates FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete message templates"
ON public.message_templates FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B13) MESSAGE_LOG TABLE - Updated RLS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Org admins can view message logs" ON public.message_log;
DROP POLICY IF EXISTS "Parents can view messages about their children" ON public.message_log;
DROP POLICY IF EXISTS "System can insert message logs" ON public.message_log;
DROP POLICY IF EXISTS "Teachers can insert messages" ON public.message_log;
DROP POLICY IF EXISTS "Teachers can view messages they sent" ON public.message_log;

-- SELECT: Admin, or own sent messages, or parent recipient
CREATE POLICY "Admin can view all message logs"
ON public.message_log FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Staff can view own sent messages"
ON public.message_log FOR SELECT
USING (
  is_org_staff(auth.uid(), org_id)
  AND sender_user_id = auth.uid()
);

CREATE POLICY "Parent can view received messages"
ON public.message_log FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND recipient_type = 'guardian'
  AND recipient_id IN (
    SELECT id FROM public.guardians WHERE user_id = auth.uid()
  )
);

-- INSERT: Staff only with sender = self
CREATE POLICY "Staff can insert messages"
ON public.message_log FOR INSERT
WITH CHECK (
  is_org_staff(auth.uid(), org_id)
  AND sender_user_id = auth.uid()
);

-- ============================================
-- B14) AI TABLES - Staff only
-- ============================================

-- AI_CONVERSATIONS
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;

-- SELECT/INSERT/UPDATE/DELETE: Staff only, own conversations
CREATE POLICY "Staff can view own conversations"
ON public.ai_conversations FOR SELECT
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can create own conversations"
ON public.ai_conversations FOR INSERT
WITH CHECK (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can update own conversations"
ON public.ai_conversations FOR UPDATE
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can delete own conversations"
ON public.ai_conversations FOR DELETE
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

-- AI_MESSAGES
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.ai_messages;

CREATE POLICY "Staff can view own ai messages"
ON public.ai_messages FOR SELECT
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can create ai messages"
ON public.ai_messages FOR INSERT
WITH CHECK (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

-- AI_ACTION_PROPOSALS
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create own action proposals" ON public.ai_action_proposals;
DROP POLICY IF EXISTS "Users can update own action proposals" ON public.ai_action_proposals;
DROP POLICY IF EXISTS "Users can view own action proposals" ON public.ai_action_proposals;

CREATE POLICY "Staff can view own action proposals"
ON public.ai_action_proposals FOR SELECT
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can create action proposals"
ON public.ai_action_proposals FOR INSERT
WITH CHECK (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Staff can update own action proposals"
ON public.ai_action_proposals FOR UPDATE
USING (
  is_org_staff(auth.uid(), org_id)
  AND user_id = auth.uid()
);

-- ============================================
-- B15) CONFIG TABLES - Staff only for read
-- ============================================

-- RECURRENCE_RULES
DROP POLICY IF EXISTS "Org admins can create recurrence rules" ON public.recurrence_rules;
DROP POLICY IF EXISTS "Org admins can delete recurrence rules" ON public.recurrence_rules;
DROP POLICY IF EXISTS "Org admins can update recurrence rules" ON public.recurrence_rules;
DROP POLICY IF EXISTS "Org members can view recurrence rules" ON public.recurrence_rules;

CREATE POLICY "Staff can view recurrence rules"
ON public.recurrence_rules FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Scheduler can create recurrence rules"
ON public.recurrence_rules FOR INSERT
WITH CHECK (is_org_scheduler(auth.uid(), org_id));

CREATE POLICY "Admin can update recurrence rules"
ON public.recurrence_rules FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete recurrence rules"
ON public.recurrence_rules FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- LOCATIONS
DROP POLICY IF EXISTS "Admins can create locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can delete locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can update locations" ON public.locations;
DROP POLICY IF EXISTS "Members can view org locations" ON public.locations;
DROP POLICY IF EXISTS "Parents can view lesson locations" ON public.locations;

CREATE POLICY "Staff can view locations"
ON public.locations FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parent can view locations"
ON public.locations FOR SELECT
USING (has_org_role(auth.uid(), org_id, 'parent'));

CREATE POLICY "Admin can create locations"
ON public.locations FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update locations"
ON public.locations FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete locations"
ON public.locations FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ROOMS
DROP POLICY IF EXISTS "Org admins can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Org admins can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Org admins can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Org members can view rooms" ON public.rooms;

CREATE POLICY "Staff can view rooms"
ON public.rooms FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Admin can create rooms"
ON public.rooms FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update rooms"
ON public.rooms FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete rooms"
ON public.rooms FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- CLOSURE_DATES
DROP POLICY IF EXISTS "Org admins can create closure dates" ON public.closure_dates;
DROP POLICY IF EXISTS "Org admins can delete closure dates" ON public.closure_dates;
DROP POLICY IF EXISTS "Org admins can update closure dates" ON public.closure_dates;
DROP POLICY IF EXISTS "Org members can view closure dates" ON public.closure_dates;

CREATE POLICY "Staff can view closure dates"
ON public.closure_dates FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Admin can create closure dates"
ON public.closure_dates FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can update closure dates"
ON public.closure_dates FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admin can delete closure dates"
ON public.closure_dates FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

-- ============================================
-- B16) TEACHER/AVAILABILITY TABLES
-- ============================================

-- TEACHER_PROFILES (keep existing - users manage own)
-- Already has correct policies

-- AVAILABILITY_BLOCKS
DROP POLICY IF EXISTS "Org members can view availability blocks" ON public.availability_blocks;
DROP POLICY IF EXISTS "Teachers can create own availability, admins can create for all" ON public.availability_blocks;
DROP POLICY IF EXISTS "Teachers can delete own availability, admins can delete all" ON public.availability_blocks;
DROP POLICY IF EXISTS "Teachers can update own availability, admins can update all" ON public.availability_blocks;

CREATE POLICY "Staff can view availability blocks"
ON public.availability_blocks FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Teacher can create own availability blocks"
ON public.availability_blocks FOR INSERT
WITH CHECK (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Teacher can update own availability blocks"
ON public.availability_blocks FOR UPDATE
USING (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Teacher can delete own availability blocks"
ON public.availability_blocks FOR DELETE
USING (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

-- AVAILABILITY_TEMPLATES
DROP POLICY IF EXISTS "Users can delete their own availability" ON public.availability_templates;
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability_templates;
DROP POLICY IF EXISTS "Users can update their own availability" ON public.availability_templates;
DROP POLICY IF EXISTS "Users can view availability in their org" ON public.availability_templates;

CREATE POLICY "Staff can view availability templates"
ON public.availability_templates FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "User can create own availability templates"
ON public.availability_templates FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_org_staff(auth.uid(), org_id));

CREATE POLICY "User can update own availability templates"
ON public.availability_templates FOR UPDATE
USING (user_id = auth.uid() AND is_org_staff(auth.uid(), org_id));

CREATE POLICY "User can delete own availability templates"
ON public.availability_templates FOR DELETE
USING (user_id = auth.uid() AND is_org_staff(auth.uid(), org_id));

-- TIME_OFF_BLOCKS
DROP POLICY IF EXISTS "Org members can view time off blocks" ON public.time_off_blocks;
DROP POLICY IF EXISTS "Teachers can create own time off, admins can create for all" ON public.time_off_blocks;
DROP POLICY IF EXISTS "Teachers can delete own time off, admins can delete all" ON public.time_off_blocks;
DROP POLICY IF EXISTS "Teachers can update own time off, admins can update all" ON public.time_off_blocks;

CREATE POLICY "Staff can view time off blocks"
ON public.time_off_blocks FOR SELECT
USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Teacher can create own time off"
ON public.time_off_blocks FOR INSERT
WITH CHECK (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Teacher can update own time off"
ON public.time_off_blocks FOR UPDATE
USING (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

CREATE POLICY "Teacher can delete own time off"
ON public.time_off_blocks FOR DELETE
USING (
  (teacher_user_id = auth.uid() AND has_org_role(auth.uid(), org_id, 'teacher'))
  OR is_org_admin(auth.uid(), org_id)
);

-- ============================================
-- B17) AUDIT_LOG - Tighten INSERT policy
-- ============================================

DROP POLICY IF EXISTS "Only triggers can insert audit logs" ON public.audit_log;

CREATE POLICY "Audit log insert requires org membership"
ON public.audit_log FOR INSERT
WITH CHECK (
  (actor_user_id = auth.uid() OR actor_user_id IS NULL)
  AND is_org_member(auth.uid(), org_id)
);