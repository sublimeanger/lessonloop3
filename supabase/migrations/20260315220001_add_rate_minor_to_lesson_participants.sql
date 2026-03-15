-- Snapshot the rate at lesson creation so mid-term rate changes
-- don't retroactively affect billing for already-delivered lessons.
ALTER TABLE lesson_participants
  ADD COLUMN IF NOT EXISTS rate_minor INTEGER;

COMMENT ON COLUMN lesson_participants.rate_minor
  IS 'Rate in minor currency units (pence/cents) snapshotted at lesson creation time';
