import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { WaitlistActivityTimeline } from './WaitlistActivityTimeline';
import {
  useEnrolmentWaitlistEntry,
  useConvertWaitlistToStudent,
  useRespondToOffer,
  type EnrolmentWaitlistEntry,
} from '@/hooks/useEnrolmentWaitlist';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Send,
  UserMinus,
  UserCheck,
  Mail,
  Phone,
  Music,
  Clock,
  MapPin,
  Calendar,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-blue-100 text-blue-800',
  offered: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  enrolled: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-600',
  withdrawn: 'bg-gray-100 text-gray-600',
  lost: 'bg-gray-100 text-gray-600',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaitlistEntryDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: EnrolmentWaitlistEntry;
  onOfferSlot?: () => void;
  onWithdraw?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaitlistEntryDetail({
  open,
  onOpenChange,
  entry,
  onOfferSlot,
  onWithdraw,
}: WaitlistEntryDetailProps) {
  const isMobile = useIsMobile();
  const { activities, isActivityLoading } = useEnrolmentWaitlistEntry(entry.id);
  const convertMutation = useConvertWaitlistToStudent();
  const respondMutation = useRespondToOffer();

  const handleConvert = async () => {
    await convertMutation.mutateAsync({ waitlist_id: entry.id });
    onOpenChange(false);
  };

  const handleAccept = async () => {
    await respondMutation.mutateAsync({ waitlist_id: entry.id, action: 'accept' });
  };

  const handleDecline = async () => {
    await respondMutation.mutateAsync({ waitlist_id: entry.id, action: 'decline' });
  };

  const content = (
    <div className="space-y-4 overflow-y-auto max-h-[70vh]">
      {/* Status & position header */}
      <div className="flex items-center gap-2">
        <Badge className={cn(STATUS_COLORS[entry.status])}>
          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        </Badge>
        <span className="text-sm text-muted-foreground">Position #{entry.position}</span>
        {entry.priority !== 'normal' && (
          <Badge variant="outline" className={cn(
            entry.priority === 'urgent' ? 'border-red-400 text-red-600' : 'border-amber-400 text-amber-600'
          )}>
            {entry.priority}
          </Badge>
        )}
      </div>

      {/* Child info */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-1">Child</h4>
        <p className="text-base font-medium">
          {entry.child_first_name} {entry.child_last_name || ''}
        </p>
        <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Music className="h-3.5 w-3.5" /> {entry.instrument_name}
          </span>
          {entry.child_age && <span>Age {entry.child_age}</span>}
          {entry.experience_level && <span>{entry.experience_level}</span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {entry.lesson_duration_mins} mins
          </span>
        </div>
      </div>

      <Separator />

      {/* Contact info */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-1">Contact</h4>
        <p className="font-medium">{entry.contact_name}</p>
        <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
          {entry.contact_email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {entry.contact_email}
            </span>
          )}
          {entry.contact_phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {entry.contact_phone}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Preferences */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-1">Preferences</h4>
        <div className="text-sm text-muted-foreground space-y-1">
          {entry.preferred_days?.length ? (
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {entry.preferred_days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
            </p>
          ) : (
            <p className="text-xs">No day preference</p>
          )}
          {entry.preferred_time_earliest && entry.preferred_time_latest && (
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {entry.preferred_time_earliest} – {entry.preferred_time_latest}
            </p>
          )}
          {entry.teacher?.display_name && (
            <p>Preferred teacher: {entry.teacher.display_name}</p>
          )}
          {entry.location?.name && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {entry.location.name}
            </p>
          )}
        </div>
      </div>

      {/* Current offer (if offered/accepted) */}
      {(entry.status === 'offered' || entry.status === 'accepted') && entry.offered_slot_day && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Current Offer</h4>
            <div className="rounded-lg border bg-amber-50/50 p-3 text-sm space-y-1">
              <p>
                <strong>{entry.offered_slot_day.charAt(0).toUpperCase() + entry.offered_slot_day.slice(1)}</strong>{' '}
                at <strong>{entry.offered_slot_time}</strong>
              </p>
              {entry.offered_teacher?.display_name && (
                <p>Teacher: {entry.offered_teacher.display_name}</p>
              )}
              {entry.offered_location?.name && (
                <p>Location: {entry.offered_location.name}</p>
              )}
              {entry.offered_rate_minor != null && (
                <p>Rate: £{(entry.offered_rate_minor / 100).toFixed(2)} per lesson</p>
              )}
              {entry.offer_expires_at && entry.status === 'offered' && (
                <p className="text-xs text-muted-foreground">
                  Expires {formatDistanceToNow(new Date(entry.offer_expires_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      {entry.notes && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
            <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
          </div>
        </>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {entry.status === 'waiting' && onOfferSlot && (
          <Button size="sm" onClick={onOfferSlot} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Offer Slot
          </Button>
        )}
        {entry.status === 'offered' && (
          <>
            <Button size="sm" onClick={handleAccept} disabled={respondMutation.isPending} className="gap-1.5">
              {respondMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} disabled={respondMutation.isPending}>
              Decline
            </Button>
          </>
        )}
        {entry.status === 'accepted' && (
          <Button size="sm" onClick={handleConvert} disabled={convertMutation.isPending} className="gap-1.5">
            {convertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            Convert to Student
          </Button>
        )}
        {['waiting', 'offered'].includes(entry.status) && onWithdraw && (
          <Button size="sm" variant="destructive" onClick={onWithdraw} className="gap-1.5">
            <UserMinus className="h-3.5 w-3.5" /> Withdraw
          </Button>
        )}
      </div>

      <Separator />

      {/* Activity timeline */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Activity</h4>
        <WaitlistActivityTimeline activities={activities} isLoading={isActivityLoading} />
      </div>

      <p className="text-xs text-muted-foreground">
        Added {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
        {entry.source !== 'manual' && ` · Source: ${entry.source.replace('_', ' ')}`}
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>
              {entry.child_first_name} {entry.child_last_name || ''} — {entry.instrument_name}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {entry.child_first_name} {entry.child_last_name || ''} — {entry.instrument_name}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
