import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, Loader2, Wand2, ChevronDown, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { useUsageCounts } from "@/hooks/useUsageCounts";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TargetField {
  name: string;
  required: boolean;
  description: string;
}

interface ColumnMapping {
  csv_header: string;
  target_field: string | null;
  confidence: number;
}

interface ImportResult {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
  lessonsCreated: number;
  errors: string[];
  details: { row: number; student: string; status: string; error?: string }[];
}

type Step = "upload" | "mapping" | "preview" | "importing" | "complete";

export default function StudentsImport() {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const { counts, limits, canAddStudent } = useUsageCounts();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [targetFields, setTargetFields] = useState<TargetField[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [importLessons, setImportLessons] = useState(false);

  // Parse CSV content
  const parseCSV = useCallback((content: string): { headers: string[]; rows: string[][] } => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    
    return { headers, rows };
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    if (!uploadedFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setFile(uploadedFile);
    setIsLoading(true);

    try {
      const content = await uploadedFile.text();
      const { headers: csvHeaders, rows: csvRows } = parseCSV(content);
      
      if (csvHeaders.length === 0 || csvRows.length === 0) {
        throw new Error("CSV file is empty or invalid");
      }

      setHeaders(csvHeaders);
      setRows(csvRows);

      // Fetch teachers for lesson assignment
      if (currentOrg) {
        const { data: teacherData } = await supabase
          .from("org_memberships")
          .select("user_id, profiles:user_id(full_name)")
          .eq("org_id", currentOrg.id)
          .eq("status", "active")
          .in("role", ["owner", "admin", "teacher"]);

        if (teacherData) {
          const teacherList = teacherData
            .filter((t: any) => t.profiles?.full_name)
            .map((t: any) => ({ id: t.user_id, name: t.profiles.full_name }));
          setTeachers(teacherList);
          if (teacherList.length > 0) setSelectedTeacher(teacherList[0].id);
        }
      }

      // Get AI mapping suggestions
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-mapping`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            headers: csvHeaders,
            sampleRows: csvRows.slice(0, 5),
            orgId: currentOrg?.id,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to get column mappings");
      }

      const mappingData = await response.json();
      setMappings(mappingData.mappings);
      setTargetFields(mappingData.target_fields || []);
      setWarnings(mappingData.warnings || []);
      setImportLessons(mappingData.has_lesson_data || false);
      setStep("mapping");

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, parseCSV, toast]);

  // Update mapping for a column
  const updateMapping = useCallback((csvHeader: string, targetField: string | null) => {
    setMappings(prev => prev.map(m =>
      m.csv_header === csvHeader
        ? { ...m, target_field: targetField === "none" ? null : targetField, confidence: 1 }
        : m
    ));
  }, []);

  // Get available target fields (not already mapped)
  const getAvailableFields = useCallback((currentHeader: string) => {
    const usedFields = mappings
      .filter(m => m.csv_header !== currentHeader && m.target_field)
      .map(m => m.target_field);
    return targetFields.filter(f => !usedFields.includes(f.name));
  }, [mappings, targetFields]);

  // Transform rows based on mappings
  const transformedRows = useMemo(() => {
    return rows.map(row => {
      const obj: Record<string, string> = {};
      mappings.forEach((mapping, idx) => {
        if (mapping.target_field && row[idx]) {
          obj[mapping.target_field] = row[idx];
        }
      });
      return obj;
    });
  }, [rows, mappings]);

  // Check if required fields are mapped
  const requiredFieldsMapped = useMemo(() => {
    const required = targetFields.filter(f => f.required).map(f => f.name);
    const mapped = mappings.filter(m => m.target_field).map(m => m.target_field);
    return required.every(r => mapped.includes(r));
  }, [mappings, targetFields]);

  // Check student limit capacity
  const remainingCapacity = limits.maxStudents - counts.students;
  const willExceedLimit = rows.length > remainingCapacity;
  const canProceedWithImport = requiredFieldsMapped && !willExceedLimit;

  // Execute import
  const executeImport = useCallback(async () => {
    if (!currentOrg) return;

    setStep("importing");
    setIsLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            rows: transformedRows,
            mappings: Object.fromEntries(
              mappings.filter(m => m.target_field).map(m => [m.csv_header, m.target_field])
            ),
            orgId: currentOrg.id,
            teacherUserId: importLessons ? selectedTeacher : undefined,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await response.json();
      setImportResult(result);
      setStep("complete");

      toast({
        title: "Import complete",
        description: `Created ${result.studentsCreated} students, ${result.guardiansCreated} guardians, ${result.lessonsCreated} lessons`,
      });

    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, transformedRows, mappings, selectedTeacher, importLessons, toast]);

  return (
    <AppLayout>
      <PageHeader
        title="Import Students"
        description="Upload a CSV file to bulk import students, guardians, and lesson schedules"
        breadcrumbs={[
          { label: "Students", href: "/students" },
          { label: "Import" },
        ]}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-sm">
          {["upload", "mapping", "preview", "complete"].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? "bg-primary text-primary-foreground" :
                (step === "importing" && s === "preview") ? "bg-primary text-primary-foreground" :
                ["upload", "mapping", "preview", "complete"].indexOf(step) > idx ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {["upload", "mapping", "preview"].indexOf(step) > idx || step === "complete" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < 3 && (
                <div className={`w-12 h-0.5 mx-1 ${
                  ["upload", "mapping", "preview", "complete"].indexOf(step) > idx ? "bg-primary" : "bg-muted"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV File
              </CardTitle>
              <CardDescription>
                Upload a CSV file with student data. LoopAssist will help map columns to the correct fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={isLoading}
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  {isLoading ? (
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  )}
                  <p className="text-lg font-medium mb-1">
                    {isLoading ? "Processing..." : "Drop your CSV file here or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports: students, guardians, student-guardian links, and recurring lessons
                  </p>
                </label>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  AI-Powered Column Mapping
                </h4>
                <p className="text-sm text-muted-foreground">
                  LoopAssist will automatically detect and map your CSV columns to the correct fields.
                  You can review and adjust mappings before importing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Review Column Mappings
              </CardTitle>
              <CardDescription>
                LoopAssist has suggested mappings based on your data. Adjust as needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Suggestions</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
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
                      <TableHead className="w-24">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping, idx) => (
                      <TableRow key={mapping.csv_header}>
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
                          {mapping.target_field && (
                            <Badge variant={mapping.confidence > 0.7 ? "default" : "secondary"}>
                              {Math.round(mapping.confidence * 100)}%
                            </Badge>
                          )}
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
                  <AlertDescription>
                    Please map columns for: first_name, last_name
                  </AlertDescription>
                </Alert>
              )}

              {/* Capacity warning */}
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

              {/* Lesson import options */}
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
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep("preview")}
                  disabled={!canProceedWithImport}
                >
                  Continue to Preview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Preview Import
              </CardTitle>
              <CardDescription>
                Review the data to be imported. {rows.length} records will be processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{rows.length}</div>
                    <div className="text-sm text-muted-foreground">Students</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {transformedRows.filter(r => r.guardian_name).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Guardians</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {importLessons ? transformedRows.filter(r => r.lesson_day && r.lesson_time).length : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Lessons</div>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Guardian</TableHead>
                      {importLessons && <TableHead>Lesson</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transformedRows.slice(0, 20).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {row.first_name} {row.last_name}
                        </TableCell>
                        <TableCell>{row.email || "—"}</TableCell>
                        <TableCell>{row.guardian_name || "—"}</TableCell>
                        {importLessons && (
                          <TableCell>
                            {row.lesson_day && row.lesson_time
                              ? `${row.lesson_day} ${row.lesson_time}`
                              : "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {rows.length > 20 && (
                <p className="text-sm text-muted-foreground text-center">
                  Showing first 20 of {rows.length} records
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Back to Mapping
                </Button>
                <Button onClick={executeImport} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Confirm Import
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
              <h3 className="text-lg font-medium mb-2">Importing data...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we process {rows.length} records
              </p>
              <Progress className="mt-6 max-w-md mx-auto" value={undefined} />
            </CardContent>
          </Card>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && importResult && (
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
                    <div className="text-2xl font-bold text-primary">
                      {importResult.studentsCreated}
                    </div>
                    <div className="text-sm text-muted-foreground">Students Created</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {importResult.guardiansCreated}
                    </div>
                    <div className="text-sm text-muted-foreground">Guardians Created</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {importResult.linksCreated}
                    </div>
                    <div className="text-sm text-muted-foreground">Links Created</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {importResult.lessonsCreated}
                    </div>
                    <div className="text-sm text-muted-foreground">Lessons Created</div>
                  </CardContent>
                </Card>
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{importResult.errors.length} Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-2 max-h-[150px] overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setHeaders([]);
                  setRows([]);
                  setMappings([]);
                  setImportResult(null);
                }}>
                  Import More
                </Button>
                <Button onClick={() => navigate("/students")}>
                  View Students
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
