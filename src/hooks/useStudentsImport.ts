import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { useUsageCounts } from "@/hooks/useUsageCounts";
import { parseCSV as sharedParseCSV, readFileAsText } from "@/lib/csv-parser";

export interface TargetField {
  name: string;
  required: boolean;
  description: string;
}

export interface ColumnMapping {
  csv_header: string;
  target_field: string | null;
  confidence: number;
  transform?: string | null;
  combine_with?: string | null;
}

export interface RowStatus {
  row: number;
  name: string;
  status: "ready" | "duplicate_csv" | "duplicate_db" | "invalid";
  duplicateOf?: number;
  existingStudentId?: string;
  matchType?: string;
  errors?: string[];
}

export interface ValidationResult {
  valid: number;
  duplicatesInCsv: { row: number; duplicateOf: number; name: string }[];
  duplicatesInDatabase: { row: number; existingStudentId: string; name: string; matchType: string }[];
  errors: { row: number; errors: string[] }[];
}

export interface DryRunResult {
  dryRun: true;
  validation: ValidationResult;
  preview: {
    studentsToCreate: number;
    studentsToSkip: number;
    guardiansToCreate: number;
    lessonsToCreate: number;
  };
  rowStatuses: RowStatus[];
}

export interface ImportResult {
  studentsCreated: number;
  guardiansCreated: number;
  linksCreated: number;
  lessonsCreated: number;
  errors: string[];
  details: { row: number; student: string; status: string; error?: string }[];
}

export type Step = "upload" | "mapping" | "preview" | "importing" | "complete";

