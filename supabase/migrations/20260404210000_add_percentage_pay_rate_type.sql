DO $$
BEGIN
  ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_pay_rate_type_check;
  ALTER TABLE teachers ADD CONSTRAINT teachers_pay_rate_type_check
    CHECK (pay_rate_type IS NULL OR pay_rate_type IN ('per_lesson', 'hourly', 'percentage')) NOT VALID;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
