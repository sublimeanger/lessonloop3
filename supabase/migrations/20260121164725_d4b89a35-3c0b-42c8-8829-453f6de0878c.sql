-- Create rate_limits table for tracking API usage
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Composite unique constraint for upsert operations
  CONSTRAINT rate_limits_user_action_window UNIQUE (user_id, action_type, window_start)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON public.rate_limits (user_id, action_type, window_start DESC);

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limits (no user access needed)
-- This table is managed by edge functions using service role key

-- Create function to check and increment rate limit
-- Returns true if request is allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _action_type text,
  _max_requests integer,
  _window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_start timestamptz;
  _current_count integer;
BEGIN
  -- Calculate window start (truncate to window size)
  _window_start := date_trunc('minute', now()) - 
    (EXTRACT(MINUTE FROM now())::integer % _window_minutes) * INTERVAL '1 minute';
  
  -- Try to insert or update the rate limit record
  INSERT INTO public.rate_limits (user_id, action_type, window_start, request_count)
  VALUES (_user_id, _action_type, _window_start, 1)
  ON CONFLICT (user_id, action_type, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO _current_count;
  
  -- Check if under limit
  RETURN _current_count <= _max_requests;
END;
$$;

-- Cleanup function to remove old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;