import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, ArrowDownToLine, Sparkles, Rocket, Clock,
  FileSpreadsheet, Loader2, Wand2, CheckCircle2, AlertTriangle, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { MigrationChoice, ImportData } from '@/hooks/useOnboardingState';
import type { ColumnMapping, TargetField } from '@/hooks/useStudentsImport';

// ── Source options (same as existing import page) ──────────────────────────

const SOURCE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', description: 'Let LoopAssist figure it out' },
  { value: 'mymusicstaff', label: 'My Music Staff', description: 'Most popular music teaching platform' },
  { value: 'opus1', label: 'Opus 1', description: 'Music school management' },
  { value: 'teachworks', label: 'Teachworks', description: 'Tutoring management software' },
  { value: 'duetpartner', label: 'Duet Partner', description: 'Music teaching app' },
  { value: 'fons', label: 'Fons', description: 'Client management for teachers' },
  { value: 'jackrabbit', label: 'Jackrabbit Music', description: 'Music school software' },
  { value: 'generic', label: 'Other / Generic CSV', description: 'Any CSV spreadsheet' },
];

const SOURCE_LABELS: Record<string, string> = {
  mymusicstaff: 'My Music Staff',
  opus1: 'Opus 1',
  teachworks: 'Teachworks',
  duetpartner: 'Duet Partner',
  fons: 'Fons',
  jackrabbit: 'Jackrabbit Music',
};

// ── CSV Parsing (extracted from useStudentsImport) ─────────────────────────

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
}

async function readFileAsText(f: File): Promise<string> {
  const utf8 = await f.text();
  if (!utf8.includes('\uFFFD')) return utf8;
  const buffer = await f.arrayBuffer();
  return new TextDecoder('windows-1252').decode(buffer);
}

// ── Confidence badge ───────────────────────────────────────────────────────

