import { Loader2, Users, Shield, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MESSAGES = [
  { icon: Users, text: "Creating student records..." },
  { icon: Shield, text: "Linking guardians..." },
  { icon: Database, text: "Setting up lessons..." },
];

function getExpectedDuration(totalRows?: number): string | null {
  if (!totalRows) return null;
  if (totalRows < 50) return "a few seconds";
  if (totalRows <= 200) return "about 30 seconds";
  if (totalRows <= 500) return "1–2 minutes";
  return "several minutes";
}

interface ImportingStepProps {
  totalRows?: number;
}

export function ImportingStep({ totalRows }: ImportingStepProps) {
  const expectedDuration = getExpectedDuration(totalRows);

  return (
    <Card className="overflow-hidden">
      <CardContent className="py-16 sm:py-20">
        <div className="text-center max-w-sm mx-auto">
          {/* Animated spinner */}
          <div className="relative mx-auto mb-8 h-20 w-20">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
          </div>

          <h3 className="text-section-title mb-2">Importing your data</h3>
          <p className="text-body text-muted-foreground mb-8">
            {totalRows
              ? `Processing ${totalRows.toLocaleString()} records.`
              : "Please wait while we process your records."}
            {expectedDuration && ` Estimated time: ${expectedDuration}.`}
            {" "}Please don't close this page.
          </p>

          {/* Indeterminate progress bar */}
          <div className="w-full max-w-xs mx-auto mb-6 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>

          {/* Animated step indicators */}
          <div className="space-y-3">
            {MESSAGES.map((msg, i) => {
              const Icon = msg.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-2.5 text-sm animate-fade-in"
                  style={{ animationDelay: `${i * 0.6}s`, animationFillMode: "backwards" }}
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{msg.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
