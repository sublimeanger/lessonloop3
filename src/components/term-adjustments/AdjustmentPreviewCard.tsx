import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrencyMinor } from '@/lib/utils';
import type { TermAdjustmentPreview } from '@/hooks/useTermAdjustment';

interface AdjustmentPreviewCardProps {
  preview: TermAdjustmentPreview;
  adjustmentType: 'withdrawal' | 'day_change';
}

export function AdjustmentPreviewCard({ preview, adjustmentType }: AdjustmentPreviewCardProps) {
  const isCredit = preview.adjustment_amount_minor > 0;
  const isDebit = preview.adjustment_amount_minor < 0;
  const isZero = preview.adjustment_amount_minor === 0;
  const currency = preview.currency_code;

  return (
    <div className="space-y-4">
      {/* Two-column comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current column */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Current</div>
          <div className="font-medium">{preview.original_day} {preview.original_time}</div>
          {preview.teacher_name && (
            <div className="text-sm text-muted-foreground">with {preview.teacher_name}</div>
          )}
          {preview.location_name && (
            <div className="text-sm text-muted-foreground">@ {preview.location_name}</div>
          )}
          <div className="text-sm">
            <span className="font-medium">{preview.original_remaining_lessons}</span>{' '}
            lesson{preview.original_remaining_lessons !== 1 ? 's' : ''} remaining
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {preview.original_remaining_dates.map((date) => (
              <Badge
                key={date}
                variant="secondary"
                className={`text-xs ${adjustmentType === 'day_change' ? 'line-through opacity-60' : ''}`}
              >
                {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Badge>
            ))}
          </div>
        </div>

        {/* New / After column */}
        <div className="rounded-lg border p-3 space-y-2">
          {adjustmentType === 'day_change' ? (
            <>
              <div className="text-sm font-medium text-muted-foreground">New</div>
              <div className="font-medium">
                {preview.new_day} {preview.new_time}
              </div>
              {preview.new_teacher_name && preview.new_teacher_name !== preview.teacher_name && (
                <div className="text-sm text-muted-foreground">with {preview.new_teacher_name}</div>
              )}
              {preview.new_teacher_name && preview.new_teacher_name === preview.teacher_name && preview.teacher_name && (
                <div className="text-sm text-muted-foreground">with {preview.teacher_name}</div>
              )}
              {preview.new_location_name && preview.new_location_name !== preview.location_name && (
                <div className="text-sm text-muted-foreground">@ {preview.new_location_name}</div>
              )}
              {preview.new_location_name && preview.new_location_name === preview.location_name && preview.location_name && (
                <div className="text-sm text-muted-foreground">@ {preview.location_name}</div>
              )}
              <div className="text-sm">
                <span className="font-medium">{preview.new_lesson_count}</span>{' '}
                lesson{preview.new_lesson_count !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {preview.new_lesson_dates.map((date) => (
                  <Badge key={date} variant="default" className="text-xs">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-muted-foreground">After</div>
              <div className="font-medium">Withdrawn</div>
              <div className="text-sm text-muted-foreground">
                All {preview.original_remaining_lessons} lesson
                {preview.original_remaining_lessons !== 1 ? 's' : ''} will be cancelled
              </div>
            </>
          )}
        </div>
      </div>

      {/* Financial summary */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {preview.original_remaining_lessons} lesson{preview.original_remaining_lessons !== 1 ? 's' : ''} cancelled
          </span>
          <span>
            -{preview.original_remaining_lessons} × {formatCurrencyMinor(preview.lesson_rate_minor, currency)}
          </span>
        </div>

        {adjustmentType === 'day_change' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {preview.new_lesson_count} new lesson{preview.new_lesson_count !== 1 ? 's' : ''} created
            </span>
            <span>
              +{preview.new_lesson_count} × {formatCurrencyMinor(preview.lesson_rate_minor, currency)}
            </span>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Difference</span>
          <span>
            {preview.lessons_difference} lesson{Math.abs(preview.lessons_difference) !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {isCredit ? 'Credit amount' : isDebit ? 'Additional charge' : 'Amount'}
          </span>
          <span>
            {formatCurrencyMinor(Math.abs(preview.adjustment_amount_minor), currency)}
          </span>
        </div>

        {preview.vat_amount_minor > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">VAT</span>
            <span>{formatCurrencyMinor(preview.vat_amount_minor, currency)}</span>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="font-medium">
            {isCredit ? 'Credit to parent' : isDebit ? 'Additional charge' : 'No financial difference'}
          </span>
          {!isZero && (
            <span className={`text-2xl font-bold tracking-tight ${isCredit ? 'text-success' : ''}`}>
              {isCredit ? '' : '+'}{formatCurrencyMinor(Math.abs(preview.total_adjustment_minor), currency)}
            </span>
          )}
        </div>
      </div>

      {/* Linked invoice */}
      {preview.existing_term_invoice && (
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">Linked Invoice</div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {preview.existing_term_invoice.invoice_number}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {formatCurrencyMinor(preview.existing_term_invoice.total_minor, currency)}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {preview.existing_term_invoice.status}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
