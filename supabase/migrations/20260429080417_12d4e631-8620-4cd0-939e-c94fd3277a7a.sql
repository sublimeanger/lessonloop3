TRUNCATE public._spotcheck_log;

WITH new_lesson AS (
  INSERT INTO lessons (id, org_id, title, start_at, end_at, status, lesson_type, is_open_slot, teacher_id, location_id, created_by)
  VALUES ('aaaa1111-aaaa-1111-aaaa-111111111111','50357e06-1178-463c-a715-d35404832225',
    'Make-up — Charlotte (booked)', now()+interval '3 days', now()+interval '3 days'+interval '30 minutes',
    'scheduled','private',false,'54c26ce4-e742-412d-9e79-7742442dcb00',
    'e1fda18a-89cc-4e90-8f1f-df5b14bbb516','829d878e-83be-4241-b49f-f8efc5ed9e5e')
  ON CONFLICT (id) DO UPDATE SET status='scheduled' RETURNING id, org_id
)
INSERT INTO lesson_participants (lesson_id, student_id, org_id)
SELECT id, 'c74a871b-4d3a-4f59-ae5e-bb8be1ed4181', org_id FROM new_lesson
ON CONFLICT DO NOTHING;

INSERT INTO make_up_waitlist (
  id, org_id, student_id, guardian_id, missed_lesson_id, missed_lesson_date,
  absence_reason, lesson_title, lesson_duration_minutes, status,
  matched_lesson_id, offered_at, booked_lesson_id, created_at, updated_at, offer_expires_at
) VALUES
  ('b1111111-1111-1111-1111-111111111111','50357e06-1178-463c-a715-d35404832225',
   'c74a871b-4d3a-4f59-ae5e-bb8be1ed4181','1c3b090f-5c73-42ce-9a64-bf1ef6c2f8ca',
   '8d653111-fab3-40b5-b8d2-25f730c74e73','2026-04-08','sick',
   'Piano Lesson — Charlotte (cancel test)',30,'booked',
   'aaaa1111-aaaa-1111-aaaa-111111111111', now()-interval '2 days',
   'aaaa1111-aaaa-1111-aaaa-111111111111', now()-interval '3 days', now()-interval '2 days', NULL),
  ('b2222222-2222-2222-2222-222222222222','50357e06-1178-463c-a715-d35404832225',
   '90094334-d8a4-4192-b362-ced384f1806d','1c3b090f-5c73-42ce-9a64-bf1ef6c2f8ca',
   '8d653111-fab3-40b5-b8d2-25f730c74e73','2026-04-15','sick',
   'Piano Lesson — Oliver (decline test)',30,'offered',
   'fdd745b8-159c-4e0b-8767-e4c3e42f1a39', now()-interval '1 hour',
   NULL, now()-interval '2 days', now()-interval '1 hour', now()+interval '47 hours'),
  ('b3333333-3333-3333-3333-333333333333','50357e06-1178-463c-a715-d35404832225',
   '2d609039-17c4-41bb-af7e-be89838afa1b','d9a0023e-16d2-43b6-9661-b43937a9dcd6',
   '8d653111-fab3-40b5-b8d2-25f730c74e73','2026-04-22','sick',
   'Piano Lesson — Zara (accept test)',30,'offered',
   '607f9aba-eeea-4ab0-888a-e33f9568d4d9', now()-interval '30 minutes',
   NULL, now()-interval '1 day', now()-interval '30 minutes', now()+interval '47 hours')
ON CONFLICT (id) DO UPDATE SET
  status=EXCLUDED.status, matched_lesson_id=EXCLUDED.matched_lesson_id,
  booked_lesson_id=EXCLUDED.booked_lesson_id, offered_at=EXCLUDED.offered_at,
  responded_at=NULL, updated_at=now();

INSERT INTO public._spotcheck_log(label,value)
SELECT 'PRE_'||substring(id::text,1,8), jsonb_build_object('status',status,'booked_lesson_id',booked_lesson_id)
FROM make_up_waitlist WHERE id IN
  ('b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','b3333333-3333-3333-3333-333333333333');

DO $$
DECLARE r json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','3ebf4217-6d19-49bd-801c-268b8a1a6bad','role','authenticated')::text, true);
  r := public.respond_to_makeup_offer('b2222222-2222-2222-2222-222222222222'::uuid,'decline');
  INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_DECLINE_RESULT', r::jsonb);
EXCEPTION WHEN OTHERS THEN INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_DECLINE_ERROR', to_jsonb(SQLERRM));
END $$;

DO $$
DECLARE r json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','b9573e82-52b7-4b08-8bb8-2da90e3688af','role','authenticated')::text, true);
  r := public.respond_to_makeup_offer('b3333333-3333-3333-3333-333333333333'::uuid,'accept');
  INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_ACCEPT_RESULT', r::jsonb);
EXCEPTION WHEN OTHERS THEN INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_ACCEPT_ERROR', to_jsonb(SQLERRM));
END $$;

DO $$
DECLARE r json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','3ebf4217-6d19-49bd-801c-268b8a1a6bad','role','authenticated')::text, true);
  r := public.cancel_booked_makeup('b1111111-1111-1111-1111-111111111111'::uuid);
  INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_CANCEL_RESULT', r::jsonb);
EXCEPTION WHEN OTHERS THEN INSERT INTO public._spotcheck_log(label,value) VALUES ('RPC_CANCEL_ERROR', to_jsonb(SQLERRM));
END $$;

INSERT INTO public._spotcheck_log(label,value)
SELECT 'POST_'||substring(id::text,1,8), jsonb_build_object('status',status,'booked_lesson_id',booked_lesson_id,'responded_at',responded_at)
FROM make_up_waitlist WHERE id IN
  ('b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','b3333333-3333-3333-3333-333333333333');

INSERT INTO public._spotcheck_log(label,value)
SELECT 'AUDIT_'||substring(entity_id::text,1,8)||'_'||action,
       jsonb_build_object('entity_type',entity_type,'actor',actor_user_id,'after',after)
FROM audit_log
WHERE entity_id IN ('b1111111-1111-1111-1111-111111111111'::uuid,
                    'b2222222-2222-2222-2222-222222222222'::uuid,
                    'b3333333-3333-3333-3333-333333333333'::uuid)
ORDER BY created_at;

INSERT INTO public._spotcheck_log(label,value)
SELECT 'PARTICIPANTS_AFTER_CANCEL', to_jsonb(count(*))
FROM lesson_participants
WHERE lesson_id='aaaa1111-aaaa-1111-aaaa-111111111111' AND student_id='c74a871b-4d3a-4f59-ae5e-bb8be1ed4181';