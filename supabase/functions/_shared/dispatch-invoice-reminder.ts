/**
 * Centralised invoice-reminder dispatch.
 *
 * Single source of truth for sending a payment-reminder email:
 *   1. Check the recipient hasn't opted out
 *   2. Render the branded HTML
 *   3. Insert a `message_log` row with status='pending' (or 'logged' if no
 *      Resend key configured — local/dev only)
 *   4. POST to Resend (passed through `transformEmailForShadow` so shadow
 *      orgs go to the safe SHADOW_RECIPIENTS)
 *   5. Update the message_log row to 'sent' / 'failed' with sent_at /
 *      error_message
 *   6. Return a structured result so callers can classify outcomes
 *
 * Used by:
 *   - `looopassist-execute` send_invoice_reminders + send_bulk_reminders
 *     (user-initiated, no tier-cadence)
 *   - (planned sprint 2) `overdue-reminders` cron — currently inlines its
 *     own copy; refactoring to this module gives prod + LoopAssist one shape
 *
 * Why this exists: prior to s38 sprint 1, LoopAssist's reminder handlers
 * just inserted message_log rows with status='queued' and returned "Queued
 * N — review in Messages" — but no UI surfaces 'queued' rows and no path
 * actually sent them. The marketing claim was a fiction. This module makes
 * the action card's promise ("Sent N") match what actually happens.
 */

import { escapeHtml, sanitiseFromName } from "./escape-html.ts";
import { isNotificationEnabled } from "./check-notification-pref.ts";
import { transformEmailForShadow } from "./shadow-email.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

export interface ReminderInvoice {
  id: string;
  invoice_number: string;
  total_minor: number;
  paid_minor?: number | null;
  due_date: string;
  currency_code: string;
}

export interface ReminderRecipient {
  type: 'guardian' | 'student';
  id: string;
  name: string;
  email: string;
  /** Auth user_id when the recipient has a portal account; used for notification preference check. */
  userId?: string | null;
}

export interface ReminderOrg {
  id: string;
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}

export interface DispatchInvoiceReminderOpts {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  /** From Deno.env.get("RESEND_API_KEY"). Undefined → log-only mode (status='logged'). */
  resendApiKey: string | undefined;
  org: ReminderOrg;
  invoice: ReminderInvoice;
  recipient: ReminderRecipient;
  /** auth.uid() of the user who triggered the send. Stored as sender_user_id on the message_log row. */
  senderUserId: string;
  /**
   * Distinguishes LoopAssist-initiated sends from automated cron sends in
   * audit + analytics. Stored in `message_type`. The cron uses
   * `overdue_reminder_d{tier}`; LoopAssist uses `invoice_reminder`.
   */
  messageType?: string;
}

export type DispatchResult =
  | {
      ok: true;
      /** 'sent' if Resend confirmed delivery; 'pending' if dispatched but not yet confirmed; 'logged' if no API key (dev). */
      status: 'sent' | 'pending' | 'logged';
      messageLogId?: string;
    }
  | {
      ok: false;
      reason: 'opted_out' | 'send_failed' | 'log_failed';
      error?: string;
    };

function formatCurrency(minorAmount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(minorAmount / 100);
  } catch {
    return `${(minorAmount / 100).toFixed(2)} ${currencyCode}`;
  }
}

