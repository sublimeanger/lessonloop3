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

    // Check for future lessons
    const now = new Date().toISOString();
    const { data: futureLessons, count: lessonCount } = await supabase
      .from('lesson_participants')
      .select('lesson:lessons!inner(id, title, start_at)', { count: 'exact' })
      .eq('student_id', studentId)
      .eq('org_id', currentOrg.id)
      .gte('lesson.start_at', now)
      .neq('lesson.status', 'cancelled');

    if (lessonCount && lessonCount > 0) {
      blocks.push({
        reason: `Student has ${lessonCount} upcoming lesson${lessonCount > 1 ? 's' : ''} scheduled`,
        entityType: 'lessons',
        count: lessonCount,
        details: 'Cancel or reassign these lessons before deleting the student.',
      });
    }

    // Check for unpaid invoices
    const { data: unpaidInvoices, count: invoiceCount } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_minor', { count: 'exact' })
      .eq('payer_student_id', studentId)
      .eq('org_id', currentOrg.id)
      .in('status', ['sent', 'overdue']);

    if (invoiceCount && invoiceCount > 0) {
      blocks.push({
        reason: `Student has ${invoiceCount} unpaid invoice${invoiceCount > 1 ? 's' : ''}`,
        entityType: 'invoices',
        count: invoiceCount,
        details: 'Mark invoices as paid or void before deleting the student.',
      });
    }

    // Check for unredeemed credits
    const { count: creditCount } = await supabase
      .from('make_up_credits')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('org_id', currentOrg.id)
      .is('redeemed_at', null);

    if (creditCount && creditCount > 0) {
      warnings.push(`Student has ${creditCount} unredeemed make-up credit${creditCount > 1 ? 's' : ''} that will be lost.`);
    }

    return {
      canDelete: blocks.length === 0,
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
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payer_guardian_id', guardianId)
      .eq('org_id', currentOrg.id)
      .in('status', ['sent', 'overdue']);

    if (invoiceCount && invoiceCount > 0) {
      blocks.push({
        reason: `Guardian is the payer on ${invoiceCount} unpaid invoice${invoiceCount > 1 ? 's' : ''}`,
        entityType: 'invoices',
        count: invoiceCount,
        details: 'Reassign these invoices to another guardian or mark as paid/void.',
      });
    }

    // Check if this is the only guardian for any students
    const { data: linkedStudents } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_id', guardianId);

    if (linkedStudents) {
      for (const link of linkedStudents) {
        const { count: otherGuardians } = await supabase
          .from('student_guardians')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', link.student_id)
          .neq('guardian_id', guardianId);

        if (!otherGuardians || otherGuardians === 0) {
          const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', link.student_id)
            .single();

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
   */
  const checkTeacherRemoval = async (teacherUserId: string): Promise<DeletionCheckResult> => {
    if (!currentOrg) return { canDelete: false, blocks: [{ reason: 'No organisation context', entityType: 'org', count: 0 }], warnings: [] };

    const blocks: DeletionBlock[] = [];
    const warnings: string[] = [];

    // Check for future lessons
    const now = new Date().toISOString();
    const { count: lessonCount } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_user_id', teacherUserId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');

    if (lessonCount && lessonCount > 0) {
      blocks.push({
        reason: `Teacher has ${lessonCount} upcoming lesson${lessonCount > 1 ? 's' : ''} scheduled`,
        entityType: 'lessons',
        count: lessonCount,
        details: 'Reassign these lessons to another teacher before removing.',
      });
    }

    // Check for assigned students
    const { count: assignmentCount } = await supabase
      .from('student_teacher_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_user_id', teacherUserId)
      .eq('org_id', currentOrg.id);

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
    const { count: lessonCount } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');

    if (lessonCount && lessonCount > 0) {
      blocks.push({
        reason: `Location has ${lessonCount} upcoming lesson${lessonCount > 1 ? 's' : ''} scheduled`,
        entityType: 'lessons',
        count: lessonCount,
        details: 'Move these lessons to another location before deleting.',
      });
    }

    // Check if this is the primary location
    const { data: location } = await supabase
      .from('locations')
      .select('is_primary')
      .eq('id', locationId)
      .single();

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
    const { count: lessonCount } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('org_id', currentOrg.id)
      .gte('start_at', now)
      .neq('status', 'cancelled');

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
