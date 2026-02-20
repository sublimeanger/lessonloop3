import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { StudentWizard } from '@/components/students/StudentWizard';
import { Plus, Search, Users, Upload, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type StudentStatus = 'active' | 'inactive';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  notes: string | null;
  status: StudentStatus;
  created_at: string;
}

// Generate a consistent color from a name string
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

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
  student: Student;
  isAdmin: boolean;
  onToggleStatus: (s: Student) => void;
}) {
  const navigate = useNavigate();
  const fullName = `${student.first_name} ${student.last_name}`;
  const initials = `${student.first_name[0]}${student.last_name[0]}`;
  const avatarColor = nameToColor(fullName);

  return (
    <div
      onClick={() => navigate(`/students/${student.id}`)}
      className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md cursor-pointer group"
      role="listitem"
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: avatarColor }}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {fullName}
          </span>
          {/* Status indicator */}
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
        </div>
      </div>

      {/* Admin action */}
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
  const { currentOrg, currentRole } = useOrg();
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { limits, canAddStudent } = useUsageCounts();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchStudents = async () => {
    if (!currentOrg) return;
    setIsLoading(true);

    if (currentRole === 'teacher' && user) {
      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .eq('teacher_user_id', user.id);

      if (assignError) {
        toast({ title: 'Error loading assignments', description: assignError.message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const assignedIds = assignments?.map((a) => a.student_id) || [];
      if (assignedIds.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('org_id', currentOrg.id)
        .in('id', assignedIds)
        .order('last_name', { ascending: true });

      if (error) {
        toast({ title: 'Error loading students', description: error.message, variant: 'destructive' });
      } else {
        setStudents((data || []) as Student[]);
      }
    } else {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('last_name', { ascending: true });

      if (error) {
        toast({ title: 'Error loading students', description: error.message, variant: 'destructive' });
      } else {
        setStudents((data || []) as Student[]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [currentOrg?.id, currentRole, user?.id]);

  const statusCounts = useMemo(() => ({
    all: students.length,
    active: students.filter((s) => s.status === 'active').length,
    inactive: students.filter((s) => s.status === 'inactive').length,
  }), [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, statusFilter]);

  const openAddWizard = () => {
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

  const toggleStatus = async (student: Student) => {
    const newStatus: StudentStatus = student.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('students')
      .update({ status: newStatus })
      .eq('id', student.id);

    if (error) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    } else {
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, status: newStatus } : s)));
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
    }
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

      {/* Search + Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="student-filters">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search students"
          />
        </div>
        <StatusPills value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
      </div>

      {/* Student List */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No students found' : 'No students yet'}
          description={searchQuery ? 'Try adjusting your search terms.' : 'Add your first student to get started.'}
          actionLabel={searchQuery ? undefined : 'Add Student'}
          onAction={searchQuery ? undefined : openAddWizard}
          secondaryActionLabel={searchQuery ? undefined : 'Import from CSV'}
          onSecondaryAction={searchQuery ? undefined : () => (window.location.href = '/students/import')}
          previewImage={searchQuery ? undefined : '/previews/students-preview.svg'}
          previewAlt="Example student list"
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
        onSuccess={fetchStudents}
      />
    </AppLayout>
  );
}
