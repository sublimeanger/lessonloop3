import { Check, AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
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
              <AlertTriangle className="h-3 w-3 mr-1" />Dup of #{status.duplicateOf}
            </Badge>
          </TooltipTrigger>
          <TooltipContent><p>This row is a duplicate of row {status.duplicateOf} in your CSV</p></TooltipContent>
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
          <TooltipContent><p>A student with this {status.matchType} already exists in your database</p></TooltipContent>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Validation Results
        </CardTitle>
        <CardDescription>
          Review the validation results before importing. Duplicates and errors are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-success/10 border-success/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <div className="text-section-title text-success">{dryRunResult.validation.valid}</div>
                  <div className="text-caption text-success">Ready to import</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <div className="text-section-title text-warning">{dryRunResult.validation.duplicatesInCsv.length}</div>
                  <div className="text-caption text-warning">Duplicates in CSV</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <div className="text-section-title text-warning">{dryRunResult.validation.duplicatesInDatabase.length}</div>
                  <div className="text-caption text-warning">Already in database</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-section-title text-destructive">{dryRunResult.validation.errors.length}</div>
                  <div className="text-caption text-destructive">Invalid rows</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import preview counts */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Import Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Students:</span> <span className="font-medium">{dryRunResult.preview.studentsToCreate}</span></div>
            <div><span className="text-muted-foreground">Guardians:</span> <span className="font-medium">{dryRunResult.preview.guardiansToCreate}</span></div>
            <div><span className="text-muted-foreground">Lessons:</span> <span className="font-medium">{dryRunResult.preview.lessonsToCreate}</span></div>
            <div><span className="text-muted-foreground">Skipped:</span> <span className="font-medium">{dryRunResult.preview.studentsToSkip}</span></div>
          </div>
        </div>

        {/* Duplicate handling */}
        {(dryRunResult.validation.duplicatesInCsv.length > 0 || dryRunResult.validation.duplicatesInDatabase.length > 0) && (
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="skip-duplicates" checked={skipDuplicates} onCheckedChange={(checked) => setSkipDuplicates(!!checked)} />
              <Label htmlFor="skip-duplicates">Skip duplicate records (recommended)</Label>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {skipDuplicates
                ? "Duplicate rows will be skipped. Only new students will be imported."
                : "Warning: Duplicate rows will be imported, creating new student records."}
            </p>
          </div>
        )}

        {/* Tabbed row list */}
        <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)}>
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="all">All Records ({dryRunResult.rowStatuses.length})</TabsTrigger>
            <TabsTrigger value="issues" className="text-warning">
              Issues ({dryRunResult.rowStatuses.filter(s => s.status !== "ready").length})
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-success">
              Ready ({dryRunResult.validation.valid})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={previewTab} className="mt-4">
            <div className="max-h-[400px] overflow-auto rounded-lg border">
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
                        className={
                          status.status === "invalid" ? "bg-destructive/5" :
                          status.status !== "ready" ? "bg-warning/5" : ""
                        }
                      >
                        <TableCell className="text-muted-foreground">{status.row}</TableCell>
                        <TableCell className="font-medium">{status.name}</TableCell>
                        <TableCell>{row?.email || "—"}</TableCell>
                        <TableCell>{row?.guardian_name || "—"}</TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {filteredRowStatuses.length > 50 && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Showing first 50 of {filteredRowStatuses.length} records
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack}>Back to Mapping</Button>
          <Button onClick={onExecute} disabled={isLoading || dryRunResult.validation.valid === 0}>
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Import {skipDuplicates ? dryRunResult.validation.valid : (dryRunResult.validation.valid + dryRunResult.validation.duplicatesInCsv.length + dryRunResult.validation.duplicatesInDatabase.length)} Students
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
