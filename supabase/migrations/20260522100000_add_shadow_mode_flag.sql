-- Add shadow_mode flag to organisations for Lauren's shadow programme.
-- Default FALSE — no existing org accidentally flagged.
-- Only seed-shadow-org may set this to TRUE.
ALTER TABLE organisations ADD COLUMN shadow_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for query perf on the shadow-mode subset (will be tiny —
-- 1-3 orgs across the entire shadow programme run).
CREATE INDEX idx_organisations_shadow_mode ON organisations (shadow_mode) WHERE shadow_mode = true;

COMMENT ON COLUMN organisations.shadow_mode IS
'TRUE for shadow-programme orgs (Lauren). When TRUE, _shared/shadow-email.ts intercepts outbound emails and routes to SHADOW_RECIPIENTS env only. Sentry tags events with shadow:true. Default FALSE; only set by seed-shadow-org edge fn.';
