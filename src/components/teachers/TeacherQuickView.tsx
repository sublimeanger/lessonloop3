import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Pencil, Mail, Phone, Music, Briefcase, GraduationCap, FileText, Link2, Link2Off } from 'lucide-react';
import { Teacher } from '@/hooks/useTeachers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { TEACHER_COLOURS } from '@/components/calendar/teacherColours';

interface TeacherQuickViewProps {
  teacher: Teacher | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (teacher: Teacher) => void;
  colour: (typeof TEACHER_COLOURS)[number];
}

export function TeacherQuickView({ teacher, open, onOpenChange, onEdit, colour }: TeacherQuickViewProps) {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();

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
      return (data || []).map((row: any) => ({
        id: row.students.id,
        name: `${row.students.first_name} ${row.students.last_name}`,
        isPrimary: row.is_primary,
      }));
    },
    enabled: !!teacher && !!currentOrg && open,
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
      <SheetContent className="overflow-y-auto">
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
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Link2 className="h-3 w-3" />
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Link2Off className="h-3 w-3" />
                    Unlinked
                  </Badge>
                )}
                <Badge variant={teacher.status === 'active' ? 'default' : 'destructive'} className="text-[10px]">
                  {teacher.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Actions */}
        <div className="flex gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1"
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
            className="gap-1.5 flex-1"
            onClick={() => {
              onOpenChange(false);
              onEdit(teacher);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>

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

          {teacher.pay_rate_type && teacher.pay_rate_value != null && (
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
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/students/${s.id}`);
                  }}
                >
                  <span>{s.name}</span>
                  {s.isPrimary && (
                    <Badge variant="outline" className="text-[10px]">Primary</Badge>
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