export function useStudentsImport() {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const { counts, limits } = useUsageCounts();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [targetFields, setTargetFields] = useState<TargetField[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; userId: string | null; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [importLessons, setImportLessons] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [previewTab, setPreviewTab] = useState<"all" | "issues" | "ready">("all");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [sourceSoftware, setSourceSoftware] = useState<string>("auto");
  const [detectedSource, setDetectedSource] = useState<string | null>(null);

  // Use shared RFC 4180 parser — imported at top of file

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    setFile(uploadedFile);
    setIsLoading(true);

    try {
      const content = await readFileAsText(uploadedFile);
      const { headers: csvHeaders, rows: csvRows } = sharedParseCSV(content);

      if (csvHeaders.length === 0 || csvRows.length === 0) {
        throw new Error("CSV file is empty or invalid");
      }

      if (csvRows.length > 5000) {
        throw new Error(`Your CSV has ${csvRows.length.toLocaleString()} rows. Maximum is 5,000 per import. Please split your file.`);
      }

      setHeaders(csvHeaders);
      setRows(csvRows);

      if (currentOrg) {
        // Fetch teachers table (supports unlinked teachers without auth accounts)
        const { data: teacherData } = await supabase
          .from("teachers")
          .select("id, display_name, user_id")
          .eq("org_id", currentOrg.id)
          .eq("status", "active");

        if (teacherData) {
          const teacherList = teacherData
            .filter((t) => t.display_name)
            .map((t) => ({ id: t.id, userId: t.user_id, name: t.display_name! }));
          setTeachers(teacherList);
          if (teacherList.length > 0) setSelectedTeacher(teacherList[0].id);
        }
      }

      const { data: mappingData, error: mappingError } = await supabase.functions.invoke(
        "csv-import-mapping",
        {
          body: {
            headers: csvHeaders,
            sampleRows: csvRows.slice(0, 5),
            orgId: currentOrg?.id,
            sourceSoftware: sourceSoftware !== "auto" ? sourceSoftware : undefined,
          },
        }
      );

      if (mappingError) throw mappingError;
      if (mappingData?.error) throw new Error(mappingData.error);
      setMappings(mappingData.mappings);
      setTargetFields(mappingData.target_fields || []);
      setWarnings(mappingData.warnings || []);
      setImportLessons(mappingData.has_lesson_data || false);
      setDetectedSource(mappingData.detected_source || null);
      setStep("mapping");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, toast, sourceSoftware]);

  const updateMapping = useCallback((csvHeader: string, targetField: string | null) => {
    setMappings(prev => prev.map(m =>
      m.csv_header === csvHeader
        ? { ...m, target_field: targetField === "none" ? null : targetField, confidence: 1 }
        : m
    ));
  }, []);

  const getAvailableFields = useCallback((currentHeader: string) => {
    const usedFields = mappings
      .filter(m => m.csv_header !== currentHeader && m.target_field)
      .map(m => m.target_field);
    return targetFields.filter(f => !usedFields.includes(f.name));
  }, [mappings, targetFields]);

  const transformedRows = useMemo(() => {
    return rows.map(row => {
      const obj: Record<string, string> = {};
      mappings.forEach((mapping) => {
        const colIdx = headers.indexOf(mapping.csv_header);
        if (mapping.target_field && colIdx >= 0 && row[colIdx]) {
          if (mapping.transform === "split_name") {
            const parts = row[colIdx].trim().split(/\s+/);
            obj["first_name"] = parts[0] || "";
            obj["last_name"] = parts.slice(1).join(" ") || "";
          } else if (mapping.transform === "combine_guardian_name" && mapping.combine_with) {
            const lastIdx = headers.indexOf(mapping.combine_with);
            const lastName = lastIdx >= 0 ? (row[lastIdx] || "") : "";
            obj["guardian_name"] = `${row[colIdx]} ${lastName}`.trim();
          } else if (mapping.transform === "combine_guardian2_name" && mapping.combine_with) {
            const lastIdx = headers.indexOf(mapping.combine_with);
            const lastName = lastIdx >= 0 ? (row[lastIdx] || "") : "";
            obj["guardian2_name"] = `${row[colIdx]} ${lastName}`.trim();
          } else {
            obj[mapping.target_field] = row[colIdx];
          }
        }
      });
      return obj;
    });
  }, [rows, mappings, headers]);

  const requiredFieldsMapped = useMemo(() => {
    const required = targetFields.filter(f => f.required).map(f => f.name);
    const mapped = mappings.filter(m => m.target_field).map(m => m.target_field);
    return required.every(r => mapped.includes(r));
  }, [mappings, targetFields]);

  // Capacity check uses dry-run actual count when available, otherwise raw row count as estimate
  const validCountAfterDryRun = dryRunResult?.preview.studentsToCreate ?? null;
  const estimatedNewStudents = validCountAfterDryRun ?? rows.length;
  const remainingCapacity = limits.maxStudents - counts.students;
  const willExceedLimit = estimatedNewStudents > remainingCapacity;
  const canProceedWithImport = requiredFieldsMapped && !willExceedLimit;

  const executeDryRun = useCallback(async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    setDryRunResult(null);

    try {
      const { data: dryRunData, error: dryRunError } = await supabase.functions.invoke(
        "csv-import-execute",
        {
          body: {
            rows: transformedRows,
            mappings: Object.fromEntries(
              mappings.filter(m => m.target_field).map(m => [m.csv_header, m.target_field])
            ),
            orgId: currentOrg.id,
            teacherId: importLessons ? selectedTeacher : undefined,
            dryRun: true,
          },
        }
      );

      if (dryRunError) throw dryRunError;
      if (dryRunData?.error) throw new Error(dryRunData.error);

      const result = dryRunData as DryRunResult;
      setDryRunResult(result);
      setStep("preview");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Validation failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, transformedRows, mappings, selectedTeacher, importLessons, toast]);

  const executeImport = useCallback(async () => {
    if (!currentOrg || !dryRunResult) return;
    setStep("importing");
    setIsLoading(true);

    try {
      const rowsToImport = dryRunResult.rowStatuses
        .filter(s => s.status === "ready" || (!skipDuplicates && (s.status === "duplicate_csv" || s.status === "duplicate_db")))
        .map(s => s.row - 1);

      const { data: importData, error: importError } = await supabase.functions.invoke(
        "csv-import-execute",
        {
          body: {
            rows: transformedRows,
            mappings: Object.fromEntries(
              mappings.filter(m => m.target_field).map(m => [m.csv_header, m.target_field])
            ),
            orgId: currentOrg.id,
            teacherId: importLessons ? selectedTeacher : undefined,
            dryRun: false,
            skipDuplicates,
            rowsToImport,
          },
        }
      );

      if (importError) throw importError;
      if (importData?.error) throw new Error(importData.error);

      const result = importData;
      setImportResult(result);
      setStep("complete");

      toast({
        title: "Import complete",
        description: `Created ${result.studentsCreated} students, ${result.guardiansCreated} guardians, ${result.lessonsCreated} lessons`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Import failed", description: message, variant: "destructive" });
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, transformedRows, mappings, selectedTeacher, importLessons, skipDuplicates, dryRunResult, toast]);

  const downloadFailedRows = useCallback(() => {
    if (!importResult) return;
    const failedDetails = importResult.details.filter(d => d.status === "error" || d.status === "skipped");
    if (failedDetails.length === 0) return;

    const csvHeaders = [...headers, "Import Error"];
    const csvRows = failedDetails.map(detail => {
      const originalRow = rows[detail.row - 1] || [];
      return [...originalRow, detail.error || "Unknown error"];
    });

    const csvContent = [
      csvHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
      ...csvRows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `failed-imports-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [importResult, headers, rows]);

  const filteredRowStatuses = useMemo(() => {
    if (!dryRunResult) return [];
    switch (previewTab) {
      case "issues":
        return dryRunResult.rowStatuses.filter(s => s.status !== "ready");
      case "ready":
        return dryRunResult.rowStatuses.filter(s => s.status === "ready");
      default:
        return dryRunResult.rowStatuses;
    }
  }, [dryRunResult, previewTab]);

  const resetImport = useCallback(() => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setImportResult(null);
    setDryRunResult(null);
    setSourceSoftware("auto");
    setDetectedSource(null);
  }, []);

  return {
    // Navigation
    navigate,

    // Step
    step, setStep,

    // File & data
    file,
    headers,
    rows,
    mappings,
    targetFields,
    warnings,
    isLoading,
    importResult,
    teachers,
    selectedTeacher, setSelectedTeacher,
    importLessons, setImportLessons,
    dryRunResult,
    previewTab, setPreviewTab,
    skipDuplicates, setSkipDuplicates,
    sourceSoftware, setSourceSoftware,
    detectedSource,

    // Handlers
    handleFileUpload,
    updateMapping,
    getAvailableFields,
    executeDryRun,
    executeImport,
    downloadFailedRows,
    resetImport,

    // Derived
    transformedRows,
    requiredFieldsMapped,
    remainingCapacity,
    willExceedLimit,
    canProceedWithImport,
    filteredRowStatuses,

    // Usage
    counts,
    limits,
  };
}
