import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { DetailSkeleton } from '@/components/shared/LoadingState';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { StudentTabsSection } from '@/components/students/StudentTabsSection';
import { useStudentDetailPage } from '@/hooks/useStudentDetailPage';
import { Edit, Trash2 } from 'lucide-react';

export default function StudentDetail() {
  const hook = useStudentDetailPage();

  if (hook.isLoading || !hook.student) {
    return (
      <AppLayout>
        <DetailSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={hook.fullName}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Students', href: '/students' },
          { label: hook.fullName },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => hook.setIsEditing(!hook.isEditing)}>
              <Edit className="mr-2 h-4 w-4" />
              {hook.isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {hook.isOrgAdmin && (
              <Button variant="destructive" size="icon" onClick={hook.handleDeleteClick}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      <StudentTabsSection hook={hook} />

      {/* Compose Message Modal */}
      <ComposeMessageModal
        open={hook.composeOpen}
        onOpenChange={hook.setComposeOpen}
        guardians={hook.guardians.filter(sg => sg.guardian?.email).map(sg => sg.guardian!)}
        preselectedGuardian={hook.selectedGuardianForMessage || undefined}
        studentId={hook.student.id}
        studentName={hook.fullName}
      />

      {/* Delete validation dialog */}
      <DeleteValidationDialog
        open={hook.deleteDialogOpen}
        onOpenChange={hook.setDeleteDialogOpen}
        entityName={hook.fullName}
        entityType="Student"
        checkResult={hook.deleteCheckResult}
        isLoading={hook.isDeleteChecking}
        onConfirmDelete={hook.handleConfirmDelete}
        isDeleting={hook.isDeleting}
      />

      {/* Guardian delete validation dialog */}
      <DeleteValidationDialog
        open={hook.guardianDeleteDialog.open}
        onOpenChange={(open) => hook.setGuardianDeleteDialog(prev => ({ ...prev, open }))}
        entityName={hook.guardianDeleteDialog.guardianName}
        entityType="Guardian"
        checkResult={hook.guardianDeleteDialog.checkResult}
        isLoading={hook.guardianDeleteDialog.isChecking}
        onConfirmDelete={hook.confirmGuardianRemoval}
        isDeleting={hook.guardianDeleteDialog.isDeleting}
      />
    </AppLayout>
  );
}
