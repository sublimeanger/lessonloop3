import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { TeacherAssignmentsPanel } from './TeacherAssignmentsPanel';
import { MakeUpCreditsPanel } from './MakeUpCreditsPanel';
import { StudentPracticePanel } from './StudentPracticePanel';
import { StudentLessonNotes } from './StudentLessonNotes';
import { StudentInfoCard } from './StudentInfoCard';
import { GuardiansCard } from './GuardiansCard';
import { MessageList } from '@/components/messages/MessageList';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';
import { Loader2, Calendar, Receipt, Music, MessageSquare, Send } from 'lucide-react';
import type { useStudentDetailPage } from '@/hooks/useStudentDetailPage';

type PageHook = ReturnType<typeof useStudentDetailPage>;

interface StudentTabsSectionProps {
  hook: PageHook;
}

export function StudentTabsSection({ hook }: StudentTabsSectionProps) {
  const student = hook.student!;
  const fullName = hook.fullName;

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="teachers">Teachers</TabsTrigger>
        <TabsTrigger value="guardians">Guardians</TabsTrigger>
        <TabsTrigger value="lessons">Lessons</TabsTrigger>
        <TabsTrigger value="practice" className="gap-1.5">
          <Music className="h-3.5 w-3.5" />
          Practice
        </TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="credits">Credits</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <StudentInfoCard
          student={student}
          isEditing={hook.isEditing}
          isSaving={hook.isSaving}
          isOrgAdmin={hook.isOrgAdmin}
          firstName={hook.firstName} setFirstName={hook.setFirstName}
          lastName={hook.lastName} setLastName={hook.setLastName}
          email={hook.email} setEmail={hook.setEmail}
          phone={hook.phone} setPhone={hook.setPhone}
          dob={hook.dob} setDob={hook.setDob}
          notes={hook.notes} setNotes={hook.setNotes}
          handleSave={hook.handleSave}
          fetchStudent={hook.fetchStudent}
        />
      </TabsContent>

      <TabsContent value="teachers">
        <SectionErrorBoundary name="Teacher Assignments">
          <TeacherAssignmentsPanel studentId={hook.id!} />
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="guardians">
        <GuardiansCard
          guardians={hook.guardians}
          allGuardians={hook.allGuardians}
          isOrgAdmin={hook.isOrgAdmin}
          isSaving={hook.isSaving}
          isGuardianDialogOpen={hook.isGuardianDialogOpen} setIsGuardianDialogOpen={hook.setIsGuardianDialogOpen}
          isNewGuardian={hook.isNewGuardian} setIsNewGuardian={hook.setIsNewGuardian}
          selectedGuardianId={hook.selectedGuardianId} setSelectedGuardianId={hook.setSelectedGuardianId}
          newGuardianName={hook.newGuardianName} setNewGuardianName={hook.setNewGuardianName}
          newGuardianEmail={hook.newGuardianEmail} setNewGuardianEmail={hook.setNewGuardianEmail}
          newGuardianPhone={hook.newGuardianPhone} setNewGuardianPhone={hook.setNewGuardianPhone}
          relationship={hook.relationship} setRelationship={hook.setRelationship}
          isPrimaryPayer={hook.isPrimaryPayer} setIsPrimaryPayer={hook.setIsPrimaryPayer}
          handleAddGuardian={hook.handleAddGuardian}
          resetGuardianForm={hook.resetGuardianForm}
          invitingGuardianId={hook.invitingGuardianId}
          guardianInvites={hook.guardianInvites}
          handleInviteGuardian={hook.handleInviteGuardian}
          handleCopyInviteLink={hook.handleCopyInviteLink}
          initiateGuardianRemoval={hook.initiateGuardianRemoval}
        />
      </TabsContent>

      <TabsContent value="lessons">
        <SectionErrorBoundary name="Lessons">
          <Card>
            <CardHeader>
              <CardTitle>Lesson History</CardTitle>
              <CardDescription>Past and upcoming lessons</CardDescription>
            </CardHeader>
            <CardContent>
              {hook.lessonsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hook.studentLessons?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">No lessons yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Schedule a lesson to see it here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hook.studentLessons.map((sl) => (
                    <div key={sl.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatDateUK(sl.lesson.start_at)} at {formatTimeUK(sl.lesson.start_at)}
                          </span>
                          <Badge variant={
                            sl.lesson.status === 'completed' ? 'default' :
                            sl.lesson.status === 'cancelled' ? 'destructive' :
                            sl.lesson.status === 'scheduled' ? 'secondary' : 'outline'
                          }>
                            {sl.lesson.status}
                          </Badge>
                          {sl.attendance_status && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {sl.attendance_status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          {sl.lesson.title && <span>{sl.lesson.title}</span>}
                          {sl.lesson.teacher_name && <span>with {sl.lesson.teacher_name}</span>}
                          {sl.lesson.location_name && <span>@ {sl.lesson.location_name}</span>}
                        </div>
                      </div>
                      <Link to={`/calendar?date=${sl.lesson.start_at.split('T')[0]}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                  {hook.lessonsHasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => hook.lessonsLoadMore()}
                        disabled={hook.lessonsIsFetchingMore}
                      >
                        {hook.lessonsIsFetchingMore ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Load more
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="invoices">
        <SectionErrorBoundary name="Invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Billing history for this student</CardDescription>
            </CardHeader>
            <CardContent>
              {hook.invoicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !hook.studentInvoices?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">No invoices yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Invoices will appear here when created.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hook.studentInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inv.invoice_number}</span>
                          <Badge variant={
                            inv.status === 'paid' ? 'default' :
                            inv.status === 'overdue' ? 'destructive' :
                            inv.status === 'sent' ? 'secondary' : 'outline'
                          }>
                            {inv.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>{formatCurrencyMinor(inv.total_minor)}</span>
                          {inv.due_date && <span>Due: {formatDateUK(inv.due_date)}</span>}
                          {inv.payer_name && <span>Payer: {inv.payer_name}</span>}
                        </div>
                      </div>
                      <Link to={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="practice">
        <SectionErrorBoundary name="Practice">
          <StudentPracticePanel studentId={student.id} studentName={fullName} />
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="credits">
        <SectionErrorBoundary name="Credits">
          <MakeUpCreditsPanel studentId={student.id} studentName={fullName} />
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="notes">
        <SectionErrorBoundary name="Notes">
          <StudentLessonNotes studentId={student.id} />
        </SectionErrorBoundary>
      </TabsContent>

      <TabsContent value="messages">
        <SectionErrorBoundary name="Messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Messages</CardTitle>
                <CardDescription>Communication history with guardians</CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  const guardianWithEmail = hook.guardians.find(sg => sg.guardian?.email);
                  if (guardianWithEmail?.guardian) {
                    hook.setSelectedGuardianForMessage(guardianWithEmail.guardian);
                    hook.setComposeOpen(true);
                  } else {
                    hook.setComposeOpen(true);
                  }
                }}
              >
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </CardHeader>
            <CardContent>
              {hook.guardians.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 font-medium">Add a guardian first</p>
                  <p className="mt-1 text-sm text-muted-foreground">Link a guardian with an email to send messages.</p>
                </div>
              ) : (
                <MessageList
                  messages={hook.messages || []}
                  isLoading={hook.messagesLoading}
                  emptyMessage="No messages sent to this student's guardians yet."
                  hasMore={hook.messagesHasMore}
                  onLoadMore={() => hook.messagesLoadMore()}
                  isFetchingMore={hook.messagesIsFetchingMore}
                />
              )}
            </CardContent>
          </Card>
        </SectionErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
