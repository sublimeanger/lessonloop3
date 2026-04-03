import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useContextualHints } from '@/hooks/useContextualHints';
import { RotateCcw, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HelpToursTab() {
  const { resetAllHints, seenHints } = useContextualHints();
  const dismissedCount = Object.keys(seenHints).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help Centre
          </CardTitle>
          <CardDescription>
            Access documentation and guides for using LessonLoop
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/help">
            <Button variant="outline" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Open Help Centre
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Contextual Hints
          </CardTitle>
          <CardDescription>
            Helpful tips that appear throughout the app to guide you through features.
            {dismissedCount > 0 && (
              <span className="ml-1 text-muted-foreground">
                ({dismissedCount} dismissed)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Contextual hints appear automatically as you explore different parts of LessonLoop.
            If you&apos;d like to see them again, you can reset all dismissed hints below.
          </p>

          {dismissedCount > 0 && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={resetAllHints}
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Hints
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will allow all contextual hints to appear again across the app.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
