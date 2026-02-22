import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { useUsageCounts } from "@/hooks/useUsageCounts";

export interface TargetField {
  name: string;
  required: boolean;
  description: string;
}

export interface ColumnMapping {
  csv_header: string;
  target_field: string | null;
  confidence: number;
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

  const readFileAsText = useCallback(async (f: File): Promise<string> => {
    // Try UTF-8 first; if replacement chars appear, fall back to Windows-1252
    const utf8 = await f.text();
    if (!utf8.includes('\uFFFD')) return utf8;
    const buffer = await f.arrayBuffer();
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(buffer);
  }, []);

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

    const csvHeaders = parseRow(lines[0]);
    const csvRows = lines.slice(1).map(parseRow);
    return { headers: csvHeaders, rows: csvRows };
  }, []);

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
      const { headers: csvHeaders, rows: csvRows } = parseCSV(content);

      if (csvHeaders.length === 0 || csvRows.length === 0) {
        throw new Error("CSV file is empty or invalid");
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Please log in again to import students");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-mapping`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, parseCSV, readFileAsText, toast]);

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
      mappings.forEach((mapping, idx) => {
        if (mapping.target_field && row[idx]) {
          obj[mapping.target_field] = row[idx];
        }
      });
      return obj;
    });
  }, [rows, mappings]);

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
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Please log in again to import students");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            rows: transformedRows,
            mappings: Object.fromEntries(
              mappings.filter(m => m.target_field).map(m => [m.csv_header, m.target_field])
            ),
            orgId: currentOrg.id,
            teacherId: importLessons ? selectedTeacher : undefined,
            dryRun: true,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Validation failed");
      }

      const result = await response.json() as DryRunResult;
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error("Please log in again to import students");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            rows: transformedRows,
            mappings: Object.fromEntries(
              mappings.filter(m => m.target_field).map(m => [m.csv_header, m.target_field])
            ),
            orgId: currentOrg.id,
            teacherId: importLessons ? selectedTeacher : undefined,
            dryRun: false,
            skipDuplicates,
            rowsToImport,
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
