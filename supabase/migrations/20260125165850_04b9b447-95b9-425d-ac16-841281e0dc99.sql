-- Delete orphan org_memberships for users without proper onboarding
DELETE FROM public.org_memberships 
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE has_completed_onboarding = false
);

-- Delete orphan profiles (users who never completed onboarding)
DELETE FROM public.profiles 
WHERE has_completed_onboarding = false;