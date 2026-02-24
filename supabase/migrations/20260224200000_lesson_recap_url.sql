-- Add recap_url column for post-lesson recording/recap links
-- Distinct from online_meeting_url which is for live meeting links
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS recap_url text;

-- No additional RLS needed — lessons table already has RLS policies
