import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, Square, Timer, Music, RotateCcw, Zap, CheckCircle } from 'lucide-react';
import { useLogPractice, useParentPracticeAssignments } from '@/hooks/usePractice';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StreakCelebration } from '@/components/practice/StreakCelebration';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── localStorage keys (user-scoped) ────────
function getStorageKeys(userId: string | undefined) {
  const prefix = userId ? `practiceTimer_${userId}` : 'practiceTimer';
  return {
    isRunning: `${prefix}_isRunning`,
    startedAt: `${prefix}_startedAt`,
    pausedElapsed: `${prefix}_pausedElapsed`,
    studentId: `${prefix}_studentId`,
    assignmentId: `${prefix}_assignmentId`,
  };
}

function storageSet(key: string, value: string) {
  safeSetItem(key, value);
}
function storageGet(key: string): string | null {
  return safeGetItem(key);
}
function storageClear(keys: ReturnType<typeof getStorageKeys>) {
  Object.values(keys).forEach(k => safeRemoveItem(k));
}

interface PracticeTimerProps {
  onComplete?: () => void;
}

const DURATION_PRESETS = [15, 30, 45, 60];

export function PracticeTimer({ onComplete }: PracticeTimerProps) {
  const { user } = useAuth();
  const STORAGE_KEYS = useMemo(() => getStorageKeys(user?.id), [user?.id]);

  const [mode, setMode] = useState<'timer' | 'quick'>('timer');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [resumed, setResumed] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Quick log state
  const [quickDuration, setQuickDuration] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

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
  }, {} as Record<string, { student: { id: string; first_name: string; last_name: string } | undefined; assignments: typeof assignments }>);

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
    if (!user?.id) return;
    const wasRunning = storageGet(STORAGE_KEYS.isRunning) === 'true';
    if (!wasRunning) return;

    const savedStartedAt = Number(storageGet(STORAGE_KEYS.startedAt));
    const savedPausedElapsed = Number(storageGet(STORAGE_KEYS.pausedElapsed) || '0');
    const savedStudent = storageGet(STORAGE_KEYS.studentId) || '';
    const savedAssignment = storageGet(STORAGE_KEYS.assignmentId) || '';

    if (!savedStartedAt) { storageClear(STORAGE_KEYS); return; }

    const elapsed = savedPausedElapsed + Math.floor((Date.now() - savedStartedAt) / 1000);
    if (elapsed > 14400) { storageClear(STORAGE_KEYS); return; }

    setSelectedStudentId(savedStudent);
    setSelectedAssignmentId(savedAssignment);
    setElapsedSeconds(elapsed);
    startedAtRef.current = savedStartedAt;
    setIsRunning(true);
    setMode('timer');
    setResumed(true);
    setTimeout(() => setResumed(false), 4000);
  }, [user?.id, STORAGE_KEYS]);

  // ─── Timer tick ────────────
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

  // ─── beforeunload warning ────────────
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
    storageSet(STORAGE_KEYS.isRunning, 'false');
    storageSet(STORAGE_KEYS.pausedElapsed, String(elapsedSeconds));
  };

  // Shared milestone check
  const checkMilestone = async (studentId: string) => {
    const MILESTONES = [3, 7, 14, 30, 60, 100];
    const { data: updatedStreak } = await supabase
      .from('practice_streaks')
      .select('current_streak')
      .eq('student_id', studentId)
      .maybeSingle();
    if (updatedStreak && MILESTONES.includes(updatedStreak.current_streak)) {
      setCelebrationStreak(updatedStreak.current_streak);
    }
  };

  const handleStop = async () => {
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    if (elapsedSeconds < 60) {
      toast.error('Practice must be at least 1 minute');
      return;
    }

    try {
      setIsRunning(false);

      await logPractice.mutateAsync({
        student_id: selectedStudentId,
        assignment_id: selectedAssignmentId || undefined,
        duration_minutes: durationMinutes,
        notes: notes || undefined,
      });

      await checkMilestone(selectedStudentId);

      storageClear(STORAGE_KEYS);
      toast.success(`Practice logged: ${durationMinutes} minutes`);
      setElapsedSeconds(0);
      startedAtRef.current = null;
      setNotes('');
      onComplete?.();
    } catch (error: unknown) {
      setIsRunning(true);
      persistRunning();
      toast.error(error instanceof Error ? error.message : 'Failed to log practice — your session is preserved.');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    startedAtRef.current = null;
    setNotes('');
    storageClear(STORAGE_KEYS);
  };

  // ─── Quick Log handler ────────────
  const handleQuickLog = async () => {
    const duration = quickDuration || parseInt(customDuration);
    if (!duration || duration < 1) {
      toast.error('Please select or enter a duration');
      return;
    }
    if (duration > 720) {
      toast.error('Duration cannot exceed 12 hours');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }

    try {
      await logPractice.mutateAsync({
        student_id: selectedStudentId,
        assignment_id: selectedAssignmentId || undefined,
        duration_minutes: duration,
        practice_date: format(new Date(), 'yyyy-MM-dd'),
        notes: quickNotes || undefined,
      });

      await checkMilestone(selectedStudentId);

      toast.success(`Practice logged: ${duration} minutes`);
      setQuickDuration(null);
      setCustomDuration('');
      setQuickNotes('');
      onComplete?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to log practice');
    }
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

  // ─── Student & Assignment selectors (shared) ──────────
  const renderSelectors = (disabled: boolean) => (
    <>
      {students.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Student</label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={disabled}>
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

      {currentStudentAssignments.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Assignment (optional)</label>
          <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId} disabled={disabled}>
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
    </>
  );

  const effectiveDuration = quickDuration || (customDuration ? parseInt(customDuration) : 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Practice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'timer' | 'quick')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timer" className="gap-1.5" disabled={isRunning}>
                <Timer className="h-4 w-4" />
                Timer
              </TabsTrigger>
              <TabsTrigger value="quick" className="gap-1.5" disabled={isRunning}>
                <Zap className="h-4 w-4" />
                Quick Log
              </TabsTrigger>
            </TabsList>

            {/* ─── Timer Tab ──────────────── */}
            <TabsContent value="timer" className="mt-4 space-y-4">
              {resumed && (
                <Alert>
                  <RotateCcw className="h-4 w-4" />
                  <AlertDescription>Resuming practice session…</AlertDescription>
                </Alert>
              )}

              {renderSelectors(isRunning)}

              {/* Timer display */}
              <div className="text-center py-6">
                <div className={cn(
                  'text-6xl font-bold tabular-nums transition-colors',
                  isRunning ? 'text-primary' : 'text-muted-foreground'
                )}>
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
                    className="gap-2 active:scale-[0.98] transition-transform"
                  >
                    <Play className="h-5 w-5" />
                    {elapsedSeconds > 0 ? 'Resume' : 'Start'}
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" onClick={handlePause} className="gap-2 active:scale-[0.98] transition-transform">
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
                      className="gap-2 active:scale-[0.98] transition-transform"
                    >
                      <Square className="h-5 w-5" />
                      Save
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset} className="active:scale-[0.98] transition-transform">
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
            </TabsContent>

            {/* ─── Quick Log Tab ──────────── */}
            <TabsContent value="quick" className="mt-4 space-y-4">
              {renderSelectors(false)}

              {/* Duration presets */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map(mins => (
                    <Button
                      key={mins}
                      type="button"
                      variant={quickDuration === mins ? 'default' : 'outline'}
                      className={cn(
                        'min-h-[44px] text-base font-semibold active:scale-[0.96] transition-all',
                        quickDuration === mins && 'ring-2 ring-primary/30'
                      )}
                      onClick={() => {
                        setQuickDuration(mins);
                        setCustomDuration('');
                      }}
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    placeholder="Custom mins"
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value);
                      setQuickDuration(null);
                    }}
                    className="max-w-[140px]"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="What did you practise?"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full min-h-[48px] text-base gap-2 active:scale-[0.98] transition-transform"
                onClick={handleQuickLog}
                disabled={logPractice.isPending || !selectedStudentId || !effectiveDuration}
              >
                <CheckCircle className="h-5 w-5" />
                {logPractice.isPending ? 'Logging...' : `Log ${effectiveDuration || ''} ${effectiveDuration ? 'min' : 'Practice'}`}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {celebrationStreak !== null && (
        <StreakCelebration
          streak={celebrationStreak}
          onDismiss={() => setCelebrationStreak(null)}
        />
      )}
    </>
  );
}
