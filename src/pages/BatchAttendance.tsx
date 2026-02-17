import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Save, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];

interface LessonRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  participants: {
    student_id: string;
    student_name: string;
    current_status: AttendanceStatus | null;
  }[];
}

export default function BatchAttendance() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Map: lessonId -> studentId -> status
  const [attendance, setAttendance] = useState<Map<string, Map<string, AttendanceStatus>>>(new Map());

  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!currentOrg) return;
    const fetchData = async () => {
      setIsLoading(true);
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select(`
          id, title, start_at, end_at, status,
          lesson_participants(student_id, student:students(id, first_name, last_name)),
          attendance_records(student_id, attendance_status)
        `)
        .eq('org_id', currentOrg.id)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd)
        .in('status', ['scheduled', 'completed'])
        .order('start_at', { ascending: true });

      if (!lessonsData) {
        setIsLoading(false);
        return;
      }

      const rows: LessonRow[] = lessonsData.map((l: any) => ({
        id: l.id,
        title: l.title,
        start_at: l.start_at,
        end_at: l.end_at,
        status: l.status,
        participants: (l.lesson_participants || []).map((p: any) => {
          const existing = (l.attendance_records || []).find((a: any) => a.student_id === p.student_id);
          return {
            student_id: p.student_id,
            student_name: p.student ? `${p.student.first_name} ${p.student.last_name}` : 'Unknown',
            current_status: existing?.attendance_status || null,
          };
        }),
      }));

      setLessons(rows);

      // Initialize attendance map from existing records
      const map = new Map<string, Map<string, AttendanceStatus>>();
      rows.forEach((lesson) => {
        const studentMap = new Map<string, AttendanceStatus>();
        lesson.participants.forEach((p) => {
          if (p.current_status) studentMap.set(p.student_id, p.current_status);
        });
        map.set(lesson.id, studentMap);
      });
      setAttendance(map);
      setIsLoading(false);
    };
    fetchData();
  }, [currentOrg, today]);

  const setStudentAttendance = useCallback(
    (lessonId: string, studentId: string, status: AttendanceStatus) => {
      setAttendance((prev) => {
        const next = new Map(prev);
        const lessonMap = new Map(next.get(lessonId) || []);
        lessonMap.set(studentId, status);
        next.set(lessonId, lessonMap);
        return next;
      });
    },
    []
  );

  const markAllPresent = useCallback(() => {
    setAttendance((prev) => {
      const next = new Map(prev);
      lessons.forEach((lesson) => {
        const lessonMap = new Map(next.get(lesson.id) || []);
        lesson.participants.forEach((p) => {
          if (!lessonMap.has(p.student_id)) {
            lessonMap.set(p.student_id, 'present');
          }
        });
        next.set(lesson.id, lessonMap);
      });
      return next;
    });
  }, [lessons]);

  const handleSave = async () => {
    if (!currentOrg || !user) return;
    setIsSaving(true);

    try {
      const upserts: {
        lesson_id: string;
        student_id: string;
        attendance_status: AttendanceStatus;
        org_id: string;
        recorded_by: string;
      }[] = [];

      attendance.forEach((studentMap, lessonId) => {
        studentMap.forEach((status, studentId) => {
          upserts.push({
            lesson_id: lessonId,
            student_id: studentId,
            attendance_status: status,
            org_id: currentOrg.id,
            recorded_by: user.id,
          });
        });
      });

      if (upserts.length === 0) {
        toast({ title: 'Nothing to save', description: 'No attendance records marked.' });
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('attendance_records')
        .upsert(upserts, { onConflict: 'lesson_id,student_id' });

      if (error) throw error;

      toast({
        title: 'Attendance saved',
        description: `${upserts.length} records updated successfully.`,
      });
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast({
        title: 'Failed to save',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalStudents = lessons.reduce((sum, l) => sum + l.participants.length, 0);
  const markedCount = Array.from(attendance.values()).reduce(
    (sum, m) => sum + m.size,
    0
  );

  return (
    <AppLayout>
      <PageHeader
        title="Batch Attendance"
        description={`Mark attendance for all of today's lessons — ${format(today, 'EEEE, d MMMM yyyy')}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Calendar', href: '/calendar' },
          { label: 'Batch Attendance' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllPresent} className="gap-1.5">
              <UserCheck className="h-4 w-4" />
              Mark All Present
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All ({markedCount}/{totalStudents})
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No lessons today</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no scheduled or completed lessons for today.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const lessonMap = attendance.get(lesson.id) || new Map();
            return (
              <Card key={lesson.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {format(parseISO(lesson.start_at), 'HH:mm')} – {format(parseISO(lesson.end_at), 'HH:mm')}
                      <span className="ml-2 font-normal text-muted-foreground">{lesson.title}</span>
                    </CardTitle>
                    <Badge variant={lesson.status === 'completed' ? 'secondary' : 'default'}>
                      {lesson.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {lesson.participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {lesson.participants.map((p) => {
                        const currentStatus = lessonMap.get(p.student_id) || null;
                        return (
                          <div
                            key={p.student_id}
                            className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
                          >
                            <span className="text-sm font-medium">{p.student_name}</span>
                            <ToggleGroup
                              type="single"
                              value={currentStatus || ''}
                              onValueChange={(v) => {
                                if (v) setStudentAttendance(lesson.id, p.student_id, v as AttendanceStatus);
                              }}
                              className="gap-1"
                            >
                              <ToggleGroupItem
                                value="present"
                                aria-label="Present"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'present' && 'bg-primary/15 text-primary border-primary/30'
                                )}
                              >
                                Present
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="absent"
                                aria-label="Absent"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'absent' && 'bg-destructive/15 text-destructive border-destructive/30'
                                )}
                              >
                                Absent
                              </ToggleGroupItem>
                              <ToggleGroupItem
                                value="late"
                                aria-label="Late"
                                className={cn(
                                  'h-7 px-2 text-xs',
                                  currentStatus === 'late' && 'bg-warning/15 text-warning border-warning/30'
                                )}
                              >
                                Late
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
