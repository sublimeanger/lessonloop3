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
 * Format currency with proper locale
 */
export function formatCurrency(
  amount: number,
  currencyCode = 'GBP',
  options: { fromMinor?: boolean } = {}
): string {
  const value = options.fromMinor ? amount / 100 : amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format currency from minor units (pence/cents)
 */
export function formatCurrencyMinor(amountMinor: number, currencyCode = 'GBP'): string {
  return formatCurrency(amountMinor, currencyCode, { fromMinor: true });
}

/**
 * Return the narrow currency symbol for a given ISO 4217 code.
 * e.g. 'GBP' → '£', 'USD' → '$', 'EUR' → '€'
 */
export function currencySymbol(code: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: code })
    .formatToParts(0).find(p => p.type === 'currency')?.value || code;
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
