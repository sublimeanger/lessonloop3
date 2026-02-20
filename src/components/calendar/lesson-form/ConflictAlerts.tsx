import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { ConflictResult } from '../types';

interface ConflictAlertsProps {
  conflictState: {
    isChecking: boolean;
    conflicts: ConflictResult[];
  };
  errors: ConflictResult[];
  warnings: ConflictResult[];
  setConflictState: (state: { isChecking: boolean; conflicts: ConflictResult[] }) => void;
}

export function ConflictAlerts({ conflictState, errors, warnings, setConflictState }: ConflictAlertsProps) {
  return (
    <div className="min-h-[60px]">
      {conflictState.isChecking && (
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking for conflicts...
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setConflictState({
              isChecking: false,
              conflicts: [{
                type: 'teacher',
                severity: 'warning',
                message: 'Conflict check skipped. Please verify manually.',
              }]
            })}
          >
            Skip
          </Button>
        </div>
      )}

      {!conflictState.isChecking && errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {!conflictState.isChecking && warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
