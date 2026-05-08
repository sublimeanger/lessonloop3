import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as fnsFormat, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date using UK conventions (DD/MM/YYYY)
 * If timezone is provided, formats in that timezone instead of browser local.
 */
export function formatDateUK(date: Date | string, formatStr = 'dd/MM/yyyy', timezone?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (timezone) {
    return formatInTimeZone(d, timezone, formatStr);
  }
  return fnsFormat(d, formatStr);
}

/**
 * Format a time using 24-hour format (HH:mm)
 * If timezone is provided, formats in that timezone instead of browser local.
 */
export function formatTimeUK(date: Date | string, timezone?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (timezone) {
    return formatInTimeZone(d, timezone, 'HH:mm');
  }
  return fnsFormat(d, 'HH:mm');
}

/**
 * Format a date in an org's timezone (defaults to dd/MM/yyyy).
 */
export function formatDateForOrg(date: Date | string, timezone: string, formatStr = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, formatStr);
}

/**
 * Format a time in an org's timezone (HH:mm).
 */
export function formatTimeForOrg(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, 'HH:mm');
}

/**
 * Format date + time in an org's timezone (dd/MM/yyyy HH:mm).
 */
export function formatDateTimeForOrg(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, 'dd/MM/yyyy HH:mm');
}

/**
 * Format currency with proper locale
 */
/**
 * Coerce a currency code to a valid ISO 4217 string.
 *
 * Many call sites pass `currentOrg?.currency_code ?? ''` — when the org
 * hasn't loaded yet, this becomes `''`, and `Intl.NumberFormat` then
 * throws `RangeError: Invalid currency code` causing the React error
 * boundary to catch and show "Something went wrong". Centralising the
 * coercion here keeps callers simple and unbreakable.
 *
 * Discovered 2026-05-08 via the e2e parent-portal invoices error.
 */
function safeCurrencyCode(code: string | null | undefined): string {
  const trimmed = (code ?? '').toString().trim();
  // Must be a 3-letter ISO 4217 code; fall back to GBP for anything
  // shorter / longer / weird (e.g. empty string, lowercase, numeric).
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return 'GBP';
}

export function formatCurrency(
  amount: number,
  currencyCode: string | null | undefined = 'GBP',
  options: { fromMinor?: boolean } = {}
): string {
  const value = options.fromMinor ? amount / 100 : amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: safeCurrencyCode(currencyCode),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format currency from minor units (pence/cents)
 */
export function formatCurrencyMinor(amountMinor: number, currencyCode: string | null | undefined = 'GBP'): string {
  return formatCurrency(amountMinor, currencyCode, { fromMinor: true });
}

/**
 * Return the narrow currency symbol for a given ISO 4217 code.
 * e.g. 'GBP' → '£', 'USD' → '$', 'EUR' → '€'
 */
export function currencySymbol(code: string | null | undefined): string {
  const safe = safeCurrencyCode(code);
  return new Intl.NumberFormat('en', { style: 'currency', currency: safe })
    .formatToParts(0).find(p => p.type === 'currency')?.value || safe;
}

/**
 * Sanitise a string for safe CSV inclusion.
 * Prefixes cells starting with formula characters (=, +, -, @, \t, \r)
 * with a single quote to prevent Excel/Sheets formula injection.
 */
export function sanitiseCSVCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}
