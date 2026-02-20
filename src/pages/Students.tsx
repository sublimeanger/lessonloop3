import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { useUsageCounts } from '@/hooks/useUsageCounts';
import { StudentWizard } from '@/components/students/StudentWizard';
import { Plus, Search, Users, Mail, Phone, Upload, Lock } from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState<'all' | StudentStatus>('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchStudents = async () => {
    if (!currentOrg) return;
    setIsLoading(true);

    // If teacher role, only fetch assigned students
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
      // Owners/admins see all students
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

  const filteredStudents = students.filter(student => {
    const matchesSearch = `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAddWizard = () => {
    if (!canAddStudent) {
      toast({ 
        title: 'Student limit reached', 
        description: `You've reached your limit of ${limits.maxStudents} students. Upgrade your plan to add more.`,
        variant: 'destructive' 
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
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus } : s));
      queryClient.invalidateQueries({ queryKey: ['usage-counts'] });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Students"
        description="Manage your students and their information"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Link to="/students/import">
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </Link>
              <Button onClick={openAddWizard} className="gap-2" disabled={!canAddStudent} data-tour="add-student-button">
                {!canAddStudent && <Lock className="h-4 w-4" />}
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Student</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center" role="search" data-tour="student-filters">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search students"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Student List */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? 'No students found' : 'No students yet'}
          description={searchQuery ? 'Try adjusting your search terms.' : 'Add your first student to get started with lesson scheduling and billing.'}
          actionLabel={searchQuery ? undefined : 'Add Your First Student'}
          onAction={searchQuery ? undefined : openAddWizard}
          secondaryActionLabel={searchQuery ? undefined : 'Import from CSV'}
          onSecondaryAction={searchQuery ? undefined : () => window.location.href = '/students/import'}
          previewImage={searchQuery ? undefined : '/previews/students-preview.svg'}
          previewAlt="Example student list"
        />
      ) : (
        <div className="space-y-2" role="list" aria-label="Students list" data-tour="student-list" data-hint="student-list">
          <ContextualHint
            id="student-click-to-view"
            message="Click any student to view their details, lessons, and invoices"
            position="top"
            targetSelector="[data-hint='student-list']"
          />
          {filteredStudents.map((student) => (
            <Link
              key={student.id}
              to={`/students/${student.id}`}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="listitem"
            >
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium"
                aria-hidden="true"
              >
                {student.first_name[0]}{student.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{student.first_name} {student.last_name}</span>
                  <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {student.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground hidden sm:flex">
                  {student.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Email:</span>
                      {student.email}
                    </span>
                  )}
                  {student.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Phone:</span>
                      {student.phone}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); toggleStatus(student); }}
                  aria-label={`${student.status === 'active' ? 'Deactivate' : 'Activate'} ${student.first_name} ${student.last_name}`}
                >
                  {student.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Student Creation Wizard */}
      <StudentWizard 
        open={isWizardOpen} 
        onOpenChange={setIsWizardOpen}
        onSuccess={fetchStudents}
      />
    </AppLayout>
  );
}
