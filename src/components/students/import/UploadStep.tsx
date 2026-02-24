import { Loader2, FileSpreadsheet, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

interface UploadStepProps {
  isLoading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadStep({ isLoading, handleFileUpload }: UploadStepProps) {
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
      <CardContent>
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
  );
}
