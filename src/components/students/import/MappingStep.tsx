import { Wand2, AlertCircle, AlertTriangle, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Scissors, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ColumnMapping, TargetField } from "@/hooks/useStudentsImport";

interface MappingStepProps {
  headers: string[];
  rows: string[][];
  mappings: ColumnMapping[];
  targetFields: TargetField[];
  warnings: string[];
  isLoading: boolean;
  requiredFieldsMapped: boolean;
  canProceedWithImport: boolean;
  willExceedLimit: boolean;
  remainingCapacity: number;
  counts: { students: number };
  limits: { maxStudents: number };
  teachers: { id: string; name: string }[];
  selectedTeacher: string;
  setSelectedTeacher: (v: string) => void;
  importLessons: boolean;
  setImportLessons: (v: boolean) => void;
  updateMapping: (csvHeader: string, targetField: string | null) => void;
  getAvailableFields: (currentHeader: string) => TargetField[];
  detectedSource?: string | null;
  onNext: () => void;
  onBack: () => void;
}

function getConfidenceBadge(confidence: number, hasTarget: boolean) {
  if (!hasTarget) return null;

  if (confidence >= 0.7) {
    return (
      <Badge variant="default" className="bg-success/90 hover:bg-success text-success-foreground">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30 hover:bg-warning/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {Math.round(confidence * 100)}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>Uncertain mapping ({Math.round(confidence * 100)}%) — please double-check</p>
      </TooltipContent>
    </Tooltip>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  mymusicstaff: "My Music Staff",
  opus1: "Opus 1",
  teachworks: "Teachworks",
  duetpartner: "Duet Partner",
  fons: "Fons",
  jackrabbit: "Jackrabbit Music",
};

export function MappingStep({
  rows, mappings, warnings, isLoading, requiredFieldsMapped, canProceedWithImport,
  willExceedLimit, remainingCapacity, counts, limits,
  teachers, selectedTeacher, setSelectedTeacher, importLessons, setImportLessons,
  updateMapping, getAvailableFields, detectedSource, onNext, onBack,
}: MappingStepProps) {
  const hasGuardian2 = mappings.some(m => m.target_field?.startsWith("guardian2"));
  const mappedCount = mappings.filter(m => m.target_field).length;
  const totalCount = mappings.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Review Column Mappings
            </CardTitle>
            <CardDescription className="mt-1">
              LoopAssist has suggested mappings based on your data. Review low-confidence mappings carefully.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="self-start sm:self-center shrink-0">
            {mappedCount}/{totalCount} mapped
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Alerts section */}
        <div className="space-y-3">
          {detectedSource && SOURCE_LABELS[detectedSource] && (
            <div className="flex items-start gap-3 rounded-lg border bg-primary/5 border-primary/20 p-3 sm:p-4">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-body-strong text-primary">Detected: {SOURCE_LABELS[detectedSource]} format</p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  Columns auto-mapped from known {SOURCE_LABELS[detectedSource]} export. Please verify below.
                </p>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Suggestions</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {hasGuardian2 && (
            <div className="flex items-start gap-3 rounded-lg border bg-info/5 border-info/20 p-3 sm:p-4">
              <Users className="h-4 w-4 text-info mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-body-strong">Two guardians detected</p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  Both parents/guardians will be created and linked automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">CSV Column</TableHead>
                <TableHead className="w-[200px]">Sample Data</TableHead>
                <TableHead>Map To</TableHead>
                <TableHead className="w-36">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping, idx) => (
                <TableRow
                  key={mapping.csv_header}
                  className={`transition-colors ${
                    !mapping.target_field ? "opacity-60" :
                    mapping.confidence < 0.7 ? "bg-warning/5" : ""
                  }`}
                >
                  <TableCell className="font-medium text-sm">{mapping.csv_header}</TableCell>
                  <TableCell className="text-caption text-muted-foreground max-w-[200px] truncate">
                    {rows.slice(0, 2).map(r => r[idx]).filter(Boolean).join(", ") || "(empty)"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.target_field || "none"}
                      onValueChange={(value) => updateMapping(mapping.csv_header, value)}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Skip column —</SelectItem>
                        {getAvailableFields(mapping.csv_header).map(field => (
                          <SelectItem key={field.name} value={field.name}>
                            <div className="flex flex-col">
                              <span>
                                {field.name}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </span>
                              <span className="text-xs text-muted-foreground">{field.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {mapping.target_field && (
                          <SelectItem value={mapping.target_field}>
                            {mapping.target_field}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getConfidenceBadge(mapping.confidence, !!mapping.target_field)}
                      {mapping.transform === "split_name" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              <Scissors className="h-3 w-3 mr-1" />Split
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent><p>Full name will be split into first + last name</p></TooltipContent>
                        </Tooltip>
                      )}
                      {mapping.transform?.startsWith("combine_guardian") && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />Merge
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent><p>First + last name will be merged into guardian name</p></TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-3">
          {mappings.map((mapping, idx) => (
            <div
              key={mapping.csv_header}
              className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
                !mapping.target_field ? "opacity-60" :
                mapping.confidence < 0.7 && mapping.target_field ? "border-warning/40 bg-warning/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body-strong truncate">{mapping.csv_header}</p>
                  <p className="text-caption text-muted-foreground truncate">
                    {rows.slice(0, 2).map(r => r[idx]).filter(Boolean).join(", ") || "(empty)"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {getConfidenceBadge(mapping.confidence, !!mapping.target_field)}
                  {mapping.transform === "split_name" && (
                    <Badge variant="outline" className="text-xs"><Scissors className="h-3 w-3" /></Badge>
                  )}
                  {mapping.transform?.startsWith("combine_guardian") && (
                    <Badge variant="outline" className="text-xs"><Users className="h-3 w-3" /></Badge>
                  )}
                </div>
              </div>
              <Select
                value={mapping.target_field || "none"}
                onValueChange={(value) => updateMapping(mapping.csv_header, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Skip column —</SelectItem>
                  {getAvailableFields(mapping.csv_header).map(field => (
                    <SelectItem key={field.name} value={field.name}>
                      <div className="flex flex-col">
                        <span>
                          {field.name}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{field.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {mapping.target_field && (
                    <SelectItem value={mapping.target_field}>{mapping.target_field}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Validation alerts */}
        {!requiredFieldsMapped && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required fields missing</AlertTitle>
            <AlertDescription>Please map columns for: first_name, last_name</AlertDescription>
          </Alert>
        )}

        {willExceedLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Student limit exceeded</AlertTitle>
            <AlertDescription>
              Your CSV has {rows.length} rows, but you can only add {remainingCapacity} more student{remainingCapacity !== 1 ? 's' : ''} on your current plan
              ({counts.students} / {limits.maxStudents} used).
              <a href="/settings?tab=billing" className="ml-1 underline font-medium">Upgrade your plan</a>
            </AlertDescription>
          </Alert>
        )}

        {/* Lesson creation toggle */}
        {mappings.some(m => ["lesson_day", "lesson_time", "instrument"].includes(m.target_field || "")) && (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-lessons"
                checked={importLessons}
                onCheckedChange={(checked) => setImportLessons(!!checked)}
              />
              <Label htmlFor="import-lessons" className="text-body-strong cursor-pointer">
                Create recurring lessons for students
              </Label>
            </div>
            {importLessons && teachers.length > 0 && (
              <div className="ml-6 space-y-2">
                <Label className="text-caption text-muted-foreground">Assign lessons to teacher:</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button onClick={onNext} disabled={!canProceedWithImport || isLoading} size="lg">
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</>
            ) : (
              <>Continue to Preview<ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
