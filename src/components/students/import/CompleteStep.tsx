import { CheckCircle2, AlertCircle, Download, Users, ArrowRight, BookOpen, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ImportResult } from "@/hooks/useStudentsImport";

interface CompleteStepProps {
  importResult: ImportResult;
  downloadFailedRows: () => void;
  onImportMore: () => void;
  onViewStudents: () => void;
}

export function CompleteStep({ importResult, downloadFailedRows, onImportMore, onViewStudents }: CompleteStepProps) {
  const hasErrors = importResult.errors.length > 0;
  const hasFailedRows = importResult.details.some(d => d.status === "error" || d.status === "skipped");
  const teachersCreated = (importResult as any).teachersCreated ?? 0;
  const locationsCreated = (importResult as any).locationsCreated ?? 0;
  const rateCardsCreated = (importResult as any).rateCardsCreated ?? 0;
  const hasExtras = teachersCreated > 0 || locationsCreated > 0 || rateCardsCreated > 0;

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

        {/* Errors */}
        {hasErrors && (
          <div className="max-w-xl mx-auto mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{importResult.errors.length} Error{importResult.errors.length !== 1 ? "s" : ""}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm mt-2 max-h-[150px] overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                  {importResult.errors.length > 10 && (
                    <li className="text-muted-foreground">...and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
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

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
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
