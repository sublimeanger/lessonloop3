import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, XCircle, CalendarClock, MessageSquare, Calendar, Clock, MapPin, User, ArrowLeft } from 'lucide-react';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useNavigate } from 'react-router-dom';

type ChangeOption = 'menu' | 'cancel' | 'reschedule';

const CANCEL_REASONS = [
  { value: 'illness', label: 'Illness' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'scheduling_conflict', label: 'Scheduling conflict' },
  { value: 'other', label: 'Other' },
] as const;

interface LessonInfo {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  teacher_name: string | null;
  location_name: string | null;
  student_names: string;
}

interface LessonChangeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonInfo | null;
  tz: string;
  onSubmit: (data: {
    request_type: 'cancellation' | 'reschedule';
    subject: string;
    message: string;
    lesson_id: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function LessonChangeSheet({
  open,
  onOpenChange,
  lesson,
  tz,
  onSubmit,
  isSubmitting,
}: LessonChangeSheetProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<ChangeOption>('menu');
  const [cancelReason, setCancelReason] = useState('');
  const [notes, setNotes] = useState('');
  const [reschedulePreference, setReschedulePreference] = useState('');

  const resetAndClose = () => {
    setView('menu');
    setCancelReason('');
    setNotes('');
    setReschedulePreference('');
    onOpenChange(false);
  };

  const handleSubmitCancel = async () => {
    if (!lesson || !cancelReason) return;
    const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelReason)?.label || cancelReason;
    const date = formatInTimeZone(parseISO(lesson.start_at), tz, 'd MMMM yyyy');
    const subject = `Lesson cancellation request — ${lesson.student_names} — ${lesson.title} — ${date}`;
    const body = `Reason: ${reasonLabel}${notes.trim() ? `\n\nAdditional notes: ${notes.trim()}` : ''}`;
    await onSubmit({ request_type: 'cancellation', subject, message: body, lesson_id: lesson.id });
    resetAndClose();
  };

  const handleSubmitReschedule = async () => {
    if (!lesson || !reschedulePreference.trim()) return;
    const date = formatInTimeZone(parseISO(lesson.start_at), tz, 'd MMMM yyyy');
    const subject = `Reschedule request — ${lesson.student_names} — ${lesson.title} — ${date}`;
    const body = `Preferred alternative: ${reschedulePreference.trim()}${notes.trim() ? `\n\nAdditional notes: ${notes.trim()}` : ''}`;
    await onSubmit({ request_type: 'reschedule', subject, message: body, lesson_id: lesson.id });
    resetAndClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setView('menu');
      setCancelReason('');
      setNotes('');
      setReschedulePreference('');
    }
    onOpenChange(v);
  };

  if (!lesson) return null;

  const formattedDate = formatInTimeZone(parseISO(lesson.start_at), tz, 'EEEE, d MMMM yyyy');
  const formattedTime = `${formatInTimeZone(parseISO(lesson.start_at), tz, 'HH:mm')} – ${formatInTimeZone(parseISO(lesson.end_at), tz, 'HH:mm')}`;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">
            {view === 'menu' && 'Request a Change'}
            {view === 'cancel' && 'Cancel This Lesson'}
            {view === 'reschedule' && 'Request Reschedule'}
          </SheetTitle>
          <SheetDescription className="sr-only">Request a change to your lesson</SheetDescription>
        </SheetHeader>

        {/* Lesson summary */}
        <div className="rounded-lg border bg-muted/30 p-3 mt-3 space-y-1 text-sm">
          <p className="font-medium">{lesson.title}</p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>{lesson.student_names}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{formattedTime}</span>
          </div>
          {lesson.teacher_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{lesson.teacher_name}</span>
            </div>
          )}
          {lesson.location_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{lesson.location_name}</span>
            </div>
          )}
        </div>

        {/* Menu view */}
        {view === 'menu' && (
          <div className="mt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 px-4 min-h-[44px]"
              onClick={() => setView('cancel')}
            >
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-left">
                <p className="font-medium">Cancel this lesson</p>
                <p className="text-xs text-muted-foreground">Let the academy know you can't attend</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 px-4 min-h-[44px]"
              onClick={() => setView('reschedule')}
            >
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium">Request reschedule</p>
                <p className="text-xs text-muted-foreground">Ask to move this lesson to a different time</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 px-4 min-h-[44px]"
              onClick={() => {
                resetAndClose();
                navigate('/portal/messages');
              }}
            >
              <MessageSquare className="h-5 w-5 text-info shrink-0" />
              <div className="text-left">
                <p className="font-medium">Send a note to teacher</p>
                <p className="text-xs text-muted-foreground">Open messaging to send a direct message</p>
              </div>
            </Button>
          </div>
        )}

        {/* Cancel form */}
        {view === 'cancel' && (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setView('menu')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra details..."
                rows={3}
                className="text-base"
              />
            </div>
            <Button
              className="w-full min-h-[44px]"
              disabled={!cancelReason || isSubmitting}
              onClick={handleSubmitCancel}
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Cancellation Request'}
            </Button>
          </div>
        )}

        {/* Reschedule form */}
        {view === 'reschedule' && (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setView('menu')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="space-y-2">
              <Label>When would you prefer instead? *</Label>
              <Textarea
                value={reschedulePreference}
                onChange={(e) => setReschedulePreference(e.target.value)}
                placeholder="e.g. Can we move to Wednesday same time?"
                rows={3}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra details..."
                rows={2}
                className="text-base"
              />
            </div>
            <Button
              className="w-full min-h-[44px]"
              disabled={!reschedulePreference.trim() || isSubmitting}
              onClick={handleSubmitReschedule}
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Reschedule Request'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
