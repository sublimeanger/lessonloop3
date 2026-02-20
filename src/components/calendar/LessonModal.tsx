import { useRef } from 'react';
import { format } from 'date-fns';
import { LessonWithDetails, LessonStatus } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Loader2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { RecurringEditDialog } from './RecurringEditDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLessonForm } from './useLessonForm';

interface LessonModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lesson?: LessonWithDetails | null;
  initialDate?: Date;
  initialEndDate?: Date;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const TIME_OPTIONS = Array.from({ length: 56 }, (_, i) => {
  const hour = Math.floor(i / 4) + 7;
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function LessonModal({ open, onClose, onSaved, lesson, initialDate, initialEndDate }: LessonModalProps) {
  const isMobile = useIsMobile();
  const studentSelectorRef = useRef<HTMLButtonElement>(null);

  const {
    teachers, locations, students,
    lessonType, setLessonType,
    teacherId, setTeacherId,
    selectedStudents, setSelectedStudents,
    locationId, setLocationId,
    roomId, setRoomId,
    selectedDate, setSelectedDate,
    startTime, setStartTime,
    durationMins, setDurationMins,
    notesPrivate, setNotesPrivate,
    notesShared, setNotesShared,
    status, setStatus,
    isRecurring, setIsRecurring,
    recurrenceDays,
    recurrenceEndDate, setRecurrenceEndDate,
    isSaving, savingProgress,
    studentsOpen, setStudentsOpen,
    studentSheetOpen, setStudentSheetOpen,
    showRecurringDialog, setShowRecurringDialog,
    conflictState, setConflictState,
    filteredRooms, errors, warnings, isSaveDisabled,
    closureCheck,
    handleStudentToggle,
    handleSaveClick,
    handleRecurringModeSelect,
    handleRecurrenceDayToggle,
  } = useLessonForm({ open, lesson, initialDate, initialEndDate, onSaved, onClose });

  // ─── Student selector content (shared between mobile sheet & desktop popover) ───
  const studentSelectorContent = (
    <Command>
      <CommandInput placeholder="Search students..." className="min-h-[44px]" />
      <CommandList className={isMobile ? "max-h-[60vh]" : ""}>
        <CommandEmpty>No students found.</CommandEmpty>
        <CommandGroup>
          {students.map((student) => (
            <CommandItem
              key={student.id}
              onSelect={() => handleStudentToggle(student.id)}
              className="min-h-[44px]"
            >
              <Checkbox
                checked={selectedStudents.includes(student.id)}
                className="mr-2"
              />
              {student.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  // ─── Duration selector: chips on mobile, dropdown on desktop ───
  const durationSelector = isMobile ? (
    <div className="space-y-2">
      <Label>Duration</Label>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {DURATION_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDurationMins(d)}
            className={cn(
              "shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium border transition-colors",
              durationMins === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent"
            )}
          >
            {d} min
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="space-y-2">
      <Label>Duration</Label>
      <Select value={durationMins.toString()} onValueChange={(v) => setDurationMins(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATION_OPTIONS.map((d) => (
            <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ─── Form body (shared between Dialog & Drawer) ───
  const formBody = (
    <div className="space-y-4 py-4">
      {/* Lesson Type */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={lessonType === 'private' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => {
            setLessonType('private');
            if (selectedStudents.length > 1) {
              setSelectedStudents([selectedStudents[0]]);
            }
          }}
        >
          Private Lesson
        </Button>
        <Button
          type="button"
          variant={lessonType === 'group' ? 'default' : 'outline'}
          className="flex-1 min-h-[44px]"
          onClick={() => setLessonType('group')}
        >
          Group Lesson
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Teacher</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students */}
      <div className="space-y-2">
        <Label>Student{lessonType === 'group' ? 's' : ''}</Label>
        {isMobile ? (
          <>
            <Button
              ref={studentSelectorRef}
              variant="outline"
              className="w-full justify-start text-left font-normal min-h-[44px]"
              onClick={() => setStudentSheetOpen(true)}
            >
              {selectedStudents.length === 0 ? (
                <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
              ) : (
                <span className="truncate">
                  {selectedStudents.map(id => students.find(s => s.id === id)?.name).join(', ')}
                </span>
              )}
            </Button>
            <Sheet open={studentSheetOpen} onOpenChange={setStudentSheetOpen}>
              <SheetContent side="bottom" className="h-[85vh] p-0" hideCloseButton>
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Select Student{lessonType === 'group' ? 's' : ''}</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  {studentSelectorContent}
                </div>
                {lessonType === 'group' && (
                  <div className="p-4 border-t">
                    <Button className="w-full min-h-[44px]" onClick={() => setStudentSheetOpen(false)}>
                      Done ({selectedStudents.length} selected)
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={studentsOpen} onOpenChange={setStudentsOpen}>
            <PopoverTrigger asChild>
              <Button ref={studentSelectorRef} variant="outline" className="w-full justify-start text-left font-normal">
                {selectedStudents.length === 0 ? (
                  <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
                ) : (
                  <span className="truncate">
                    {selectedStudents.map(id => students.find(s => s.id === id)?.name).join(', ')}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              {studentSelectorContent}
            </PopoverContent>
          </Popover>
        )}
        {selectedStudents.length > 0 && lessonType === 'group' && (
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedStudents.map(id => {
              const student = students.find(s => s.id === id);
              return (
                <Badge key={id} variant="secondary" className="gap-1">
                  {student?.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedStudents(prev => prev.filter(s => s !== id))}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Date & Time */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "top" : "bottom"}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Time</Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>{time}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {durationSelector}
      </div>

      {/* Location & Room */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select value={locationId || 'none'} onValueChange={(v) => { setLocationId(v === 'none' ? null : v); setRoomId(null); }}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Room</Label>
          <Select
            value={roomId || 'none'}
            onValueChange={(v) => setRoomId(v === 'none' ? null : v)}
            disabled={!locationId}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue placeholder={locationId ? "Select room" : "Select location first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No room</SelectItem>
              {filteredRooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recurrence */}
      {!lesson && (
        <div className="space-y-3">
          <div className="flex items-center justify-between min-h-[44px]">
            <Label htmlFor="recurring">Recurring lesson</Label>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {isRecurring && (
            <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
              <div className="space-y-2">
                <Label className="text-sm">Repeat on</Label>
                <div className="flex gap-1 flex-wrap">
                  {DAY_NAMES.map((day, i) => (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={recurrenceDays.includes(i) ? 'default' : 'outline'}
                      className="w-10 h-10 text-xs"
                      onClick={() => handleRecurrenceDayToggle(i)}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">End date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal min-h-[44px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEndDate ? format(recurrenceEndDate, 'dd MMM yyyy') : 'No end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side={isMobile ? "top" : "bottom"}>
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate || undefined}
                      onSelect={(date) => setRecurrenceEndDate(date || null)}
                      disabled={(date) => date < selectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {closureCheck.hasConflicts && (
                <Alert className="border-secondary bg-secondary/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">{closureCheck.warningMessage}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      These lessons will be skipped automatically.
                    </p>
                    {closureCheck.conflicts.length <= 5 && (
                      <ul className="text-xs mt-2 space-y-0.5 text-muted-foreground">
                        {closureCheck.conflicts.map((c, i) => (
                          <li key={i}>
                            • {format(c.date, 'EEE, d MMM')}: {c.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label>Shared notes (visible to parents)</Label>
        <Textarea
          value={notesShared}
          onChange={(e) => setNotesShared(e.target.value)}
          placeholder="Add lesson notes that parents can see..."
          rows={2}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Private notes (visible to staff only)</Label>
        <Textarea
          value={notesPrivate}
          onChange={(e) => setNotesPrivate(e.target.value)}
          placeholder="Add internal notes about this lesson..."
          rows={2}
          className="min-h-[44px]"
        />
      </div>

      {/* Status (edit mode only) */}
      {lesson && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
            <SelectTrigger className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Conflict alerts */}
      <div className="min-h-[60px]">
        {conflictState.isChecking && (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for conflicts...
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => setConflictState({
                isChecking: false,
                conflicts: [{
                  type: 'teacher',
                  severity: 'warning',
                  message: 'Conflict check skipped. Please verify manually.',
                }]
              })}
            >
              Skip
            </Button>
          </div>
        )}

        {!conflictState.isChecking && errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errors.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {!conflictState.isChecking && warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {warnings.map((w, i) => (
                <div key={i}>{w.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );

  // ─── Footer buttons (shared) ───
  const footerButtons = (
    <>
      <Button variant="outline" onClick={onClose} className="min-h-[44px]">Cancel</Button>
      <Button onClick={handleSaveClick} disabled={isSaveDisabled} className="min-h-[44px]">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {isSaving && savingProgress ? savingProgress : conflictState.isChecking ? 'Checking...' : (lesson ? 'Save Changes' : 'Create Lesson')}
      </Button>
    </>
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
          open={showRecurringDialog}
          onClose={() => setShowRecurringDialog(false)}
          onSelect={handleRecurringModeSelect}
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
        open={showRecurringDialog}
        onClose={() => setShowRecurringDialog(false)}
        onSelect={handleRecurringModeSelect}
      />
    </Dialog>
  );
}
