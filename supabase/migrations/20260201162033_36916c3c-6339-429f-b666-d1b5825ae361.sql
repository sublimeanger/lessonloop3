-- Create teacher records for solo_teacher org owners who don't have one
INSERT INTO teachers (org_id, user_id, display_name, email, status)
SELECT 
  o.id as org_id,
  om.user_id,
  p.full_name as display_name,
  p.email,
  'active' as status
FROM organisations o
JOIN org_memberships om ON o.id = om.org_id AND om.role = 'owner'
JOIN profiles p ON om.user_id = p.id
LEFT JOIN teachers t ON t.org_id = o.id AND t.user_id = om.user_id
WHERE o.org_type = 'solo_teacher'
AND t.id IS NULL;