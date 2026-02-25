import { Loader2, FileSpreadsheet, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

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
  return (
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
      <CardContent className="space-y-6">
        {/* Source software selector */}
        <div className="space-y-2">
          <Label htmlFor="source-software">Importing from</Label>
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
          <p className="text-xs text-muted-foreground">
            Selecting your previous software helps us match columns more accurately.
          </p>
        </div>

        {/* File upload dropzone */}
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50 sm:p-12">
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
            <p className="text-section-title mb-1">
              {isLoading ? "Processing..." : "Drop your CSV file here or click to upload"}
            </p>
            <p className="text-body text-muted-foreground">
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
            We support exports from My Music Staff, Opus 1, Teachworks, Duet Partner, and more.
            You can review and adjust mappings before importing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
