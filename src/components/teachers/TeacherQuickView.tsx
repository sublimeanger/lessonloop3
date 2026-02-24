import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Pencil, Mail, Phone, Music, Briefcase, GraduationCap, FileText, Link2, Link2Off, Trash2, Clock } from 'lucide-react';
import { Teacher } from '@/hooks/useTeachers';
import { useQuery } from '@tanstack/react-query';
import { STALE_VOLATILE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { TEACHER_COLOURS } from '@/components/calendar/teacherColours';
import { startOfWeek, endOfWeek } from 'date-fns';

interface TeacherQuickViewProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (teacher: Teacher) => void;
  onRemove?: (teacher: Teacher) => void;
  colour: (typeof TEACHER_COLOURS)[number];
}

export function TeacherQuickView({ teacher, open, onOpenChange, onEdit, onRemove, colour }: TeacherQuickViewProps) {
  const navigate = useNavigate();
  const { currentOrg, isOrgAdmin } = useOrg();

  const { data: assignedStudents = [] } = useQuery({
    queryKey: ['teacher-assigned-students', teacher?.id, currentOrg?.id],
    queryFn: async () => {
      if (!teacher || !currentOrg) return [];
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, is_primary, students!inner(id, first_name, last_name)')
        .eq('org_id', currentOrg.id)
        .eq('teacher_id', teacher.id);

      if (error) throw error;
      type StudentJoin = { id: string; first_name: string; last_name: string };
      return (data || []).map((row) => {
        const s = row.students as unknown as StudentJoin;
        return { id: s.id, name: `${s.first_name} ${s.last_name}`, isPrimary: row.is_primary };
      });
    },
    enabled: !!teacher && !!currentOrg && open,
  });

  const { data: weekStats } = useQuery({
    queryKey: ['teacher-week-stats', teacher?.id, currentOrg?.id],
    queryFn: async () => {
      if (!teacher || !currentOrg) return null;
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const { data, error } = await supabase
        .from('lessons')
        .select('start_at, end_at')
        .eq('org_id', currentOrg.id)
        .eq('teacher_id', teacher.id)
        .eq('status', 'scheduled')
        .gte('start_at', weekStart.toISOString())
        .lte('start_at', weekEnd.toISOString());

      if (error || !data) return { count: 0, hours: 0 };
      const totalMinutes = data.reduce((sum, l) => {
        return sum + (new Date(l.end_at).getTime() - new Date(l.start_at).getTime()) / 60000;
      }, 0);
      return { count: data.length, hours: Math.round(totalMinutes / 60 * 10) / 10 };
    },
    enabled: !!teacher && !!currentOrg && open,
    staleTime: STALE_VOLATILE,
  });

  if (!teacher) return null;

  const infoRows: { icon: React.ReactNode; label: string; value: string | null }[] = [
    { icon: <Mail className="h-4 w-4" />, label: 'Email', value: teacher.email },
    { icon: <Phone className="h-4 w-4" />, label: 'Phone', value: teacher.phone },
    { icon: <Music className="h-4 w-4" />, label: 'Instruments', value: teacher.instruments?.length ? teacher.instruments.join(', ') : null },
    { icon: <Briefcase className="h-4 w-4" />, label: 'Employment', value: teacher.employment_type === 'employee' ? 'Employee' : 'Contractor' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-[100dvh] w-full overflow-y-auto sm:h-auto sm:w-[640px] sm:max-w-[640px]">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: colour.hex }}
            >
              {teacher.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-left truncate">{teacher.display_name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                {teacher.isLinked ? (
                  <Badge variant="outline" className="text-micro gap-1">
                    <Link2 className="h-3 w-3" />
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-micro gap-1">
                    <Link2Off className="h-3 w-3" />
                    Unlinked
                  </Badge>
                )}
                <Badge variant={teacher.status === 'active' ? 'success' : 'destructive'} className="text-micro">
                  {teacher.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Actions */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-9"
            onClick={() => {
              onOpenChange(false);
              navigate(`/calendar?teacher=${teacher.id}`);
            }}
          >
            <Calendar className="h-3.5 w-3.5" />
            View Calendar
          </Button>
          <Button
            size="sm"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-9"
            onClick={() => {
              onOpenChange(false);
              onEdit(teacher);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
        {isOrgAdmin && onRemove && (
          <div className="mb-6">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-full gap-1.5 text-destructive hover:text-destructive sm:min-h-9"
              onClick={() => {
                onOpenChange(false);
                onRemove(teacher);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Teacher
            </Button>
          </div>
        )}

        {/* Weekly Stats */}
        {weekStats && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              This week: <span className="font-medium text-foreground">{weekStats.count} lesson{weekStats.count !== 1 ? 's' : ''}</span> · <span className="font-medium text-foreground">{weekStats.hours}h</span>
            </span>
          </div>
        )}

        <Separator />

        {/* Details */}
        <div className="space-y-3 py-4">
          {infoRows.map((row) => row.value && (
            <div key={row.label} className="flex items-start gap-3">
              <div className="text-muted-foreground mt-0.5">{row.icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm truncate">{row.value}</p>
              </div>
            </div>
          ))}

          {/* Calendar Colour */}
          <div className="flex items-start gap-3">
            <div className="text-muted-foreground mt-0.5"><Calendar className="h-4 w-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Calendar Colour</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: colour.hex }} />
                <span className="text-sm">{colour.name}</span>
              </div>
            </div>
          </div>

          {isOrgAdmin && teacher.pay_rate_type && teacher.pay_rate_value != null && (
            <div className="flex items-start gap-3">
              <div className="text-muted-foreground mt-0.5"><Briefcase className="h-4 w-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pay Rate</p>
                <p className="text-sm">
                  £{(teacher.pay_rate_value ?? 0).toFixed(2)}{' '}
                  {teacher.pay_rate_type === 'per_lesson' ? '/ lesson' : teacher.pay_rate_type === 'hourly' ? '/ hour' : '(%)'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bio */}
        {teacher.bio && (
          <>
            <Separator />
            <div className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Bio</p>
              </div>
              <p className="text-sm leading-relaxed">{teacher.bio}</p>
            </div>
          </>
        )}

        {/* Assigned Students */}
        <Separator />
        <div className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              Assigned Students ({assignedStudents.length})
            </p>
          </div>
          {assignedStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned</p>
          ) : (
            <div className="space-y-1.5">
              {assignedStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/students/${s.id}`);
                  }}
                >
                  <span>{s.name}</span>
                  {s.isPrimary && (
                    <Badge variant="outline" className="text-micro">Primary</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}