import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface DeletionBlock {
  reason: string;
  entityType: string;
  count: number;
  details?: string;
}

export interface DeletionCheckResult {
  canDelete: boolean;
  blocks: DeletionBlock[];
  warnings: string[];
}

/**
 * Hook for checking if an entity can be safely deleted
 * Returns blocking reasons and warnings
 */
export function useDeleteValidation() {
  const { currentOrg } = useOrg();

  /**
   * Check if a student can be deleted
   */
  const checkStudentDeletion = async (studentId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for future lessons (warn, don't block — soft-delete will remove participations)
    const now = new Date().toISOString();
    const { count: futureLessonCount, error: flErr } = await supabase
      .from('lesson_participants')
      .select('lesson:lessons!inner(id)', { count: 'exact' })
      .eq('student_id', studentId)
      .eq('org_id', currentOrg.id)
      .gte('lesson.start_at', now)
      .eq('lesson.status', 'scheduled');
    if (flErr) throw flErr;

    const upcomingCount = futureLessonCount || 0;
    if (upcomingCount > 0) {
      warnings.push(`This student has ${upcomingCount} upcoming lesson${upcomingCount > 1 ? 's' : ''}. They will be removed from these lessons.`);
    }

    // Check for unpaid invoices (warn, don't block)
    const { count: invoiceCount, error: invErr } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payer_student_id', studentId)
      .eq('org_id', currentOrg.id)
      .in('status', ['sent', 'overdue']);
    if (invErr) throw invErr;

    if (invoiceCount && invoiceCount > 0) {
      warnings.push(`Student has ${invoiceCount} unpaid invoice${invoiceCount > 1 ? 's' : ''} totalling outstanding balance. These invoices will remain on record.`);
    }

    // Check for unredeemed credits
    const { count: creditCount, error: crErr } = await supabase
      .from('make_up_credits')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('org_id', currentOrg.id)
      .is('redeemed_at', null);
    if (crErr) throw crErr;

    if (creditCount && creditCount > 0) {
      warnings.push(`Student has ${creditCount} unredeemed make-up credit${creditCount > 1 ? 's' : ''} that will be lost.`);
    }

    return {
      canDelete: true,
      blocks,
      warnings,
    };
  };

  /**
   * Check if a guardian can be deleted
   */
  const checkGuardianDeletion = async (guardianId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for unpaid invoices where this guardian is the payer
    const { count: invoiceCount, error: invErr } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payer_guardian_id', guardianId)
      .eq('org_id', currentOrg.id)
      .in('status', ['sent', 'overdue']);
    if (invErr) throw invErr;

    if (invoiceCount && invoiceCount > 0) {
      blocks.push({
        reason: `Guardian is the payer on ${invoiceCount} unpaid invoice${invoiceCount > 1 ? 's' : ''}`,
        entityType: 'invoices',
        count: invoiceCount,
        details: 'Reassign these invoices to another guardian or mark as paid/void.',
      });
    }

    // Check if this is the only guardian for any students
    const { data: linkedStudents, error: lsErr } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_id', guardianId);
    if (lsErr) throw lsErr;

    if (linkedStudents) {
      for (const link of linkedStudents) {
        const { count: otherGuardians, error: ogErr } = await supabase
          .from('student_guardians')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', link.student_id)
          .neq('guardian_id', guardianId);
        if (ogErr) throw ogErr;

        if (!otherGuardians || otherGuardians === 0) {
          const { data: student, error: sErr } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', link.student_id)
            .single();
          if (sErr) throw sErr;

          if (student) {
            warnings.push(`${student.first_name} ${student.last_name} will have no remaining guardians.`);
          }
        }
      }
    }

    return {
      canDelete: blocks.length === 0,
      blocks,
      warnings,
    };
  };

  /**
   * Check if a teacher can be removed from the org
   * @param teacherId - The teacher's ID from the teachers table (not auth user id)
   */
  const checkTeacherRemoval = async (teacherId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for future lessons using teacher_id
    const now = new Date().toISOString();
    
    const { count: totalLessonCount, error: tlErr } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');
    if (tlErr) throw tlErr;

    if (totalLessonCount != null && totalLessonCount > 0) {
      warnings.push(`Teacher has ${totalLessonCount} upcoming lesson${totalLessonCount > 1 ? 's' : ''}. You'll be able to reassign or cancel them in the next step.`);
    }

    // Check for assigned students using teacher_id
    const { count: assignmentCount, error: acErr } = await supabase
      .from('student_teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('org_id', currentOrg.id);
    if (acErr) throw acErr;

    if (assignmentCount && assignmentCount > 0) {
      warnings.push(`${assignmentCount} student${assignmentCount > 1 ? 's' : ''} will be unassigned from this teacher.`);
    }

    return {
      canDelete: blocks.length === 0,
      blocks,
      warnings,
    };
  };

  /**
   * Check if a location can be deleted
   */
  const checkLocationDeletion = async (locationId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for future lessons at this location
    const now = new Date().toISOString();
    const { count: lessonCount, error: lcErr } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');
    if (lcErr) throw lcErr;

    if (lessonCount && lessonCount > 0) {
      blocks.push({
        reason: `Location has ${lessonCount} upcoming lesson${lessonCount > 1 ? 's' : ''} scheduled`,
        entityType: 'lessons',
        count: lessonCount,
        details: 'Move these lessons to another location before deleting.',
      });
    }

    // Check for future lessons in rooms belonging to this location
    const { data: locationRooms, error: lrErr } = await supabase
      .from('rooms')
      .select('id')
      .eq('location_id', locationId);
    if (lrErr) throw lrErr;

    if (locationRooms && locationRooms.length > 0) {
      const roomIds = locationRooms.map(r => r.id);
      const { count: roomLessonCount, error: rlErr } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .in('room_id', roomIds)
        .eq('org_id', currentOrg.id)
        .gte('start_at', now)
        .neq('status', 'cancelled');
      if (rlErr) throw rlErr;

      if (roomLessonCount && roomLessonCount > 0) {
        blocks.push({
          reason: `Rooms at this location have ${roomLessonCount} upcoming lesson${roomLessonCount > 1 ? 's' : ''} scheduled`,
          entityType: 'lessons',
          count: roomLessonCount,
          details: 'Reassign these lessons to other rooms before deleting this location.',
        });
      }
    }

    // Check if this is the primary location
    const { data: location, error: locErr } = await supabase
      .from('locations')
      .select('is_primary')
      .eq('id', locationId)
      .single();
    if (locErr) throw locErr;

    if (location?.is_primary) {
      warnings.push('This is the primary location. Another location will need to be set as primary.');
    }

    return {
      canDelete: blocks.length === 0,
      blocks,
      warnings,
    };
  };

  /**
   * Check if a room can be deleted
   */
  const checkRoomDeletion = async (roomId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for future lessons in this room
    const now = new Date().toISOString();
    const { count: lessonCount, error: lcErr } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');
    if (lcErr) throw lcErr;

    if (lessonCount && lessonCount > 0) {
      blocks.push({
        reason: `Room has ${lessonCount} upcoming lesson${lessonCount > 1 ? 's' : ''} scheduled`,
        entityType: 'lessons',
        count: lessonCount,
        details: 'Move these lessons to another room before deleting.',
      });
    }

    return {
      canDelete: blocks.length === 0,
      blocks,
      warnings,
    };
  };

  return {
    checkStudentDeletion,
    checkGuardianDeletion,
    checkTeacherRemoval,
    checkLocationDeletion,
    checkRoomDeletion,
  };
}
