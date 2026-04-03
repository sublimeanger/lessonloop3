import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useContextualHints, HINT_REGISTRY } from '@/hooks/useContextualHints';
import { RotateCcw, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export function HelpToursTab() {
  const { resetAllHints, seenHints } = useContextualHints();
  const { toast } = useToast();

  const totalHints = Object.keys(HINT_REGISTRY).length;
  const seenCount = Object.keys(seenHints).length;

  const handleReset = () => {
    resetAllHints();
    toast({ title: 'Hints reset', description: 'All contextual hints will appear again as you navigate the app.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Contextual Hints
          </CardTitle>
          <CardDescription>
            Helpful tips appear as you use the app for the first time. They only show once per feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You've seen {seenCount} of {totalHints} available hints.
          </p>

          {seenCount > 0 && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Reset all hints
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help Centre
          </CardTitle>
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
    </div>
  );
}
