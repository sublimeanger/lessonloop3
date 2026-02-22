import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, addMinutes, differenceInMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useOrg } from '@/contexts/OrgContext';
import { useNavigate } from 'react-router-dom';
import { useAdminMessageRequests, useUpdateMessageRequest, AdminMessageRequest } from '@/hooks/useAdminMessageRequests';

interface MessageRequestsListProps {
  className?: string;
}

export function MessageRequestsList({ className }: MessageRequestsListProps) {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdminMessageRequest | null>(null);
  const [responseAction, setResponseAction] = useState<'approved' | 'declined' | 'resolved'>('resolved');
  const [responseText, setResponseText] = useState('');

  // Reschedule fields
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const { data: requests, isLoading } = useAdminMessageRequests({ status: statusFilter });
  const updateRequest = useUpdateMessageRequest();

  const handleRespond = (request: AdminMessageRequest, action: 'approved' | 'declined' | 'resolved') => {
    setSelectedRequest(request);
    setResponseAction(action);
    setResponseText('');

    // Pre-fill reschedule fields from original lesson
    if (request.lesson && request.request_type === 'reschedule' && action === 'approved') {
      const startDate = parseISO(request.lesson.start_at);
      setNewDate(format(startDate, 'yyyy-MM-dd'));
      setNewTime(format(startDate, 'HH:mm'));
    } else {
      setNewDate('');
      setNewTime('');
    }

    setRespondModalOpen(true);
  };

  // Calculate the new end time based on original lesson duration
  const lessonDurationMinutes = useMemo(() => {
    if (!selectedRequest?.lesson) return 30;
    const start = parseISO(selectedRequest.lesson.start_at);
    const end = parseISO(selectedRequest.lesson.end_at);
    return differenceInMinutes(end, start);
  }, [selectedRequest]);

  const handleSubmitResponse = async () => {
    if (!selectedRequest) return;

    let newStartAt: string | undefined;
    let newEndAt: string | undefined;

    // Build new start/end for reschedule approvals
    if (
      responseAction === 'approved' &&
      selectedRequest.request_type === 'reschedule' &&
      selectedRequest.lesson &&
      newDate &&
      newTime
    ) {
      const newStart = fromZonedTime(`${newDate}T${newTime}:00`, currentOrg?.timezone || 'Europe/London');
      const newEnd = addMinutes(newStart, lessonDurationMinutes);
      newStartAt = newStart.toISOString();
      newEndAt = newEnd.toISOString();
    }

    await updateRequest.mutateAsync({
      requestId: selectedRequest.id,
      status: responseAction,
      adminResponse: responseText || undefined,
      newStartAt,
      newEndAt,
      lessonId: selectedRequest.lesson?.id,
      requestType: selectedRequest.request_type,
    });

    setRespondModalOpen(false);
    setSelectedRequest(null);
    setResponseText('');
  };

  const handleViewOnCalendar = (lessonStartAt: string) => {
    const date = format(parseISO(lessonStartAt), 'yyyy-MM-dd');
    navigate(`/calendar?date=${date}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-success text-success-foreground"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'declined':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Declined</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'cancellation':
        return <Badge variant="destructive">Cancellation</Badge>;
      case 'reschedule':
        return <Badge variant="outline">Reschedule</Badge>;
      case 'general':
        return <Badge variant="secondary">General</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Determine if reschedule approval needs the picker
  const isRescheduleApproval =
    responseAction === 'approved' &&
    selectedRequest?.request_type === 'reschedule' &&
    !!selectedRequest?.lesson;

  const isCancellationApproval =
    responseAction === 'approved' &&
    selectedRequest?.request_type === 'cancellation' &&
    !!selectedRequest?.lesson;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {requests?.length || 0} request{requests?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Requests List */}
      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No requests found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter === 'pending' 
                ? 'No pending requests from parents.'
                : 'No requests match the selected filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getTypeBadge(request.request_type)}
                      {getStatusBadge(request.status)}
                    </div>
                    <CardTitle className="text-base">{request.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      {format(parseISO(request.created_at), 'd MMM yyyy, HH:mm')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guardian info */}
                {request.guardian && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.guardian.full_name}</span>
                    {request.guardian.email && (
                      <span className="text-muted-foreground">({request.guardian.email})</span>
                    )}
                  </div>
                )}

                {/* Student and lesson info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {request.student && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Student:</span>
                      <span>{request.student.first_name} {request.student.last_name}</span>
                    </div>
                  )}
                  {request.lesson && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{request.lesson.title}</span>
                      <span className="text-muted-foreground">
                        ({format(parseISO(request.lesson.start_at), 'd MMM, HH:mm')})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => handleViewOnCalendar(request.lesson!.start_at)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm whitespace-pre-wrap">{request.message}</p>
                </div>

                {/* Admin response if exists */}
                {request.admin_response && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary mb-1">Admin Response:</p>
                    <p className="text-sm whitespace-pre-wrap">{request.admin_response}</p>
                  </div>
                )}

                {/* Actions for pending requests */}
                {request.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    {request.request_type === 'cancellation' || request.request_type === 'reschedule' ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => handleRespond(request, 'approved')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRespond(request, 'declined')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => handleRespond(request, 'resolved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response Modal */}
      <Dialog open={respondModalOpen} onOpenChange={setRespondModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {responseAction === 'approved' ? 'Approve Request' :
               responseAction === 'declined' ? 'Decline Request' : 'Resolve Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current lesson details for reschedule/cancellation */}
            {selectedRequest?.lesson && (responseAction === 'approved') && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Current Lesson
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{selectedRequest.lesson.title}</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {format(parseISO(selectedRequest.lesson.start_at), 'EEEE d MMM yyyy, HH:mm')}
                  {' – '}
                  {format(parseISO(selectedRequest.lesson.end_at), 'HH:mm')}
                  <span className="ml-2 text-xs">({lessonDurationMinutes} min)</span>
                </p>
              </div>
            )}

            {/* Cancellation warning */}
            {isCancellationApproval && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">This will cancel the lesson</p>
                  <p className="text-muted-foreground mt-0.5">
                    Approving this request will mark the lesson as cancelled on the calendar. 
                    The parent will be notified.
                  </p>
                </div>
              </div>
            )}

            {/* Reschedule picker */}
            {isRescheduleApproval && (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-primary">Reschedule To</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-date" className="text-xs">New Date</Label>
                    <Input
                      id="new-date"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-time" className="text-xs">New Time</Label>
                    <Input
                      id="new-time"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Duration stays the same ({lessonDurationMinutes} min). The calendar will update automatically.
                </p>
              </div>
            )}

            {/* Response text */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Response to parent {responseAction === 'declined' ? '' : '(optional)'}
              </Label>
              <Textarea
                placeholder="Add a message to the parent..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitResponse}
              disabled={
                updateRequest.isPending ||
                (isRescheduleApproval && (!newDate || !newTime))
              }
              variant={responseAction === 'declined' ? 'destructive' : 'default'}
            >
              {updateRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {responseAction === 'approved' 
                ? (isRescheduleApproval ? 'Approve & Reschedule' : isCancellationApproval ? 'Approve & Cancel Lesson' : 'Approve')
                : responseAction === 'declined' ? 'Decline' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
