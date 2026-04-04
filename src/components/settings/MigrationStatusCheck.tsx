import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface CheckResult {
  label: string;
  status: 'pending' | 'pass' | 'fail';
  error?: string;
}

export function MigrationStatusCheck() {
  const [checks, setChecks] = useState<CheckResult[]>([
    { label: 'xero_connections table exists', status: 'pending' },
    { label: 'xero_entity_mappings table exists', status: 'pending' },
    { label: 'external_busy_blocks table exists', status: 'pending' },
    { label: 'hint_completions table exists', status: 'pending' },
    { label: 'teachers.pay_rate_type column exists', status: 'pending' },
    { label: 'organisations dunning/reminder columns exist', status: 'pending' },
  ]);

  useEffect(() => {
    const run = async () => {
      const results: CheckResult[] = [];

      // 1. xero_connections
      const r1 = await (supabase as any).from('xero_connections').select('id').limit(1);
      results.push({ label: 'xero_connections table exists', status: r1.error ? 'fail' : 'pass', error: r1.error?.message });

      // 2. xero_entity_mappings
      const r2 = await (supabase as any).from('xero_entity_mappings').select('id').limit(1);
      results.push({ label: 'xero_entity_mappings table exists', status: r2.error ? 'fail' : 'pass', error: r2.error?.message });

      // 3. external_busy_blocks
      const r3 = await supabase.from('external_busy_blocks').select('id').limit(1);
      results.push({ label: 'external_busy_blocks table exists', status: r3.error ? 'fail' : 'pass', error: r3.error?.message });

      // 4. hint_completions
      const r4 = await supabase.from('hint_completions').select('id').limit(1);
      results.push({ label: 'hint_completions table exists', status: r4.error ? 'fail' : 'pass', error: r4.error?.message });

      // 5. teachers.pay_rate_type
      const r5 = await (supabase as any).from('teachers').select('pay_rate_type').limit(1);
      results.push({ label: 'teachers.pay_rate_type column exists', status: r5.error ? 'fail' : 'pass', error: r5.error?.message });

      // 6. organisations dunning columns
      const r6 = await (supabase as any).from('organisations').select('payment_reminder_enabled,dunning_enabled').limit(1);
      results.push({ label: 'organisations dunning/reminder columns exist', status: r6.error ? 'fail' : 'pass', error: r6.error?.message });

      setChecks(results);
    };
    run();
  }, []);

  return (
    <Card className="border-dashed border-2 border-yellow-500/50 bg-yellow-50/30 dark:bg-yellow-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">🔍 Migration Status Check</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {c.status === 'pending' && <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />}
            {c.status === 'pass' && <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />}
            {c.status === 'fail' && <XCircle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />}
            <div>
              <span className={c.status === 'fail' ? 'text-red-700 dark:text-red-400' : ''}>{c.label}</span>
              {c.error && <p className="text-xs text-red-500 mt-0.5">{c.error}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
