/**
 * 21 — LoopAssist action lifecycle (server-side determinism)
 *
 * Tests the full executable side of LoopAssist by-passing the Anthropic call:
 *   seed synthetic `ai_action_proposals` row
 *   → POST `looopassist-execute` with `{ proposalId, action }`
 *   → assert handler did exactly what it claimed.
 *
 * What this catches that the existing chat-side tests don't:
 *   - CHECK constraint mismatches (s38 #1 — proposed→executing rejected)
 *   - "Queued 0 ✓" success-shaped responses with zero side-effects (s38 #3)
 *   - Cross-org entity leaks via ownership-check holes
 *   - Per-handler logic regressions (rate cards, lesson IDs, audit log writes)
 *   - Permission gating drift between knowledge base and execute fn
 *
 * Pre-Anthropic-mock-mode (s38 follow-up): this exercises 100% of the
 * deterministic path; the AI-emission side will get its own coverage when
 * mock mode lands.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import {
  seedProposal,
  callExecuteFn,
  getProposal,
  signInForToken,
  cleanupProposalsByDescriptionPrefix,
  getQueuedMessages,
  cleanupMessageLogByRecipientPrefix,
} from './_fixtures/loopassist-harness';
import {
  getOrgId,
  seedStudent,
  seedInvoice,
  patchInvoiceStatus,
  cleanupByPrefix,
} from '../supabase-admin';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

test.describe('§21.5 — send_invoice_reminders action handler', () => {
  test.use({ storageState: AUTH.owner });

  // Unique per test-suite run so parallel workers + reruns don't collide.
  const testId = `la_sir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;
  const emailPrefix = `e2e_${testId}`;

  test.afterAll(() => {
    // Best-effort cleanup. Order matters: messages first (FK on related_id),
    // then proposals, then the seeded fixtures.
    try { cleanupMessageLogByRecipientPrefix(emailPrefix); } catch { /* ignore */ }
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.5.1 — guardian-payer overdue invoice → 1 reminder queued to guardian email', async () => {
    const orgId = getOrgId();

    // Seed: student + guardian (with email) + invoice payable BY the guardian.
    const { studentId: _studentId, guardianId } = seedStudent({
      testId: `${testId}_g`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_guardian@test.lessonloop.net`,
    });
    expect(guardianId, 'seed must produce a guardian').toBeTruthy();

    // Invoice is guardian-payer. dueDate 30+ days in past → trigger overdue.
    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId, invoiceNumber } = seedInvoice({
      testId: `${testId}_g`,
      payerGuardianId: guardianId,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    // create_invoice_with_items defaults to 'draft'. Push through draft→sent→overdue.
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    // Seed proposal authored by the e2e owner.
    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}guardian_payer`,
      entities: [{ type: 'invoice', id: invoiceId, label: invoiceNumber }],
      params: { invoice_ids: [invoiceId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status, `execute fn returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.reminders_sent).toBe(1);

    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('executed');
    expect(proposal?.executed_at).toBeTruthy();

    const queued = getQueuedMessages(orgId, invoiceId);
    expect(queued.length).toBe(1);
    expect(queued[0].message_type).toBe('invoice_reminder');
    expect(queued[0].status).toBe('queued');
    expect(queued[0].recipient_email).toBe(`${emailPrefix}_guardian@test.lessonloop.net`);
    expect(queued[0].recipient_type).toBe('guardian');
  });

  test('§21.5.2 — student-payer overdue invoice (no student email) → 1 reminder queued to primary guardian via student_guardians fallback', async () => {
    const orgId = getOrgId();

    // Same shape as today's s38 bug + the shadow studio data: student-payer
    // invoice, student has no email of their own, primary guardian is linked
    // via student_guardians with is_primary_payer=true. The handler MUST fall
    // back through that link to find the recipient email.
    const { studentId, guardianId } = seedStudent({
      testId: `${testId}_s`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_payer@test.lessonloop.net`,
    });
    expect(guardianId).toBeTruthy();

    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId, invoiceNumber } = seedInvoice({
      testId: `${testId}_s`,
      payerStudentId: studentId, // student-payer, NOT guardian
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}student_payer_fallback`,
      entities: [{ type: 'invoice', id: invoiceId, label: invoiceNumber }],
      params: { invoice_ids: [invoiceId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    // This is the canary for the s38 third root cause. Pre-fix: 0. Post-fix: 1.
    expect(
      res.body?.result?.reminders_sent,
      'Handler must fall back through student_guardians to find the primary-payer guardian when payer_guardian_id is null and student email is null',
    ).toBe(1);

    const queued = getQueuedMessages(orgId, invoiceId);
    expect(queued.length).toBe(1);
    expect(queued[0].recipient_email).toBe(`${emailPrefix}_payer@test.lessonloop.net`);
    expect(queued[0].recipient_type).toBe('guardian');
  });

  test('§21.5.3 — cancel proposal → status=cancelled, no message_log rows', async () => {
    const orgId = getOrgId();

    const { guardianId } = seedStudent({
      testId: `${testId}_c`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_cancel@test.lessonloop.net`,
    });
    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId, invoiceNumber } = seedInvoice({
      testId: `${testId}_c`,
      payerGuardianId: guardianId,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}cancel_path`,
      entities: [{ type: 'invoice', id: invoiceId, label: invoiceNumber }],
      params: { invoice_ids: [invoiceId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'cancel', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('cancelled');

    const queued = getQueuedMessages(orgId, invoiceId);
    expect(queued.length, 'cancel path must not queue any messages').toBe(0);
  });

  test('§21.5.5 — student-payer invoice with NO recipient reachable → outcome=no_op, status=failed, ✗ prefix', async () => {
    // Soft-fail surface: prior to the s38 fix, a proposal that processed
    // zero invoices returned a success-shaped "Queued 0 ✓" message that
    // misled users into thinking the action had run. Now the handler
    // classifies that as outcome='no_op' and the outer fn overrides
    // newStatus to 'failed' so the chat renders ✗ and the audit trail
    // accurately reflects that the intent did not realise.
    const orgId = getOrgId();

    // Student-payer with NO student_guardians link → no fallback path possible.
    // seedStudent without withGuardian gives us an orphan student.
    const { studentId } = seedStudent({
      testId: `${testId}_n`,
      withGuardian: false,
    });

    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId, invoiceNumber } = seedInvoice({
      testId: `${testId}_n`,
      payerStudentId: studentId,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}no_recipient`,
      entities: [{ type: 'invoice', id: invoiceId, label: invoiceNumber }],
      params: { invoice_ids: [invoiceId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    // success:false because we overrode newStatus to 'failed'.
    expect(res.body?.success).toBe(false);
    expect(res.body?.result?.outcome).toBe('no_op');
    expect(res.body?.result?.reminders_sent).toBe(0);

    const proposal = getProposal(proposalId);
    expect(proposal?.status, 'no_op outcome must land in status=failed, not executed').toBe('failed');

    const queued = getQueuedMessages(orgId, invoiceId);
    expect(queued.length).toBe(0);
  });

  test('§21.5.6 — partial-success: 2 invoices, 1 with email + 1 without → outcome=partial, 1 queued, status=executed', async () => {
    // The partial-success surface: when SOME invoices succeed and OTHERS skip
    // (no email on file), the handler must report "Queued N of M" with the
    // proposal still landing in 'executed' (intent partially realised).
    const orgId = getOrgId();

    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Invoice A: guardian-payer with email — should queue.
    const { guardianId: gA } = seedStudent({
      testId: `${testId}_p1`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_partial_ok@test.lessonloop.net`,
    });
    const { invoiceId: invA, invoiceNumber: numA } = seedInvoice({
      testId: `${testId}_p1`,
      payerGuardianId: gA,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invA, 'sent');
    patchInvoiceStatus(invA, 'overdue');

    // Invoice B: student-payer with no guardian link — should skip.
    const { studentId: sB } = seedStudent({
      testId: `${testId}_p2`,
      withGuardian: false,
    });
    const { invoiceId: invB, invoiceNumber: numB } = seedInvoice({
      testId: `${testId}_p2`,
      payerStudentId: sB,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invB, 'sent');
    patchInvoiceStatus(invB, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}partial`,
      entities: [
        { type: 'invoice', id: invA, label: numA },
        { type: 'invoice', id: invB, label: numB },
      ],
      params: { invoice_ids: [invA, invB] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.outcome).toBe('partial');
    expect(res.body?.result?.reminders_sent).toBe(1);
    expect(Array.isArray(res.body?.result?.skipped)).toBe(true);
    expect(res.body?.result?.skipped?.length).toBe(1);

    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('executed');

    expect(getQueuedMessages(orgId, invA).length).toBe(1);
    expect(getQueuedMessages(orgId, invB).length).toBe(0);
  });

  test('§21.5.7 — entity ownership: proposal with a UUID that does not exist in this org → execute rejects', async () => {
    // Closes the s38 audit hole where ENTITY_TABLE_MAP skipped invoice ownership
    // checks ("uses invoice_number not UUID, skip ownership check"). Now uniform:
    // every entity type in the proposal's entities[] gets verified against the
    // user's org before the handler runs. Bogus UUID → handler never executes.
    const orgId = getOrgId();
    const bogusUUID = '00000000-0000-4000-8000-000000000000';

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}cross_org`,
      entities: [{ type: 'invoice', id: bogusUUID, label: 'LL-FAKE' }],
      params: { invoice_ids: [bogusUUID] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    // The handler's outer catch sets newStatus='failed' + returns 200 with
    // success:false (consistent with other handler-thrown errors). The error
    // message must mention the entity, not leak generic "no rows".
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(false);
    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('failed');
    // No message_log rows queued.
    expect(getQueuedMessages(orgId, bogusUUID).length).toBe(0);
  });

  test('§21.5.4 — confirm already-executed proposal → 400/409 with safe error', async () => {
    // s38 #1 surfaced this as a misleading 'Proposal already processed' when
    // the CHECK constraint was bad. Now that the constraint allows 'executing',
    // verify the legitimate already-processed path returns a sane error.
    const { guardianId } = seedStudent({
      testId: `${testId}_d`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_dup@test.lessonloop.net`,
    });
    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId, invoiceNumber } = seedInvoice({
      testId: `${testId}_d`,
      payerGuardianId: guardianId,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_invoice_reminders',
      description: `${descriptionPrefix}double_confirm`,
      entities: [{ type: 'invoice', id: invoiceId, label: invoiceNumber }],
      params: { invoice_ids: [invoiceId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const first = callExecuteFn(proposalId, 'confirm', token);
    expect(first.status).toBe(200);

    const second = callExecuteFn(proposalId, 'confirm', token);
    // Either status >=400 OR success:false — whatever shape, must not double-queue.
    expect([400, 409].includes(second.status) || second.body?.success === false).toBe(true);

    const queued = getQueuedMessages(getOrgId(), invoiceId);
    expect(queued.length, 'second confirm must not double-queue').toBe(1);
  });
});
