import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SUPPORTED_PLATFORMS = [
  { name: "My Music Staff", description: "Full student, guardian, lesson, and billing data" },
  { name: "Opus 1", description: "Student profiles, addresses, tags, and statuses" },
  { name: "Teachworks", description: "Students, families, and scheduling data" },
  { name: "Duet Partner", description: "Contact info, instruments, and skill levels" },
  { name: "Fons", description: "Client management exports" },
  { name: "Jackrabbit Music", description: "Music school student rosters" },
  { name: "Generic CSV", description: "Any spreadsheet with student information" },
];

export function DataImportTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Students
          </CardTitle>
          <CardDescription>
            Bulk import students, guardians, and lesson schedules from a CSV file.
            Our AI-powered column mapping automatically detects and matches fields from your previous software.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/students/import")} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Start CSV Import
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported Platforms</CardTitle>
          <CardDescription>
            We auto-detect exports from these platforms and map columns automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUPPORTED_PLATFORMS.map((platform) => (
              <div key={platform.name} className="flex items-start gap-3 rounded-lg border p-3">
                <FileSpreadsheet className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{platform.name}</p>
                  <p className="text-xs text-muted-foreground">{platform.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What gets imported</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Students</p>
              <p className="text-muted-foreground">Names, email, phone, DOB, gender, start date, tags, notes, status</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Guardians</p>
              <p className="text-muted-foreground">Up to 2 parents/guardians per student with contact details</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Teaching</p>
              <p className="text-muted-foreground">Instruments, grade levels, teachers, locations, rate cards</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Scheduling</p>
              <p className="text-muted-foreground">Recurring lesson day, time, and duration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
