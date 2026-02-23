import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { format, addDays, subDays, isToday } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RegisterRow } from '@/components/register/RegisterRow';
import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { useRegisterData } from '@/hooks/useRegisterData';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarIcon, 
  ClipboardList,
  CheckCircle2,
  Clock,
  Users,
  XCircle,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DailyRegister() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { user } = useAuth();
  const { currentRole, currentOrg } = useOrg();
  
  const storageKey = `register_teacher_filter_${currentOrg?.id}`;

  // Only teachers get a persisted filter; owners/admins start with null (see all)
  const [teacherFilter, setTeacherFilter] = useState<string | null>(() => {
    if (currentRole !== 'teacher' || !currentOrg?.id) return null;
    const stored = safeGetItem(storageKey);
    return stored || null;
  });

  // Reset filter when org or role changes
  useEffect(() => {
    if (!currentOrg?.id) return;
    if (currentRole !== 'teacher') {
      setTeacherFilter(null);
      return;
    }
    const stored = safeGetItem(storageKey);
    setTeacherFilter(stored || null);
  }, [currentOrg?.id, currentRole, storageKey]);

  // Clean up stale localStorage for non-teacher roles
  useEffect(() => {
    if (currentRole !== 'teacher' && currentOrg?.id) {
      try { localStorage.removeItem(storageKey); } catch {}
    }
  }, [currentRole, currentOrg?.id, storageKey]);

  const { data: allLessons, isLoading, refetch } = useRegisterData(selectedDate);

  // Fetch teachers list for the filter dropdown (owners/admins only)
  const { data: teachers = [] } = useQuery({
    queryKey: ['register-teachers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('teachers')
        .select('id, display_name')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .order('display_name');
      return data || [];
    },
    enabled: !!currentOrg?.id && currentRole !== 'teacher',
  });
  
  // For teachers, auto-detect their teacher_id from lessons
  useEffect(() => {
    if (currentRole === 'teacher' && user?.id && !teacherFilter && allLessons) {
      const myLesson = allLessons.find(l => l.teacher_user_id === user.id);
      if (myLesson?.teacher_id) {
        setTeacherFilter(myLesson.teacher_id);
        safeSetItem(storageKey, myLesson.teacher_id);
      }
    }
  }, [currentRole, user?.id, teacherFilter, allLessons, storageKey]);

  // Filter lessons by teacher_id if filter is set
  const lessons = allLessons?.filter(lesson => 
    !teacherFilter || lesson.teacher_id === teacherFilter || 
    (!lesson.teacher_id && lesson.teacher_user_id === user?.id && currentRole === 'teacher')
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
  const cancelledLessons = lessons?.filter(l => l.status === 'cancelled').length || 0;
  const activeLessons = totalLessons - cancelledLessons;
  const totalStudents = lessons?.filter(l => l.status !== 'cancelled').reduce((acc, l) => acc + l.participants.length, 0) || 0;

  // Transform lessons for MarkDayCompleteButton (needs LessonWithDetails format)
  const lessonsForBulkComplete = (lessons || []).map(l => ({
    id: l.id,
    title: l.title,
    start_at: l.start_at,
    end_at: l.end_at,
    status: l.status,
    org_id: '',
    lesson_type: 'private' as const,
    teacher_id: l.teacher_id || null,
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

        {/* Teacher filter for owners/admins */}
        {currentRole !== 'teacher' && teachers.length > 0 && (
          <Select
            value={teacherFilter ?? 'all'}
            onValueChange={(value) => setTeacherFilter(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        {/* Batch Mode Link */}
        <Button variant="outline" size="sm" asChild>
          <Link to="/batch-attendance" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Batch Mode
          </Link>
        </Button>

        {/* Mark Day Complete Button */}
        <MarkDayCompleteButton
          currentDate={selectedDate}
          lessons={lessonsForBulkComplete}
          onComplete={refetch}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Lessons</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLessons}</div>
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
        {cancelledLessons > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{cancelledLessons}</div>
            </CardContent>
          </Card>
        )}
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
