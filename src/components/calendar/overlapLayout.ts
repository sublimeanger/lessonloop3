import { parseISO } from 'date-fns';
import { LessonWithDetails } from './types';

export interface LayoutPosition {
  top: number;
  height: number;
  columnIndex: number;
  totalColumns: number;
}

/**
 * Groups overlapping lessons into clusters and assigns column positions
 * so they render side-by-side instead of stacking on top of each other.
 * 
 * Algorithm:
 * 1. Sort lessons by start time
 * 2. Group into overlap clusters (any lesson overlapping with another in the cluster)
 * 3. Assign column indices greedily (first available column)
 */
export function computeOverlapLayout(
  lessons: LessonWithDetails[],
  hourHeight: number,
  startHour: number
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();
  if (lessons.length === 0) return positions;

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
    
    // Find an existing cluster this lesson overlaps with
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
    
    // Sort cluster by start time for greedy assignment
    cluster.sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    
    const columnAssignments = new Map<string, number>();
    
    for (const lesson of cluster) {
      const lessonStart = new Date(lesson.start_at).getTime();
      
      // Find the first column where this lesson fits (no overlap)
      let assignedCol = -1;
      for (let col = 0; col < columns.length; col++) {
        if (lessonStart >= columns[col].end) {
          assignedCol = col;
          columns[col].end = new Date(lesson.end_at).getTime();
          break;
        }
      }
      
      // If no column available, create a new one
      if (assignedCol === -1) {
        assignedCol = columns.length;
        columns.push({ end: new Date(lesson.end_at).getTime() });
      }
      
      columnAssignments.set(lesson.id, assignedCol);
    }

    const totalColumns = columns.length;
    
    for (const lesson of cluster) {
      positions.set(lesson.id, {
        ...getVerticalPosition(lesson, hourHeight, startHour),
        columnIndex: columnAssignments.get(lesson.id) || 0,
        totalColumns,
      });
    }
  }

  return positions;
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
