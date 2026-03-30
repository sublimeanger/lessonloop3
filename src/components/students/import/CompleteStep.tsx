import { useState, useMemo } from "react";
import { CheckCircle2, Download, Users, ArrowRight, BookOpen, Link2, RotateCcw, AlertTriangle, ShieldAlert, Database, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import type { ImportResult } from "@/hooks/useStudentsImport";

interface CompleteStepProps {
  importResult: ImportResult & { importBatchId?: string };
  downloadFailedRows: () => void;
  onImportMore: () => void;
  onViewStudents: () => void;
  onUndoImport?: (batchId: string) => void;
}

export function CompleteStep({ importResult, downloadFailedRows, onImportMore, onViewStudents, onUndoImport }: CompleteStepProps) {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const hasFailedRows = importResult.details.some(d => d.status === "error" || d.status === "skipped");
  const teachersCreated = (importResult as any).teachersCreated ?? 0;
  const locationsCreated = (importResult as any).locationsCreated ?? 0;
  const rateCardsCreated = (importResult as any).rateCardsCreated ?? 0;
  const hasExtras = teachersCreated > 0 || locationsCreated > 0 || rateCardsCreated > 0;

  // Batch invite state
  const [isBatchInviting, setIsBatchInviting] = useState(false);
  const [batchInviteResult, setBatchInviteResult] = useState<{ invited: number; skipped: number; failed: number } | null>(null);
  const [dismissedInviteCta, setDismissedInviteCta] = useState(false);

  const categorisedErrors = useMemo(() => {
    const categories = {
      data: [] as typeof importResult.details,
      schema: [] as typeof importResult.details,
      permission: [] as typeof importResult.details,
    };

    importResult.details
      .filter(d => d.status === "error")
      .forEach(d => {
        const error = d.error || "";
        if (/Missing|Invalid|format/i.test(error)) {
          categories.data.push(d);
        } else if (/permission|RLS|Unauthorized/i.test(error)) {
          categories.permission.push(d);
        } else {
          categories.schema.push(d);
        }
      });

    return categories;
  }, [importResult]);

  const skippedRows = useMemo(
    () => importResult.details.filter(d => d.status === "skipped"),
    [importResult]
  );

  const hasErrors = categorisedErrors.data.length > 0 || categorisedErrors.schema.length > 0 || categorisedErrors.permission.length > 0;

  const handleBatchInvite = async () => {
    if (!currentOrg) return;
    setIsBatchInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-invite-guardians', {
        body: {
          org_id: currentOrg.id,
          import_batch_id: importResult.importBatchId,
        },
      });
      if (error) throw error;
      setBatchInviteResult(data);
      toast({
        title: 'Invites sent',
        description: `${data.invited} portal invite${data.invited !== 1 ? 's' : ''} sent to guardians.`,
      });
    } catch (error: any) {
      toast({ title: 'Failed to send invites', description: error.message, variant: 'destructive' });
    } finally {
      setIsBatchInviting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-10 pb-8 sm:pt-12 sm:pb-10">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 animate-scale-in">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-page-title mb-1">Import Complete</h2>
          <p className="text-body text-muted-foreground">
            {importResult.studentsCreated} student{importResult.studentsCreated !== 1 ? "s" : ""} successfully imported
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6 max-w-xl mx-auto">
          <div className="rounded-xl border bg-card p-3 sm:p-4 text-center shadow-card">
            <Users className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <div className="text-section-title text-primary">{importResult.studentsCreated}</div>
            <div className="text-caption text-muted-foreground">Students</div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4 text-center shadow-card">
            <Users className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <div className="text-section-title text-primary">{importResult.guardiansCreated}</div>
            <div className="text-caption text-muted-foreground">Guardians</div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4 text-center shadow-card">
            <BookOpen className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <div className="text-section-title text-primary">{importResult.lessonsCreated}</div>
            <div className="text-caption text-muted-foreground">Lessons</div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4 text-center shadow-card">
            <Link2 className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <div className="text-section-title text-primary">{importResult.linksCreated}</div>
            <div className="text-caption text-muted-foreground">Links</div>
          </div>
        </div>

        {/* Extra created entities */}
        {hasExtras && (
          <p className="text-caption text-muted-foreground text-center mb-6">
            Also created:{" "}
            {[
              teachersCreated > 0 && `${teachersCreated} teacher${teachersCreated !== 1 ? "s" : ""}`,
              locationsCreated > 0 && `${locationsCreated} location${locationsCreated !== 1 ? "s" : ""}`,
              rateCardsCreated > 0 && `${rateCardsCreated} rate card${rateCardsCreated !== 1 ? "s" : ""}`,
            ].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Guardian invite CTA */}
        {importResult.guardiansCreated > 0 && !dismissedInviteCta && !batchInviteResult && (
          <Card className="border-primary/20 bg-primary/5 max-w-xl mx-auto mb-6">
            <CardContent className="py-5">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Invite guardians to the parent portal?</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {importResult.guardiansCreated} guardian{importResult.guardiansCreated !== 1 ? 's' : ''} were
                    created with email addresses. Send them portal invites so they can view
                    schedules, pay invoices, and track practice.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleBatchInvite} disabled={isBatchInviting}>
                      {isBatchInviting ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending invites...</>
                      ) : (
                        <><Mail className="h-4 w-4 mr-1.5" /> Send Portal Invites</>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDismissedInviteCta(true)}>
                      Not now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch invite result */}
        {batchInviteResult && (
          <div className="max-w-xl mx-auto mb-6">
            <p className="text-sm text-muted-foreground text-center">
              ✓ {batchInviteResult.invited} invite{batchInviteResult.invited !== 1 ? 's' : ''} sent
              {batchInviteResult.skipped > 0 && `, ${batchInviteResult.skipped} already invited`}
              {batchInviteResult.failed > 0 && `, ${batchInviteResult.failed} failed`}
            </p>
          </div>
        )}

        {/* Categorised errors */}
        {hasErrors && (
          <div className="max-w-xl mx-auto mb-6 space-y-4">
            {categorisedErrors.data.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Data Issues ({categorisedErrors.data.length})</AlertTitle>
                <AlertDescription>
                  <p className="text-xs text-muted-foreground mb-2">
                    These rows had invalid data. Download the failed rows, fix them, and re-import.
                  </p>
                  <ul className="list-disc list-inside text-sm max-h-[120px] overflow-y-auto">
                    {categorisedErrors.data.slice(0, 8).map((d, i) => (
                      <li key={i} className="truncate">
                        <span className="font-mono text-xs">#{d.row}</span> {d.student}: {d.error}
                      </li>
                    ))}
                    {categorisedErrors.data.length > 8 && (
                      <li className="text-muted-foreground">...and {categorisedErrors.data.length - 8} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {categorisedErrors.schema.length > 0 && (
              <Alert variant="destructive">
                <Database className="h-4 w-4" />
                <AlertTitle>System Issues ({categorisedErrors.schema.length})</AlertTitle>
                <AlertDescription>
                  <p className="text-xs text-muted-foreground mb-2">
                    These failed due to a system constraint. Please contact support if this persists.
                  </p>
                  <ul className="list-disc list-inside text-sm max-h-[120px] overflow-y-auto">
                    {categorisedErrors.schema.slice(0, 5).map((d, i) => (
                      <li key={i} className="truncate">
                        <span className="font-mono text-xs">#{d.row}</span> {d.student}: {d.error}
                      </li>
                    ))}
                    {categorisedErrors.schema.length > 5 && (
                      <li className="text-muted-foreground">...and {categorisedErrors.schema.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {categorisedErrors.permission.length > 0 && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Permission Issues ({categorisedErrors.permission.length})</AlertTitle>
                <AlertDescription>
                  <p className="text-xs text-muted-foreground mb-2">
                    These rows failed due to permission restrictions. Check your role or contact your admin.
                  </p>
                  <ul className="list-disc list-inside text-sm max-h-[120px] overflow-y-auto">
                    {categorisedErrors.permission.slice(0, 5).map((d, i) => (
                      <li key={i} className="truncate">
                        <span className="font-mono text-xs">#{d.row}</span> {d.student}: {d.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Download failed rows */}
        {hasFailedRows && (
          <div className="flex justify-center mb-6">
            <Button variant="outline" size="sm" onClick={downloadFailedRows}>
              <Download className="mr-2 h-4 w-4" />
              Download Failed/Skipped Rows
            </Button>
          </div>
        )}

        {/* Skipped rows summary */}
        {skippedRows.length > 0 && (
          <div className="max-w-xl mx-auto rounded-lg bg-muted/50 border p-4 mb-6">
            <h4 className="text-body-strong mb-2">
              Skipped Rows ({skippedRows.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {skippedRows.map(d => (
                <div key={d.row} className="text-xs text-muted-foreground flex gap-2">
                  <span className="font-mono w-8 shrink-0">#{d.row}</span>
                  <span className="font-medium text-foreground">{d.student}</span>
                  <span className="truncate">— {d.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {importResult.importBatchId && onUndoImport && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/30">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Undo Import
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Undo this import?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all {importResult.studentsCreated} students,
                    their guardian links, and any lessons created during this import.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Import</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => onUndoImport(importResult.importBatchId!)}
                  >
                    Yes, Undo Import
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={onImportMore}>Import More</Button>
          <Button onClick={onViewStudents}>
            View Students
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
