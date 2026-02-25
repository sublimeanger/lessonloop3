import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { ConvertLeadWizard } from '@/components/leads/ConvertLeadWizard';
import { BookTrialModal } from '@/components/leads/BookTrialModal';
import { useLead, useUpdateLeadStage, useDeleteLead } from '@/hooks/useLeads';
import { useLeadFollowUps, useCreateFollowUp, useCompleteFollowUp } from '@/hooks/useLeadActivities';
import { useOrg } from '@/contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Mail,
  Phone,
  Users,
  Calendar,
  Music,
  Clock,
  MapPin,
  ArrowRightCircle,
  Trash2,
  CheckCircle,
  AlertCircle,
  User,
  CalendarPlus,
  UserCheck,
  FileText,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Database } from '@/integrations/supabase/types';

type LeadStage = Database['public']['Enums']['lead_stage'];

const STAGE_LABELS: Record<LeadStage, string> = {
  enquiry: 'Enquiry',
  contacted: 'Contacted',
  trial_booked: 'Trial Booked',
  trial_completed: 'Trial Completed',
  enrolled: 'Enrolled',
  lost: 'Lost',
};

const STAGE_COLORS: Record<LeadStage, string> = {
  enquiry: 'bg-teal-100 text-teal-800',
  contacted: 'bg-blue-100 text-blue-800',
  trial_booked: 'bg-amber-100 text-amber-800',
  trial_completed: 'bg-purple-100 text-purple-800',
  enrolled: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-600',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  booking_page: 'Booking Page',
  widget: 'Widget',
  referral: 'Referral',
  website: 'Website',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function LeadDetail() {
  usePageMeta('Lead Detail | LessonLoop', 'View and manage lead details');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [showConvert, setShowConvert] = useState(false);
  const [showBookTrial, setShowBookTrial] = useState(false);

  const { data: lead, isLoading } = useLead(id!);
  const { data: followUps = [] } = useLeadFollowUps(id!);
  const updateStage = useUpdateLeadStage();
  const deleteLead = useDeleteLead();
  const completeFollowUp = useCompleteFollowUp();

  const handleStageChange = (newStage: string) => {
    if (!lead || !id) return;
    if (newStage === 'enrolled') {
      setShowConvert(true);
      return;
    }
    updateStage.mutate({
      leadId: id,
      stage: newStage as LeadStage,
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteLead.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Lead deleted' });
        navigate('/leads');
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Leads', href: '/leads' },
            { label: 'Loading...' },
          ]}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <PageHeader
          title="Lead Not Found"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Leads', href: '/leads' },
            { label: 'Not Found' },
          ]}
        />
        <div className="text-center py-12">
          <p className="text-muted-foreground">This lead doesn't exist or you don't have access.</p>
          <Button onClick={() => navigate('/leads')} variant="outline" className="mt-4">
            Back to Leads
          </Button>
        </div>
      </AppLayout>
    );
  }

  const students = (lead as any).lead_students || [];
  const pendingFollowUps = followUps.filter((f: any) => !f.completed_at);
  const overdueFollowUps = pendingFollowUps.filter((f: any) => isPast(new Date(f.due_at)));

  return (
    <AppLayout>
      <PageHeader
        title={
          <div className="flex items-center gap-3 flex-wrap">
            <span>{lead.contact_name}</span>
            <Badge variant="secondary" className={cn('text-xs', STAGE_COLORS[lead.stage])}>
              {STAGE_LABELS[lead.stage]}
            </Badge>
          </div>
        }
        description={`Source: ${SOURCE_LABELS[lead.source] || lead.source}${lead.source_detail ? ` (${lead.source_detail})` : ''}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Leads', href: '/leads' },
          { label: lead.contact_name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lead.stage !== 'enrolled' && lead.stage !== 'lost' && !lead.trial_lesson_id && (
              <Button onClick={() => setShowBookTrial(true)} variant="outline" size="sm" className="gap-2">
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Book Trial</span>
              </Button>
            )}
            {lead.stage !== 'enrolled' && lead.stage !== 'lost' && (
              <Button onClick={() => setShowConvert(true)} size="sm" className="gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Convert</span>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {lead.contact_name} and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-5">
        {/* Left column — info */}
        <div className="md:col-span-2 space-y-4">
          {/* Stage selector */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={lead.stage} onValueChange={handleStageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Contact info */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{lead.contact_name}</span>
              </div>
              {lead.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">
                    {lead.contact_email}
                  </a>
                </div>
              )}
              {lead.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${lead.contact_phone}`} className="text-primary hover:underline">
                    {lead.contact_phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Children */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Children ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No children added</p>
              ) : (
                <div className="space-y-3">
                  {students.map((s: any) => (
                    <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                        {s.first_name[0]}{s.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {s.first_name} {s.last_name || ''}
                          {s.age && <span className="text-muted-foreground ml-1">(age {s.age})</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {s.instrument && (
                            <Badge variant="outline" className="text-xs">
                              <Music className="h-3 w-3 mr-1" />
                              {s.instrument}
                            </Badge>
                          )}
                          {s.experience_level && (
                            <Badge variant="outline" className="text-xs">
                              {EXPERIENCE_LABELS[s.experience_level] || s.experience_level}
                            </Badge>
                          )}
                        </div>
                        {s.converted_student_id && (
                          <Badge className="mt-1 bg-emerald-100 text-emerald-800 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Enrolled
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          {(lead.preferred_instrument || lead.preferred_day || lead.preferred_time || lead.notes) && (
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Preferences & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.preferred_instrument && (
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.preferred_instrument}</span>
                  </div>
                )}
                {lead.preferred_day && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.preferred_day}</span>
                  </div>
                )}
                {lead.preferred_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.preferred_time}</span>
                  </div>
                )}
                {lead.notes && (
                  <p className="text-muted-foreground pt-2 border-t">{lead.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Follow-ups */}
          {pendingFollowUps.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Follow-ups ({pendingFollowUps.length})
                  {overdueFollowUps.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{overdueFollowUps.length} overdue</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingFollowUps.map((fu: any) => {
                  const isOverdue = isPast(new Date(fu.due_at));
                  return (
                    <div
                      key={fu.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg text-sm',
                        isOverdue ? 'bg-destructive/10' : 'bg-muted/50'
                      )}
                    >
                      {isOverdue ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={cn(isOverdue && 'text-destructive font-medium')}>
                          {format(new Date(fu.due_at), 'MMM d, h:mm a')}
                        </div>
                        {fu.note && <div className="text-muted-foreground truncate">{fu.note}</div>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => completeFollowUp.mutate({ followUpId: fu.id, leadId: id! })}
                        className="shrink-0"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — timeline */}
        <div className="md:col-span-3">
          <LeadTimeline leadId={id!} />
        </div>
      </div>

      {/* Modals */}
      <ConvertLeadWizard
        open={showConvert}
        onOpenChange={setShowConvert}
        lead={lead}
        students={students}
      />

      <BookTrialModal
        open={showBookTrial}
        onOpenChange={setShowBookTrial}
        lead={lead}
      />
    </AppLayout>
  );
}
