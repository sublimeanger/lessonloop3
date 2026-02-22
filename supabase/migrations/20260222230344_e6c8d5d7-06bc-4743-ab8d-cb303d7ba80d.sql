CREATE POLICY "Parents can update their waitlist entries"
  ON make_up_waitlist FOR UPDATE
  USING (guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid()))
  WITH CHECK (guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid()));