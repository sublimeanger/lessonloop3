import { Loader2, Users, Shield, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MESSAGES = [
  { icon: Users, text: "Creating student records..." },
  { icon: Shield, text: "Linking guardians..." },
  { icon: Database, text: "Setting up lessons..." },
];

export function ImportingStep() {
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
            Please wait while we process your records. This may take a moment for large files.
          </p>

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
