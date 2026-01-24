import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Plus, Search, Users, Mail, Phone, Upload } from 'lucide-react';

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
  const { currentOrg, isOrgAdmin, currentRole } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentStatus>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');

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

  const openAddDialog = () => {
    setEditingStudent(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setDob('');
    setNotes('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFirstName(student.first_name);
    setLastName(student.last_name);
    setEmail(student.email || '');
    setPhone(student.phone || '');
    setDob(student.dob || '');
    setNotes(student.notes || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'Please enter first and last name.', variant: 'destructive' });
      return;
    }
    if (!currentOrg) return;

    setIsSaving(true);
    
    const studentData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      dob: dob || null,
      notes: notes.trim() || null,
    };

    if (editingStudent) {
      const { error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', editingStudent.id);
      
      if (error) {
        toast({ title: 'Error updating student', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Student updated' });
        setIsDialogOpen(false);
        fetchStudents();
      }
    } else {
      const { error } = await supabase
        .from('students')
        .insert({ ...studentData, org_id: currentOrg.id });
      
      if (error) {
        toast({ title: 'Error adding student', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Student added' });
        setIsDialogOpen(false);
        fetchStudents();
      }
    }
    setIsSaving(false);
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
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Students"
        description="Manage your students and their information"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/students/import">
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            </Link>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Student</span>
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center" role="search">
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
          onAction={searchQuery ? undefined : openAddDialog}
          secondaryActionLabel={searchQuery ? undefined : 'Import from CSV'}
          onSecondaryAction={searchQuery ? undefined : () => window.location.href = '/students/import'}
        />
      ) : (
        <div className="space-y-2" role="list" aria-label="Students list">
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
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); openEditDialog(student); }}
                aria-label={`Edit ${student.first_name} ${student.last_name}`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); toggleStatus(student); }}
                aria-label={`${student.status === 'active' ? 'Deactivate' : 'Activate'} ${student.first_name} ${student.last_name}`}
              >
                {student.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            </Link>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription id="dialog-description">
              {editingStudent ? 'Update student information.' : 'Add a new student to your organisation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First name <span className="text-destructive" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </Label>
                <Input 
                  id="firstName" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  placeholder="Emma"
                  aria-required="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last name <span className="text-destructive" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </Label>
                <Input 
                  id="lastName" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  placeholder="Wilson"
                  aria-required="true"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emma@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Grade 5 piano, preparing for exam..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingStudent ? 'Update' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
