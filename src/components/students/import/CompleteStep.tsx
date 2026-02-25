import { Check, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ImportResult } from "@/hooks/useStudentsImport";

interface CompleteStepProps {
  importResult: ImportResult;
  downloadFailedRows: () => void;
  onImportMore: () => void;
  onViewStudents: () => void;
}

export function CompleteStep({ importResult, downloadFailedRows, onImportMore, onViewStudents }: CompleteStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Check className="h-5 w-5" />
          Import Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-section-title text-primary">{importResult.studentsCreated}</div>
              <div className="text-caption text-muted-foreground">Students</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-section-title text-primary">{importResult.guardiansCreated}</div>
              <div className="text-caption text-muted-foreground">Guardians</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-section-title text-primary">{importResult.lessonsCreated}</div>
              <div className="text-caption text-muted-foreground">Lessons</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-section-title text-primary">{importResult.linksCreated}</div>
              <div className="text-caption text-muted-foreground">Links</div>
            </CardContent>
          </Card>
        </div>

        {((importResult as any).teachersCreated > 0 || (importResult as any).locationsCreated > 0 || (importResult as any).rateCardsCreated > 0) && (
          <p className="text-sm text-muted-foreground text-center">
            Also created:{" "}
            {[
              (importResult as any).teachersCreated > 0 && `${(importResult as any).teachersCreated} teacher${(importResult as any).teachersCreated !== 1 ? "s" : ""}`,
              (importResult as any).locationsCreated > 0 && `${(importResult as any).locationsCreated} location${(importResult as any).locationsCreated !== 1 ? "s" : ""}`,
              (importResult as any).rateCardsCreated > 0 && `${(importResult as any).rateCardsCreated} rate card${(importResult as any).rateCardsCreated !== 1 ? "s" : ""}`,
            ].filter(Boolean).join(", ")}
          </p>
        )}

        {importResult.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{importResult.errors.length} Errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm mt-2 max-h-[150px] overflow-y-auto">
                {importResult.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                {importResult.errors.length > 10 && (
                  <li className="text-muted-foreground">...and {importResult.errors.length - 10} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {importResult.details.some(d => d.status === "error" || d.status === "skipped") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadFailedRows}>
              <Download className="mr-2 h-4 w-4" />
              Download Failed/Skipped Rows
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onImportMore}>Import More</Button>
          <Button onClick={onViewStudents}>View Students</Button>
        </div>
      </CardContent>
    </Card>
  );
}
