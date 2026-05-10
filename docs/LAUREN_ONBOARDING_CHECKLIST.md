# Lauren Onboarding Checklist (Shadow Programme — 551ca74e)

**Pre-flight owner:** Jamie McKaye
**Shadow org:** `551ca74e-d47d-4d02-9a4b-24863349a030` (Lauren's Shadow Studio)
**Status as of s33 end:** READY FOR ONBOARDING — pending Jamie greenlight.

This checklist guides the staged Lauren onboarding flow. The shadow org is fully seeded with realistic Studio data (90 students, 2068 lessons, 1124 attendance records, 402 lesson notes, 90 invoices, 71 payments, 40 historical messages, 165 practice logs, recurring billing templates, 5 teachers with realistic instrument specialisations). The shadow-email layer intercepts every outbound email and routes to Jamie + Lauren only.

---

## Step 1 — Jamie pre-flight UI sanity check (~10 min, do this FIRST)

Before Lauren receives the magic link, Jamie clicks into the shadow org UI personally to confirm the seed data renders without obvious bugs.

### 1.1 Mint a fresh magic link for Jamie

Magic links are single-use and expire after ~1 hour. Run this command in your local shell whenever you need a fresh link:

```bash
curl -sS -X POST "https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/admin/generate_link" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"magiclink",
    "email":"jamie@searchflare.co.uk",
    "options": {"redirect_to": "https://app.lessonloop.net/dashboard"}
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['action_link'])"
```

Click the returned URL. You should land in 551ca74e's dashboard.

### 1.2 UI smoke checklist (Jamie clicks through)

- [ ] Dashboard loads. Stat cards show ~90 students / ~2000 lessons / ~£17k payments.
- [ ] Students page renders 90 rows. Sort by last name; spot-check 3 students at random.
- [ ] Click into 1 student profile:
  - [ ] Primary teacher shown (one of: Rachel Chen, Sarah Mitchell, Olivia Hartley, James Coleman, David Okonkwo).
  - [ ] Primary instrument shown; if it's one of the doubler students, secondary instrument also visible.
  - [ ] Past lessons list populated (some with notes, some without — ~35% have notes).
  - [ ] Guardian section shows 1 guardian (some students share a guardian with a sibling).
- [ ] Click into 1 past lesson:
  - [ ] Lesson date/time/teacher shown.
  - [ ] If the lesson has a note: content matches the student's primary instrument family (e.g., piano student → piano content like Hanon / Bach Minuet).
  - [ ] Attendance status (present/absent/late) shown.
- [ ] Calendar view renders without errors.
- [ ] Invoices page shows ~90 invoices: 66 paid + 16 outstanding + 4 overdue + 4 draft.
- [ ] Click 1 paid invoice: line items match the student's completed lessons.
- [ ] Messages page shows historical sends (40 rows).
- [ ] Teachers page shows 5 teachers with their instrument specialisations.
- [ ] Settings / org config shows shadow_mode badge (if UI surfaces it; otherwise verify via DB).

### 1.3 Known data inconsistencies to expect

The seed contains a few realistic "mid-reassignment" patterns that look like bugs but aren't:

- **Past lessons can show a different teacher than the student's current primary.** Reason: s33 redistributed students across 5 teachers (Sarah/James originally taught everyone in s32; now David/Olivia/Rachel each have their share). Past lessons retain the historical teacher who actually taught them. New teacher assignments only apply to future lessons.
- **Some past lessons taught by Sarah may show woodwinds content; James may show trumpet content.** Same root cause: at the time of the lesson, that teacher really was teaching that instrument. Sarah's and James's `instruments[]` specialisation was narrowed in s33.
- **About 7 students don't have a future lesson schedule yet.** Reason: Phase 1.3 redistributed `student_teacher_assignments` but did not update `lessons.teacher_id` for pre-scheduled future lessons (would conflict with the teacher-double-booking trigger). Lauren can use the UI's "Reschedule student" flow to rebuild.

Document any genuinely unexpected behaviour as findings in `audit/findings/`.

### 1.4 Halt conditions

If any of these surface during 1.2, halt and file a finding:

- Hard 5xx errors anywhere.
- Empty page where data should render (counts above were verified at s33 end).
- Slow page load (>3s on dashboard, >5s on student list).
- Shadow_mode badge absent on org settings (if UI surfaces it).

---

## Step 2 — Greenlight Lauren onboarding (Jamie decision)

After 1.2 is fully green: Jamie confirms onboarding is safe to proceed. Optionally drop a Sentry watch:

- Sentry filter: `org_id:551ca74e-d47d-4d02-9a4b-24863349a030` + `tags["shadow"]:"true"` — pin this view for daily monitoring.

---

## Step 3 — Mint Lauren's magic link

Same command, different email:

```bash
curl -sS -X POST "https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/admin/generate_link" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"magiclink",
    "email":"laurentwilleypiano@gmail.com",
    "options": {"redirect_to": "https://app.lessonloop.net/dashboard"}
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['action_link'])"
```

Send the returned URL to Lauren via her preferred channel. Link is single-use, ~1 hour TTL. Mention she may need a fresh link if more than an hour elapses before she clicks.

---

## Step 4 — First-touch monitoring (Lauren's first session)

While Lauren is exploring the app:

### 4.1 Live Sentry tail
- Filter: `tags["shadow"]:"true"`
- Watch for any 5xx events; investigate immediately.

### 4.2 Live audit log tail (every ~5 min)

```sql
SELECT created_at, action, entity_type, actor_user_id
FROM audit_log
WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

### 4.3 Live message_log tail (any test emails Lauren sends)

```sql
SELECT created_at, status, recipient_email, subject
FROM message_log
WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Verify each entry has `status = 'sent'` (not 'failed') — Resend quota is 50k/day so no quota issues expected.

For every email Lauren sends from the app: check Jamie + Lauren's inboxes within 60s for `[SHADOW: 551ca74e]` subject prefix. If a real email reaches a real guardian (i.e., `shadow-guardian-N@lessonloop.test`): HALT IMMEDIATELY, the shadow layer is broken.

---

## Step 5 — Daily review (Jamie, end of each day)

### 5.1 Counts snapshot

```sql
SELECT 
  (SELECT count(*) FROM lessons WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030' AND created_at > CURRENT_DATE - 1) new_lessons_today,
  (SELECT count(*) FROM invoices WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030' AND created_at > CURRENT_DATE - 1) new_invoices_today,
  (SELECT count(*) FROM payments WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030' AND created_at > CURRENT_DATE - 1) new_payments_today,
  (SELECT count(*) FROM message_log WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030' AND created_at > CURRENT_DATE - 1) messages_today;
```

### 5.2 Sentry shadow:true tag review

Check Sentry filter for the past 24h. Note any errors, even non-5xx, that originated from a shadow request. Document patterns in `audit/findings/` if any.

### 5.3 Shadow integrity check

```sql
-- Confirm no real-recipient emails leaked. Every message_log row in the
-- shadow org should have recipient_email matching the seeded shadow
-- pattern, NOT a real-looking email.
SELECT count(*) AS suspect_real_recipients
FROM message_log
WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030'
  AND recipient_email NOT LIKE '%@lessonloop.test'
  AND recipient_email NOT LIKE 'jamie@searchflare.co.uk'
  AND recipient_email NOT LIKE 'laurentwilleypiano@gmail.com';
```

Expected: 0. Non-zero → investigate immediately (a real recipient may have leaked into the seed via UI).

---

## Step 6 — Reset path (if Lauren breaks state badly)

If the shadow org becomes unusable (Lauren accidentally bulk-deletes everything, or a workflow corrupts the seed):

```bash
# 1. Reset (delete everything in 551ca74e, including the org itself)
curl -sS -X POST "https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/reset-shadow-org" \
  -H "Authorization: Bearer ${SHADOW_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"org_id":"551ca74e-d47d-4d02-9a4b-24863349a030"}'

# 2. Reseed the org skeleton (creates new org, gets new UUID)
curl -sS -X POST "https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/seed-shadow-org" \
  -H "Authorization: Bearer ${SHADOW_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tier":"studio",
    "jamie_user_id":"29ae9f1e-c528-40ea-b9e8-84c2f03b15a9",
    "lauren_user_id":"1e52dad5-77aa-437a-9cc9-6425001f3e39",
    "org_name":"Lauren'\''s Shadow Studio"
  }'
# Capture the new org_id from the response.

# 3. Apply the data clusters (substitute the new org_id):
#    - scripts/seed-shadow-clusters.sql  (s32 base — students/lessons/invoices/etc)
#    - scripts/seed-shadow-enrichment.sql (s33 — teachers/doublers/notes)
#    Both files contain '551ca74e-d47d-4d02-9a4b-24863349a030' hardcoded;
#    sed-replace before running.
```

Reset is intentionally manual because it's destructive.

---

## Step 7 — Deferred to post-shadow-term

These were considered for s33 but explicitly deferred per scope. Revisit after Lauren's first 1-2 weeks of shadow-term use:

- Additional shadow orgs for Teacher tier (solo) and Agency tier (multi-studio variants). s34 work.
- Leads + booking + waitlist + AI conversation history seed. s34 enrichment.
- Calendar OAuth fix (per Jamie's earlier ask). Post-shadow-term.
- Import XLSX support (per Jamie's earlier ask). Post-shadow-term.
- API keys / MCP infrastructure (per Jamie's earlier discussion). Post-shadow-term.
- `/admin/shadow` UI page for in-app shadow management. Still optional.

---

## Appendix — Verification commands

### Confirm 551ca74e is fully seeded

```sql
SELECT 
  (SELECT count(*) FROM teachers WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS teachers,
  (SELECT count(*) FROM students WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS students,
  (SELECT count(*) FROM student_instruments WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS instrument_records,
  (SELECT count(*) FROM lessons WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS lessons,
  (SELECT count(*) FROM lesson_notes WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS notes,
  (SELECT count(*) FROM invoices WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS invoices,
  (SELECT count(*) FROM payments WHERE org_id = '551ca74e-d47d-4d02-9a4b-24863349a030') AS payments;
```

Expected: 5 / 90 / 101 / 2068 / ~400 / 90 / 71.

### Confirm shadow_mode flag and stripe_test_mode

```sql
SELECT name, shadow_mode, stripe_test_mode, subscription_plan, org_type
FROM organisations WHERE id = '551ca74e-d47d-4d02-9a4b-24863349a030';
```

Expected: shadow_mode=true, stripe_test_mode=true, subscription_plan='academy', org_type='studio'.
