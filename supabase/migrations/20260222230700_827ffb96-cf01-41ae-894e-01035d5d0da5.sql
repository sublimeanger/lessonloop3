CREATE POLICY "Parent can update own guardian"
  ON guardians FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());