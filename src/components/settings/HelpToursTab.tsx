import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTour, TourName } from '@/components/tours/TourProvider';
import { RotateCcw, PlayCircle, HelpCircle, BookOpen, Map, Receipt, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const tours: { name: TourName; title: string; description: string; icon: typeof Map }[] = [
  {
    name: 'dashboard',
    title: 'Dashboard Tour',
    description: 'Learn about your dashboard overview, stats, and quick actions.',
    icon: Map,
  },
  {
    name: 'calendar',
    title: 'Calendar Tour',
    description: 'Discover how to create lessons, use views, and navigate your schedule.',
    icon: BookOpen,
  },
  {
    name: 'students',
    title: 'Students Tour',
    description: 'Learn how to add and manage students and their guardians.',
    icon: Users,
  },
  {
    name: 'invoices',
    title: 'Invoices Tour',
    description: 'Understand invoice creation, billing runs, and payment tracking.',
    icon: Receipt,
  },
  {
    name: 'loopassist',
    title: 'LoopAssist Tour',
    description: 'Get to know your AI assistant and what it can help you with.',
    icon: Sparkles,
  },
];

export function HelpToursTab() {
  const { hasCompletedTour, resetTours, completedTours } = useTour();

  // Tour start is handled by TourTrigger components on each page

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
            <PlayCircle className="h-5 w-5" />
            Guided Tours
          </CardTitle>
          <CardDescription>
            Interactive walkthroughs to help you learn LessonLoop features.
            {completedTours.length > 0 && (
              <span className="ml-1 text-primary">
                ({completedTours.length}/{tours.length} completed)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {tours.map((tour) => {
              const completed = hasCompletedTour(tour.name);
              const Icon = tour.icon;
              
              return (
                <div
                  key={tour.name}
                  className="flex items-start gap-3 rounded-lg border p-4"
                >
                  <div className={`rounded-lg p-2 ${completed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{tour.title}</span>
                      {completed && (
                        <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          ✓ Done
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tour.description}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-xs"
                      onClick={() => {
                        // Navigate to page where tour runs
                        const pathMap: Record<TourName, string> = {
                          dashboard: '/dashboard',
                          calendar: '/calendar',
                          students: '/students',
                          invoices: '/invoices',
                          loopassist: '/dashboard', // LoopAssist is opened from drawer
                        };
                        resetTours();
                        // Allow localStorage write to flush before navigating
                        requestAnimationFrame(() => {
                          window.location.href = pathMap[tour.name];
                        });
                      }}
                    >
                      {completed ? 'Replay tour' : 'Start tour'} →
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {completedTours.length > 0 && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={resetTours}
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Tours
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will allow all tours to show again on their respective pages.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
