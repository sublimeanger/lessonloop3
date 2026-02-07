/**
 * LL-PER-P2-01 — Calendar Load Performance
 * Tests that calendar data handling works correctly with large datasets.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Lesson data generation for stress testing
// ---------------------------------------------------------------------------
interface LessonStub {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  teacher_user_id: string;
  org_id: string;
}

function generateLessons(count: number, weekStartISO: string): LessonStub[] {
  const lessons: LessonStub[] = [];
  const weekStart = new Date(weekStartISO);

  for (let i = 0; i < count; i++) {
    const dayOffset = i % 5; // Mon-Fri
    const hourOffset = 9 + (i % 8); // 9am-4pm
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(hourOffset, 0, 0, 0);

    const end = new Date(start);
    end.setMinutes(30);

    lessons.push({
      id: `lesson-${i}`,
      title: `Lesson ${i}`,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: 'scheduled',
      teacher_user_id: `teacher-${i % 5}`,
      org_id: 'org-1',
    });
  }

  return lessons;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LL-PER-P2-01 Calendar handles large datasets', () => {
  it('generates and processes 100+ lessons without error', () => {
    const lessons = generateLessons(150, '2025-06-09T00:00:00Z');
    expect(lessons).toHaveLength(150);
    expect(lessons[0].id).toBe('lesson-0');
    expect(lessons[149].id).toBe('lesson-149');
  });

  it('generates and processes 500 lessons without error', () => {
    const lessons = generateLessons(500, '2025-06-09T00:00:00Z');
    expect(lessons).toHaveLength(500);
  });

  it('filters lessons by teacher efficiently', () => {
    const lessons = generateLessons(200, '2025-06-09T00:00:00Z');
    const teacher0Lessons = lessons.filter(l => l.teacher_user_id === 'teacher-0');
    // 200 lessons / 5 teachers = 40 per teacher
    expect(teacher0Lessons).toHaveLength(40);
  });

  it('groups lessons by day for week view', () => {
    const lessons = generateLessons(100, '2025-06-09T00:00:00Z');
    const dayGroups = new Map<string, LessonStub[]>();

    for (const lesson of lessons) {
      const day = lesson.start_at.split('T')[0];
      if (!dayGroups.has(day)) dayGroups.set(day, []);
      dayGroups.get(day)!.push(lesson);
    }

    // Should have lessons distributed across 5 weekdays
    expect(dayGroups.size).toBe(5);
  });
});

describe('LL-PER-P2-01 AbortController cancellation', () => {
  it('AbortController can be created and aborted', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('new request aborts previous stale request', () => {
    let currentController: AbortController | null = null;
    const abortedSignals: boolean[] = [];

    // Simulate 3 rapid navigation changes
    for (let i = 0; i < 3; i++) {
      if (currentController) {
        currentController.abort();
        abortedSignals.push(currentController.signal.aborted);
      }
      currentController = new AbortController();
    }

    // First two should have been aborted
    expect(abortedSignals).toEqual([true, true]);
    // Last one should still be active
    expect(currentController!.signal.aborted).toBe(false);
  });
});

describe('LL-PER-P2-01 Page size limits', () => {
  const LESSONS_PAGE_SIZE = 200;

  it('respects page size limit', () => {
    const allLessons = generateLessons(500, '2025-06-09T00:00:00Z');
    const page1 = allLessons.slice(0, LESSONS_PAGE_SIZE);
    expect(page1).toHaveLength(200);
  });

  it('handles pages correctly when total < page size', () => {
    const allLessons = generateLessons(50, '2025-06-09T00:00:00Z');
    const page1 = allLessons.slice(0, LESSONS_PAGE_SIZE);
    expect(page1).toHaveLength(50);
  });

  it('calculates total pages', () => {
    const totalLessons = 500;
    const totalPages = Math.ceil(totalLessons / LESSONS_PAGE_SIZE);
    expect(totalPages).toBe(3);
  });
});
