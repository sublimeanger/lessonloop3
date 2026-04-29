DO $$
DECLARE
  v_uid uuid;
  v_g uuid;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','3ebf4217-6d19-49bd-801c-268b8a1a6bad','role','authenticated')::text, true);
  v_uid := auth.uid();
  RAISE NOTICE 'auth.uid() = %', v_uid;

  SELECT id INTO v_g FROM public.guardians WHERE user_id = v_uid AND deleted_at IS NULL LIMIT 1;
  RAISE NOTICE 'guardian lookup = %', v_g;
END $$;