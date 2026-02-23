import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { StudentWizard } from '@/components/students/StudentWizard';
import { useStudents, useToggleStudentStatus } from '@/hooks/useStudents';
import type { StudentListItem, StudentStatus } from '@/hooks/useStudents';
import { Plus, Search, Users, Upload, Lock, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoopAssistPageBanner } from '@/components/shared/LoopAssistPageBanner';
import { supabase } from '@/integrations/supabase/client';

const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

// Generate a consistent color from a name string
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

function StatusPills({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: { all: number; active: number; inactive: number };
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
      {STATUS_FILTERS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all',
            value === s
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s === 'all' ? `All (${counts.all})` : `${s} (${counts[s]})`}
        </button>
      ))}
    </div>
  );
}

function StudentCard({
  student,
  isAdmin,
  onToggleStatus,
}: {
  student: StudentListItem;
  isAdmin: boolean;
  onToggleStatus: (s: StudentListItem) => void;
}) {
  const navigate = useNavigate();
  const fullName = `${student.first_name} ${student.last_name}`;
  const initials = `${student.first_name[0]}${student.last_name[0]}`;
  const avatarColor = nameToColor(fullName);

  return (
    <div
      onClick={() => navigate(`/students/${student.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/students/${student.id}`);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View ${fullName}`}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: avatarColor }}
        aria-hidden="true"
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {fullName}
          </span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                student.status === 'active' ? 'bg-success' : 'bg-muted-foreground/40',
              )}
            />
            <span className="text-[10px] font-medium text-muted-foreground capitalize hidden sm:inline">
              {student.status}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {student.email && <span className="truncate">{student.email}</span>}
          {student.phone && <span className="hidden sm:inline">{student.phone}</span>}
          {student.guardian_count === 0 && <span className="text-xs text-amber-600 font-medium">No guardian</span>}
        </div>
      </div>

      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(student);
          }}
          aria-label={`${student.status === 'active' ? 'Deactivate' : 'Activate'} ${fullName}`}
        >
          {student.status === 'active' ? 'Deactivate' : 'Activate'}
        </Button>
      )}
    </div>
  );
}

export default function Students() {
  const { currentRole, currentOrg } = useOrg();
  const navigate = useNavigate();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { limits, canAddStudent } = useUsageCounts();
  const { data: students = [], isLoading } = useStudents();
  const toggleMutation = useToggleStudentStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<StudentListItem | null>(null);
  const [sortBy, setSortBy] = useState<'last_name' | 'first_name' | 'created_at'>('last_name');

  const statusCounts = useMemo(() => ({
    all: students.length,
    active: students.filter((s) => s.status === 'active').length,
    inactive: students.filter((s) => s.status === 'inactive').length,
  }), [students]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((student) => {
        const matchesSearch =
          `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.phone?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'first_name') return a.first_name.localeCompare(b.first_name);
        if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return a.last_name.localeCompare(b.last_name);
      });
  }, [students, searchQuery, statusFilter, sortBy]);

  const openAddWizard = () => {
    // Client-side guard only — server-side enforcement pending
    if (!canAddStudent) {
      toast({
        title: 'Student limit reached',
        description: `You've reached your limit of ${limits.maxStudents} students. Upgrade your plan to add more.`,
        variant: 'destructive',
      });
      return;
    }
    setIsWizardOpen(true);
  };

  const toggleStatus = (student: StudentListItem) => {
    setConfirmToggle(student);
  };

  const confirmToggleStatus = () => {
    if (!confirmToggle) return;
    const newStatus: StudentStatus = confirmToggle.status === 'active' ? 'inactive' : 'active';
    toggleMutation.mutate({ studentId: confirmToggle.id, newStatus, orgId: currentOrg!.id });
    setConfirmToggle(null);
  };

  return (
    <AppLayout>
      <PageHeader
        title={`Students${!isLoading ? ` (${students.length})` : ''}`}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Link to="/students/import">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </Link>
              <Button onClick={openAddWizard} size="sm" className="gap-1.5" disabled={!canAddStudent} data-tour="add-student-button">
                {!canAddStudent && <Lock className="h-4 w-4" />}
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Student</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      <StudentsOverdueBanner />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="student-filters">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search students..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`pl-9 ${searchInput ? 'pr-9' : ''}`}
            aria-label="Search students"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_name">Last name</SelectItem>
              <SelectItem value="first_name">First name</SelectItem>
              <SelectItem value="created_at">Newest first</SelectItem>
            </SelectContent>
          </Select>
          <StatusPills value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No students found' : 'No students yet'}
          description={searchQuery ? 'Try adjusting your search terms.' : 'Add your first student to start managing lessons and billing.'}
          actionLabel={searchQuery ? undefined : 'Add Student'}
          onAction={searchQuery ? undefined : openAddWizard}
          secondaryActionLabel={searchQuery ? undefined : 'Import from CSV'}
          onSecondaryAction={searchQuery ? undefined : () => navigate('/students/import')}
        />
      ) : (
        <div className="space-y-2" role="list" aria-label="Students list" data-tour="student-list">
          {filteredStudents.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              isAdmin={isAdmin}
              onToggleStatus={toggleStatus}
            />
          ))}
        </div>
      )}

      <StudentWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
      />

      <AlertDialog open={!!confirmToggle} onOpenChange={(open) => !open && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.status === 'active' ? 'Deactivate' : 'Reactivate'} {confirmToggle?.first_name} {confirmToggle?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.status === 'active'
                ? 'This student will be hidden from the calendar and billing. You can reactivate them later.'
                : 'This student will appear in the calendar and be eligible for billing again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus} disabled={toggleMutation.isPending}>
              {toggleMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                confirmToggle?.status === 'active' ? 'Deactivate' : 'Reactivate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function StudentsOverdueBanner() {
  const { currentOrg } = useOrg();
  const { data: overdueStudentCount = 0 } = useQuery({
    queryKey: ['overdue-student-count', currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('payer_student_id')
        .eq('org_id', currentOrg!.id)
        .in('status', ['overdue'])
        .not('payer_student_id', 'is', null);
      return new Set(data?.map(d => d.payer_student_id)).size;
    },
    enabled: !!currentOrg,
    // Uses default SEMI_STABLE (2 min)
  });

  if (overdueStudentCount === 0) return null;

  return (
    <LoopAssistPageBanner
      bannerKey="students_overdue"
      message={`${overdueStudentCount} student${overdueStudentCount !== 1 ? 's have' : ' has'} overdue invoices — Ask LoopAssist to send reminders`}
      prompt="Send reminders for students with overdue invoices"
    />
  );
}
