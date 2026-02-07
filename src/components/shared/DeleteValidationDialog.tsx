import { useState } from 'react';
import { DeletionCheckResult, DeletionBlock } from '@/hooks/useDeleteValidation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, Ban, Loader2 } from 'lucide-react';

interface DeleteValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType: string;
  checkResult: DeletionCheckResult | null;
  isLoading: boolean;
  onConfirmDelete: () => void;
  isDeleting?: boolean;
}

export function DeleteValidationDialog({
  open,
  onOpenChange,
  entityName,
  entityType,
  checkResult,
  isLoading,
  onConfirmDelete,
  isDeleting = false,
}: DeleteValidationDialogProps) {
  if (isLoading) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Checking dependencies...
            </AlertDialogTitle>
            <AlertDialogDescription>
              Verifying if {entityName} can be safely deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (!checkResult) return null;

  const hasBlocks = checkResult.blocks.length > 0;
  const hasWarnings = checkResult.warnings.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasBlocks ? (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                Cannot Delete {entityType}
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-warning" />
                Delete {entityType}?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasBlocks
              ? `${entityName} cannot be deleted due to the following dependencies:`
              : `Are you sure you want to delete ${entityName}?`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Blocking Issues */}
        {hasBlocks && (
          <div className="space-y-3 my-4">
            {checkResult.blocks.map((block, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-destructive">{block.reason}</p>
                    <Badge variant="destructive" className="text-xs">
                      {block.count}
                    </Badge>
                  </div>
                  {block.details && (
                    <p className="text-sm text-muted-foreground mt-1">{block.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && !hasBlocks && (
          <div className="space-y-2 my-4">
            {checkResult.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg"
              >
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-warning dark:text-warning">{warning}</p>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>
            {hasBlocks ? 'Close' : 'Cancel'}
          </AlertDialogCancel>
          {!hasBlocks && (
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete {entityType}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
