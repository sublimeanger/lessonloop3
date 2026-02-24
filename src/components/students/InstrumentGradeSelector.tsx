import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { Music, Plus, Trash2, Loader2 } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import {
  useInstruments, useExamBoards, useGradeLevels,
  getGradesForBoard, groupInstrumentsByCategory, getInstrumentCategoryIcon,
} from '@/hooks/useInstruments';
import {
  useStudentInstruments, useAddStudentInstrument,
  useRemoveStudentInstrument,
} from '@/hooks/useStudentInstruments';
import type { StudentInstrumentRow } from '@/hooks/useStudentInstruments';

interface InstrumentGradeSelectorProps {
  studentId: string;
  readOnly?: boolean;
}

export function InstrumentGradeSelector({ studentId, readOnly = false }: InstrumentGradeSelectorProps) {
  const { currentOrg } = useOrg();
  const { data: studentInstruments, isLoading } = useStudentInstruments(studentId);
  const { data: instruments } = useInstruments();
  const { data: examBoards } = useExamBoards();
  const { data: gradeLevels } = useGradeLevels();
  const addMutation = useAddStudentInstrument();
  const removeMutation = useRemoveStudentInstrument();

  const [showAddForm, setShowAddForm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StudentInstrumentRow | null>(null);

  // Add form state
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [selectedExamBoardId, setSelectedExamBoardId] = useState('');
  const [selectedCurrentGradeId, setSelectedCurrentGradeId] = useState('');
  const [selectedTargetGradeId, setSelectedTargetGradeId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const resetForm = () => {
    setSelectedInstrumentId('');
    setSelectedExamBoardId('');
    setSelectedCurrentGradeId('');
    setSelectedTargetGradeId('');
    setIsPrimary(false);
    setShowAddForm(false);
  };

  const handleAdd = () => {
    if (!selectedInstrumentId) return;

    const isFirst = !studentInstruments || studentInstruments.length === 0;

    const cleanId = (v: string) => (v && v !== 'none' ? v : null);

    addMutation.mutate(
      {
        student_id: studentId,
        instrument_id: selectedInstrumentId,
        exam_board_id: cleanId(selectedExamBoardId),
        current_grade_id: cleanId(selectedCurrentGradeId),
        target_grade_id: cleanId(selectedTargetGradeId),
        is_primary: isPrimary || isFirst,
      },
      { onSuccess: resetForm },
    );
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    removeMutation.mutate(
      { id: removeTarget.id, student_id: studentId },
      { onSuccess: () => setRemoveTarget(null) },
    );
  };

  const effectiveExamBoardId = selectedExamBoardId && selectedExamBoardId !== 'none' ? selectedExamBoardId : null;
  const availableGrades = getGradesForBoard(
    gradeLevels || [],
    effectiveExamBoardId,
  );

  // For target grade, filter to grades higher than current
  const currentGradeSortOrder = availableGrades.find(
    (g) => g.id === selectedCurrentGradeId,
  )?.sort_order;
  const targetGradeOptions =
    currentGradeSortOrder != null
      ? availableGrades.filter((g) => g.sort_order > currentGradeSortOrder)
      : availableGrades;

  const grouped = groupInstrumentsByCategory(instruments || []);

  // Instruments already assigned — exclude from add form
  const assignedInstrumentIds = new Set(
    (studentInstruments || []).map((si) => si.instrument_id),
  );

  return (
    <SectionErrorBoundary name="Instruments & Grades">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Instruments & Grades</CardTitle>
              <CardDescription>
                What this student plays and their current grade level
              </CardDescription>
            </div>
          </div>
          {!readOnly && !showAddForm && (
            <Button
              onClick={() => {
                // Pre-fill org's default exam board when opening the form
                if (currentOrg?.default_exam_board_id) {
                  setSelectedExamBoardId(currentOrg.default_exam_board_id);
                }
                setShowAddForm(true);
              }}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Instrument
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !studentInstruments || studentInstruments.length === 0 ? (
            !showAddForm && (
              <div className="flex flex-col items-center py-8 text-center">
                <Music className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 font-medium">No instruments added yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add an instrument to track this student's grade progress.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {studentInstruments.map((si) => (
                <InstrumentRow
                  key={si.id}
                  item={si}
                  readOnly={readOnly}
                  onRemove={() => setRemoveTarget(si)}
                />
              ))}
            </div>
          )}

          {/* Inline Add Form */}
          {showAddForm && (
            <div className="mt-4 rounded-lg border p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instrument select (grouped by category) */}
                <div className="space-y-2">
                  <Label>Instrument *</Label>
                  <Select value={selectedInstrumentId} onValueChange={setSelectedInstrumentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select instrument..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(grouped).map(([category, items]) => (
                        <SelectGroup key={category}>
                          <SelectLabel>
                            {getInstrumentCategoryIcon(category)} {category}
                          </SelectLabel>
                          {items
                            .filter((i) => !assignedInstrumentIds.has(i.id))
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Exam board select */}
                <div className="space-y-2">
                  <Label>Exam Board</Label>
                  <Select
                    value={selectedExamBoardId}
                    onValueChange={(v) => {
                      setSelectedExamBoardId(v);
                      // Reset grades when board changes
                      setSelectedCurrentGradeId('');
                      setSelectedTargetGradeId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not doing exams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not doing exams</SelectItem>
                      {(examBoards || []).map((eb) => (
                        <SelectItem key={eb.id} value={eb.id}>
                          {eb.short_name} — {eb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current grade select */}
                <div className="space-y-2">
                  <Label>Current Grade</Label>
                  <Select value={selectedCurrentGradeId} onValueChange={setSelectedCurrentGradeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGrades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                          {g.is_diploma ? ' (Diploma)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target grade select */}
                <div className="space-y-2">
                  <Label>Target Grade</Label>
                  <Select value={selectedTargetGradeId} onValueChange={setSelectedTargetGradeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No target set</SelectItem>
                      {targetGradeOptions.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                          {g.is_diploma ? ' (Diploma)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-primary"
                  checked={isPrimary}
                  onCheckedChange={(v) => setIsPrimary(v === true)}
                />
                <Label htmlFor="is-primary" className="text-sm font-normal">
                  Primary instrument
                </Label>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedInstrumentId || addMutation.isPending}
                >
                  {addMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Instrument'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove instrument?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {removeTarget?.instrument?.name} and its grade
              information from this student. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete instrument
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionErrorBoundary>
  );
}

/** Individual instrument row display */
function InstrumentRow({
  item,
  readOnly,
  onRemove,
}: {
  item: StudentInstrumentRow;
  readOnly: boolean;
  onRemove: () => void;
}) {
  const categoryIcon = getInstrumentCategoryIcon(item.instrument?.category || '');

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {categoryIcon} {item.instrument?.name}
          </span>
          {item.is_primary && (
            <Badge variant="success" className="text-xs">
              Primary
            </Badge>
          )}
          {item.exam_board && (
            <Badge variant="outline" className="text-xs">
              {item.exam_board.short_name}
            </Badge>
          )}
          {item.current_grade && (
            <Badge variant="secondary" className="text-xs">
              {item.current_grade.name}
            </Badge>
          )}
          {item.target_grade &&
            item.target_grade.id !== item.current_grade?.id && (
              <span className="text-xs text-muted-foreground">
                &rarr; {item.target_grade.name}
              </span>
            )}
        </div>
      </div>
      {!readOnly && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
