# Cron authentication — canonical pattern (Pattern C)

All cron-callable edge functions authenticate the caller via the
`x-cron-secret` header, compared against `INTERNAL_CRON_SECRET` read
from the Supabase Vault at registration time. This is the single
source of truth across the 12 production crons — no other auth
pattern is permitted.

## Template

Copy-paste this template when registering a new cron. Replace
`<JOBNAME>`, `<SCHEDULE>`, and `<EDGE_FN>` only.

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '<JOBNAME>') THEN
    PERFORM cron.unschedule('<JOBNAME>');
  END IF;
END $$;

SELECT cron.schedule(
  '<JOBNAME>',
  '<SCHEDULE>',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/<EDGE_FN>',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
```

The edge function consumes this header via the shared helper:

```ts
import { validateCronAuth } from "../_shared/cron-auth.ts";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;
  // ... rest of the handler
});
```

`validateCronAuth` is fail-closed: missing env, missing header, or
mismatch all return 401.

## Why Pattern C

- **Vault encryption at rest** — `INTERNAL_CRON_SECRET` is stored in
  `vault.decrypted_secrets`, not in plaintext PostgreSQL config.
- **Single rotation point** — rotating the secret means updating
  one Vault entry plus one Edge Functions env var. No SQL config
  rewrites, no code changes, no per-cron migrations.
- **Header is purpose-specific** — `x-cron-secret` cannot be confused
  with the `Authorization: Bearer` header that authenticated user
  calls and service-role calls already use.
- **Validator is shared** — every cron-callable fn imports the same
  `validateCronAuth` from `_shared/cron-auth.ts`. One implementation,
  one place to fix bugs in.

## History

Four auth patterns drifted into production over the lifetime of the
crons:

| Pattern | Auth | Status pre-T08 |
|---|---|---|
| A (inline) | `Authorization: Bearer <service_role_key>` checked via `authHeader.includes(supabaseServiceKey)` | Worked but fragile |
| C (vault) | `x-cron-secret` from `vault.INTERNAL_CRON_SECRET` → `validateCronAuth` | Worked — canonical |
| D | `x-cron-secret` from `current_setting('app.settings.internal_cron_secret')` | Dead (config never set) |
| E | `x-cron-secret` from `current_setting('app.settings.cron_secret')` | Dead (config never set) |

Track 0.8 Phase 1 (T08-P1) standardised all 12 production crons on
Pattern C. The two PostgreSQL config keys are no longer referenced
anywhere — they can be left unset.

## Adding a new cron

1. Write the edge function with `validateCronAuth` at the top of the
   handler, after any OPTIONS short-circuit.
2. Write a migration using the template above.
3. Deploy migration via Supabase, deploy fn via Lovable. Done.

No further auth wiring is required — `INTERNAL_CRON_SECRET` is
already populated in both Vault and Edge Functions env.
