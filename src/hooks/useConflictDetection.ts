import { useCallback } from 'react';
import { format, getDay, differenceInMinutes, addMinutes, subMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { ConflictResult } from '@/components/calendar/types';
import type { Database } from '@/integrations/supabase/types';

type DayOfWeek = Database['public']['Enums']['day_of_week'];

const DAY_INDEX_TO_NAME: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const CONFLICT_CHECK_TIMEOUT = 10000; // 10 second timeout

interface ConflictCheckParams {
  start_at: Date;
  end_at: Date;
  teacher_user_id: string | null;
  teacher_id?: string | null; // teachers.id for unlinked teacher fallback
  room_id: string | null;
  location_id: string | null;
  student_ids: string[];
  exclude_lesson_id?: string;
}

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

export function useConflictDetection() {
  const { currentOrg } = useOrg();

  const checkConflicts = useCallback(async (params: ConflictCheckParams): Promise<ConflictResult[]> => {
    if (!currentOrg) return [];

    const conflicts: ConflictResult[] = [];
    const { start_at, end_at, teacher_user_id, teacher_id, room_id, location_id, student_ids, exclude_lesson_id } = params;

    try {
      // Run conflict checks in parallel with individual error handling
      // Each check is wrapped to prevent one failure from blocking others
      const safeCheck = async <T>(
        checkFn: () => Promise<T[]>,
        fallbackMessage: string
      ): Promise<T[]> => {
        try {
          return await checkFn();
        } catch (error) {
          console.warn(`Conflict check failed: ${fallbackMessage}`, error);
          return [];
        }
      };

      // Run all conflict checks in parallel with timeout for better performance
      const [
        closureResult,
        availabilityResult,
        timeOffResult,
        teacherLessonsResult,
        roomResult,
        externalCalendarResult,
      ] = await withTimeout(
        Promise.all([
          // Check closure dates
          safeCheck(
            () => checkClosureDates(currentOrg.id, start_at, location_id, currentOrg.block_scheduling_on_closures),
            'closure dates'
          ),
          // Check teacher availability blocks (skip if no user_id)
          teacher_user_id
            ? safeCheck(
                () => checkTeacherAvailability(currentOrg.id, teacher_user_id, start_at, end_at),
                'teacher availability'
              )
            : Promise.resolve([]),
          // Check teacher time-off (skip if no user_id)
          teacher_user_id
            ? safeCheck(
                () => checkTeacherTimeOff(currentOrg.id, teacher_user_id, start_at, end_at),
                'teacher time-off'
              )
            : Promise.resolve([]),
          // Check teacher lesson overlap with travel buffer (skip if no user_id)
          teacher_user_id
            ? safeCheck(
                () => checkTeacherLessons(
                  currentOrg.id, 
                  teacher_user_id, 
                  start_at, 
                  end_at, 
                  location_id,
                  (currentOrg as any).buffer_minutes_between_locations || 0,
                  exclude_lesson_id
                ),
                'teacher lessons'
              )
            // Fallback: check by teacher_id for unlinked teachers
            : teacher_id
              ? safeCheck(
                  () => checkTeacherLessonsByTeacherId(
                    currentOrg.id,
                    teacher_id,
                    start_at,
                    end_at,
                    exclude_lesson_id
                  ),
                  'teacher lessons (by teacher_id)'
                )
              : Promise.resolve([]),
          // Check room overlap and capacity
          room_id 
            ? safeCheck(
                () => checkRoomConflicts(currentOrg.id, room_id, start_at, end_at, student_ids, exclude_lesson_id),
                'room conflicts'
              ) 
            : Promise.resolve([]),
          // Check external calendar busy blocks (skip if no user_id)
          teacher_user_id
            ? safeCheck(
                () => checkExternalBusyBlocks(currentOrg.id, teacher_user_id, start_at, end_at),
                'external calendar'
              )
            : Promise.resolve([]),
        ]),
        CONFLICT_CHECK_TIMEOUT,
        'Conflict check timed out'
      );

      conflicts.push(
        ...closureResult, 
        ...availabilityResult, 
        ...timeOffResult, 
        ...teacherLessonsResult, 
        ...roomResult,
        ...externalCalendarResult
      );

      // Check student overlaps (can be slower, so we do it separately but still with timeout)
      if (student_ids.length > 0) {
        try {
          const studentConflicts = await withTimeout(
            checkStudentConflicts(currentOrg.id, student_ids, start_at, end_at, exclude_lesson_id),
            CONFLICT_CHECK_TIMEOUT,
            'Student conflict check timed out'
          );
          conflicts.push(...studentConflicts);
        } catch (studentError) {
          console.warn('Student conflict check failed, continuing without:', studentError);
          // Don't block - just skip student conflict checking
        }
      }

    } catch (error) {
      console.error('Conflict detection error:', error);
      // Return empty array - allow lesson creation even if conflict check completely fails
      // This is better than blocking the user entirely
      return [];
    }

    return conflicts;
  }, [currentOrg]);

  return { checkConflicts };
}

/**
 * Check for closure dates
 */
async function checkClosureDates(
  orgId: string,
  startAt: Date,
  locationId: string | null,
  blockScheduling: boolean
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];
  const lessonDate = format(startAt, 'yyyy-MM-dd');
  
  const { data: closures } = await supabase
    .from('closure_dates')
    .select('reason, location_id, applies_to_all_locations')
    .eq('org_id', orgId)
    .eq('date', lessonDate);

  if (closures && closures.length > 0) {
    const applicableClosure = closures.find(c => {
      if (c.applies_to_all_locations) return true;
      if (locationId && c.location_id === locationId) return true;
      return false;
    });

    if (applicableClosure) {
      conflicts.push({
        type: 'closure',
        severity: blockScheduling ? 'error' : 'warning',
        message: `This date is marked as closed: ${applicableClosure.reason}`,
      });
    }
  }

  return conflicts;
}

