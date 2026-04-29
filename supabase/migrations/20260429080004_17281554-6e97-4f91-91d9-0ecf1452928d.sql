CREATE TABLE IF NOT EXISTS public._spotcheck_log (id serial primary key, ts timestamptz default now(), label text, value jsonb);
TRUNCATE public._spotcheck_log;

DO $$
DECLARE v_uid uuid; v_g uuid; v_g_count int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','3ebf4217-6d19-49bd-801c-268b8a1a6bad','role','authenticated')::text, true);
  v_uid := auth.uid();
  SELECT id INTO v_g FROM public.guardians WHERE user_id = v_uid AND deleted_at IS NULL LIMIT 1;
  SELECT count(*) INTO v_g_count FROM public.guardians WHERE user_id = v_uid;
  INSERT INTO public._spotcheck_log(label,value) VALUES
    ('uid', to_jsonb(v_uid)),
    ('guardian_id_lookup', to_jsonb(v_g)),
    ('guardian_count_no_filter', to_jsonb(v_g_count));
END $$;