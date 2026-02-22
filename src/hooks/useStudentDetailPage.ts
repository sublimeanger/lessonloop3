import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { useStudentMessages } from '@/hooks/useMessages';
import { useStudentLessons, useStudentInvoices } from '@/hooks/useStudentDetail';

export type StudentStatus = 'active' | 'inactive';
export type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';

export interface GuardianInviteStatus {
  guardianId: string;
  inviteId: string | null;
  inviteStatus: 'none' | 'pending' | 'expired' | 'accepted';
  expiresAt?: string;
  token?: string;
}

export interface Student {
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

export interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
}

export interface StudentGuardian {
  id: string;
  guardian_id: string;
  relationship: RelationshipType;
  is_primary_payer: boolean;
  guardian?: Guardian;
}

export function useStudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // React Query for student data
  const studentQuery = useQuery({
    queryKey: ['student', id, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id!)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as unknown as Student;
    },
    enabled: !!id && !!currentOrg,
    staleTime: 30_000,
  });

  const student = studentQuery.data ?? null;
  const isLoading = studentQuery.isLoading;

  // Navigate away if student not found after query settles
  useEffect(() => {
    if (!studentQuery.isLoading && studentQuery.isFetched && !student && id && currentOrg) {
      toast({ title: 'Student not found', variant: 'destructive' });
      navigate('/students');
    }
  }, [studentQuery.isLoading, studentQuery.isFetched, student, id, currentOrg]);

  // React Query for guardians
  const guardiansQuery = useQuery({
    queryKey: ['student-guardians', id, currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_guardians')
        .select(`*, guardian:guardians(id, full_name, email, phone, user_id)`)
        .eq('student_id', id!);

      const mapped = (data || []).map((sg: any) => ({
        ...sg,
        guardian: sg.guardian as Guardian,
      }));

      const { data: allG } = await supabase
        .from('guardians')
        .select('*')
        .eq('org_id', currentOrg!.id)
        .is('deleted_at', null);

      return {
        guardians: mapped as StudentGuardian[],
        allGuardians: (allG || []) as Guardian[],
      };
    },
    enabled: !!id && !!currentOrg,
    staleTime: 30_000,
  });

  const guardians = guardiansQuery.data?.guardians ?? [];
  const allGuardians = guardiansQuery.data?.allGuardians ?? [];

  // Invalidation helpers (keep API compatible for consumers)
  const invalidateStudent = () => {
    queryClient.invalidateQueries({ queryKey: ['student', id] });
  };
  const invalidateGuardians = () => {
    queryClient.invalidateQueries({ queryKey: ['student-guardians', id] });
  };

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState<DeletionCheckResult | null>(null);
  const [isDeleteChecking, setIsDeleteChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { checkStudentDeletion, checkGuardianDeletion } = useDeleteValidation();

  // Guardian delete
  const [guardianDeleteDialog, setGuardianDeleteDialog] = useState<{
    open: boolean;
    sgId: string;
    guardianName: string;
    guardianId: string;
    checkResult: DeletionCheckResult | null;
    isChecking: boolean;
    isDeleting: boolean;
  }>({ open: false, sgId: '', guardianName: '', guardianId: '', checkResult: null, isChecking: false, isDeleting: false });

  // Edit form
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');

  // Sync edit form when student data loads/changes
  useEffect(() => {
    if (student) {
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setEmail(student.email || '');
      setPhone(student.phone || '');
      setDob(student.dob || '');
      setNotes(student.notes || '');
    }
  }, [student]);

  // Guardian form
  const [isGuardianDialogOpen, setIsGuardianDialogOpen] = useState(false);
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('guardian');
  const [isPrimaryPayer, setIsPrimaryPayer] = useState(false);
  const [isNewGuardian, setIsNewGuardian] = useState(false);

  // Edit guardian state
  const [editGuardianDialog, setEditGuardianDialog] = useState<{
    open: boolean;
    guardianId: string;
    fullName: string;
    email: string;
    phone: string;
  }>({ open: false, guardianId: '', fullName: '', email: '', phone: '' });
  const [isEditGuardianSaving, setIsEditGuardianSaving] = useState(false);

  // Message state
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedGuardianForMessage, setSelectedGuardianForMessage] = useState<Guardian | null>(null);

  // Invite state
  const [invitingGuardianId, setInvitingGuardianId] = useState<string | null>(null);
  const [guardianInvites, setGuardianInvites] = useState<Record<string, GuardianInviteStatus>>({});

  // Data hooks
  const { data: messages, isLoading: messagesLoading, hasMore: messagesHasMore, loadMore: messagesLoadMore, isFetchingMore: messagesIsFetchingMore } = useStudentMessages(id);
  const lessonsQuery = useStudentLessons(id);
  const studentLessons = lessonsQuery.data?.pages.flatMap(p => p.items) ?? [];
  const lessonsLoading = lessonsQuery.isLoading;
  const lessonsHasMore = lessonsQuery.hasNextPage ?? false;
  const lessonsLoadMore = () => lessonsQuery.fetchNextPage();
  const lessonsIsFetchingMore = lessonsQuery.isFetchingNextPage;
  const { data: studentInvoices, isLoading: invoicesLoading } = useStudentInvoices(id);

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
    if (guardians.length > 0) {
      fetchGuardianInvites();
    }
  }, [guardians, currentOrg?.id]);

  const handleSave = async () => {
    if (!student) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'First and last name cannot be empty.', variant: 'destructive' });
      return;
    }
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
      .eq('id', student.id)
      .eq('org_id', currentOrg!.id);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Student updated' });
      setIsEditing(false);
      invalidateStudent();
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

      const { error } = await supabase
        .from('students')
        .update({ deleted_at: now, status: 'inactive' })
        .eq('id', student.id)
        .eq('org_id', currentOrg.id);

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

  const resetGuardianForm = () => {
    setSelectedGuardianId('');
    setNewGuardianName('');
    setNewGuardianEmail('');
    setNewGuardianPhone('');
    setRelationship('guardian');
    setIsPrimaryPayer(false);
    setIsNewGuardian(false);
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

    // If marking as primary payer, clear any existing primary payer first
    if (isPrimaryPayer) {
      await supabase
        .from('student_guardians')
        .update({ is_primary_payer: false })
        .eq('student_id', student.id)
        .eq('org_id', currentOrg.id);
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
      invalidateGuardians();
    }
    setIsSaving(false);
  };

  const initiateGuardianRemoval = async (sg: StudentGuardian) => {
    if (!sg.guardian) return;
    setGuardianDeleteDialog({
      open: true,
      sgId: sg.id,
      guardianName: sg.guardian.full_name,
      guardianId: sg.guardian_id,
      checkResult: null,
      isChecking: true,
      isDeleting: false,
    });
    const result = await checkGuardianDeletion(sg.guardian_id);
    setGuardianDeleteDialog(prev => ({ ...prev, checkResult: result, isChecking: false }));
  };

  const confirmGuardianRemoval = async () => {
    setGuardianDeleteDialog(prev => ({ ...prev, isDeleting: true }));
    const guardianId = guardianDeleteDialog.guardianId;
    const { error } = await supabase.from('student_guardians').delete().eq('id', guardianDeleteDialog.sgId);
    if (error) {
      toast({ title: 'Error removing guardian', description: error.message, variant: 'destructive' });
    } else {
      // Check if guardian is now orphaned (no remaining student links)
      const { count } = await supabase
        .from('student_guardians')
        .select('id', { count: 'exact', head: true })
        .eq('guardian_id', guardianId);

      if (count === 0) {
        // Soft-delete orphaned guardian
        await supabase
          .from('guardians')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', guardianId);
        toast({ title: 'Guardian removed', description: 'Guardian record archived (no remaining student links).' });
      } else {
        toast({ title: 'Guardian unlinked' });
      }
      invalidateGuardians();
    }
    setGuardianDeleteDialog(prev => ({ ...prev, open: false, isDeleting: false }));
  };

  const handleInviteGuardian = async (guardian: Guardian, existingInviteId?: string) => {
    if (!guardian.email || !currentOrg || !student) return;
    setInvitingGuardianId(guardian.id);

    try {
      if (existingInviteId) {
        await supabase.from('invites').delete().eq('id', existingInviteId);
      }

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

      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: { inviteId: invite.id, guardianId: guardian.id },
      });

      if (emailError) {
        logger.error('Email error:', emailError);
      }

      toast({
        title: existingInviteId ? 'Invite resent' : 'Invite sent',
        description: `Portal invite sent to ${guardian.full_name} at ${guardian.email}`,
      });

      invalidateGuardians();
    } catch (error: any) {
      toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
    } finally {
      setInvitingGuardianId(null);
    }
  };

  const handleEditGuardian = (guardian: Guardian) => {
    setEditGuardianDialog({
      open: true,
      guardianId: guardian.id,
      fullName: guardian.full_name,
      email: guardian.email || '',
      phone: guardian.phone || '',
    });
  };

  const handleSaveGuardianEdit = async () => {
    if (!currentOrg || !editGuardianDialog.guardianId) return;
    setIsEditGuardianSaving(true);
    try {
      const { error } = await supabase
        .from('guardians')
        .update({
          full_name: editGuardianDialog.fullName.trim(),
          email: editGuardianDialog.email.trim() || null,
          phone: editGuardianDialog.phone.trim() || null,
        })
        .eq('id', editGuardianDialog.guardianId)
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      toast({ title: 'Guardian updated', description: 'Contact details have been saved.' });
      setEditGuardianDialog(prev => ({ ...prev, open: false }));
      invalidateGuardians();
    } catch (error: any) {
      toast({ title: 'Error updating guardian', description: error.message, variant: 'destructive' });
    } finally {
      setIsEditGuardianSaving(false);
    }
  };

  const fullName = student ? `${student.first_name} ${student.last_name}` : '';

  return {
    id,
    student,
    fullName,
    isLoading,
    isOrgAdmin,

    // Edit state
    isEditing, setIsEditing,
    isSaving,
    firstName, setFirstName,
    lastName, setLastName,
    email, setEmail,
    phone, setPhone,
    dob, setDob,
    notes, setNotes,
    handleSave,

    // Delete state
    deleteDialogOpen, setDeleteDialogOpen,
    deleteCheckResult,
    isDeleteChecking,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,

    // Guardian state
    guardians,
    allGuardians,
    isGuardianDialogOpen, setIsGuardianDialogOpen,
    selectedGuardianId, setSelectedGuardianId,
    newGuardianName, setNewGuardianName,
    newGuardianEmail, setNewGuardianEmail,
    newGuardianPhone, setNewGuardianPhone,
    relationship, setRelationship,
    isPrimaryPayer, setIsPrimaryPayer,
    isNewGuardian, setIsNewGuardian,
    handleAddGuardian,
    resetGuardianForm,
    initiateGuardianRemoval,
    confirmGuardianRemoval,
    guardianDeleteDialog, setGuardianDeleteDialog,

    // Edit guardian
    editGuardianDialog, setEditGuardianDialog,
    isEditGuardianSaving,
    handleEditGuardian,
    handleSaveGuardianEdit,

    // Invite state
    invitingGuardianId,
    guardianInvites,
    handleInviteGuardian,
    handleCopyInviteLink,

    // Message state
    composeOpen, setComposeOpen,
    selectedGuardianForMessage, setSelectedGuardianForMessage,

    // Data
    messages, messagesLoading, messagesHasMore, messagesLoadMore, messagesIsFetchingMore,
    studentLessons, lessonsLoading, lessonsHasMore, lessonsLoadMore, lessonsIsFetchingMore,
    studentInvoices, invoicesLoading,

    fetchStudent: invalidateStudent,
    fetchGuardians: invalidateGuardians,
  };
}
