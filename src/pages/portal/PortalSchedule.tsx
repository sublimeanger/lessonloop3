import { useState } from 'react';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { useSearchParams } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, Loader2, MessageSquare, CheckCircle, XCircle, AlertCircle, FileText, CalendarClock, CalendarPlus } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfToday, differenceInHours } from 'date-fns';
import { useParentLessons, useChildrenWithDetails, useCreateMessageRequest } from '@/hooks/useParentPortal';
import { useOrg } from '@/contexts/OrgContext';
import { RequestModal } from '@/components/portal/RequestModal';
import { RescheduleSlotPicker } from '@/components/portal/RescheduleSlotPicker';
import { useToast } from '@/hooks/use-toast';
import { downloadICSFile, generateGoogleCalendarUrl } from '@/lib/calendarExport';

export default function PortalSchedule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const studentFilter = searchParams.get('student') || '';
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{ id: string; title: string } | null>(null);
  
  // Reschedule slot picker state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleLesson, setRescheduleLesson] = useState<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    teacher_id: string | null;
  } | null>(null);

  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const { data: children } = useChildrenWithDetails();
  const { data: lessons, isLoading, refetch: refetchLessons } = useParentLessons({
    studentId: studentFilter || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const createRequest = useCreateMessageRequest();

  // P0 Fix: Enforce parent reschedule policy
  const reschedulePolicy = currentOrg?.parent_reschedule_policy || 'request_only';
  const canReschedule = reschedulePolicy !== 'admin_locked';
  const showSlotPicker = reschedulePolicy === 'self_service';

  const handleStudentChange = (value: string) => {
    if (value) {
      setSearchParams({ student: value });
    } else {
      setSearchParams({});
    }
  };

  const handleRequestChange = (lesson: { id: string; title: string }) => {
    setSelectedLesson(lesson);
    setRequestModalOpen(true);
  };

  // Handle one-tap reschedule with slot picker
  const handleRescheduleClick = (lesson: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    teacher_id: string | null;
  }) => {
    setRescheduleLesson(lesson);
    setRescheduleModalOpen(true);
  };

  // Check if cancellation is within notice period
  const isWithinNoticeWindow = (startAt: string): boolean => {
    const noticeHours = currentOrg?.cancellation_notice_hours || 24;
    const lessonStart = parseISO(startAt);
    const hoursUntil = differenceInHours(lessonStart, new Date());
    return hoursUntil < noticeHours;
  };

  // Handle slot selection from picker
  const handleSlotSelect = async (slot: { proposedStart: Date; proposedEnd: Date }) => {
    if (!rescheduleLesson || !currentOrg) return;

    const isLate = isWithinNoticeWindow(rescheduleLesson.start_at);
    
    try {
      await createRequest.mutateAsync({
        request_type: 'reschedule',
        subject: `Reschedule Request: ${rescheduleLesson.title}`,
        message: `I would like to reschedule my lesson from ${format(parseISO(rescheduleLesson.start_at), 'EEEE, d MMMM \'at\' HH:mm')} to:\n\n**Proposed new time:** ${format(slot.proposedStart, 'EEEE, d MMMM \'at\' HH:mm')} - ${format(slot.proposedEnd, 'HH:mm')}\n\n${isLate ? '⚠️ Note: This is a late cancellation request.' : ''}`,
        lesson_id: rescheduleLesson.id,
      });

      toast({
        title: 'Reschedule request sent',
        description: 'The admin will review and confirm your new time.',
      });

      setRescheduleModalOpen(false);
      setRescheduleLesson(null);
    } catch (error) {
      toast({
        title: 'Failed to send request',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    }
  };

  // Split lessons into upcoming and past
  const today = startOfToday();
  const upcomingLessons = lessons?.filter(l => 
    isAfter(parseISO(l.start_at), today) || 
    format(parseISO(l.start_at), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  ) || [];
  const pastLessons = lessons?.filter(l => 
    isBefore(parseISO(l.start_at), today) && 
    format(parseISO(l.start_at), 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">Scheduled</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAttendanceBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'present':
        return (
          <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
            <CheckCircle className="h-3 w-3" />
            Present
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Absent
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Late
          </Badge>
        );
      default:
        return null;
    }
  };

  const LessonCard = ({ lesson, isPast }: { lesson: typeof lessons extends (infer T)[] ? T : never; isPast?: boolean }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium truncate">{lesson.title}</h3>
              {getStatusBadge(lesson.status)}
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{format(parseISO(lesson.start_at), 'EEEE, d MMMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>
                  {format(parseISO(lesson.start_at), 'HH:mm')} - {format(parseISO(lesson.end_at), 'HH:mm')}
                </span>
              </div>
              {lesson.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{lesson.location.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 flex-shrink-0" />
                <span>
                  {lesson.students.map(s => `${s.first_name} ${s.last_name}`).join(', ')}
                </span>
              </div>
            </div>

            {/* Attendance status for past lessons */}
            {isPast && lesson.students.some(s => s.attendance_status) && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Attendance</p>
                <div className="flex flex-wrap gap-2">
                  {lesson.students.map((student) => (
                    <div key={student.id} className="flex items-center gap-1.5">
                      <span className="text-sm">{student.first_name}:</span>
                      {getAttendanceBadge(student.attendance_status)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared notes from teacher */}
            {lesson.notes_shared && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  Lesson Notes
                </div>
                <p className="text-sm bg-muted/50 p-2.5 rounded-md whitespace-pre-wrap">
                  {lesson.notes_shared}
                </p>
              </div>
            )}
          </div>

          {lesson.status === 'scheduled' && !isPast && (
            <div className="flex flex-col gap-1">
              {/* Add to Calendar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <CalendarPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add to Cal</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => window.open(generateGoogleCalendarUrl(lesson), '_blank', 'noopener,noreferrer')}
                  >
                    Google Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadICSFile(lesson)}>
                    Apple / Outlook (.ics)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Reschedule */}
              {canReschedule && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => showSlotPicker 
                    ? handleRescheduleClick({
                        id: lesson.id,
                        title: lesson.title,
                        start_at: lesson.start_at,
                        end_at: lesson.end_at,
                        teacher_id: lesson.teacher_id,
                      })
                    : handleRequestChange({ id: lesson.id, title: lesson.title })
                  }
                >
                  <CalendarClock className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {showSlotPicker ? 'Reschedule' : 'Request Change'}
                  </span>
                </Button>
              )}
              {/* Message button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRequestChange({ id: lesson.id, title: lesson.title })}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PortalLayout>
      <PageHeader
        title="Schedule"
        description="View your children's lesson schedule"
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
        {children && children.length > 1 && (
          <Select value={studentFilter || '__all__'} onValueChange={(v) => handleStudentChange(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All children" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All children</SelectItem>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.first_name} {child.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lessons</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : !lessons || lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No lessons found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all'
                ? `No ${statusFilter} lessons to display.`
                : 'No lessons scheduled yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcomingLessons.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Upcoming Lessons</h2>
              <div className="space-y-3">
                {upcomingLessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} isPast={false} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastLessons.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Past Lessons</h2>
              <div className="space-y-3">
                {pastLessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} isPast={true} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <RequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        defaultType="reschedule"
        lessonId={selectedLesson?.id}
        lessonTitle={selectedLesson?.title}
      />

      {/* Reschedule Slot Picker Modal */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
          </DialogHeader>
          {rescheduleLesson && currentOrg && (
            <RescheduleSlotPicker
              lessonId={rescheduleLesson.id}
              lessonTitle={rescheduleLesson.title}
              originalStart={rescheduleLesson.start_at}
              originalEnd={rescheduleLesson.end_at}
              teacherId={rescheduleLesson.teacher_id}
              orgId={currentOrg.id}
              onSlotSelect={handleSlotSelect}
              onCancel={() => {
                setRescheduleModalOpen(false);
                setRescheduleLesson(null);
              }}
              isLateCancel={isWithinNoticeWindow(rescheduleLesson.start_at)}
              cancellationNoticeHours={currentOrg.cancellation_notice_hours || 24}
            />
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
