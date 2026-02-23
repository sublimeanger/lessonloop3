-- Allow parents to also see messages THEY sent (parent replies)
CREATE POLICY "Parent can view own sent messages"
ON public.message_log
FOR SELECT
USING (
  sender_user_id = auth.uid()
  AND has_org_role(auth.uid(), org_id, 'parent'::app_role)
);