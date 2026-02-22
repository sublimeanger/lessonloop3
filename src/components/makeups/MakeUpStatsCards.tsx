import { Bell, Clock, Mail, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  waiting: number;
  matched: number;
  offered: number;
  booked: number;
  accepted?: number;
}

interface MakeUpStatsCardsProps {
  stats: Stats | undefined;
  isLoading: boolean;
}

const cards = [
  { key: 'matched' as const, label: 'Needs Action', icon: Bell, color: 'text-warning' },
  { key: 'waiting' as const, label: 'Waiting', icon: Clock, color: 'text-muted-foreground' },
  { key: 'offered' as const, label: 'Offered', icon: Mail, color: 'text-primary' },
  { key: 'booked' as const, label: 'Booked This Month', icon: CheckCircle2, color: 'text-emerald-500' },
];

export function MakeUpStatsCards({ stats, isLoading }: MakeUpStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-1">{stats?.[key] ?? 0}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
