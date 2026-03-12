import { FileText, Users, Star, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { NotesStats } from '@/hooks/useNotesExplorer';

interface NotesStatsBarProps {
  stats: NotesStats | undefined;
  isLoading: boolean;
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotesStatsBar({ stats, isLoading }: NotesStatsBarProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard icon={FileText} label="Total Notes" value={stats.totalNotes} />
      <StatCard icon={Users} label="Students Covered" value={stats.uniqueStudents} />
      <StatCard icon={Star} label="Avg Engagement" value={stats.averageEngagement !== null ? `${stats.averageEngagement} / 5` : '—'} />
      <StatCard icon={BookOpen} label="Missing Homework" value={stats.notesWithoutHomework} />
    </div>
  );
}