/**
 * Check teacher availability blocks
 */
async function checkTeacherAvailability(
  orgId: string,
  teacherUserId: string,
  startAt: Date,
  endAt: Date
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];
  const dayOfWeek = DAY_INDEX_TO_NAME[getDay(startAt)];
  const lessonStartTime = format(startAt, 'HH:mm:ss');
  const lessonEndTime = format(endAt, 'HH:mm:ss');

  const { data: availabilityBlocks } = await supabase
    .from('availability_blocks')
    .select('start_time_local, end_time_local')
    .eq('org_id', orgId)
    .eq('teacher_user_id', teacherUserId)
    .eq('day_of_week', dayOfWeek);

  if (availabilityBlocks && availabilityBlocks.length > 0) {
    const fitsWithinAvailability = availabilityBlocks.some(block => {
      return lessonStartTime >= block.start_time_local && lessonEndTime <= block.end_time_local;
    });

    if (!fitsWithinAvailability) {
      conflicts.push({
        type: 'availability',
        severity: 'warning',
        message: `Lesson is outside teacher's available hours on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`,
      });
    }
  }

  return conflicts;
}

/**
 * Check teacher time-off
 */
async function checkTeacherTimeOff(
  orgId: string,
  teacherUserId: string,
  startAt: Date,
  endAt: Date
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];

  const { data: timeOff } = await supabase
    .from('time_off_blocks')
    .select('id, reason')
    .eq('org_id', orgId)
    .eq('teacher_user_id', teacherUserId)
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString());

  if (timeOff && timeOff.length > 0) {
    conflicts.push({
      type: 'time_off',
      severity: 'error',
      message: `Teacher has time off during this period${timeOff[0].reason ? `: ${timeOff[0].reason}` : ''}`,
    });
  }

  return conflicts;
}

/**
 * Check teacher lesson overlaps with travel buffer
 */
