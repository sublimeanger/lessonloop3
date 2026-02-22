import { useMemo } from 'react';
import { format, addWeeks, isSameDay } from 'date-fns';
import { useClosureDates, ClosureDateInfo } from './useClosureDates';

interface ClosureConflict {
  date: Date;
  reason: string;
  lessonNumber: number;
}

interface UseClosurePatternCheckResult {
  conflicts: ClosureConflict[];
  totalLessons: number;
  conflictCount: number;
  hasConflicts: boolean;
  warningMessage: string | null;
}

/**
 * Checks a recurring lesson series against closure dates
 * Returns conflicts that need user attention before creating the series
 */
export function useClosurePatternCheck(
  startDate: Date | null,
  intervalWeeks: number,
  totalLessons: number,
  locationId: string | null
): UseClosurePatternCheckResult {
  // Compute the date range for the series
  const endDate = useMemo(
    () => startDate && totalLessons > 0 ? addWeeks(startDate, totalLessons * intervalWeeks) : undefined,
    [startDate, totalLessons, intervalWeeks]
  );

  const { closures } = useClosureDates(startDate ?? undefined, endDate);

  const result = useMemo<UseClosurePatternCheckResult>(() => {
    if (!startDate || !closures || totalLessons <= 0) {
      return { conflicts: [], totalLessons: 0, conflictCount: 0, hasConflicts: false, warningMessage: null };
    }

    const conflicts: ClosureConflict[] = [];

    for (let i = 0; i < totalLessons; i++) {
      const lessonDate = addWeeks(startDate, i * intervalWeeks);
      for (const closure of closures) {
        if (isSameDay(lessonDate, closure.date)) {
          const appliesToThisLesson =
            closure.applies_to_all_locations ||
            !locationId ||
            closure.location_id === locationId;
          if (appliesToThisLesson) {
            conflicts.push({ date: lessonDate, reason: closure.reason, lessonNumber: i + 1 });
          }
        }
      }
    }

    const conflictCount = conflicts.length;
    const hasConflicts = conflictCount > 0;
    let warningMessage: string | null = null;
    if (hasConflicts) {
      warningMessage = conflictCount === 1
        ? `1 lesson falls on a closure date (${conflicts[0].reason})`
        : `${conflictCount} of ${totalLessons} lessons fall on closure dates`;
    }

    return { conflicts, totalLessons, conflictCount, hasConflicts, warningMessage };
  }, [startDate, intervalWeeks, totalLessons, locationId, closures]);

  return result;
}

/**
 * Formats closure conflicts for display
 */
export function formatClosureConflicts(conflicts: ClosureConflict[]): string {
  if (conflicts.length === 0) return '';
  return conflicts.map(c =>
    `• Lesson ${c.lessonNumber} on ${format(c.date, 'EEE, d MMM yyyy')}: ${c.reason}`
  ).join('\n');
}
