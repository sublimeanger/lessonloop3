import { useRef } from 'react';
import { LessonWithDetails } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { RecurringEditDialog } from './RecurringEditDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLessonForm } from './useLessonForm';
import { LessonFormBody } from './lesson-form/LessonFormBody';
import { useCalendarConnections } from '@/hooks/useCalendarConnections';

interface LessonModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lesson?: LessonWithDetails | null;
  initialDate?: Date;
  initialEndDate?: Date;
}

export function LessonModal({ open, onClose, onSaved, lesson, initialDate, initialEndDate }: LessonModalProps) {
  const isMobile = useIsMobile();
  const studentSelectorRef = useRef<HTMLButtonElement>(null);

  const form = useLessonForm({ open, lesson, initialDate, initialEndDate, onSaved, onClose });
  const { zoomConnection } = useCalendarConnections();
  const hasZoomConnection = !!zoomConnection && zoomConnection.sync_status === 'active';

  const footerButtons = (
    <>
      <Button variant="outline" onClick={onClose} className="min-h-[44px]">Cancel</Button>
      <Button onClick={form.handleSaveClick} disabled={form.isSaveDisabled} className="min-h-[44px]">
        {form.isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {form.isSaving && form.savingProgress ? form.savingProgress : form.conflictState.isChecking ? 'Checking...' : (lesson ? 'Save Changes' : 'Create Lesson')}
      </Button>
    </>
  );

  const formBody = (
    <LessonFormBody
      lesson={lesson}
      teachers={form.teachers}
      locations={form.locations}
      students={form.students}
      filteredRooms={form.filteredRooms}
      lessonType={form.lessonType} setLessonType={form.setLessonType}
      teacherId={form.teacherId} setTeacherId={form.setTeacherId}
      selectedStudents={form.selectedStudents} setSelectedStudents={form.setSelectedStudents}
      locationId={form.locationId} setLocationId={form.setLocationId}
      roomId={form.roomId} setRoomId={form.setRoomId}
      selectedDate={form.selectedDate} setSelectedDate={form.setSelectedDate}
      startTime={form.startTime} setStartTime={form.setStartTime}
      durationMins={form.durationMins} setDurationMins={form.setDurationMins}
      notesPrivate={form.notesPrivate} setNotesPrivate={form.setNotesPrivate}
      notesShared={form.notesShared} setNotesShared={form.setNotesShared}
      status={form.status} setStatus={form.setStatus}
      isOnlineLesson={form.isOnlineLesson} setIsOnlineLesson={form.setIsOnlineLesson}
      hasZoomConnection={hasZoomConnection}
      isRecurring={form.isRecurring} setIsRecurring={form.setIsRecurring}
      recurrenceDays={form.recurrenceDays}
      recurrenceEndDate={form.recurrenceEndDate} setRecurrenceEndDate={form.setRecurrenceEndDate}
      studentsOpen={form.studentsOpen} setStudentsOpen={form.setStudentsOpen}
      studentSheetOpen={form.studentSheetOpen} setStudentSheetOpen={form.setStudentSheetOpen}
      conflictState={form.conflictState} setConflictState={form.setConflictState}
      errors={form.errors} warnings={form.warnings}
      closureCheck={form.closureCheck}
      handleStudentToggle={form.handleStudentToggle}
      handleRecurrenceDayToggle={form.handleRecurrenceDayToggle}
      studentSelectorRef={studentSelectorRef}
    />
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader>
              <DrawerTitle>{lesson ? 'Edit Lesson' : 'New Lesson'}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 flex-1">
              {formBody}
            </div>
            <DrawerFooter className="sticky bottom-0 bg-background border-t pt-3 pb-safe flex-row gap-2">
              {footerButtons}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <RecurringEditDialog
          open={form.showRecurringDialog}
          onClose={() => form.setShowRecurringDialog(false)}
          onSelect={form.handleRecurringModeSelect}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>
          {footerButtons}
        </DialogFooter>
      </DialogContent>

      <RecurringEditDialog
        open={form.showRecurringDialog}
        onClose={() => form.setShowRecurringDialog(false)}
        onSelect={form.handleRecurringModeSelect}
      />
    </Dialog>
  );
}
