import { parseISO } from 'date-fns';
import { LessonWithDetails } from './types';

export interface LayoutPosition {
  top: number;
  height: number;
  columnIndex: number;
  totalColumns: number;
}

export interface OverlapResult {
  positions: Map<string, LayoutPosition>;
  /** Lessons hidden behind the "+N more" pill, keyed by a time-bucket string */
  overflowBuckets: Map<string, { lessons: LessonWithDetails[]; top: number; height: number }>;
}

/**
 * Groups overlapping lessons into clusters and assigns column positions
 * so they render side-by-side instead of stacking on top of each other.
 *
 * When a cluster needs more columns than `maxColumns`, lessons beyond
 * the cap are collected into overflow buckets and removed from the
 * visible positions map.
 */
export function computeOverlapLayout(
  lessons: LessonWithDetails[],
  hourHeight: number,
  startHour: number,
  maxColumns: number = 3
): OverlapResult {
  const positions = new Map<string, LayoutPosition>();
  const overflowBuckets = new Map<string, { lessons: LessonWithDetails[]; top: number; height: number }>();

  if (lessons.length === 0) return { positions, overflowBuckets };

  // Sort by start time, then by end time (longer first)
  const sorted = [...lessons].sort((a, b) => {
    const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    if (diff !== 0) return diff;
    return new Date(b.end_at).getTime() - new Date(a.end_at).getTime();
  });

  // Build overlap clusters
  const clusters: LessonWithDetails[][] = [];

  for (const lesson of sorted) {
    const lessonStart = new Date(lesson.start_at).getTime();
    const lessonEnd = new Date(lesson.end_at).getTime();

    let foundCluster = false;
    for (const cluster of clusters) {
      const overlapsWithCluster = cluster.some(existing => {
        const existingStart = new Date(existing.start_at).getTime();
        const existingEnd = new Date(existing.end_at).getTime();
        return lessonStart < existingEnd && lessonEnd > existingStart;
      });

      if (overlapsWithCluster) {
        cluster.push(lesson);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push([lesson]);
    }
  }

  // Assign columns within each cluster
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const lesson = cluster[0];
      positions.set(lesson.id, {
        ...getVerticalPosition(lesson, hourHeight, startHour),
        columnIndex: 0,
        totalColumns: 1,
      });
      continue;
    }

    // Greedy column assignment
    const columns: { end: number }[] = [];

    cluster.sort((a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    const columnAssignments = new Map<string, number>();

    for (const lesson of cluster) {
      const lessonStart = new Date(lesson.start_at).getTime();

      let assignedCol = -1;
      for (let col = 0; col < columns.length; col++) {
        if (lessonStart >= columns[col].end) {
          assignedCol = col;
          columns[col].end = new Date(lesson.end_at).getTime();
          break;
        }
      }

      if (assignedCol === -1) {
        assignedCol = columns.length;
        columns.push({ end: new Date(lesson.end_at).getTime() });
      }

      columnAssignments.set(lesson.id, assignedCol);
    }

    const rawTotalColumns = columns.length;

    if (rawTotalColumns <= maxColumns) {
      // No overflow — assign normally
      for (const lesson of cluster) {
        positions.set(lesson.id, {
          ...getVerticalPosition(lesson, hourHeight, startHour),
          columnIndex: columnAssignments.get(lesson.id) || 0,
          totalColumns: rawTotalColumns,
        });
      }
    } else {
      // Overflow: keep first (maxColumns - 1) columns visible,
      // last visible column reserved for the "+N more" pill area
      const visibleCols = maxColumns - 1; // e.g. 2 columns for lessons

      const overflowLessons: LessonWithDetails[] = [];

      for (const lesson of cluster) {
        const col = columnAssignments.get(lesson.id) || 0;
        if (col < visibleCols) {
          // Visible lesson
          positions.set(lesson.id, {
            ...getVerticalPosition(lesson, hourHeight, startHour),
            columnIndex: col,
            totalColumns: maxColumns, // render at maxColumns width so pill has space
          });
        } else {
          // Overflow lesson
          overflowLessons.push(lesson);
        }
      }

      if (overflowLessons.length > 0) {
        // Compute the bounding box for the overflow group
        let minTop = Infinity;
        let maxBottom = -Infinity;
        for (const lesson of overflowLessons) {
          const vp = getVerticalPosition(lesson, hourHeight, startHour);
          minTop = Math.min(minTop, vp.top);
          maxBottom = Math.max(maxBottom, vp.top + vp.height);
        }

        // Key by cluster identity (use first lesson id)
        const bucketKey = cluster[0].id;
        overflowBuckets.set(bucketKey, {
          lessons: overflowLessons,
          top: minTop,
          height: maxBottom - minTop,
        });
      }
    }
  }

  return { positions, overflowBuckets };
}

function getVerticalPosition(
  lesson: LessonWithDetails,
  hourHeight: number,
  startHour: number
): { top: number; height: number } {
  const start = parseISO(lesson.start_at);
  const end = parseISO(lesson.end_at);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const duration = endMinutes - startMinutes;

  const top = ((startMinutes - startHour * 60) / 60) * hourHeight;
  const height = (duration / 60) * hourHeight;

  return { top, height: Math.max(height, 20) };
}
