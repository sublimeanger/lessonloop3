
-- Drop the existing overly-permissive parent UPDATE policy
DROP POLICY IF EXISTS "Parents can update their waitlist entries" ON make_up_waitlist;

-- Create a tighter policy: parents can only change status from 'offered' to 'accepted'/'declined',
-- or from 'declined' to 'waiting' (for the reset flow)
CREATE POLICY "Parents can respond to waitlist offers"
ON make_up_waitlist
FOR UPDATE
USING (
  guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())
)
WITH CHECK (
  guardian_id IN (SELECT id FROM guardians WHERE user_id = auth.uid())
  AND status IN ('accepted', 'declined', 'waiting')
);
