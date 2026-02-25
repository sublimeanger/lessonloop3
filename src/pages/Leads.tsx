import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { CreateLeadModal } from '@/components/leads/CreateLeadModal';
import { LeadFunnelChart } from '@/components/leads/LeadFunnelChart';
import { useLeads, useLeadStageCounts } from '@/hooks/useLeads';
import { useLeadFunnelStats, exportLeadsToCSV } from '@/hooks/useLeadAnalytics';
import { useOrg } from '@/contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  UserPlus,
  Search,
  LayoutGrid,
  List,
  Download,
  ChevronRight,
  Users,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type LeadStage = Database['public']['Enums']['lead_stage'];
type LeadSource = Database['public']['Enums']['lead_source'];

const STAGE_LABELS: Record<LeadStage, string> = {
  enquiry: 'Enquiry',
  contacted: 'Contacted',
  trial_booked: 'Trial Booked',
  trial_completed: 'Trial Completed',
  enrolled: 'Enrolled',
  lost: 'Lost',
};

const STAGE_COLORS: Record<LeadStage, string> = {
  enquiry: 'bg-teal-100 text-teal-800',
  contacted: 'bg-blue-100 text-blue-800',
  trial_booked: 'bg-amber-100 text-amber-800',
  trial_completed: 'bg-purple-100 text-purple-800',
  enrolled: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-600',
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: 'Manual',
  booking_page: 'Booking Page',
  widget: 'Widget',
  referral: 'Referral',
  website: 'Website',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
};

export default function Leads() {
  usePageMeta('Leads | LessonLoop', 'Manage your lead pipeline and trial lessons');
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [view, setView] = useState<'kanban' | 'list'>(isMobile ? 'list' : 'kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const filters = useMemo(() => ({
    search: search || undefined,
    stage: stageFilter !== 'all' ? stageFilter as LeadStage : undefined,
    source: sourceFilter !== 'all' ? sourceFilter as LeadSource : undefined,
  }), [search, stageFilter, sourceFilter]);

  const { data: leads = [], isLoading } = useLeads(filters);
  const { data: stageCounts } = useLeadStageCounts();
  const { data: funnelStats } = useLeadFunnelStats();

  const handleExport = () => {
    if (leads.length > 0 && currentOrg) {
      try {
        exportLeadsToCSV(leads, currentOrg.name.replace(/[^a-zA-Z0-9]/g, '_'));
        toast({ title: 'Leads exported', description: 'CSV file has been downloaded.' });
      } catch {
        toast({ title: 'Export failed', description: 'Something went wrong.', variant: 'destructive' });
      }
    }
  };

  const totalActive = stageCounts
    ? Object.entries(stageCounts)
        .filter(([stage]) => stage !== 'enrolled' && stage !== 'lost')
        .reduce((sum, [, count]) => sum + (count as number), 0)
    : 0;

  return (
    <FeatureGate feature="lead_pipeline">
      <AppLayout>
        <PageHeader
          title="Leads"
          description={`${totalActive} active lead${totalActive !== 1 ? 's' : ''} in pipeline`}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Leads' },
          ]}
          actions={
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              {leads.length > 0 && (
                <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Lead
              </Button>
            </div>
          }
        />

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative w-full sm:flex-1 sm:w-auto min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[130px] sm:w-[150px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px] sm:w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main content */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 && !search && stageFilter === 'all' && sourceFilter === 'all' ? (
          <EmptyState
            icon={UserPlus}
            title="No leads yet"
            description="Start building your pipeline by adding your first lead, or set up a public booking page to receive enquiries automatically."
            actionLabel="Add First Lead"
            onAction={() => setShowCreate(true)}
          />
        ) : view === 'kanban' ? (
          <LeadKanbanBoard
            leads={leads}
            stageCounts={stageCounts || {}}
            onAddLead={() => setShowCreate(true)}
          />
        ) : (
          /* List view */
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden sm:table-cell">Children</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{lead.contact_name}</div>
                        <div className="text-sm text-muted-foreground">{lead.contact_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {lead.student_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs', STAGE_COLORS[lead.stage])}>
                        {STAGE_LABELS[lead.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {SOURCE_LABELS[lead.source]}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Funnel analytics */}
        {funnelStats && leads.length > 0 && (
          <div className="mt-8">
            <LeadFunnelChart data={funnelStats} />
          </div>
        )}

        <CreateLeadModal open={showCreate} onOpenChange={setShowCreate} />
      </AppLayout>
    </FeatureGate>
  );
}
