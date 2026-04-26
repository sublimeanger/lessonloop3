/**
 * Cron Health Watchdog (T08-P2-C2)
 *
 * Daily survey of all pg_cron jobs. Calls public.check_cron_health() RPC,
 * formats failures as an HTML email, sends via Resend to OPERATOR_ALERT_EMAIL,
 * and self-audits to platform_audit_log on every run regardless of outcome.
 *
 * Severity policy (see docs/CRON_HEALTH.md):
 *   - Class A (stopped firing): always emailed (critical, daily).
 *   - Class B (HTTP failing): critical = daily; warning = Monday weekly digest.
 *
 * Runs daily at 09:30 UTC via pg_cron (registered in
 * 20260508100100_cron_health_watchdog.sql). Pattern C cron auth.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

interface CronHealthRow {
  jobname: string;
  schedule: string;
  active: boolean;
  failure_class: string | null;
  severity: "info" | "warning" | "critical";
  last_run_at: string | null;
  expected_interval_seconds: number;
  age_since_last_run_seconds: number | null;
  http_failures_24h: number;
  http_total_24h: number;
  http_failure_rate: number;
  evidence: Record<string, unknown>;
}

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return "never";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  return `${Math.round(seconds / 86400)} day(s)`;
}

function buildEmailHtml(rows: CronHealthRow[]): string {
  const critical = rows.filter((r) => r.severity === "critical");
  const warning = rows.filter((r) => r.severity === "warning");
  const total = rows.length;

  const classA = critical.filter((r) => r.failure_class === "A_stopped_firing");
  const classB = critical.filter((r) => r.failure_class === "B_http_failing");

  let body = `
    <p>Of ${total} crons, <strong>${critical.length}</strong> critical and <strong>${warning.length}</strong> warning.</p>
  `;

  if (classA.length > 0) {
    body += `<h3 style="color:#b91c1c;">Class A — stopped firing (${classA.length})</h3><ul>`;
    for (const r of classA) {
      body += `<li><strong>${escapeHtml(r.jobname)}</strong> — last run ${formatAge(r.age_since_last_run_seconds)} ago (schedule: ${escapeHtml(r.schedule)})</li>`;
    }
    body += "</ul>";
  }

  if (classB.length > 0) {
    body += `<h3 style="color:#b91c1c;">Class B — HTTP failing (${classB.length})</h3><ul>`;
    for (const r of classB) {
      body += `<li><strong>${escapeHtml(r.jobname)}</strong> — ${r.http_failures_24h} failures in last 24h of ${r.http_total_24h} firings (${(r.http_failure_rate * 100).toFixed(0)}%)</li>`;
    }
    body += "</ul>";
  }

  if (warning.length > 0) {
    body += `<h3 style="color:#b45309;">Warning — transient failures (${warning.length})</h3><ul>`;
    for (const r of warning) {
      body += `<li><strong>${escapeHtml(r.jobname)}</strong> — ${r.http_failures_24h} transient failure(s) in last 24h</li>`;
    }
    body += "</ul>";
  }

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-top:0;">LessonLoop cron-health alert</h2>
        ${body}
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 13px; color: #6b7280;">
          Watchdog ran at ${new Date().toISOString()}. Open <a href="${FRONTEND_URL}/admin">${FRONTEND_URL}</a> to investigate.
        </p>
      </body>
    </html>
  `;
}

async function sendAlertEmail(
  to: string,
  rows: CronHealthRow[],
  resendApiKey: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const critical = rows.filter((r) => r.severity === "critical");
  const warning = rows.filter((r) => r.severity === "warning");
  const subject =
    critical.length > 0
      ? `LessonLoop cron-health: ${critical.length} critical, ${warning.length} warning`
      : `LessonLoop cron-health: ${warning.length} warning`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "LessonLoop Watchdog <noreply@lessonloop.net>",
      to,
      subject,
      html: buildEmailHtml(rows),
    }),
  });

  return {
    ok: res.ok,
    status: res.status,
    body: await res.text(),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const operatorEmail = Deno.env.get("OPERATOR_ALERT_EMAIL");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.rpc("check_cron_health");
  if (error) {
    console.error("[cron-health-watchdog] RPC failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (data || []) as CronHealthRow[];
  const failures = rows.filter(
    (r) => r.severity === "critical" || r.severity === "warning",
  );
  const criticalCount = rows.filter((r) => r.severity === "critical").length;
  const warningCount = rows.filter((r) => r.severity === "warning").length;

  const auditDetails = {
    checked_at: new Date().toISOString(),
    total_crons: rows.length,
    critical_count: criticalCount,
    warning_count: warningCount,
    failures: failures.map((r) => ({
      cron_name: r.jobname,
      class: r.failure_class,
      severity: r.severity,
      evidence: r.evidence,
    })),
  };

  const auditSeverity =
    criticalCount > 0 ? "error" : warningCount > 0 ? "warning" : "info";

  await supabase.from("platform_audit_log").insert({
    action: "cron_health_check_run",
    source: "cron-health-watchdog",
    severity: auditSeverity,
    details: auditDetails,
  });

  let emailResult: { ok: boolean; status: number; body: string } | null = null;
  if (failures.length > 0) {
    if (!operatorEmail) {
      console.warn(
        "[cron-health-watchdog] OPERATOR_ALERT_EMAIL not set; skipping email",
      );
    } else if (!resendApiKey) {
      console.warn(
        "[cron-health-watchdog] RESEND_API_KEY not set; skipping email",
      );
    } else {
      const isMonday = new Date().getUTCDay() === 1;
      const hasCritical = criticalCount > 0;
      const shouldEmail = hasCritical || isMonday;

      if (shouldEmail) {
        emailResult = await sendAlertEmail(operatorEmail, failures, resendApiKey);
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      total_crons: rows.length,
      critical_count: criticalCount,
      warning_count: warningCount,
      email_sent: emailResult !== null,
      email_ok: emailResult?.ok ?? null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
