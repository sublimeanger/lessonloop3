import { format, parseISO, isSameDay, startOfDay, addDays } from 'date-fns';
import { LessonWithDetails } from './types';
import { LessonCard } from './LessonCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeacherWithColour, TeacherColourEntry, TEACHER_COLOURS } from './teacherColours';

function resolveColourByUserId(
  colourMap: Map<string, TeacherWithColour>,
  teacherUserId: string | null | undefined
): TeacherColourEntry {
  if (!teacherUserId) return TEACHER_COLOURS[0];
  for (const entry of colourMap.values()) {
    if (entry.userId === teacherUserId) return entry.colour;
  }
  return TEACHER_COLOURS[0];
}

interface AgendaViewProps {
  currentDate: Date;
  lessons: LessonWithDetails[];
  onLessonClick: (lesson: LessonWithDetails) => void;
  teacherColourMap?: Map<string, TeacherWithColour>;
}

export function AgendaView({ currentDate, lessons, onLessonClick, teacherColourMap }: AgendaViewProps) {
  const groupedLessons: { date: Date; lessons: LessonWithDetails[] }[] = [];
  
  for (let i = 0; i < 14; i++) {
    const day = addDays(startOfDay(currentDate), i);
    const dayLessons = lessons.filter(l => isSameDay(parseISO(l.start_at), day));
    if (dayLessons.length > 0) {
      groupedLessons.push({ date: day, lessons: dayLessons });
    }
  }

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg">No lessons in the next 2 weeks</p>
        <p className="text-sm mt-1">Click "New Lesson" to schedule one</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <div className="space-y-6 pr-4">
        {groupedLessons.map(({ date, lessons: dayLessons }) => (
          <div key={date.toISOString()}>
            <div className="sticky top-0 bg-background py-2 mb-2 border-b">
              <h3 className="font-semibold">
                {format(date, 'EEEE, d MMMM yyyy')}
                {isSameDay(date, new Date()) && (
                  <span className="ml-2 text-primary text-sm font-normal">Today</span>
                )}
              </h3>
            </div>
            <div className="space-y-2">
              {dayLessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onClick={() => onLessonClick(lesson)}
                  variant="agenda"
                  teacherColour={teacherColourMap ? resolveColourByUserId(teacherColourMap, lesson.teacher_user_id) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
