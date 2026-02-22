
-- Create a trigger function that calls the edge function via pg_net when waitlist status changes to 'matched'
CREATE OR REPLACE FUNCTION public.notify_makeup_match_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'matched' AND (OLD.status IS NULL OR OLD.status != 'matched') THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/notify-makeup-match',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_makeup_match
  AFTER UPDATE ON make_up_waitlist
  FOR EACH ROW EXECUTE FUNCTION notify_makeup_match_webhook();
