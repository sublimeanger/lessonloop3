import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Play, Pause, Square, Timer, Music, RotateCcw } from 'lucide-react';
import { useLogPractice, useParentPracticeAssignments } from '@/hooks/usePractice';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';

// ─── localStorage keys ────────
const STORAGE_KEYS = {
  isRunning: 'practiceTimer_isRunning',
  startedAt: 'practiceTimer_startedAt',
  pausedElapsed: 'practiceTimer_pausedElapsed',
  studentId: 'practiceTimer_studentId',
  assignmentId: 'practiceTimer_assignmentId',
} as const;

function storageSet(key: string, value: string) {
  safeSetItem(key, value);
}
function storageGet(key: string): string | null {
  return safeGetItem(key);
}
function storageClear() {
  Object.values(STORAGE_KEYS).forEach(k => safeRemoveItem(k));
}

interface PracticeTimerProps {
  onComplete?: () => void;
}

export function PracticeTimer({ onComplete }: PracticeTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [resumed, setResumed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const { data: assignments = [], isLoading } = useParentPracticeAssignments();
  const logPractice = useLogPractice();

  // Group assignments by student
  const studentAssignments = assignments.reduce((acc, assignment) => {
    const studentId = assignment.student_id;
    if (!acc[studentId]) {
      acc[studentId] = { student: assignment.student, assignments: [] };
    }
    acc[studentId].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { student: any; assignments: typeof assignments }>);

  const students = Object.entries(studentAssignments);

  // Auto-select first student if only one
  useEffect(() => {
    if (students.length === 1 && !selectedStudentId) {
      const [studentId] = students[0];
      setSelectedStudentId(studentId);
    }
  }, [students, selectedStudentId]);

  // ─── Restore session on mount ─────────────────────────────
  useEffect(() => {
    const wasRunning = storageGet(STORAGE_KEYS.isRunning) === 'true';
    if (!wasRunning) return;

    const savedStartedAt = Number(storageGet(STORAGE_KEYS.startedAt));
    const savedPausedElapsed = Number(storageGet(STORAGE_KEYS.pausedElapsed) || '0');
    const savedStudent = storageGet(STORAGE_KEYS.studentId) || '';
    const savedAssignment = storageGet(STORAGE_KEYS.assignmentId) || '';

    if (!savedStartedAt) { storageClear(); return; }

    const elapsed = savedPausedElapsed + Math.floor((Date.now() - savedStartedAt) / 1000);
    // Cap at 4 hours to discard stale sessions
    if (elapsed > 14400) { storageClear(); return; }

    setSelectedStudentId(savedStudent);
    setSelectedAssignmentId(savedAssignment);
    setElapsedSeconds(elapsed);
    startedAtRef.current = savedStartedAt;
    setIsRunning(true);
    setResumed(true);
    setTimeout(() => setResumed(false), 4000);
  }, []);

  // ─── Timer tick (uses wall-clock for accuracy) ────────────
  useEffect(() => {
    if (isRunning && startedAtRef.current) {
      const pausedElapsed = Number(storageGet(STORAGE_KEYS.pausedElapsed) || '0');
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        setElapsedSeconds(pausedElapsed + Math.floor((now - startedAtRef.current!) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // ─── beforeunload warning ─────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isRunning) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // ─── Persist helpers ──────────────────────────────────────
  const persistRunning = () => {
    const now = Date.now();
    startedAtRef.current = now;
    storageSet(STORAGE_KEYS.isRunning, 'true');
    storageSet(STORAGE_KEYS.startedAt, String(now));
    storageSet(STORAGE_KEYS.pausedElapsed, String(elapsedSeconds));
    storageSet(STORAGE_KEYS.studentId, selectedStudentId);
    storageSet(STORAGE_KEYS.assignmentId, selectedAssignmentId);
  };

  const handleStart = () => {
    if (!selectedStudentId) {
      toast.error('Please select a student first');
      return;
    }
    persistRunning();
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    // Save elapsed so far, clear startedAt
    storageSet(STORAGE_KEYS.isRunning, 'false');
    storageSet(STORAGE_KEYS.pausedElapsed, String(elapsedSeconds));
  };

  const handleStop = async () => {
    setIsRunning(false);
    storageClear();

    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    if (elapsedSeconds < 60) {
      toast.error('Practice must be at least 1 minute');
      return;
    }

    const selectedStudent = studentAssignments[selectedStudentId];
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }

    const assignment = selectedStudent.assignments.find(a => a.id === selectedAssignmentId);

    try {
      await logPractice.mutateAsync({
        org_id: assignment?.org_id || selectedStudent.assignments[0]?.org_id,
        student_id: selectedStudentId,
        assignment_id: selectedAssignmentId || undefined,
        duration_minutes: durationMinutes,
        notes: notes || undefined,
      });

      toast.success(`Practice logged: ${durationMinutes} minutes`);
      setElapsedSeconds(0);
      startedAtRef.current = null;
      setNotes('');
      onComplete?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to log practice');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    startedAtRef.current = null;
    setNotes('');
    storageClear();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading practice assignments...
        </CardContent>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Music className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No practice assignments yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your teacher will assign practice when ready.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentStudentAssignments = selectedStudentId
    ? studentAssignments[selectedStudentId]?.assignments || []
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Practice Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumed banner */}
        {resumed && (
          <Alert>
            <RotateCcw className="h-4 w-4" />
            <AlertDescription>Resuming practice session…</AlertDescription>
          </Alert>
        )}

        {/* Student selector */}
        {students.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Student</label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(([studentId, { student }]) => (
                  <SelectItem key={studentId} value={studentId}>
                    {student?.first_name} {student?.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Assignment selector */}
        {currentStudentAssignments.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Practice Assignment (optional)</label>
            <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">General Practice</SelectItem>
                {currentStudentAssignments.map(assignment => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Timer display */}
        <div className="text-center py-8">
          <div className={`text-6xl font-bold tabular-nums transition-colors ${
            isRunning ? 'text-primary' : 'text-muted-foreground'
          }`}>
            {formatTime(elapsedSeconds)}
          </div>
          {elapsedSeconds > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {Math.round(elapsedSeconds / 60)} minutes
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!isRunning ? (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={!selectedStudentId}
              className="gap-2"
            >
              <Play className="h-5 w-5" />
              {elapsedSeconds > 0 ? 'Resume' : 'Start'}
            </Button>
          ) : (
            <Button size="lg" variant="secondary" onClick={handlePause} className="gap-2">
              <Pause className="h-5 w-5" />
              Pause
            </Button>
          )}

          {elapsedSeconds > 0 && (
            <>
              <Button
                size="lg"
                variant="success"
                onClick={handleStop}
                disabled={logPractice.isPending}
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Save
              </Button>
              <Button size="lg" variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </>
          )}
        </div>

        {/* Notes */}
        {elapsedSeconds > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Practice Notes (optional)</label>
            <Textarea
              placeholder="What did you work on today?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
