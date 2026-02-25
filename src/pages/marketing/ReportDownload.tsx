import { generateCompetitiveReport } from '@/lib/generateCompetitiveReport';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ReportDownload() {
  usePageMeta('Download Report | LessonLoop', 'Download the LessonLoop competitive analysis report');
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">LessonLoop Report</h1>
        <p className="text-muted-foreground">Competitive Analysis, Feature Audit & Valuation</p>
        <Button size="lg" onClick={() => generateCompetitiveReport()} className="gap-2">
          <FileDown className="h-5 w-5" />
          Download PDF Report
        </Button>
      </div>
    </div>
  );
}
