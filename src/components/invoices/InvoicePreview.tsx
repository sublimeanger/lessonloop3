import { useMemo } from 'react';
import { formatDateUK } from '@/lib/utils';

interface InvoiceBranding {
  orgName: string;
  invoiceFromName: string;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  vatNumber: string;
  footerNote: string;
  invoiceNumberPrefix: string;
  invoiceNumberDigits: number;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankReferencePrefix: string;
}

interface InvoicePreviewProps {
  branding: InvoiceBranding;
  className?: string;
}

/** Hex colour to RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/** Calculate relative luminance to determine text contrast */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastText(bg: string): string {
  return luminance(bg) > 0.4 ? '#1a1a2e' : '#ffffff';
}

export function InvoicePreview({ branding, className = '' }: InvoicePreviewProps) {
  const {
    orgName,
    invoiceFromName,
    logoUrl,
    brandColor,
    accentColor,
    addressLine1,
    addressLine2,
    city,
    postcode,
    vatNumber,
    footerNote,
    invoiceNumberPrefix,
    invoiceNumberDigits,
    bankAccountName,
    bankSortCode,
    bankAccountNumber,
    bankReferencePrefix,
  } = branding;

  const displayName = invoiceFromName || orgName || 'Your Organisation';
  const today = useMemo(() => formatDateUK(new Date(), 'dd/MM/yyyy'), []);
  const dueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return formatDateUK(d, 'dd/MM/yyyy');
  }, []);

  const sampleNumber = useMemo(() => {
    const prefix = invoiceNumberPrefix || 'LL';
    const year = new Date().getFullYear();
    const digits = Math.max(3, Math.min(8, invoiceNumberDigits || 5));
    return `${prefix}-${year}-${'1'.padStart(digits, '0')}`;
  }, [invoiceNumberPrefix, invoiceNumberDigits]);

  const addressParts = [addressLine1, addressLine2, city, postcode].filter(Boolean);

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border border-border/60 overflow-hidden ${className}`}
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* Coloured header bar */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: brandColor }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-lg object-contain bg-white/90 p-0.5 shrink-0"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{
                backgroundColor: accentColor,
                color: contrastText(accentColor),
              }}
            >
              {(displayName || 'O').substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div
              className="font-semibold text-sm truncate"
              style={{ color: contrastText(brandColor) }}
            >
              {displayName}
            </div>
            {addressParts.length > 0 && (
              <div
                className="text-[10px] truncate opacity-80"
                style={{ color: contrastText(brandColor) }}
              >
                {addressParts.join(', ')}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-xs font-bold tracking-wider uppercase"
            style={{ color: contrastText(brandColor), opacity: 0.9 }}
          >
            Invoice
          </div>
          <div
            className="text-[10px] font-mono mt-0.5"
            style={{ color: contrastText(brandColor), opacity: 0.7 }}
          >
            {sampleNumber}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-4 space-y-4 text-[11px] text-gray-700">
        {/* Bill To / Dates */}
        <div className="flex justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-medium">
              Bill To
            </div>
            <div className="font-medium text-gray-900 mt-0.5">Jane Smith</div>
            <div className="text-gray-500">jane@example.com</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-medium">
              Issue Date
            </div>
            <div className="mt-0.5">{today}</div>
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-medium mt-2">
              Due Date
            </div>
            <div className="mt-0.5">{dueDate}</div>
          </div>
        </div>

        {vatNumber && (
          <div className="text-[9px] text-gray-400">VAT: {vatNumber}</div>
        )}

        {/* Line items table */}
        <div className="rounded-lg overflow-hidden border border-gray-100">
          <div
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider"
            style={{ backgroundColor: `${accentColor}12`, color: accentColor }}
          >
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-gray-50">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 items-center">
              <span>Piano lesson (60 min)</span>
              <span className="text-right text-gray-500">4</span>
              <span className="text-right text-gray-500">&pound;45.00</span>
              <span className="text-right font-medium text-gray-900">&pound;180.00</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 items-center">
              <span>Theory workbook</span>
              <span className="text-right text-gray-500">1</span>
              <span className="text-right text-gray-500">&pound;12.99</span>
              <span className="text-right font-medium text-gray-900">&pound;12.99</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-40 space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>&pound;192.99</span>
            </div>
            <div
              className="flex justify-between pt-1.5 border-t font-semibold text-xs"
              style={{ borderColor: `${accentColor}30` }}
            >
              <span className="text-gray-900">Total</span>
              <span style={{ color: accentColor }}>&pound;192.99</span>
            </div>
          </div>
        </div>

        {/* Bank details */}
        {bankAccountName && bankSortCode && bankAccountNumber && (
          <div
            className="rounded-lg p-3 mt-2"
            style={{ backgroundColor: `${brandColor}08`, borderLeft: `3px solid ${accentColor}` }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Payment Details
            </div>
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <div>Account: {bankAccountName}</div>
              <div>
                Sort Code: {bankSortCode} &middot; Acc: {bankAccountNumber}
              </div>
              {bankReferencePrefix && (
                <div>Ref: {bankReferencePrefix}-{sampleNumber}</div>
              )}
            </div>
          </div>
        )}

        {/* Footer note */}
        {footerNote && (
          <div className="text-[9px] text-gray-400 italic pt-2 border-t border-gray-100">
            {footerNote}
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
      <div className="h-1" style={{ backgroundColor: accentColor }} />
    </div>
  );
}
