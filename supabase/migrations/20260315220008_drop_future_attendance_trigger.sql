-- Fix 2: Remove the prevent_future_attendance trigger
-- The trigger raises an exception on any attendance insert where lesson.start_at > NOW().
-- This breaks the "Mark Complete" flow which first sets lesson status to 'completed'
-- then inserts attendance records — for future lessons the trigger kills the insert,
-- leaving the lesson stuck as completed with no attendance.
--
-- The client-side guard in useUpdateAttendance already prevents users from marking
-- attendance for future lessons (checks lesson.start_at > new Date()), making this
-- trigger redundant and harmful.

DROP TRIGGER IF EXISTS trg_attendance_not_future ON attendance_records;
DROP FUNCTION IF EXISTS check_attendance_not_future();
