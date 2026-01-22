import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as fnsFormat, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date using UK conventions (DD/MM/YYYY)
 */
export function formatDateUK(date: Date | string, formatStr = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fnsFormat(d, formatStr);
}

/**
 * Format a time using 24-hour format (HH:mm)
 */
export function formatTimeUK(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
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