async function checkTeacherLessons(
  orgId: string,
  teacherUserId: string,
  startAt: Date,
  endAt: Date,
  locationId: string | null,
  bufferMinutes: number,
  excludeLessonId?: string
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];
  
  const bufferedStart = bufferMinutes > 0 ? subMinutes(startAt, bufferMinutes) : startAt;
  const bufferedEnd = bufferMinutes > 0 ? addMinutes(endAt, bufferMinutes) : endAt;

  let query = supabase
    .from('lessons')
    .select('id, title, start_at, end_at, location_id')
    .eq('org_id', orgId)
    .eq('teacher_user_id', teacherUserId)
    .neq('status', 'cancelled')
    .lt('start_at', bufferedEnd.toISOString())
    .gt('end_at', bufferedStart.toISOString());

  if (excludeLessonId) {
    query = query.neq('id', excludeLessonId);
  }

  const { data: teacherLessons } = await query;

  if (teacherLessons && teacherLessons.length > 0) {
    const directOverlap = teacherLessons.find(l => {
      const lStart = new Date(l.start_at);
      const lEnd = new Date(l.end_at);
      return lStart < endAt && lEnd > startAt;
    });

    if (directOverlap) {
      conflicts.push({
        type: 'teacher',
        severity: 'error',
        message: `Teacher already has a lesson at this time: ${directOverlap.title}`,
      });
    } else if (bufferMinutes > 0) {
      const bufferConflict = teacherLessons.find(l => l.location_id !== locationId);
      if (bufferConflict) {
        conflicts.push({
          type: 'teacher',
          severity: 'warning',
          message: `Teacher needs ${bufferMinutes} min travel buffer between locations. Next lesson: ${bufferConflict.title}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Check room conflicts and capacity
 */
async function checkRoomConflicts(
  orgId: string,
  roomId: string,
  startAt: Date,
  endAt: Date,
  studentIds: string[],
  excludeLessonId?: string
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];

  // Get room capacity
  const { data: room } = await supabase
    .from('rooms')
    .select('name, max_capacity')
    .eq('id', roomId)
    .single();

  // Check capacity for group lessons
  if (room && room.max_capacity && studentIds.length > room.max_capacity) {
    conflicts.push({
      type: 'room',
      severity: 'error',
      message: `Room "${room.name}" has a capacity of ${room.max_capacity} students, but ${studentIds.length} are assigned`,
    });
  }

  // Check booking conflicts
  let query = supabase
    .from('lessons')
    .select('id, title, start_at, end_at')
    .eq('org_id', orgId)
    .eq('room_id', roomId)
    .neq('status', 'cancelled')
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString());

  if (excludeLessonId) {
    query = query.neq('id', excludeLessonId);
  }

  const { data: roomLessons } = await query;

  if (roomLessons && roomLessons.length > 0) {
    conflicts.push({
      type: 'room',
      severity: 'error',
      message: `Room is already booked: ${roomLessons[0].title}`,
    });
  }

  return conflicts;
}

/**
 * Check student conflicts
 */
async function checkStudentConflicts(
  orgId: string,
  studentIds: string[],
  startAt: Date,
  endAt: Date,
  excludeLessonId?: string
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];

  // Batch student checks for better performance
  const { data: participations } = await supabase
    .from('lesson_participants')
    .select(`
      student_id,
      lesson_id,
      lesson:lessons!inner(id, title, start_at, end_at, status)
    `)
    .eq('org_id', orgId)
    .in('student_id', studentIds);

  if (participations) {
    const conflictingStudents = new Set<string>();
    
    for (const p of participations) {
      const lesson = p.lesson as any;
      if (!lesson || lesson.status === 'cancelled') continue;
      if (excludeLessonId && lesson.id === excludeLessonId) continue;
      
      const lessonStart = new Date(lesson.start_at);
      const lessonEnd = new Date(lesson.end_at);
      
      if (lessonStart < endAt && lessonEnd > startAt) {
        conflictingStudents.add(p.student_id);
      }
    }

    // Get student names for conflicting students
    if (conflictingStudents.size > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', Array.from(conflictingStudents));

      if (students) {
        for (const student of students) {
          conflicts.push({
            type: 'student',
            severity: 'error',
            message: `${student.first_name} ${student.last_name} already has a lesson at this time`,
            entity_name: `${student.first_name} ${student.last_name}`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Check external calendar busy blocks
 */
async function checkExternalBusyBlocks(
  orgId: string,
  teacherUserId: string,
  startAt: Date,
  endAt: Date
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];

  const { data: busyBlocks } = await supabase
    .from('external_busy_blocks')
    .select('id, title, start_at, end_at')
    .eq('org_id', orgId)
    .eq('user_id', teacherUserId)
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString());

  if (busyBlocks && busyBlocks.length > 0) {
    // Group overlapping blocks to avoid duplicate warnings
    const overlappingBlock = busyBlocks[0];
    const title = overlappingBlock.title || 'Busy';
    
    conflicts.push({
      type: 'external_calendar',
      severity: 'warning',
      message: `Teacher has an external calendar event: ${title}`,
      entity_name: title,
    });
  }

  return conflicts;
}

/**
 * Check teacher lesson overlaps by teacher_id (for unlinked teachers without user accounts)
 */
async function checkTeacherLessonsByTeacherId(
  orgId: string,
  teacherId: string,
  startAt: Date,
  endAt: Date,
  excludeLessonId?: string
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];

  let query = supabase
    .from('lessons')
    .select('id, title, start_at, end_at')
    .eq('org_id', orgId)
    .eq('teacher_id', teacherId)
    .neq('status', 'cancelled')
    .lt('start_at', endAt.toISOString())
    .gt('end_at', startAt.toISOString());

  if (excludeLessonId) {
    query = query.neq('id', excludeLessonId);
  }

  const { data: teacherLessons } = await query;

  if (teacherLessons && teacherLessons.length > 0) {
    const directOverlap = teacherLessons.find(l => {
      const lStart = new Date(l.start_at);
      const lEnd = new Date(l.end_at);
      return lStart < endAt && lEnd > startAt;
    });

    if (directOverlap) {
      conflicts.push({
        type: 'teacher',
        severity: 'error',
        message: `Teacher already has a lesson at this time: ${directOverlap.title}`,
      });
    }
  }

  return conflicts;
}
