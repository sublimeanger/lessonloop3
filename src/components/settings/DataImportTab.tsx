import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, ArrowRight, Users, GraduationCap, Calendar, Music, CheckCircle2 } from "lucide-react";
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

const IMPORT_CATEGORIES = [
  { icon: Users, label: "Students", detail: "Names, email, phone, DOB, gender, start date, tags, notes, status" },
  { icon: Users, label: "Guardians", detail: "Up to 2 parents/guardians per student with contact details" },
  { icon: Music, label: "Teaching", detail: "Instruments, grade levels, teachers, locations, rate cards" },
  { icon: Calendar, label: "Scheduling", detail: "Recurring lesson day, time, and duration" },
];

export function DataImportTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <Card className="overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-section-title mb-1">Import Students</h3>
            <p className="text-body text-muted-foreground mb-4">
              Bulk import students, guardians, and lesson schedules from a CSV file.
              Our AI-powered column mapping automatically detects and matches fields from your previous software.
            </p>
            <Button onClick={() => navigate("/students/import")} size="lg" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Start CSV Import
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Supported platforms */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Supported Platforms
          </CardTitle>
          <CardDescription>
            We auto-detect exports from these platforms and map columns automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUPPORTED_PLATFORMS.map((platform) => (
              <div
                key={platform.name}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-body-strong truncate">{platform.name}</p>
                  <p className="text-caption text-muted-foreground truncate">{platform.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What gets imported */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>What gets imported</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.label} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-strong">{cat.label}</p>
                    <p className="text-caption text-muted-foreground">{cat.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