function formatDateGB(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function calcDaysOverdue(dueDate: string, today: Date = new Date()): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((todayMidnight.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
}

function buildEmail(opts: {
  org: ReminderOrg;
  invoice: ReminderInvoice;
  recipient: ReminderRecipient;
  daysOverdue: number;
}): { subject: string; html: string } {
  const { org, invoice, recipient, daysOverdue } = opts;
  const brandColor = org.brandColor || "#2563eb";
  const remainingMinor = invoice.total_minor - (invoice.paid_minor || 0);
  const amount = formatCurrency(remainingMinor, invoice.currency_code);
  const portalLink = `${FRONTEND_URL}/portal/invoices?invoice=${invoice.id}&action=pay`;

  const urgency: 'friendly' | 'important' | 'urgent' =
    daysOverdue >= 30 ? 'urgent'
    : daysOverdue >= 14 ? 'important'
    : 'friendly';

  const accentColor = urgency === 'urgent' ? '#dc2626' : brandColor;
  const bgColor = urgency === 'urgent' ? '#fef2f2' : '#f5f5f5';

  const subject = urgency === 'urgent'
    ? `URGENT: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`
    : urgency === 'important'
    ? `Important: Invoice ${invoice.invoice_number} requires attention`
    : daysOverdue > 0
    ? `Reminder: Invoice ${invoice.invoice_number} is overdue`
    : `Reminder: Invoice ${invoice.invoice_number}`;

  const headerLogo = org.logoUrl
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="${escapeHtml(org.logoUrl)}" alt="${escapeHtml(org.name)}" style="max-height:60px;max-width:200px;" /></div>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${headerLogo}
      <h1 style="color: ${accentColor}; margin-bottom: 20px;">
        Payment ${urgency === 'urgent' ? 'Urgently Required' : 'Reminder'}
      </h1>
      <p>Dear ${escapeHtml(recipient.name)},</p>
      <p>Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>${daysOverdue > 0 ? ` is now <strong>${daysOverdue} days overdue</strong>` : ' is outstanding'}.</p>
      <div style="background: ${bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accentColor};">
        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${escapeHtml(invoice.invoice_number)}</p>
        ${(invoice.paid_minor || 0) > 0
          ? `<p style="margin: 5px 0;"><strong>Total:</strong> ${escapeHtml(formatCurrency(invoice.total_minor, invoice.currency_code))}</p>
        <p style="margin: 5px 0;"><strong>Paid:</strong> ${escapeHtml(formatCurrency(invoice.paid_minor || 0, invoice.currency_code))}</p>
        <p style="margin: 5px 0; font-weight: 600;"><strong>Remaining:</strong> ${escapeHtml(amount)}</p>`
          : `<p style="margin: 5px 0;"><strong>Amount Due:</strong> ${escapeHtml(amount)}</p>`}
        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formatDateGB(invoice.due_date)}</p>
        ${daysOverdue > 0 ? `<p style="margin: 5px 0; color: ${urgency === 'urgent' ? '#dc2626' : '#666'};"><strong>Days Overdue:</strong> ${daysOverdue}</p>` : ''}
      </div>
      <p style="text-align: center;">
        <a href="${portalLink}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;">Pay Now</a>
      </p>
      <p style="font-size: 12px; color: #666;">If you have already made payment, please disregard this email. Payments may take 1-2 business days to process.</p>
      <p>Thank you,<br>${escapeHtml(org.name)}</p>
    </div>`;

  return { subject, html };
}

/**
 * Dispatch a single payment-reminder email. See module docstring for contract.
 *
 * On opt-out: no message_log row written, returns `{ ok: false, reason: 'opted_out' }`.
 * On log failure: returns `{ ok: false, reason: 'log_failed' }` (Resend not attempted).
 * On send failure: message_log row is updated with status='failed' + error_message; returns `{ ok: false, reason: 'send_failed' }`.
 * On dev (no RESEND_API_KEY): message_log row is inserted with status='logged'; returns `{ ok: true, status: 'logged' }`.
 */
export async function dispatchInvoiceReminder(opts: DispatchInvoiceReminderOpts): Promise<DispatchResult> {
  const { supabase, resendApiKey, org, invoice, recipient, senderUserId } = opts;
  const messageType = opts.messageType || 'invoice_reminder';

  // 1. Notification preference — only relevant if the recipient has a portal account.
  //    Marketing keys default to opt-out, transactional default to opt-in (per
  //    check-notification-pref.ts). invoice_reminders is transactional.
  if (recipient.userId) {
    const allowed = await isNotificationEnabled(supabase, org.id, recipient.userId, 'email_invoice_reminders');
    if (!allowed) {
      return { ok: false, reason: 'opted_out' };
    }
  }

  // 2. Render
  const daysOverdue = calcDaysOverdue(invoice.due_date);
  const { subject, html } = buildEmail({ org, invoice, recipient, daysOverdue });

  // 3. Log first — provides a row to update + an audit record even if Resend fails.
  const initialStatus = resendApiKey ? 'pending' : 'logged';
  const { data: logRow, error: logError } = await supabase
    .from('message_log')
    .insert({
      org_id: org.id,
      channel: 'email',
      subject,
      body: html,
      sender_user_id: senderUserId,
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      recipient_type: recipient.type,
      recipient_id: recipient.id,
      related_id: invoice.id,
      message_type: messageType,
      status: initialStatus,
    })
    .select('id')
    .single();

  if (logError || !logRow) {
    console.error('[dispatch-invoice-reminder] message_log insert failed', logError);
    return { ok: false, reason: 'log_failed', error: logError?.message };
  }

  const messageLogId = logRow.id as string;

  // 4. If no Resend key, we're done (dev/local). The row exists in 'logged' state.
  if (!resendApiKey) {
    return { ok: true, status: 'logged', messageLogId };
  }

  // 5. Dispatch via Resend (with shadow-email transform for shadow orgs).
  const fromName = sanitiseFromName(org.name);
  const payload = await transformEmailForShadow(
    {
      from: `${fromName} <billing@lessonloop.net>`,
      to: [recipient.email],
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
    { orgId: org.id, supabase }
  );

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : 'fetch threw';
    await supabase
      .from('message_log')
      .update({ status: 'failed', error_message: errMsg })
      .eq('id', messageLogId);
    return { ok: false, reason: 'send_failed', error: errMsg, messageLogId } as DispatchResult;
  }

  let resendBody: unknown;
  try { resendBody = await response.json(); } catch { resendBody = null; }

  if (response.ok) {
    await supabase
      .from('message_log')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', messageLogId);
    return { ok: true, status: 'sent', messageLogId };
  }

  const errMsg = `Resend ${response.status}: ${JSON.stringify(resendBody).slice(0, 300)}`;
  await supabase
    .from('message_log')
    .update({ status: 'failed', error_message: errMsg })
    .eq('id', messageLogId);
  return { ok: false, reason: 'send_failed', error: errMsg, messageLogId };
}
