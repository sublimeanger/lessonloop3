-- Add import_batch_id column to students for tracking which import created each student.
-- Enables undo/rollback of entire import batches.

ALTER TABLE students ADD COLUMN IF NOT EXISTS import_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_students_import_batch
  ON students(import_batch_id) WHERE import_batch_id IS NOT NULL;