function ConfidenceBadge({ confidence, hasTarget }: { confidence: number; hasTarget: boolean }) {
  if (!hasTarget) return null;
  if (confidence >= 0.7) {
    return (
      <Badge variant="default" className="bg-success/90 hover:bg-success text-success-foreground text-xs">
        <CheckCircle2 className="h-3 w-3 mr-0.5" />
        {Math.round(confidence * 100)}%
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30 text-xs">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
          {Math.round(confidence * 100)}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Uncertain mapping — please verify</TooltipContent>
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface MigrationStepProps {
  migrationChoice: MigrationChoice | null;
  importData: ImportData | null;
  onMigrationChoiceChange: (choice: MigrationChoice) => void;
  onImportDataChange: (data: ImportData | null) => void;
  onNext: () => void;
  onBack: () => void;
}

type ImportPhase = 'choice' | 'upload' | 'mapping' | 'ready';

export function MigrationStep({
  migrationChoice, importData,
  onMigrationChoiceChange, onImportDataChange,
  onNext, onBack,
}: MigrationStepProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>(() => {
    if (importData?.summary) return 'ready';
    if (importData?.mappings?.length) return 'mapping';
    if (migrationChoice === 'switching') return 'upload';
    return 'choice';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sourceSoftware, setSourceSoftware] = useState(importData?.sourceSoftware || 'auto');

  // Local mapping state (before saving to parent)
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(importData?.mappings || []);
  const [localHeaders, setLocalHeaders] = useState<string[]>(importData?.headers || []);
  const [localRows, setLocalRows] = useState<string[][]>(importData?.rows || []);
  const [localTargetFields, setLocalTargetFields] = useState<TargetField[]>(importData?.targetFields || []);
  const [localWarnings, setLocalWarnings] = useState<string[]>(importData?.warnings || []);
  const [localDetectedSource, setLocalDetectedSource] = useState<string | null>(importData?.detectedSource || null);
  const [localImportLessons, setLocalImportLessons] = useState(importData?.importLessons || false);

  // Compute summary from mappings
  const summary = useMemo(() => {
    if (!localMappings.length || !localRows.length) return null;
    const mapped = localMappings.filter(m => m.target_field).map(m => m.target_field);
    const hasGuardian = mapped.some(f => f?.startsWith('guardian'));
    const hasLesson = mapped.some(f => f === 'lesson_day' || f === 'lesson_time');
    return {
      students: localRows.length,
      guardians: hasGuardian ? localRows.filter(r => {
        const guardianIdx = localMappings.findIndex(m => m.target_field === 'guardian_name' || m.target_field === 'guardian_email');
        return guardianIdx >= 0 && r[guardianIdx]?.trim();
      }).length : 0,
      lessons: hasLesson ? localRows.filter(r => {
        const lessonIdx = localMappings.findIndex(m => m.target_field === 'lesson_day');
        return lessonIdx >= 0 && r[lessonIdx]?.trim();
      }).length : 0,
    };
  }, [localMappings, localRows]);

  const requiredFieldsMapped = useMemo(() => {
    const required = localTargetFields.filter(f => f.required).map(f => f.name);
    const mapped = localMappings.filter(m => m.target_field).map(m => m.target_field);
    return required.every(r => mapped.includes(r));
  }, [localMappings, localTargetFields]);

  const getAvailableFields = useCallback((currentHeader: string) => {
    const usedFields = localMappings
      .filter(m => m.csv_header !== currentHeader && m.target_field)
      .map(m => m.target_field);
    return localTargetFields.filter(f => !usedFields.includes(f.name));
  }, [localMappings, localTargetFields]);

  const updateMapping = useCallback((csvHeader: string, targetField: string | null) => {
    setLocalMappings(prev => prev.map(m =>
      m.csv_header === csvHeader
        ? { ...m, target_field: targetField === 'none' ? null : targetField, confidence: 1 }
        : m
    ));
  }, []);

  // ── Choice selection ──

  const handleChoiceSwitching = () => {
    onMigrationChoiceChange('switching');
    setPhase('upload');
  };

  const handleChoiceSkip = (choice: 'fresh' | 'later') => {
    onMigrationChoiceChange(choice);
    onImportDataChange(null);
    onNext();
  };

  // ── File upload ──

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer?.items?.length) setIsDragging(true);
  }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
      inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    if (!uploadedFile.name.endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const content = await readFileAsText(uploadedFile);
      const { headers: csvHeaders, rows: csvRows } = parseCSV(content);
      if (csvHeaders.length === 0 || csvRows.length === 0) {
        throw new Error('CSV file is empty or invalid');
      }

      setLocalHeaders(csvHeaders);
      setLocalRows(csvRows);

      // Call AI mapping (doesn't need org_id)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Please log in again');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csv-import-mapping`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            headers: csvHeaders,
            sampleRows: csvRows.slice(0, 5),
            sourceSoftware: sourceSoftware !== 'auto' ? sourceSoftware : undefined,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get column mappings');
      }

      const mappingData = await response.json();
      setLocalMappings(mappingData.mappings);
      setLocalTargetFields(mappingData.target_fields || []);
      setLocalWarnings(mappingData.warnings || []);
      setLocalImportLessons(mappingData.has_lesson_data || false);
      setLocalDetectedSource(mappingData.detected_source || null);
      setPhase('mapping');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [sourceSoftware, toast]);

  // ── Confirm mappings ──

  const handleConfirmMappings = () => {
    const importDataPayload: ImportData = {
      sourceSoftware,
      headers: localHeaders,
      rows: localRows,
      mappings: localMappings,
      targetFields: localTargetFields,
      warnings: localWarnings,
      detectedSource: localDetectedSource,
      importLessons: localImportLessons,
      summary: summary,
    };
    onImportDataChange(importDataPayload);
    setPhase('ready');
  };

  const handleContinueFromReady = () => {
    onNext();
  };

  // ── Render ──

  return (
    <motion.div
      key="migration"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Bring Your Data</h1>
        <p className="mt-2 text-muted-foreground">
          Already using music teaching software? We'll import your students in seconds.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Phase: Choice ── */}
        {phase === 'choice' && (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Switching option */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleChoiceSwitching}
              className="w-full flex items-center gap-4 rounded-xl border-2 border-border p-5 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="rounded-xl bg-primary/10 p-3">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Yes, import my data</div>
                <div className="text-sm text-muted-foreground">
                  Upload a CSV from My Music Staff, Opus 1, Teachworks, and more
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>

            {/* Fresh start */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => handleChoiceSkip('fresh')}
              className="w-full flex items-center gap-4 rounded-xl border-2 border-border p-5 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="rounded-xl bg-muted p-3">
                <Rocket className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">No, starting fresh</div>
                <div className="text-sm text-muted-foreground">
                  I'll add my students manually
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>

            {/* Later */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => handleChoiceSkip('later')}
              className="w-full flex items-center gap-4 rounded-xl border-2 border-border p-5 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="rounded-xl bg-muted p-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">I'll import later</div>
                <div className="text-sm text-muted-foreground">
                  You can always import from Settings
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>

            {/* Supported platforms badge row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-2 pt-4"
            >
              <span className="text-xs text-muted-foreground">Supports:</span>
              {['My Music Staff', 'Opus 1', 'Teachworks', 'Duet Partner', 'Fons', 'Jackrabbit'].map(name => (
                <Badge key={name} variant="secondary" className="text-xs font-normal">
                  {name}
                </Badge>
              ))}
            </motion.div>

            {/* Back button */}
            <div className="flex justify-start pt-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Phase: Upload ── */}
        {phase === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card>
              <CardContent className="space-y-5 pt-6">
                {/* Source selector */}
                <div className="space-y-2">
                  <Label className="font-medium">Importing from</Label>
                  <Select value={sourceSoftware} onValueChange={setSourceSoftware}>
                    <SelectTrigger className="w-full sm:w-[320px]">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dropzone */}
                <div
                  onDragEnter={handleDragIn}
                  onDragLeave={handleDragOut}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 sm:p-10
                    ${isLoading
                      ? 'border-primary/40 bg-primary/5'
                      : isDragging
                        ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg'
                        : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30'
                    }
                  `}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="onboarding-csv-upload"
                    disabled={isLoading}
                  />
                  <label htmlFor="onboarding-csv-upload" className="cursor-pointer block">
                    <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                      isLoading ? 'bg-primary/10' : isDragging ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      {isLoading ? (
                        <Loader2 className="h-7 w-7 text-primary animate-spin" />
                      ) : (
                        <FileSpreadsheet className={`h-7 w-7 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      )}
                    </div>
                    <p className="font-semibold mb-1">
                      {isLoading ? 'Processing your file...' : isDragging ? 'Drop it here' : 'Drop your CSV here or click to upload'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Students, guardians, instruments, and lesson schedules
                    </p>
                  </label>
                </div>

                {/* AI info */}
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Wand2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        AI-Powered Column Mapping
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        LoopAssist automatically maps your columns. You'll review before anything is imported.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setPhase('choice')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Phase: Mapping ── */}
        {phase === 'mapping' && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Detected source */}
                {localDetectedSource && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>
                      Detected export from <strong>{SOURCE_LABELS[localDetectedSource] || localDetectedSource}</strong>
                    </span>
                  </div>
                )}

                {/* Row count */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span>{localRows.length} rows found — {localMappings.filter(m => m.target_field).length} of {localMappings.length} columns mapped</span>
                </div>

                {/* Warnings */}
                {localWarnings.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                    {localWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-warning flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Compact mapping table */}
                <div className="max-h-[320px] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">CSV Column</TableHead>
                        <TableHead>Maps To</TableHead>
                        <TableHead className="w-16 text-center">Conf.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {localMappings.map((mapping) => {
                        const available = getAvailableFields(mapping.csv_header);
                        return (
                          <TableRow key={mapping.csv_header}>
                            <TableCell className="font-mono text-xs truncate max-w-[150px]">
                              {mapping.csv_header}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={mapping.target_field || 'none'}
                                onValueChange={(v) => updateMapping(mapping.csv_header, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <span className="text-muted-foreground">— Skip —</span>
                                  </SelectItem>
                                  {mapping.target_field && !available.some(f => f.name === mapping.target_field) && (
                                    <SelectItem value={mapping.target_field}>{mapping.target_field}</SelectItem>
                                  )}
                                  {available.map(f => (
                                    <SelectItem key={f.name} value={f.name}>
                                      <div className="flex flex-col">
                                        <span>{f.name}</span>
                                        {f.required && <span className="text-xs text-destructive">Required</span>}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <ConfidenceBadge confidence={mapping.confidence} hasTarget={!!mapping.target_field} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Required fields warning */}
                {!requiredFieldsMapped && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Required fields must be mapped before importing.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setPhase('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Re-upload
              </Button>
              <Button onClick={handleConfirmMappings} disabled={!requiredFieldsMapped} size="lg">
                Confirm Mappings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Phase: Ready ── */}
        {phase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10"
                >
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </motion.div>

                <div>
                  <h2 className="text-xl font-bold">Data Ready to Import</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll import everything when your account is set up.
                  </p>
                </div>

                {summary && (
                  <div className="flex justify-center gap-6 py-2">
                    {summary.students > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{summary.students}</div>
                        <div className="text-xs text-muted-foreground">Students</div>
                      </div>
                    )}
                    {summary.guardians > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{summary.guardians}</div>
                        <div className="text-xs text-muted-foreground">Guardians</div>
                      </div>
                    )}
                    {summary.lessons > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{summary.lessons}</div>
                        <div className="text-xs text-muted-foreground">Lessons</div>
                      </div>
                    )}
                  </div>
                )}

                {localDetectedSource && (
                  <p className="text-xs text-muted-foreground">
                    Imported from {SOURCE_LABELS[localDetectedSource] || localDetectedSource}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setPhase('mapping')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Edit Mappings
              </Button>
              <Button onClick={handleContinueFromReady} size="lg">
                Choose Plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
