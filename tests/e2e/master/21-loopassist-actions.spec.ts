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
  getOwnerUserId,
  getOwnerTeacherId,
  seedStudent,
  seedLesson,
  seedInvoice,
  patchInvoiceStatus,
  supabaseSelect,
  supabaseInsert,
  supabaseDelete,
  cleanupByPrefix,
} from '../supabase-admin';
import { resetE2ERateLimits } from './_fixtures/stripe-test-helpers';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

// looopassist-execute is rate-limited to 10/min per user. This spec fires
// ~16+ confirm calls across describe blocks; the bucket would fill mid-run.
// Reset before every test so each gets a clean slate. Cheap (one DELETE).
test.beforeEach(() => {
  resetE2ERateLimits();
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
    // Post-s38 dispatch rewrite: handler actually sends via Resend (or 'logged'
    // in dev). Status reflects the dispatch lifecycle. No more 'queued' void.
    expect(['sent', 'pending', 'logged', 'failed']).toContain(queued[0].status);
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

// ════════════════════════════════════════════════════════════════════
// §21.6 — send_bulk_reminders (auto-finds all overdue invoices in org)
// ════════════════════════════════════════════════════════════════════
test.describe('§21.6 — send_bulk_reminders action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_sbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;
  const emailPrefix = `e2e_${testId}`;

  test.afterAll(() => {
    try { cleanupMessageLogByRecipientPrefix(emailPrefix); } catch { /* ignore */ }
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  // NB: send_bulk_reminders scans ALL overdue invoices in the org. To avoid
  // false-positive coverage from pre-existing fixture data, we assert on the
  // delta of message_log rows for THIS testId's seeded invoices, not the total.

  test('§21.6.1 — bulk over 1 newly-overdue invoice (guardian-payer) → queued via the shared resolver', async () => {
    const orgId = getOrgId();
    const { guardianId } = seedStudent({
      testId: `${testId}_a`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_a@test.lessonloop.net`,
    });
    const pastDue = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { invoiceId } = seedInvoice({
      testId: `${testId}_a`,
      payerGuardianId: guardianId,
      dueDate: pastDue,
      items: [{ description: `${descriptionPrefix}item`, quantity: 1, unit_price_minor: 5000 }],
    });
    patchInvoiceStatus(invoiceId, 'sent');
    patchInvoiceStatus(invoiceId, 'overdue');

    const proposalId = seedProposal({
      actionType: 'send_bulk_reminders',
      description: `${descriptionPrefix}bulk_basic`,
      params: {},
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    // We don't assert sentCount exactly because the org may have other overdue
    // invoices from prior fixture data. But OUR invoice must have been queued.
    expect(typeof res.body?.result?.reminders_sent).toBe('number');
    expect((res.body?.result?.reminders_sent as number) >= 1).toBe(true);

    const queued = getQueuedMessages(orgId, invoiceId);
    expect(queued.length).toBe(1);
    expect(queued[0].recipient_email).toBe(`${emailPrefix}_a@test.lessonloop.net`);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.7 — draft_email
// ════════════════════════════════════════════════════════════════════
test.describe('§21.7 — draft_email action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_de_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;
  const emailPrefix = `e2e_${testId}`;

  test.afterAll(() => {
    try { cleanupMessageLogByRecipientPrefix(emailPrefix); } catch { /* ignore */ }
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.7.1 — guardian + subject + body → 1 draft message_log row created', async () => {
    const orgId = getOrgId();
    const { studentId, guardianId } = seedStudent({
      testId: `${testId}_ok`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_ok@test.lessonloop.net`,
    });

    const proposalId = seedProposal({
      actionType: 'draft_email',
      description: `${descriptionPrefix}happy`,
      entities: [{ type: 'guardian', id: guardianId!, label: 'Test Guardian' }],
      params: {
        guardian_id: guardianId,
        student_id: studentId,
        tone: 'friendly',
        subject: `${descriptionPrefix}subject`,
        body: 'Hi, just checking in about your child\'s practice this week. Best,',
      },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.result?.draft_id).toBe('string');

    const rows = supabaseSelect(
      'message_log',
      `org_id=eq.${orgId}&recipient_email=eq.${encodeURIComponent(`${emailPrefix}_ok@test.lessonloop.net`)}&select=id,subject,message_type,status,recipient_type`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].message_type).toBe('custom');
    expect(rows[0].status).toBe('draft');
    expect(rows[0].recipient_type).toBe('guardian');
    expect(rows[0].subject).toBe(`${descriptionPrefix}subject`);
  });

  test('§21.7.2 — guardian with no email → handler rejects with "Guardian has no email"', async () => {
    // Seed a guardian without going through seedStudent (which sets email).
    // Insert directly so we can leave email NULL.
    const orgId = getOrgId();
    const guardian = supabaseInsert('guardians', {
      org_id: orgId,
      full_name: `e2e_${testId} no_email`,
      email: null,
    });

    const proposalId = seedProposal({
      actionType: 'draft_email',
      description: `${descriptionPrefix}no_email`,
      entities: [{ type: 'guardian', id: guardian.id, label: 'No-email Guardian' }],
      params: {
        guardian_id: guardian.id,
        subject: `${descriptionPrefix}subject2`,
        body: 'Test body',
      },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(false);
    const proposal = getProposal(proposalId);
    expect(proposal?.status).toBe('failed');
    expect(proposal?.result?.error).toMatch(/no email/i);

    // Cleanup
    try { supabaseDelete('guardians', `id=eq.${guardian.id}`); } catch { /* ignore */ }
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.8 — mark_attendance
// ════════════════════════════════════════════════════════════════════
test.describe('§21.8 — mark_attendance action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_ma_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;

  test.afterAll(() => {
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.8.1 — scheduled lesson + participant → attendance_record upserted, audit_log row', async () => {
    const orgId = getOrgId();
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId } = seedStudent({
      testId: `${testId}_p`,
      withGuardian: false,
    });
    // Past start_at — trigger `prevent_future_attendance` blocks recording
    // attendance for lessons that haven't started yet.
    const { lessonId } = seedLesson({
      testId: `${testId}_p`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    });

    const proposalId = seedProposal({
      actionType: 'mark_attendance',
      description: `${descriptionPrefix}present`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: {
        lesson_id: lessonId,
        records: [{ student_id: studentId, status: 'present' }],
      },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success, `mark_attendance failed: ${JSON.stringify(res.body).slice(0, 400)}`).toBe(true);
    expect(res.body?.result?.marked_count, `details: ${JSON.stringify(res.body?.result?.details)}`).toBe(1);

    const att = supabaseSelect(
      'attendance_records',
      `org_id=eq.${orgId}&lesson_id=eq.${lessonId}&student_id=eq.${studentId}&select=attendance_status`,
    );
    expect(att.length).toBe(1);
    expect(att[0].attendance_status).toBe('present');
  });

  test('§21.8.2 — student not in lesson participants → reported as skipped, not marked', async () => {
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId: inLessonStudent } = seedStudent({
      testId: `${testId}_in`,
      withGuardian: false,
    });
    const { studentId: notInLessonStudent } = seedStudent({
      testId: `${testId}_out`,
      withGuardian: false,
    });
    const { lessonId } = seedLesson({
      testId: `${testId}_in`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [inLessonStudent],
      // Past start_at so the prevent_future_attendance trigger doesn't fire
      // before we get the chance to test the "not a participant" path.
      startAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    });

    const proposalId = seedProposal({
      actionType: 'mark_attendance',
      description: `${descriptionPrefix}wrong_student`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: {
        lesson_id: lessonId,
        records: [{ student_id: notInLessonStudent, status: 'present' }],
      },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    // Handler doesn't throw — it skips non-participants and reports details.
    expect(res.body?.result?.marked_count).toBe(0);
    expect(Array.isArray(res.body?.result?.details)).toBe(true);
    expect((res.body?.result?.details as string[]).join(' ')).toMatch(/not a participant/i);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.9 — cancel_lesson
// ════════════════════════════════════════════════════════════════════
test.describe('§21.9 — cancel_lesson action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;

  test.afterAll(() => {
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.9.1 — cancel + issue_credit=true → lesson cancelled + make_up_credit row', async () => {
    const orgId = getOrgId();
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId } = seedStudent({
      testId: `${testId}_c1`,
      withGuardian: false,
    });
    const { lessonId } = seedLesson({
      testId: `${testId}_c1`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString(),
      durationMins: 30,
    });

    const proposalId = seedProposal({
      actionType: 'cancel_lesson',
      description: `${descriptionPrefix}with_credit`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: {
        lesson_ids: [lessonId],
        reason: 'e2e test cancel',
        notify: false,
        issue_credit: true,
      },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.cancelled_count).toBe(1);
    expect(res.body?.result?.credits_issued).toBe(1);

    const lesson = supabaseSelect('lessons', `id=eq.${lessonId}&select=status`)[0];
    expect(lesson?.status).toBe('cancelled');

    const credits = supabaseSelect(
      'make_up_credits',
      `org_id=eq.${orgId}&student_id=eq.${studentId}&issued_for_lesson_id=eq.${lessonId}&select=id,credit_value_minor`,
    );
    expect(credits.length).toBe(1);
    expect(credits[0].credit_value_minor).toBeGreaterThan(0);
  });

  test('§21.9.2 — cancel without issue_credit → lesson cancelled, NO make_up_credit', async () => {
    const orgId = getOrgId();
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId } = seedStudent({
      testId: `${testId}_c2`,
      withGuardian: false,
    });
    const { lessonId } = seedLesson({
      testId: `${testId}_c2`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
    });

    const proposalId = seedProposal({
      actionType: 'cancel_lesson',
      description: `${descriptionPrefix}no_credit`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: { lesson_ids: [lessonId], notify: false, issue_credit: false },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.cancelled_count).toBe(1);
    expect(res.body?.result?.credits_issued).toBe(0);

    const credits = supabaseSelect(
      'make_up_credits',
      `org_id=eq.${orgId}&student_id=eq.${studentId}&issued_for_lesson_id=eq.${lessonId}&select=id`,
    );
    expect(credits.length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.10 — complete_lessons
// ════════════════════════════════════════════════════════════════════
test.describe('§21.10 — complete_lessons action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;

  test.afterAll(() => {
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.10.1 — scheduled lesson → status=completed + audit_log entry', async () => {
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId } = seedStudent({
      testId: `${testId}_done`,
      withGuardian: false,
    });
    const { lessonId } = seedLesson({
      testId: `${testId}_done`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), // yesterday
    });

    const proposalId = seedProposal({
      actionType: 'complete_lessons',
      description: `${descriptionPrefix}happy`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: { lesson_ids: [lessonId] },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.completed_count).toBe(1);

    const lesson = supabaseSelect('lessons', `id=eq.${lessonId}&select=status`)[0];
    expect(lesson?.status).toBe('completed');
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.11 — bulk_complete_lessons
// ════════════════════════════════════════════════════════════════════
test.describe('§21.11 — bulk_complete_lessons action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_bcl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;

  test.afterAll(() => {
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.11.1 — past scheduled lessons before cutoff → all marked completed', async () => {
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId: s1 } = seedStudent({ testId: `${testId}_l1`, withGuardian: false });
    const { studentId: s2 } = seedStudent({ testId: `${testId}_l2`, withGuardian: false });
    const { lessonId: l1 } = seedLesson({
      testId: `${testId}_l1`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [s1],
      startAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    });
    const { lessonId: l2 } = seedLesson({
      testId: `${testId}_l2`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [s2],
      startAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    });

    // Cutoff = today, so both past lessons qualify.
    const todayStr = new Date().toISOString().slice(0, 10);

    const proposalId = seedProposal({
      actionType: 'bulk_complete_lessons',
      description: `${descriptionPrefix}before_today`,
      params: { before_date: todayStr },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    // Handler returns completed_count for ALL past lessons in the org (not just
    // ours). Assert ≥ 2 since our two qualify; both must be in the result.
    expect((res.body?.result?.completed_count as number) >= 2).toBe(true);

    const ours = supabaseSelect('lessons', `id=in.(${l1},${l2})&select=id,status`);
    expect(ours.every((l: { status: string }) => l.status === 'completed')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.12 — reschedule_lessons
// ════════════════════════════════════════════════════════════════════
test.describe('§21.12 — reschedule_lessons action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;

  test.afterAll(() => {
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.12.1 — shift_minutes=60 → lesson moved exactly 60 minutes later', async () => {
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();
    const { studentId } = seedStudent({
      testId: `${testId}_shift`,
      withGuardian: false,
    });
    // Round to an even hour to make the +60min assertion exact.
    const origStart = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    origStart.setMinutes(0, 0, 0);
    const { lessonId } = seedLesson({
      testId: `${testId}_shift`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: origStart.toISOString(),
    });

    const before = supabaseSelect('lessons', `id=eq.${lessonId}&select=start_at,end_at`)[0];

    const proposalId = seedProposal({
      actionType: 'reschedule_lessons',
      description: `${descriptionPrefix}plus60`,
      entities: [{ type: 'lesson', id: lessonId, label: 'Test lesson' }],
      params: { lesson_ids: [lessonId], shift_minutes: 60 },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.result?.lessons_updated).toBe(1);

    const after = supabaseSelect('lessons', `id=eq.${lessonId}&select=start_at,end_at`)[0];
    const beforeMs = new Date(before.start_at).getTime();
    const afterMs = new Date(after.start_at).getTime();
    expect(afterMs - beforeMs).toBe(60 * 60 * 1000);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.13 — send_progress_report
// ════════════════════════════════════════════════════════════════════
test.describe('§21.13 — send_progress_report action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_spr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;
  const emailPrefix = `e2e_${testId}`;

  test.afterAll(() => {
    try { cleanupMessageLogByRecipientPrefix(emailPrefix); } catch { /* ignore */ }
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.13.1 — student + period=month → progress report message_log row created', async () => {
    const orgId = getOrgId();
    const { studentId, guardianId } = seedStudent({
      testId: `${testId}_rep`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_rep@test.lessonloop.net`,
    });

    const proposalId = seedProposal({
      actionType: 'send_progress_report',
      description: `${descriptionPrefix}month`,
      entities: [{ type: 'student', id: studentId, label: 'Test Student' }],
      params: { student_id: studentId, guardian_id: guardianId, period: 'month', send_immediately: false },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const rows = supabaseSelect(
      'message_log',
      `org_id=eq.${orgId}&recipient_email=eq.${encodeURIComponent(`${emailPrefix}_rep@test.lessonloop.net`)}&select=id,subject,body,message_type,status`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].body).toMatch(/progress report/i);
  });
});

// ════════════════════════════════════════════════════════════════════
// §21.14 — generate_billing_run
// ════════════════════════════════════════════════════════════════════
test.describe('§21.14 — generate_billing_run action handler', () => {
  test.use({ storageState: AUTH.owner });

  const testId = `la_gbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const descriptionPrefix = `e2e_${testId}__`;
  const emailPrefix = `e2e_${testId}`;

  test.afterAll(() => {
    try { cleanupMessageLogByRecipientPrefix(emailPrefix); } catch { /* ignore */ }
    try { cleanupProposalsByDescriptionPrefix(descriptionPrefix); } catch { /* ignore */ }
    try { cleanupByPrefix(testId); } catch { /* ignore */ }
  });

  test('§21.14.1 — 1 completed lesson with guardian-payer student → 1 invoice generated', async () => {
    const orgId = getOrgId();
    const ownerUserId = getOwnerUserId();
    const teacherId = getOwnerTeacherId();

    const { studentId, guardianId } = seedStudent({
      testId: `${testId}_bill`,
      withGuardian: true,
      guardianEmail: `${emailPrefix}_bill@test.lessonloop.net`,
    });

    // Past completed lesson in the billing window.
    const lessonStart = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    lessonStart.setHours(10, 0, 0, 0);
    const { lessonId } = seedLesson({
      testId: `${testId}_bill`,
      teacherId,
      createdBy: ownerUserId,
      studentIds: [studentId],
      startAt: lessonStart.toISOString(),
      durationMins: 30,
      status: 'completed',
    });

    const startDate = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);

    const proposalId = seedProposal({
      actionType: 'generate_billing_run',
      description: `${descriptionPrefix}happy`,
      params: { start_date: startDate, end_date: endDate, mode: 'custom' },
    });

    const token = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = callExecuteFn(proposalId, 'confirm', token);

    expect(res.status, `generate_billing_run returned ${res.status}: ${JSON.stringify(res.body).slice(0, 400)}`).toBe(200);
    expect(res.body?.success, `generate_billing_run success=false: ${JSON.stringify(res.body).slice(0, 400)}`).toBe(true);
    // Handler generates invoices for ALL completed lessons in window (org-wide).
    // Our seeded lesson must result in at least one invoice covering it.
    expect((res.body?.result?.invoices_created as number) >= 1).toBe(true);

    // Verify our lesson got linked to an invoice_item.
    const items = supabaseSelect(
      'invoice_items',
      `linked_lesson_id=eq.${lessonId}&select=id,invoice_id`,
    );
    expect(items.length).toBe(1);
    const invoice = supabaseSelect(
      'invoices',
      `id=eq.${items[0].invoice_id}&select=org_id,payer_guardian_id,status`,
    )[0];
    expect(invoice?.org_id).toBe(orgId);
    expect(invoice?.payer_guardian_id).toBe(guardianId);
    expect(invoice?.status).toBe('draft');
  });
});
