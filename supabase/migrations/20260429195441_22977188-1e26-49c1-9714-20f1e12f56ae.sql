-- Move Jack Douglas's Violin lessons in the next 3 weeks from Crescendo Central to Crescendo North
-- across all 3 duplicate Crescendo Music Agency orgs, so demo-parent-3 has lessons at all 3 locations.

UPDATE lessons le
SET location_id = (
  SELECT id FROM locations
  WHERE name = 'Crescendo North' AND org_id = le.org_id
  LIMIT 1
)
WHERE le.id IN (
  '8fcd61c8-b3b9-430b-9904-cdaceec85b33',
  '76ac78c5-ea36-457f-83a5-70514daca36f',
  '8ed64dcc-c875-48d6-b248-bcab6bf94a22',
  'fc43d367-3d31-4d10-93f9-f004ec8303f5',
  '9ec633ec-cffd-47ef-a196-10c90bf1a16b',
  '3c71a0ff-3b8a-4b1d-a148-2f586531619b'
);