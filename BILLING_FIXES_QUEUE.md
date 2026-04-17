# LessonLoop Billing — Fixes Queue

Tracks every actionable fix surfaced by the Phase 2 billing forensics audit. Resolved in a dedicated fix session after Section 11 wrap.

**Buckets:**
- **A — STOP THE BLEEDING**: Live production bugs causing wrong money / data loss / parent-facing errors right now. Fix immediately.
- **B — END-OF-AUDIT FIX**: Real defects but no live harm (low-frequency, orphaned, or isolated). Fix after Section 11.
- **C — DESIGN DECISION**: Cross-cutting, architectural, or SPEC. Needs full audit picture before deciding.

---

## From Section 1 — Three-path paid_minor consistency

### Bucket A (fix now)
_None._

### Bucket B (fix at end)
- **B1.** `record_installment_payment` (P3) updates `paid_minor` via `SUM(payments)` but never INSERTs a payment row. Orphaned today — zero callers outside definition/REVOKE/generated types. Latent: if invoked, silent `paid_minor` under-count by exactly the installment amount while installment flips to 'paid'. Fix options: (a) delete the RPC, or (b) add payment INSERT + over-application guard + audit_log entry. Decide at fix pass.
- **B2.** No over-application guard on P2 (`record_stripe_payment_paid_guard`) or P3 — a payment exceeding remaining balance would set `paid_minor` > `total_minor`.
- **B3.** No `audit_log` entry on P2 or P3 — P1 logs, P2/P3 don't. Teacher-facing evidence gap.
- **B4.** Direct UPDATE bypass at `stripe-webhook/index.ts:973` mutates `paid_minor` without going through any RPC. Undermines the entire three-path model.

### Bucket C (design decision)
- **C1.** Three RPCs + one direct UPDATE all writing `paid_minor` is itself an architectural smell. Post-audit question: do we consolidate to one canonical path?
- **C2.** Status-reopen (paid → sent on refund) only fires on P2. Should be model-wide; depends on Section 2 findings.
- **C3.** Divergent installment reconciliation (only P1 sets `installments.payment_id`) — depends on Section 4 findings.

### Tracked but not actioned
- Return shape divergence (LOW) — cosmetic
- No amount-sign check in any RPC (LOW) — cosmetic unless combined with B2

---

## Running index
- Bucket A: 0
- Bucket B: 4
- Bucket C: 3
- Tracked (low): 2

---

## From Section 2 onwards
_To be populated._
