import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Phone, Calendar, Edit, Trash2, Plus, UserPlus, MessageSquare, Send, Receipt } from 'lucide-react';
import { useStudentMessages } from '@/hooks/useMessages';
import { MessageList } from '@/components/messages/MessageList';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { TeacherAssignmentsPanel } from '@/components/students/TeacherAssignmentsPanel';
import { MakeUpCreditsPanel } from '@/components/students/MakeUpCreditsPanel';
import { CreditBalanceBadge } from '@/components/students/CreditBalanceBadge';
import { useStudentLessons, useStudentInvoices } from '@/hooks/useStudentDetail';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';

type StudentStatus = 'active' | 'inactive';
type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  notes: string | null;
  status: StudentStatus;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface StudentGuardian {
  id: string;
  guardian_id: string;
  relationship: RelationshipType;
  is_primary_payer: boolean;
  guardian?: Guardian;
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [guardians, setGuardians] = useState<StudentGuardian[]>([]);
  const [allGuardians, setAllGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuardianDialogOpen, setIsGuardianDialogOpen] = useState(false);
  
  // Edit form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  
  // Guardian form
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('guardian');
  const [isPrimaryPayer, setIsPrimaryPayer] = useState(false);
  const [isNewGuardian, setIsNewGuardian] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedGuardianForMessage, setSelectedGuardianForMessage] = useState<Guardian | null>(null);
  
  // Data hooks
  const { data: messages, isLoading: messagesLoading } = useStudentMessages(id);
  const { data: studentLessons, isLoading: lessonsLoading } = useStudentLessons(id);
  const { data: studentInvoices, isLoading: invoicesLoading } = useStudentInvoices(id);

  const fetchStudent = async () => {
    if (!id || !currentOrg) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .eq('org_id', currentOrg.id)
      .maybeSingle();
    
    if (error || !data) {
      toast({ title: 'Student not found', variant: 'destructive' });
      navigate('/students');
      return;
    }
    
    setStudent(data as Student);
    setFirstName(data.first_name);
    setLastName(data.last_name);
    setEmail(data.email || '');
    setPhone(data.phone || '');
    setDob(data.dob || '');
    setNotes(data.notes || '');
    setIsLoading(false);
  };

  const fetchGuardians = async () => {
    if (!id || !currentOrg) return;
    
    const { data } = await supabase
      .from('student_guardians')
      .select(`*, guardian:guardians(*)`)
      .eq('student_id', id);
    
    setGuardians((data || []).map((sg: any) => ({
      ...sg,
      guardian: sg.guardian as Guardian
    })));
    
    const { data: allG } = await supabase
      .from('guardians')
      .select('*')
      .eq('org_id', currentOrg.id);
    
    setAllGuardians((allG || []) as Guardian[]);
  };

  useEffect(() => {
    fetchStudent();
    fetchGuardians();
  }, [id, currentOrg?.id]);

  const handleSave = async () => {
    if (!student) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from('students')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        dob: dob || null,
        notes: notes.trim() || null,
      })
      .eq('id', student.id);
    
    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student updated' });
      setIsEditing(false);
      fetchStudent();
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!student) return;
    const { error } = await supabase.from('students').delete().eq('id', student.id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student deleted' });
      navigate('/students');
    }
  };

  const handleAddGuardian = async () => {
    if (!student || !currentOrg) return;
    setIsSaving(true);
    
    let guardianId = selectedGuardianId;
    
    if (isNewGuardian) {
      if (!newGuardianName.trim()) {
        toast({ title: 'Name required', variant: 'destructive' });
        setIsSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from('guardians')
        .insert({
          org_id: currentOrg.id,
          full_name: newGuardianName.trim(),
          email: newGuardianEmail.trim() || null,
          phone: newGuardianPhone.trim() || null,
        })
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error creating guardian', description: error.message, variant: 'destructive' });
        setIsSaving(false);
        return;
      }
      guardianId = data.id;
    }
    
    if (!guardianId) {
      toast({ title: 'Select a guardian', variant: 'destructive' });
      setIsSaving(false);
      return;
    }
    
    const { error } = await supabase
      .from('student_guardians')
      .insert({
        org_id: currentOrg.id,
        student_id: student.id,
        guardian_id: guardianId,
        relationship,
        is_primary_payer: isPrimaryPayer,
      });
    
    if (error) {
      toast({ title: 'Error linking guardian', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Guardian added' });
      setIsGuardianDialogOpen(false);
      resetGuardianForm();
      fetchGuardians();
    }
    setIsSaving(false);
  };

  const resetGuardianForm = () => {
    setSelectedGuardianId('');
    setNewGuardianName('');
    setNewGuardianEmail('');
    setNewGuardianPhone('');
    setRelationship('guardian');
    setIsPrimaryPayer(false);
    setIsNewGuardian(false);
  };

  const removeGuardian = async (sgId: string) => {
    const { error } = await supabase.from('student_guardians').delete().eq('id', sgId);
    if (error) {
      toast({ title: 'Error removing guardian', description: error.message, variant: 'destructive' });
    } else {
      fetchGuardians();
    }
  };

  if (isLoading || !student) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <AppLayout>
      <PageHeader
        title={fullName}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Students', href: '/students' },
          { label: fullName },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
              <Edit className="mr-2 h-4 w-4" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {isOrgAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete student?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {fullName} and all their records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="lessons">Lesson History</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Information</CardTitle>
                  <CardDescription>Personal details and contact information</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <CreditBalanceBadge studentId={student.id} />
                  <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {student.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{student.email}</span>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{student.phone}</span>
                      </div>
                    )}
                    {student.dob && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(student.dob).toLocaleDateString('en-GB')}</span>
                      </div>
                    )}
                  </div>
                  {student.notes && (
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-sm">{student.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers">
          <TeacherAssignmentsPanel studentId={id!} />
        </TabsContent>

        <TabsContent value="guardians">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Guardians</CardTitle>
                <CardDescription>Parents and guardians linked to this student</CardDescription>
              </div>
              <Button onClick={() => setIsGuardianDialogOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Guardian
              </Button>
            </CardHeader>
            <CardContent>
              {guardians.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <UserPlus className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">No guardians linked</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add a parent or guardian for billing and communication.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {guardians.map((sg) => (
                    <div key={sg.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sg.guardian?.full_name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{sg.relationship}</Badge>
                          {sg.is_primary_payer && <Badge className="text-xs">Primary Payer</Badge>}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          {sg.guardian?.email && <span>{sg.guardian.email}</span>}
                          {sg.guardian?.phone && <span>{sg.guardian.phone}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeGuardian(sg.id)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons">
          <Card>
            <CardHeader>
              <CardTitle>Lesson History</CardTitle>
              <CardDescription>Past and upcoming lessons</CardDescription>
            </CardHeader>
            <CardContent>
              {lessonsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !studentLessons?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">No lessons yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Schedule a lesson to see it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentLessons.map((sl) => (
                    <div key={sl.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatDateUK(sl.lesson.start_time)} at {formatTimeUK(sl.lesson.start_time)}
                          </span>
                          <Badge variant={
                            sl.lesson.status === 'completed' ? 'default' :
                            sl.lesson.status === 'cancelled' ? 'destructive' :
                            sl.lesson.status === 'scheduled' ? 'secondary' : 'outline'
                          }>
                            {sl.lesson.status}
                          </Badge>
                          {sl.attendance_status && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {sl.attendance_status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          {sl.lesson.subject && <span>{sl.lesson.subject}</span>}
                          {sl.lesson.teacher_name && <span>with {sl.lesson.teacher_name}</span>}
                          {sl.lesson.location_name && <span>@ {sl.lesson.location_name}</span>}
                        </div>
                      </div>
                      <Link to="/calendar">
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Billing history for this student</CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !studentInvoices?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">No invoices yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Invoices will appear here when created.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inv.invoice_number}</span>
                          <Badge variant={
                            inv.status === 'paid' ? 'default' :
                            inv.status === 'overdue' ? 'destructive' :
                            inv.status === 'sent' ? 'secondary' : 'outline'
                          }>
                            {inv.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>{formatCurrencyMinor(inv.total_amount_pence)}</span>
                          {inv.due_date && <span>Due: {formatDateUK(inv.due_date)}</span>}
                          {inv.payer_name && <span>Payer: {inv.payer_name}</span>}
                        </div>
                      </div>
                      <Link to={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <MakeUpCreditsPanel studentId={student.id} studentName={fullName} />
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Lesson notes and progress observations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center py-8 text-center">
                <p className="font-medium">No notes yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add notes after lessons to track progress.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Messages</CardTitle>
                <CardDescription>Communication history with guardians</CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  // Find a guardian with email to message
                  const guardianWithEmail = guardians.find(sg => sg.guardian?.email);
                  if (guardianWithEmail?.guardian) {
                    setSelectedGuardianForMessage(guardianWithEmail.guardian);
                    setComposeOpen(true);
                  } else {
                    setComposeOpen(true);
                  }
                }}
              >
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </CardHeader>
            <CardContent>
              {guardians.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">Add a guardian first</p>
                  <p className="mt-1 text-sm text-muted-foreground">Link a guardian with an email to send messages.</p>
                </div>
              ) : (
                <MessageList
                  messages={messages || []}
                  isLoading={messagesLoading}
                  emptyMessage="No messages sent to this student's guardians yet."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compose Message Modal */}
      <ComposeMessageModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        guardians={guardians.filter(sg => sg.guardian?.email).map(sg => sg.guardian!)}
        preselectedGuardian={selectedGuardianForMessage || undefined}
        studentId={student.id}
        studentName={fullName}
      />

      {/* Add Guardian Dialog */}
      <Dialog open={isGuardianDialogOpen} onOpenChange={setIsGuardianDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guardian</DialogTitle>
            <DialogDescription>Link a parent or guardian to this student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button variant={isNewGuardian ? 'outline' : 'default'} onClick={() => setIsNewGuardian(false)} className="flex-1">
                Existing Guardian
              </Button>
              <Button variant={isNewGuardian ? 'default' : 'outline'} onClick={() => setIsNewGuardian(true)} className="flex-1">
                New Guardian
              </Button>
            </div>
            
            {isNewGuardian ? (
              <>
                <div className="space-y-2">
                  <Label>Full name *</Label>
                  <Input value={newGuardianName} onChange={(e) => setNewGuardianName(e.target.value)} placeholder="Sarah Wilson" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newGuardianEmail} onChange={(e) => setNewGuardianEmail(e.target.value)} placeholder="sarah@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" value={newGuardianPhone} onChange={(e) => setNewGuardianPhone(e.target.value)} placeholder="+44 7700 900000" />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Select guardian</Label>
                <Select value={selectedGuardianId} onValueChange={setSelectedGuardianId}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {allGuardians.filter(g => !guardians.some(sg => sg.guardian_id === g.id)).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select value={relationship} onValueChange={(v) => setRelationship(v as RelationshipType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary payer?</Label>
                <Select value={isPrimaryPayer ? 'yes' : 'no'} onValueChange={(v) => setIsPrimaryPayer(v === 'yes')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsGuardianDialogOpen(false); resetGuardianForm(); }}>Cancel</Button>
            <Button onClick={handleAddGuardian} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : 'Add Guardian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
