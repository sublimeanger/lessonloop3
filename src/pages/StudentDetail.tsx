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
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Phone, Calendar, Edit, Trash2, Plus, UserPlus, MessageSquare, Send, Receipt, Music, Copy } from 'lucide-react';
import { useStudentMessages } from '@/hooks/useMessages';
import { MessageList } from '@/components/messages/MessageList';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { TeacherAssignmentsPanel } from '@/components/students/TeacherAssignmentsPanel';
import { MakeUpCreditsPanel } from '@/components/students/MakeUpCreditsPanel';
import { CreditBalanceBadge } from '@/components/students/CreditBalanceBadge';
import { StudentPracticePanel } from '@/components/students/StudentPracticePanel';
import { useStudentLessons, useStudentInvoices } from '@/hooks/useStudentDetail';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';
import { TeachingDefaultsCard } from '@/components/students/TeachingDefaultsCard';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';

type StudentStatus = 'active' | 'inactive';
type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';

interface GuardianInviteStatus {
  guardianId: string;
  inviteId: string | null;
  inviteStatus: 'none' | 'pending' | 'expired' | 'accepted';
  expiresAt?: string;
  token?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  notes: string | null;
  status: StudentStatus;
  default_location_id: string | null;
  default_teacher_user_id: string | null;
  default_teacher_id: string | null;
  default_rate_card_id: string | null;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState<DeletionCheckResult | null>(null);
  const [isDeleteChecking, setIsDeleteChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { checkStudentDeletion } = useDeleteValidation();
  
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
  const [invitingGuardianId, setInvitingGuardianId] = useState<string | null>(null);
  const [guardianInvites, setGuardianInvites] = useState<Record<string, GuardianInviteStatus>>({});
  
  // Data hooks
  const { data: messages, isLoading: messagesLoading, hasMore: messagesHasMore, loadMore: messagesLoadMore, isFetchingMore: messagesIsFetchingMore } = useStudentMessages(id);
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
      .select(`*, guardian:guardians(id, full_name, email, phone, user_id)`)
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

  const fetchGuardianInvites = async () => {
    if (!currentOrg) return;
    
    const guardianEmails = guardians
      .map(sg => sg.guardian?.email)
      .filter((email): email is string => Boolean(email));
    
    if (guardianEmails.length === 0) {
      setGuardianInvites({});
      return;
    }
    
    const { data } = await supabase
      .from('invites')
      .select('id, email, expires_at, accepted_at, token')
      .eq('org_id', currentOrg.id)
      .eq('role', 'parent')
      .in('email', guardianEmails)
      .order('created_at', { ascending: false });
    
    const inviteMap: Record<string, GuardianInviteStatus> = {};
    guardians.forEach(sg => {
      const guardian = sg.guardian;
      if (!guardian?.email) return;
      
      const invite = data?.find(i => i.email === guardian.email);
      if (!invite) {
        inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: null, inviteStatus: 'none' };
      } else if (invite.accepted_at) {
        inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'accepted' };
      } else if (new Date(invite.expires_at) < new Date()) {
        inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'expired', expiresAt: invite.expires_at };
      } else {
        inviteMap[guardian.id] = { guardianId: guardian.id, inviteId: invite.id, inviteStatus: 'pending', expiresAt: invite.expires_at, token: invite.token };
      }
    });
    
    setGuardianInvites(inviteMap);
  };

  const handleCopyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: 'Invite link copied to clipboard' });
  };

  useEffect(() => {
    fetchStudent();
    fetchGuardians();
  }, [id, currentOrg?.id]);

  useEffect(() => {
    if (guardians.length > 0) {
      fetchGuardianInvites();
    }
  }, [guardians, currentOrg?.id]);

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

  const handleDeleteClick = async () => {
    if (!student) return;
    setDeleteDialogOpen(true);
    setIsDeleteChecking(true);
    setDeleteCheckResult(null);
    const result = await checkStudentDeletion(student.id);
    setDeleteCheckResult(result);
    setIsDeleteChecking(false);
  };

  const handleConfirmDelete = async () => {
    if (!student || !currentOrg) return;
    setIsDeleting(true);

    try {
      // 1. Remove lesson_participants for FUTURE scheduled lessons only (keep historical)
      const now = new Date().toISOString();
      const { data: futureLessonIds } = await supabase
        .from('lesson_participants')
        .select('id, lesson:lessons!inner(id, start_at, status)')
        .eq('student_id', student.id)
        .eq('org_id', currentOrg.id)
        .gte('lesson.start_at', now)
        .eq('lesson.status', 'scheduled');

      if (futureLessonIds && futureLessonIds.length > 0) {
        const idsToDelete = futureLessonIds.map(lp => lp.id);
        await supabase
          .from('lesson_participants')
          .delete()
          .in('id', idsToDelete);
      }

      // 2. Soft-delete: set deleted_at and status to inactive
      const { error } = await supabase
        .from('students')
        .update({ deleted_at: now, status: 'inactive' })
        .eq('id', student.id);

      if (error) {
        toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Student archived', description: `${student.first_name} ${student.last_name} has been soft-deleted. Historical records preserved.` });
        navigate('/students');
      }
    } catch (err: any) {
      toast({ title: 'Error deleting', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
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

  const handleInviteGuardian = async (guardian: Guardian, existingInviteId?: string) => {
    if (!guardian.email || !currentOrg || !student) return;
    setInvitingGuardianId(guardian.id);

    try {
      // If resending, delete the old invite first
      if (existingInviteId) {
        await supabase
          .from('invites')
          .delete()
          .eq('id', existingInviteId);
      }

      // Create new invite record
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .insert({
          org_id: currentOrg.id,
          email: guardian.email,
          role: 'parent' as const,
          related_student_id: student.id,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send invite email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          inviteId: invite.id,
          guardianId: guardian.id,
        },
      });

      if (emailError) {
        console.error('Email error:', emailError);
        // Don't fail - invite was created
      }

      toast({
        title: existingInviteId ? 'Invite resent' : 'Invite sent',
        description: `Portal invite sent to ${guardian.full_name} at ${guardian.email}`,
      });

      fetchGuardians();
    } catch (error: any) {
      toast({
        title: 'Error sending invite',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setInvitingGuardianId(null);
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
              <Button variant="destructive" size="icon" onClick={handleDeleteClick}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="practice" className="gap-1.5">
            <Music className="h-3.5 w-3.5" />
            Practice
          </TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionErrorBoundary name="Overview">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          
          {/* Teaching Defaults Card */}
          <div className="mt-6">
            <TeachingDefaultsCard
              studentId={student.id}
              defaultLocationId={student.default_location_id}
              defaultTeacherId={student.default_teacher_id}
              defaultRateCardId={student.default_rate_card_id}
              onUpdate={fetchStudent}
              readOnly={!isOrgAdmin}
            />
          </div>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="teachers">
          <SectionErrorBoundary name="Teacher Assignments">
            <TeacherAssignmentsPanel studentId={id!} />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="guardians">
          <SectionErrorBoundary name="Guardians">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Guardians</CardTitle>
                <CardDescription>Parents and guardians linked to this student</CardDescription>
              </div>
              {isOrgAdmin && (
                <Button onClick={() => setIsGuardianDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Guardian
                </Button>
              )}
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
                          {sg.guardian?.user_id && (
                            <Badge variant="secondary" className="text-xs">Portal Access</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          {sg.guardian?.email && <span>{sg.guardian.email}</span>}
                          {sg.guardian?.phone && <span>{sg.guardian.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Invite status and actions */}
                        {isOrgAdmin && !sg.guardian?.user_id && sg.guardian?.email && (() => {
                          const inviteStatus = guardianInvites[sg.guardian.id];
                          const isInviting = invitingGuardianId === sg.guardian.id;
                          
                          if (!inviteStatus || inviteStatus.inviteStatus === 'none') {
                            // No invite sent yet
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleInviteGuardian(sg.guardian!)}
                                disabled={isInviting}
                                className="gap-1"
                              >
                                {isInviting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                Invite
                              </Button>
                            );
                          } else if (inviteStatus.inviteStatus === 'pending') {
                            // Invite pending
                            return (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">Invite Pending</Badge>
                                {inviteStatus.token && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyInviteLink(inviteStatus.token!)}
                                    className="gap-1 text-xs"
                                  >
                                    <Copy className="h-3 w-3" />
                                    Copy Link
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleInviteGuardian(sg.guardian!, inviteStatus.inviteId!)}
                                  disabled={isInviting}
                                  className="gap-1 text-xs"
                                >
                                  {isInviting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                  Resend
                                </Button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {isOrgAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => removeGuardian(sg.id)}>Remove</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="lessons">
          <SectionErrorBoundary name="Lessons">
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
                            {formatDateUK(sl.lesson.start_at)} at {formatTimeUK(sl.lesson.start_at)}
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
                          {sl.lesson.title && <span>{sl.lesson.title}</span>}
                          {sl.lesson.teacher_name && <span>with {sl.lesson.teacher_name}</span>}
                          {sl.lesson.location_name && <span>@ {sl.lesson.location_name}</span>}
                        </div>
                      </div>
                      <Link to={`/calendar?date=${sl.lesson.start_at.split('T')[0]}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="invoices">
          <SectionErrorBoundary name="Invoices">
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
                          <span>{formatCurrencyMinor(inv.total_minor)}</span>
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
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="practice">
          <SectionErrorBoundary name="Practice">
            <StudentPracticePanel studentId={student.id} studentName={fullName} />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="credits">
          <SectionErrorBoundary name="Credits">
            <MakeUpCreditsPanel studentId={student.id} studentName={fullName} />
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="notes">
          <SectionErrorBoundary name="Notes">
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
          </SectionErrorBoundary>
        </TabsContent>

        <TabsContent value="messages">
          <SectionErrorBoundary name="Messages">
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
                  hasMore={messagesHasMore}
                  onLoadMore={() => messagesLoadMore()}
                  isFetchingMore={messagesIsFetchingMore}
                />
              )}
            </CardContent>
          </Card>
          </SectionErrorBoundary>
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Delete validation dialog */}
      <DeleteValidationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        entityName={fullName}
        entityType="Student"
        checkResult={deleteCheckResult}
        isLoading={isDeleteChecking}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </AppLayout>
  );
}
