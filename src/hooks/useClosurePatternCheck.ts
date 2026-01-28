import { useMemo, useEffect } from 'react';
import { format, addWeeks, isSameDay, addMonths } from 'date-fns';
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
  const { closures, fetchClosures } = useClosureDates();

  // Fetch closure dates for the relevant range
  useEffect(() => {
    if (startDate && totalLessons > 0) {
      const endDate = addWeeks(startDate, totalLessons * intervalWeeks);
      fetchClosures(startDate, endDate);
    }
  }, [startDate, totalLessons, intervalWeeks, fetchClosures]);

  const result = useMemo<UseClosurePatternCheckResult>(() => {
    if (!startDate || !closures || totalLessons <= 0) {
      return {
        conflicts: [],
        totalLessons: 0,
        conflictCount: 0,
        hasConflicts: false,
        warningMessage: null,
      };
    }

    const conflicts: ClosureConflict[] = [];

    // Generate all lesson dates in the series
    for (let i = 0; i < totalLessons; i++) {
      const lessonDate = addWeeks(startDate, i * intervalWeeks);
      
      // Check against each closure date
      for (const closure of closures) {
        // Check if this lesson falls on a closure date
        if (isSameDay(lessonDate, closure.date)) {
          // Check if closure applies to this location
          const appliesToThisLesson = 
            closure.applies_to_all_locations || 
            !locationId || 
            closure.location_id === locationId;

          if (appliesToThisLesson) {
            conflicts.push({
              date: lessonDate,
              reason: closure.reason,
              lessonNumber: i + 1,
            });
          }
        }
      }
    }

    const conflictCount = conflicts.length;
    const hasConflicts = conflictCount > 0;

    let warningMessage: string | null = null;
    if (hasConflicts) {
      if (conflictCount === 1) {
        warningMessage = `1 lesson falls on a closure date (${conflicts[0].reason})`;
      } else {
        warningMessage = `${conflictCount} of ${totalLessons} lessons fall on closure dates`;
      }
    }

    return {
      conflicts,
      totalLessons,
      conflictCount,
      hasConflicts,
      warningMessage,
    };
  }, [startDate, intervalWeeks, totalLessons, locationId, closures]);

  return result;
}

/**
 * Formats closure conflicts for display
 */
export function formatClosureConflicts(conflicts: ClosureConflict[]): string {
  if (conflicts.length === 0) return '';
  
  const lines = conflicts.map(c => 
    `• Lesson ${c.lessonNumber} on ${format(c.date, 'EEE, d MMM yyyy')}: ${c.reason}`
  );
  
  return lines.join('\n');
}
