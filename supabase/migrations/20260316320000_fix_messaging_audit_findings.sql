-- =====================================================
-- Fix messaging audit findings (MSG-H1, MSG-H2, MSG-M2, MSG-M3, MSG-L5)
-- =====================================================

-- ── MSG-H1 (HIGH): payment_notifications INSERT WITH CHECK (true) ──
-- Any authenticated user can inject fake payment notifications.
-- Service role already bypasses RLS, so drop the permissive policy.
DROP POLICY IF EXISTS "Service role can insert payment notifications" ON public.payment_notifications;

-- Block all authenticated INSERT — only service role (webhooks/edge functions) can insert
CREATE POLICY "Block authenticated insert on payment_notifications"
  ON public.payment_notifications FOR INSERT TO authenticated
  WITH CHECK (false);


-- ── MSG-H2 (HIGH): internal_messages missing DELETE policy ──
-- Delete button silently fails. Add sender + admin delete policies.

-- Sender can delete their own sent messages
CREATE POLICY "Sender can delete own internal messages"
  ON public.internal_messages FOR DELETE
  USING (
    sender_user_id = auth.uid()
    AND is_org_member(auth.uid(), org_id)
  );

-- Admins/owners can delete any internal message in their org
CREATE POLICY "Admins can delete any internal message"
  ON public.internal_messages FOR DELETE
  USING (
    is_org_admin(auth.uid(), org_id)
  );


-- ── MSG-M2 (MEDIUM): notification_preferences INSERT missing org check ──
-- User can create prefs for orgs they don't belong to.
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_org_member(auth.uid(), org_id)
  );


-- ── MSG-M3 (MEDIUM): message_log INSERT too permissive ──
-- Parents and finance can insert raw rows bypassing edge function validation.
-- All message creation goes through edge functions using service role (bypasses RLS).
DROP POLICY IF EXISTS "System can insert message logs" ON public.message_log;
DROP POLICY IF EXISTS "Teachers can insert messages" ON public.message_log;

-- Block all direct authenticated INSERT — messages must go through edge functions
CREATE POLICY "Block authenticated insert on message_log"
  ON public.message_log FOR INSERT TO authenticated
  WITH CHECK (false);


-- ── MSG-L5 (LOW): internal_messages sender_role/recipient_role CHECK too restrictive ──
-- Finance users have Messages in nav but can't send due to CHECK constraint.
ALTER TABLE public.internal_messages DROP CONSTRAINT IF EXISTS internal_messages_sender_role_check;
ALTER TABLE public.internal_messages ADD CONSTRAINT internal_messages_sender_role_check
  CHECK (sender_role IN ('owner', 'admin', 'teacher', 'finance'));

ALTER TABLE public.internal_messages DROP CONSTRAINT IF EXISTS internal_messages_recipient_role_check;
ALTER TABLE public.internal_messages ADD CONSTRAINT internal_messages_recipient_role_check
  CHECK (recipient_role IN ('owner', 'admin', 'teacher', 'finance'));
