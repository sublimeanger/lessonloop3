import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, success, hint, required, className, id, ...props }, ref) => {
    const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-2">
        <Label 
          htmlFor={fieldId}
          className={cn(error && 'text-destructive')}
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </Label>
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            className={cn(
              error && 'border-destructive focus-visible:ring-destructive pr-10',
              success && 'border-success focus-visible:ring-success pr-10',
              className
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          />
          {error && (
            <AlertCircle 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" 
              aria-hidden="true"
            />
          )}
          {success && !error && (
            <CheckCircle2 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" 
              aria-hidden="true"
            />
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p 
            id={errorId} 
            className="text-sm text-destructive flex items-center gap-1.5"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {success && !error && (
          <p className="text-sm text-success flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {success}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

// Textarea variant
export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, success, hint, required, className, id, ...props }, ref) => {
    const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-2">
        <Label 
          htmlFor={fieldId}
          className={cn(error && 'text-destructive')}
        >
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </Label>
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            success && 'border-success focus-visible:ring-success',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p 
            id={errorId} 
            className="text-sm text-destructive flex items-center gap-1.5"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

export { FormField, FormTextarea };
