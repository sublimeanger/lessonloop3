import { useState, useEffect } from 'react';
import { format, addDays, subDays, isToday, isBefore, endOfDay } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RegisterRow } from '@/components/register/RegisterRow';
import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { useRegisterData } from '@/hooks/useRegisterData';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarIcon, 
  ClipboardList,
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DailyRegister() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { user } = useAuth();
  const { currentRole } = useOrg();
  
  // P1 Fix: Auto-filter to teacher's own lessons, persist via URL/localStorage
  // Now uses teacher_id (from teachers table) instead of auth user id
  const [teacherFilter, setTeacherFilter] = useState<string | null>(() => {
    // Initialize from localStorage for persistence
    const stored = localStorage.getItem('register_teacher_filter');
    return stored || null;
  });

  const { data: allLessons, isLoading, refetch } = useRegisterData(selectedDate);
  
  // For teachers, we need to find their teacher_id from the teachers table
  // This is done by matching user_id in the lessons data
  useEffect(() => {
    if (currentRole === 'teacher' && user?.id && !teacherFilter && allLessons) {
      // Find a lesson where this user is the teacher and get the teacher_id
      const myLesson = allLessons.find(l => l.teacher_user_id === user.id);
      if (myLesson?.teacher_id) {
        setTeacherFilter(myLesson.teacher_id);
        localStorage.setItem('register_teacher_filter', myLesson.teacher_id);
      }
    }
  }, [currentRole, user?.id, teacherFilter, allLessons]);

  // Filter lessons by teacher_id if filter is set (supports both new and legacy lessons)
  const lessons = allLessons?.filter(lesson => 
    !teacherFilter || lesson.teacher_id === teacherFilter || 
    // Fallback: for legacy lessons without teacher_id, check teacher_user_id matches linked user
    (!lesson.teacher_id && lesson.teacher_user_id === user?.id && teacherFilter === localStorage.getItem('register_teacher_filter'))
  );

  const goToPrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  const dateLabel = isToday(selectedDate) 
    ? 'Today' 
    : format(selectedDate, 'EEEE, d MMMM yyyy');

  // Stats
  const totalLessons = lessons?.length || 0;
  const completedLessons = lessons?.filter(l => l.status === 'completed').length || 0;
  const scheduledLessons = lessons?.filter(l => l.status === 'scheduled').length || 0;
  const totalStudents = lessons?.reduce((acc, l) => acc + l.participants.length, 0) || 0;

  // Transform lessons for MarkDayCompleteButton (needs LessonWithDetails format)
  const lessonsForBulkComplete = (lessons || []).map(l => ({
    id: l.id,
    title: l.title,
    start_at: l.start_at,
    end_at: l.end_at,
    status: l.status,
    org_id: '',
    lesson_type: 'private' as const,
    teacher_user_id: '',
    location_id: null,
    room_id: null,
    online_meeting_url: null,
    notes_shared: l.notes_shared,
    notes_private: l.notes_private,
    recurrence_id: l.recurrence_id,
    created_by: '',
    created_at: '',
    updated_at: '',
  }));

  return (
    <AppLayout>
      <PageHeader
        title="Daily Register"
        description="Take attendance for today's lessons"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Register' },
        ]}
      />

      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-start gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!isToday(selectedDate) && (
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Go to Today
          </Button>
        )}

        <div className="flex-1" />

        {/* Mark Day Complete Button */}
        <MarkDayCompleteButton
          currentDate={selectedDate}
          lessons={lessonsForBulkComplete}
          onComplete={refetch}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Lessons</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLessons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{completedLessons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledLessons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lessons List */}
      {isLoading ? (
        <LoadingState message="Loading lessons..." />
      ) : !lessons || lessons.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No lessons scheduled"
          description={`There are no lessons scheduled for ${isToday(selectedDate) ? 'today' : format(selectedDate, 'd MMMM yyyy')}.`}
        />
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <RegisterRow key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
