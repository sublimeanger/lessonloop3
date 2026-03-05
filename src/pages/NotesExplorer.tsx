import { useState, useMemo } from 'react';
import { subDays, startOfDay, endOfDay, format, parseISO } from 'date-fns';
import { FileText, Download } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { NotesFilterBar } from '@/components/notes/NotesFilterBar';
import { NotesStatsBar } from '@/components/notes/NotesStatsBar';
import { NoteCard } from '@/components/notes/NoteCard';
import { useNotesExplorer, useNotesStats, type NotesExplorerFilters, type ExplorerNote } from '@/hooks/useNotesExplorer';
import { useOrg } from '@/contexts/OrgContext';
import { useOrgTimezone } from '@/hooks/useOrgTimezone';
import { useTeachers } from '@/hooks/useTeachers';
import { formatDateUK, sanitiseCSVCell } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';

const DEFAULT_FILTERS: NotesExplorerFilters = {
  startDate: startOfDay(subDays(new Date(), 6)).toISOString(),
  endDate: endOfDay(new Date()).toISOString(),
};

export default function NotesExplorer() {
  usePageMeta('Lesson Notes Explorer | LessonLoop', 'Review all lesson notes across students and dates');

  const { currentOrg, isOrgAdmin, currentRole } = useOrg();
  const { timezone, formatDate, formatTime } = useOrgTimezone();
  const isTeacherRole = currentRole === 'teacher';

  const [filters, setFilters] = useState<NotesExplorerFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);

  const { data: teachersList } = useTeachers();
  const teachers = useMemo(
    () => (teachersList || []).map(t => ({ id: t.id, display_name: t.display_name })),
    [teachersList],
  );

  const { data, isLoading } = useNotesExplorer(filters, page);
  const { data: stats, isLoading: statsLoading } = useNotesStats(filters);

  // Group notes by date
  const groupedNotes = useMemo(() => {
    if (!data?.notes) return [];
    const groups: { date: string; dateLabel: string; notes: ExplorerNote[] }[] = [];
    const dateMap = new Map<string, ExplorerNote[]>();

    for (const note of data.notes) {
      const dateKey = format(parseISO(note.lesson_start_at), 'yyyy-MM-dd');
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(note);
    }

    for (const [dateKey, notes] of dateMap) {
      groups.push({
        date: dateKey,
        dateLabel: formatDateUK(parseISO(dateKey), 'EEEE, d MMMM yyyy', timezone as string),
        notes: notes.sort((a, b) => a.lesson_start_at.localeCompare(b.lesson_start_at)),
      });
    }

    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [data?.notes, timezone]);

  // CSV export
  const exportCSV = () => {
    if (!data?.notes?.length) return;
    const headers = ['Date', 'Time', 'Student', 'Teacher', 'Content Covered', 'Homework', 'Focus Areas', 'Engagement', 'Parent Visible'];
    const rows = data.notes.map(n => [
      formatDate(n.lesson_start_at, 'dd/MM/yyyy'),
      formatDate(n.lesson_start_at, 'HH:mm'),
      n.student_first_name ? `${n.student_first_name} ${n.student_last_name || ''}`.trim() : '',
      n.teacher_display_name || '',
      sanitiseCSVCell(n.content_covered || ''),
      sanitiseCSVCell(n.homework || ''),
      sanitiseCSVCell(n.focus_areas || ''),
      n.engagement_rating?.toString() || '',
      n.parent_visible ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson-notes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF export
  const exportPDF = () => {
    if (!data?.notes?.length) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text('Lesson Notes Report', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.text(`${formatDateUK(filters.startDate, 'dd/MM/yyyy')} — ${formatDateUK(filters.endDate, 'dd/MM/yyyy')}`, 14, y);
    y += 10;

    for (const group of groupedNotes) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(group.dateLabel, 14, y);
      y += 6;

      for (const note of group.notes) {
        if (y > 260) { doc.addPage(); y = 20; }
        const studentName = note.student_first_name ? `${note.student_first_name} ${note.student_last_name || ''}`.trim() : 'All';

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatDate(note.lesson_start_at, 'HH:mm')} — ${note.lesson_title} (${studentName})`, 18, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        if (note.content_covered) {
          const lines = doc.splitTextToSize(`Content: ${note.content_covered}`, 170);
          doc.text(lines, 22, y);
          y += lines.length * 4;
        }
        if (note.homework) {
          const lines = doc.splitTextToSize(`Homework: ${note.homework}`, 170);
          doc.text(lines, 22, y);
          y += lines.length * 4;
        }
        y += 3;
      }
      y += 4;
    }

    doc.save(`lesson-notes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleFiltersChange = (newFilters: NotesExplorerFilters) => {
    setFilters(newFilters);
    setPage(0);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Lesson Notes"
          description="Review all lesson notes across students and dates"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.notes?.length}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF} disabled={!data?.notes?.length}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                PDF
              </Button>
            </div>
          }
        />

        <NotesFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          teachers={teachers}
          isTeacherRole={isTeacherRole}
        />

        <NotesStatsBar stats={stats} isLoading={statsLoading} />

        {/* Notes list */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : groupedNotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No lesson notes found"
            description="No lesson notes found for this period. Notes are created from the lesson detail panel on the calendar."
          />
        ) : (
          <div className="space-y-6">
            {groupedNotes.map(group => (
              <div key={group.date}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">{group.dateLabel}</h3>
                <div className="space-y-2">
                  {group.notes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isAdmin={isOrgAdmin}
                      timezone={timezone}
                    />
                  ))}
                </div>
              </div>
            ))}

            {data?.hasMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setPage(p => p + 1)}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
