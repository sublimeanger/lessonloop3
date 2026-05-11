/**
 * LoopAssist test harness.
 *
 * Tests the deterministic part of the LoopAssist pipeline by bypassing the
 * Anthropic call entirely: insert a synthetic `ai_action_proposals` row,
 * then POST `{ proposalId, action: 'confirm' | 'cancel' }` to
 * `looopassist-execute`. This exercises the full server-side path —
 * authn/authz, atomic claim, entity-ownership validation, handler logic,
 * audit log, result message insertion — without the cost or non-determinism
 * of a real chat round-trip.
 *
 * Mock-mode for the chat fn (s38 follow-up) will cover the model-emission
 * side of the pipeline. Together they give end-to-end determinism.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { randomBytes } from 'crypto';
import {
  supabaseInsert,
  supabaseSelect,
  supabaseDelete,
  getOrgId,
  getOwnerUserId,
} from '../../supabase-admin';

const SUPABASE_URL = (process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('[loopassist-harness] E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY must be set in .env.test');
}

export interface ProposalEntity {
  type: 'student' | 'lesson' | 'invoice' | 'guardian';
  id: string;
  label: string;
}

export interface SeedProposalOpts {
  orgId?: string;
  userId?: string;
  conversationId?: string | null;
  actionType: string;
  description: string;
  entities?: ProposalEntity[];
  params: Record<string, unknown>;
  status?: 'proposed' | 'executing' | 'executed' | 'failed' | 'cancelled';
}

/**
 * Insert a synthetic action proposal directly via service-role.
 * Default org + user are the e2e test org's owner.
 */
export function seedProposal(opts: SeedProposalOpts): string {
  const orgId = opts.orgId ?? getOrgId();
  const userId = opts.userId ?? getOwnerUserId();
  if (!orgId || !userId) {
    throw new Error('seedProposal: orgId and userId required (defaults rely on E2E_ORG_ID + getOwnerUserId)');
  }
  const row = supabaseInsert('ai_action_proposals', {
    org_id: orgId,
    user_id: userId,
    conversation_id: opts.conversationId ?? null,
    proposal: {
      action_type: opts.actionType,
      description: opts.description,
      entities: opts.entities ?? [],
      params: opts.params,
    },
    status: opts.status ?? 'proposed',
  });
  if (!row?.id) {
    throw new Error(`seedProposal: insert failed (${JSON.stringify(row).slice(0, 200)})`);
  }
  return row.id as string;
}

/**
 * POST to looopassist-execute with a user JWT.
 * Returns parsed body + HTTP status.
 */
export function callExecuteFn(
  proposalId: string,
  action: 'confirm' | 'cancel',
  userToken: string,
): { status: number; body: any } {
  const tmp = `/tmp/sb-la-exec-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(tmp, JSON.stringify({ proposalId, action }));
  try {
    const res = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/looopassist-execute" ` +
        `-H "Authorization: Bearer ${userToken}" -H "apikey: ${ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${tmp}`,
      { encoding: 'utf-8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const m = res.match(/^([\s\S]*)\nHTTP:(\d+)$/);
    const rawBody = m ? m[1] : res;
    const status = m ? Number(m[2]) : 0;
    let parsed: any = rawBody;
    try { parsed = JSON.parse(rawBody); } catch { /* leave as text */ }
    return { status, body: parsed };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/** Fetch a proposal row by id (service-role). */
export function getProposal(proposalId: string): any | null {
  const rows = supabaseSelect('ai_action_proposals', `id=eq.${proposalId}&select=*`);
  return rows[0] ?? null;
}

/**
 * Sign in as a specific user and return an access token.
 * Mirrors the pattern in 10-students.spec.ts so each spec doesn't roll its
 * own auth. Throws on failure.
 */
export function signInForToken(email: string, password: string): string {
  const tmp = `/tmp/sb-la-signin-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(tmp, JSON.stringify({ email, password }));
  try {
    const res = execSync(
      `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
        `-H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" -d @${tmp}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const session = JSON.parse(res);
    if (!session?.access_token) {
      throw new Error(`signInForToken: ${email} failed — ${JSON.stringify(session).slice(0, 200)}`);
    }
    return session.access_token as string;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/**
 * Cleanup proposals authored by tests. Filters on `proposal->>description ILIKE prefix%`
 * so tests can use a per-testId prefix and only delete their own rows.
 */
export function cleanupProposalsByDescriptionPrefix(prefix: string): void {
  if (!SERVICE_ROLE_KEY) return;
  // PostgREST JSONB filter: proposal->>description=ilike.prefix%25 (URL-encoded %)
  const filter = `proposal->>description=ilike.${encodeURIComponent(prefix + '%')}`;
  supabaseDelete('ai_action_proposals', filter);
}

/**
 * Fetch message_log rows the handler queued for a given related_id (typically an invoice id).
 */
export function getQueuedMessages(orgId: string, relatedId: string): any[] {
  return supabaseSelect(
    'message_log',
    `org_id=eq.${orgId}&related_id=eq.${relatedId}&select=id,recipient_email,recipient_type,message_type,status,subject`,
  );
}

/**
 * Cleanup message_log rows by recipient_email pattern. Tests seed guardians
 * with `e2e_<testId>@test.lessonloop.net` emails, so this scrubs them.
 */
export function cleanupMessageLogByRecipientPrefix(prefix: string): void {
  if (!SERVICE_ROLE_KEY) return;
  const filter = `recipient_email=ilike.${encodeURIComponent(prefix + '%')}`;
  supabaseDelete('message_log', filter);
}
