
-- Tighten the payment_notifications INSERT policy to require org staff
DROP POLICY IF EXISTS "Service role can insert payment notifications" ON public.payment_notifications;
CREATE POLICY "Staff or service can insert payment notifications"
  ON public.payment_notifications FOR INSERT
  WITH CHECK (is_org_staff(auth.uid(), org_id));
