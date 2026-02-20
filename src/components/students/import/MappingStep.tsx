import { Wand2, AlertCircle, AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
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
        <p>Uncertain mapping ({Math.round(confidence * 100)}%) - please double-check</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function MappingStep({
  rows, mappings, warnings, isLoading, requiredFieldsMapped, canProceedWithImport,
  willExceedLimit, remainingCapacity, counts, limits,
  teachers, selectedTeacher, setSelectedTeacher, importLessons, setImportLessons,
  updateMapping, getAvailableFields, onNext, onBack,
}: MappingStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Review Column Mappings
        </CardTitle>
        <CardDescription>
          LoopAssist has suggested mappings based on your data. Review low-confidence mappings (amber/red) carefully.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CSV Column</TableHead>
                <TableHead>Sample Data</TableHead>
                <TableHead>Map To</TableHead>
                <TableHead className="w-28">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping, idx) => (
                <TableRow key={mapping.csv_header} className={mapping.confidence < 0.7 && mapping.target_field ? "bg-warning/5" : ""}>
                  <TableCell className="font-medium">{mapping.csv_header}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {rows.slice(0, 2).map(r => r[idx]).filter(Boolean).join(", ") || "(empty)"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.target_field || "none"}
                      onValueChange={(value) => updateMapping(mapping.csv_header, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Skip column —</SelectItem>
                        {getAvailableFields(mapping.csv_header).map(field => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.name}
                            {field.required && <span className="text-destructive ml-1">*</span>}
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
                    {getConfidenceBadge(mapping.confidence, !!mapping.target_field)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
              <a href="/settings?tab=billing" className="ml-1 underline">Upgrade your plan</a> or reduce the number of rows in your CSV.
            </AlertDescription>
          </Alert>
        )}

        {mappings.some(m => ["lesson_day", "lesson_time", "instrument"].includes(m.target_field || "")) && (
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-lessons"
                checked={importLessons}
                onCheckedChange={(checked) => setImportLessons(!!checked)}
              />
              <Label htmlFor="import-lessons">Create recurring lessons for students</Label>
            </div>
            {importLessons && teachers.length > 0 && (
              <div className="ml-6 space-y-2">
                <Label>Assign lessons to teacher:</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="w-[250px]">
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

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} disabled={!canProceedWithImport || isLoading}>
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
