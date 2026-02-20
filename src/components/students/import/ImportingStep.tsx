import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ImportingStep() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
        <h3 className="text-lg font-medium mb-2">Importing data...</h3>
        <p className="text-sm text-muted-foreground">
          Please wait while we process your records
        </p>
        <Progress className="mt-6 max-w-md mx-auto" value={undefined} />
      </CardContent>
    </Card>
  );
}
