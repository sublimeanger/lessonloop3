
-- Create kickstarter_signups table for email capture
CREATE TABLE public.kickstarter_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on email
ALTER TABLE public.kickstarter_signups ADD CONSTRAINT kickstarter_signups_email_unique UNIQUE (email);

-- Enable RLS
ALTER TABLE public.kickstarter_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public signup form)
CREATE POLICY "Anyone can sign up for kickstarter updates"
ON public.kickstarter_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can view signups (via service role / edge functions)
-- No SELECT policy for anon = signups not readable publicly
