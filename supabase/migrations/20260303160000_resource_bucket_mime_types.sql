-- TERM-M4: Server-side file type validation for teaching-resources bucket.
-- Extends allowed MIME types to match the client-side ALLOWED_TYPES list.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
  'video/mp4', 'video/webm',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]
WHERE id = 'teaching-resources';
