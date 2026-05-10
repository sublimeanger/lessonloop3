/**
 * Lightweight Sentry capture for Supabase Edge Functions (Deno runtime).
 *
 * Reasoning over the official @sentry/deno SDK:
 * - This wrapper is ~120 LoC of dependency-free TypeScript that sends a
 *   minimal envelope to Sentry's ingest API. It is intentionally narrow:
 *   we capture errors + a basic transaction frame (start/finish), set
 *   request tags (path, method, runtime), and forward the response.
 * - Versioning churn from @sentry/deno (which transitively pulls
 *   @sentry/core, @sentry/utils, etc) is risky on the cold-start
 *   path of every invocation. The HTTP envelope API is stable.
 * - Reuses lessonloop/javascript-react project DSN with a dedicated
 *   "Edge Functions (Supabase Deno)" key (s25). Events get tagged
 *   `runtime: deno-edge` for filtering vs the browser project.
 *
 * Usage in an edge fn:
 *
 *   import { wrapEdgeFn } from "../_shared/sentry.ts";
 *
 *   const handler = async (req: Request): Promise<Response> => {
 *     // ... existing function body ...
 *   };
 *
 *   Deno.serve(wrapEdgeFn("send-message", handler));
 *
 * Behaviour:
 * - If SENTRY_EDGE_DSN is unset, wrapEdgeFn becomes a no-op pass-through.
 *   This is intentional — local-dev / unset env should not block fn boot.
 * - Captures any error thrown by handler. Re-throws so the fn's own
 *   try/catch can still respond (we never mask the original failure
 *   from the client). Sentry capture is fire-and-forget — we don't
 *   await the ingest POST so Sentry latency does not slow user response.
 * - Captures HTTP 5xx responses too (non-throwing failures), since
 *   most edge fns catch internally and return 500 JSON.
 */

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
  envelopeUrl: string;
}

/** Parse a Sentry DSN URL into the components needed for envelope ingest. */
function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!publicKey || !projectId) return null;
    return {
      publicKey,
      host,
      projectId,
      envelopeUrl: `https://${host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

const DSN_RAW = (typeof Deno !== "undefined" && Deno.env.get("SENTRY_EDGE_DSN")) || "";
const DSN = parseDsn(DSN_RAW);

/**
 * Per-request shadow-mode marker. Populated by `_shared/shadow-email.ts`
 * when it routes an email to SHADOW_RECIPIENTS (i.e., when the request's
 * org is in shadow mode). wrapEdgeFn reads this on event capture to add
 * `shadow:true` tag to Sentry events. WeakMap so entries are GC'd when
 * the Request object goes out of scope (per-invocation, no cross-request
 * contamination).
 */
const SHADOW_REQUESTS = new WeakMap<Request, true>();

/** Mark the current request as shadow-mode. Idempotent. Called by
 *  shadow-email.ts when it intercepts an outbound email. */
export function markRequestAsShadow(req: Request): void {
  SHADOW_REQUESTS.set(req, true);
}

/** Check whether a request was marked as shadow during its lifecycle. */
function isShadowRequest(req: Request): boolean {
  return SHADOW_REQUESTS.get(req) === true;
}

/** UUID v4 without external deps. */
function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** POST a Sentry envelope. Fire-and-forget. */
function sendEnvelope(payload: Record<string, unknown>): void {
  if (!DSN) return;
  const eventId = uuid();
  const sentAt = new Date().toISOString();
  const auth =
    `Sentry sentry_version=7,sentry_client=lessonloop-edge/1.0,` +
    `sentry_key=${DSN.publicKey}`;

  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: sentAt });
  const itemHeader = JSON.stringify({ type: "event", content_type: "application/json" });
  const item = JSON.stringify({ event_id: eventId, ...payload });
  const body = `${envelopeHeader}\n${itemHeader}\n${item}\n`;

  // Fire-and-forget — do not await. Sentry latency must not slow user response.
  void fetch(DSN.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": auth,
    },
    body,
  }).catch(() => { /* swallow — never let Sentry capture failures cascade */ });
}

interface CaptureContext {
  fnName: string;
  request: Request;
  startedAt: number;
}

function buildEvent(
  context: CaptureContext,
  level: "error" | "warning",
  message: string,
  error?: unknown,
): Record<string, unknown> {
  const url = (() => { try { return new URL(context.request.url); } catch { return null; } })();
  const exception = error instanceof Error
    ? {
      values: [{
        type: error.name || "Error",
        value: error.message || String(error),
        stacktrace: error.stack ? { frames: error.stack.split("\n").slice(0, 30).map((line) => ({ filename: line.trim() })) } : undefined,
      }],
    }
    : undefined;
  const shadow = isShadowRequest(context.request);
  return {
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level,
    message: { formatted: message },
    transaction: context.fnName,
    environment: Deno.env.get("SUPABASE_ENV") || "production",
    server_name: "supabase-edge",
    tags: {
      "runtime": "deno-edge",
      "fn_name": context.fnName,
      "request.method": context.request.method,
      ...(url ? { "request.path": url.pathname } : {}),
      ...(shadow ? { "shadow": "true" } : {}),
    },
    request: url
      ? {
        url: context.request.url,
        method: context.request.method,
        headers: { "user-agent": context.request.headers.get("user-agent") ?? "" },
      }
      : undefined,
    extra: {
      duration_ms: Date.now() - context.startedAt,
    },
    exception,
  };
}

/**
 * Wrap an edge function handler with Sentry capture. The wrapper:
 * - captures any error thrown by the inner handler (re-throws after capture)
 * - captures HTTP 5xx responses returned by the inner handler
 * - tags every event with the fn name + request path/method + runtime
 *
 * Wrapping is a no-op if SENTRY_EDGE_DSN is unset.
 */
export function wrapEdgeFn(
  fnName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const context: CaptureContext = { fnName, request: req, startedAt: Date.now() };
    let response: Response;
    try {
      response = await handler(req);
    } catch (err) {
      sendEnvelope(buildEvent(context, "error", `Unhandled error in ${fnName}`, err));
      throw err;
    }
    if (response.status >= 500) {
      sendEnvelope(buildEvent(
        context,
        "error",
        `${fnName} returned HTTP ${response.status}`,
      ));
    }
    return response;
  };
}

/** Lightweight programmatic capture — for places that catch internally. */
export function captureEdgeError(fnName: string, err: unknown, req?: Request): void {
  const synthReq = req ?? new Request("https://supabase.local/" + fnName);
  const context: CaptureContext = { fnName, request: synthReq, startedAt: Date.now() };
  sendEnvelope(buildEvent(context, "error", `${fnName} captured error`, err));
}
