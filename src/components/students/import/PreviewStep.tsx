import { Check, AlertTriangle, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye } from "lucide-react";
import type { DryRunResult, RowStatus } from "@/hooks/useStudentsImport";

interface PreviewStepProps {
  dryRunResult: DryRunResult;
  previewTab: "all" | "issues" | "ready";
  setPreviewTab: (v: "all" | "issues" | "ready") => void;
  transformedRows: Record<string, string>[];
  filteredRowStatuses: RowStatus[];
  skipDuplicates: boolean;
  setSkipDuplicates: (v: boolean) => void;
  isLoading: boolean;
  onExecute: () => void;
  onBack: () => void;
}

function getStatusBadge(status: RowStatus) {
  switch (status.status) {
    case "ready":
      return (
        <Badge variant="default" className="bg-success/90 text-success-foreground">
          <CheckCircle2 className="h-3 w-3 mr-1" />Ready
        </Badge>
      );
    case "duplicate_csv":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />Dup #{status.duplicateOf}
            </Badge>
          </TooltipTrigger>
          <TooltipContent><p>Duplicate of row {status.duplicateOf} in your CSV</p></TooltipContent>
        </Tooltip>
      );
    case "duplicate_db":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />Exists
            </Badge>
          </TooltipTrigger>
          <TooltipContent><p>Student with this {status.matchType} already exists</p></TooltipContent>
        </Tooltip>
      );
    case "invalid":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />Invalid
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <ul className="list-disc list-inside">
              {status.errors?.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </TooltipContent>
        </Tooltip>
      );
  }
}

export function PreviewStep({
  dryRunResult, previewTab, setPreviewTab, transformedRows, filteredRowStatuses,
  skipDuplicates, setSkipDuplicates, isLoading, onExecute, onBack,
}: PreviewStepProps) {
  const issueCount = dryRunResult.rowStatuses.filter(s => s.status !== "ready").length;
  const hasDuplicates = dryRunResult.validation.duplicatesInCsv.length > 0 || dryRunResult.validation.duplicatesInDatabase.length > 0;
  const importCount = skipDuplicates
    ? dryRunResult.validation.valid
    : dryRunResult.validation.valid + dryRunResult.validation.duplicatesInCsv.length + dryRunResult.validation.duplicatesInDatabase.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Preview &amp; Validate
        </CardTitle>
        <CardDescription>
          Review validation results before importing. Duplicates and errors are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Validation summary — 4 stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border bg-success/5 border-success/20 p-3 sm:p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1.5 text-success" />
            <div className="text-section-title text-success">{dryRunResult.validation.valid}</div>
            <div className="text-caption text-success/80">Ready</div>
          </div>
          <div className="rounded-xl border bg-warning/5 border-warning/20 p-3 sm:p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1.5 text-warning" />
            <div className="text-section-title text-warning">{dryRunResult.validation.duplicatesInCsv.length}</div>
            <div className="text-caption text-warning/80">CSV Dupes</div>
          </div>
          <div className="rounded-xl border bg-warning/5 border-warning/20 p-3 sm:p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1.5 text-warning" />
            <div className="text-section-title text-warning">{dryRunResult.validation.duplicatesInDatabase.length}</div>
            <div className="text-caption text-warning/80">DB Exists</div>
          </div>
          <div className="rounded-xl border bg-destructive/5 border-destructive/20 p-3 sm:p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1.5 text-destructive" />
            <div className="text-section-title text-destructive">{dryRunResult.validation.errors.length}</div>
            <div className="text-caption text-destructive/80">Invalid</div>
          </div>
        </div>

        {/* Import preview counts */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <h4 className="text-body-strong mb-2">Import Preview</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4 text-sm">
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Students</span>
              <span className="font-medium sm:ml-1">{dryRunResult.preview.studentsToCreate}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Guardians</span>
              <span className="font-medium sm:ml-1">{dryRunResult.preview.guardiansToCreate}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Lessons</span>
              <span className="font-medium sm:ml-1">{dryRunResult.preview.lessonsToCreate}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Skipped</span>
              <span className="font-medium sm:ml-1">{dryRunResult.preview.studentsToSkip}</span>
            </div>
          </div>
        </div>

        {/* Duplicate handling */}
        {hasDuplicates && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skip-duplicates"
                checked={skipDuplicates}
                onCheckedChange={(checked) => setSkipDuplicates(!!checked)}
              />
              <Label htmlFor="skip-duplicates" className="cursor-pointer text-body-strong">
                Skip duplicate records (recommended)
              </Label>
            </div>
            <p className="text-caption text-muted-foreground ml-6">
              {skipDuplicates
                ? "Duplicate rows will be skipped. Only new students will be imported."
                : "Warning: Duplicate rows will be imported, creating new student records."}
            </p>
          </div>
        )}

        {/* Tabbed row list */}
        <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)}>
          <TabsList className="h-auto w-full grid grid-cols-3">
            <TabsTrigger value="all">All ({dryRunResult.rowStatuses.length})</TabsTrigger>
            <TabsTrigger value="issues" className={issueCount > 0 ? "data-[state=active]:text-warning" : ""}>
              Issues ({issueCount})
            </TabsTrigger>
            <TabsTrigger value="ready" className="data-[state=active]:text-success">
              Ready ({dryRunResult.validation.valid})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={previewTab} className="mt-4">
            {/* Desktop table */}
            <div className="hidden sm:block max-h-[400px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRowStatuses.slice(0, 50).map((status) => {
                    const row = transformedRows[status.row - 1];
                    return (
                      <TableRow
                        key={status.row}
                        className={`transition-colors ${
                          status.status === "invalid" ? "bg-destructive/5" :
                          status.status !== "ready" ? "bg-warning/5" : ""
                        }`}
                      >
                        <TableCell className="text-muted-foreground text-caption">{status.row}</TableCell>
                        <TableCell className="font-medium text-sm">{status.name}</TableCell>
                        <TableCell className="text-caption text-muted-foreground">{row?.email || "—"}</TableCell>
                        <TableCell className="text-caption text-muted-foreground">{row?.guardian_name || "—"}</TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden max-h-[400px] overflow-auto space-y-2">
              {filteredRowStatuses.slice(0, 50).map((status) => {
                const row = transformedRows[status.row - 1];
                return (
                  <div
                    key={status.row}
                    className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                      status.status === "invalid" ? "border-destructive/30 bg-destructive/5" :
                      status.status !== "ready" ? "border-warning/30 bg-warning/5" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-caption text-muted-foreground">#{status.row}</span>
                        <span className="text-body-strong truncate">{status.name}</span>
                      </div>
                      {(row?.email || row?.guardian_name) && (
                        <p className="text-caption text-muted-foreground truncate mt-0.5">
                          {[row?.email, row?.guardian_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">{getStatusBadge(status)}</div>
                  </div>
                );
              })}
            </div>

            {filteredRowStatuses.length > 50 && (
              <p className="text-caption text-muted-foreground text-center mt-3">
                Showing first 50 of {filteredRowStatuses.length} records
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Mapping
          </Button>
          <Button
            onClick={onExecute}
            disabled={isLoading || dryRunResult.validation.valid === 0}
            size="lg"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Import {importCount} Student{importCount !== 1 ? "s" : ""}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
