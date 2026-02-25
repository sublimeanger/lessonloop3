import { useState, useRef, useCallback } from "react";
import { Loader2, FileSpreadsheet, Wand2, Upload, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const SOURCE_OPTIONS = [
  { value: "auto", label: "Auto-detect", description: "Let LoopAssist figure it out" },
  { value: "mymusicstaff", label: "My Music Staff", description: "Most popular music teaching platform" },
  { value: "opus1", label: "Opus 1", description: "Music school management" },
  { value: "teachworks", label: "Teachworks", description: "Tutoring management software" },
  { value: "duetpartner", label: "Duet Partner", description: "Music teaching app" },
  { value: "fons", label: "Fons", description: "Client management for teachers" },
  { value: "jackrabbit", label: "Jackrabbit Music", description: "Music school software" },
  { value: "generic", label: "Other / Generic CSV", description: "Any CSV spreadsheet" },
];

interface UploadStepProps {
  isLoading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sourceSoftware: string;
  setSourceSoftware: (value: string) => void;
}

export function UploadStep({ isLoading, handleFileUpload, sourceSoftware, setSourceSoftware }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.items?.length) setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
      inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload CSV File
        </CardTitle>
        <CardDescription>
          Upload a CSV file with student data. LoopAssist will help map columns to the correct fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Source software selector */}
        <div className="space-y-2">
          <Label htmlFor="source-software" className="text-body-strong">Importing from</Label>
          <Select value={sourceSoftware} onValueChange={setSourceSoftware}>
            <SelectTrigger id="source-software" className="w-full sm:w-[320px]">
              <SelectValue placeholder="Select source software..." />
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
          <p className="text-caption text-muted-foreground">
            Selecting your previous software helps us match columns more accurately.
          </p>
        </div>

        {/* File upload dropzone */}
        <div
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative rounded-xl border-2 border-dashed p-8 text-center
            transition-all duration-200 sm:p-12
            ${isLoading
              ? "border-primary/40 bg-primary/5"
              : isDragging
                ? "border-primary bg-primary/10 scale-[1.01] shadow-lg"
                : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
            disabled={isLoading}
          />
          <label htmlFor="csv-upload" className="cursor-pointer block">
            <div className={`
              mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl
              transition-all duration-300
              ${isLoading
                ? "bg-primary/10"
                : isDragging
                  ? "bg-primary/20 scale-110"
                  : "bg-muted group-hover:bg-primary/10"
              }
            `}>
              {isLoading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <FileSpreadsheet className={`h-8 w-8 transition-colors duration-200 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              )}
            </div>
            <p className="text-section-title mb-1.5">
              {isLoading ? "Processing your file..." : isDragging ? "Drop your file here" : "Drop your CSV file here or click to upload"}
            </p>
            <p className="text-body text-muted-foreground max-w-md mx-auto">
              Supports students, guardians, student-guardian links, instruments, and recurring lessons
            </p>
          </label>
        </div>

        {/* AI info box */}
        <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-body-strong mb-1 flex items-center gap-1.5">
                AI-Powered Column Mapping
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </h4>
              <p className="text-caption text-muted-foreground">
                LoopAssist automatically detects and maps your CSV columns. We support exports from
                My Music Staff, Opus 1, Teachworks, Duet Partner, and more.
                You can review and adjust all mappings before importing.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
