import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, Shield, UserX, Trash2, AlertTriangle, FileText, Users, Calendar, Receipt } from 'lucide-react';
import { useGDPRExport, useGDPRDelete, useDeletionCandidates } from '@/hooks/useGDPR';
import { LoadingState } from '@/components/shared/LoadingState';
import { formatDateUK } from '@/lib/utils';

export function PrivacyTab() {
  const { exportData, isExporting } = useGDPRExport();
  const deleteMutation = useGDPRDelete();
  const { data: candidates, isLoading } = useDeletionCandidates();
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    entityType: 'student' | 'guardian';
    entityId: string;
    entityName: string;
    action: 'soft_delete' | 'anonymise';
  } | null>(null);

  const handleDelete = () => {
    if (!deleteDialog) return;
    
    deleteMutation.mutate({
      action: deleteDialog.action,
      entityType: deleteDialog.entityType,
      entityId: deleteDialog.entityId,
    });
    
    setDeleteDialog(null);
  };

  return (
    <div className="space-y-6">
      {/* Data Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export (GDPR Article 20)
          </CardTitle>
          <CardDescription>
            Export all organisation data as CSV files for portability or backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Students</div>
                <div className="text-sm text-muted-foreground">Personal data & status</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Guardians</div>
                <div className="text-sm text-muted-foreground">Contact details</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Lessons</div>
                <div className="text-sm text-muted-foreground">Schedule history</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Invoices & Payments</div>
                <div className="text-sm text-muted-foreground">Financial records</div>
              </div>
            </div>
          </div>
          
          <Button onClick={exportData} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export All Data'}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Downloads 5 separate CSV files containing all organisation data. This action is logged in the audit trail.
          </p>
        </CardContent>
      </Card>

      {/* Data Deletion Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Data Deletion (GDPR Article 17)
          </CardTitle>
          <CardDescription>
            Process deletion requests for inactive students and guardians. Invoice records are retained for accounting compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <h4 className="font-medium">Important Notice</h4>
                <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>Soft Delete:</strong> Marks record as deleted but retains data for potential recovery</li>
                  <li><strong>Anonymise:</strong> Replaces personal data with placeholder values. This cannot be undone.</li>
                  <li>Invoice records are always retained for accounting/tax compliance</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Inactive Students</h4>
            {isLoading ? (
              <LoadingState message="Loading candidates..." />
            ) : candidates?.students && candidates.students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.first_name} {student.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{student.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateUK(student.updated_at)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialog({
                            open: true,
                            entityType: 'student',
                            entityId: student.id,
                            entityName: `${student.first_name} ${student.last_name}`,
                            action: 'soft_delete',
                          })}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialog({
                            open: true,
                            entityType: 'student',
                            entityId: student.id,
                            entityName: `${student.first_name} ${student.last_name}`,
                            action: 'anonymise',
                          })}
                        >
                          <Shield className="mr-1 h-3 w-3" />
                          Anonymise
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No inactive students available for deletion.</p>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Guardians</h4>
            {isLoading ? (
              <LoadingState message="Loading candidates..." />
            ) : candidates?.guardians && candidates.guardians.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Linked Students</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.guardians.map((guardian) => (
                    <TableRow key={guardian.id}>
                      <TableCell className="font-medium">{guardian.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {guardian.student_guardians?.length || 0} students
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDateUK(guardian.updated_at)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialog({
                            open: true,
                            entityType: 'guardian',
                            entityId: guardian.id,
                            entityName: guardian.full_name,
                            action: 'soft_delete',
                          })}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialog({
                            open: true,
                            entityType: 'guardian',
                            entityId: guardian.id,
                            entityName: guardian.full_name,
                            action: 'anonymise',
                          })}
                        >
                          <Shield className="mr-1 h-3 w-3" />
                          Anonymise
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No guardians available for deletion.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Retention Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data Retention Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Invoice & Payment Records</span>
              <span className="font-medium">7 years (HMRC requirement)</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Lesson History</span>
              <span className="font-medium">Until student deletion</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Audit Logs</span>
              <span className="font-medium">Permanent</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Message History</span>
              <span className="font-medium">3 years</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={deleteDialog?.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.action === 'anonymise' ? 'Anonymise Data' : 'Delete Record'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.action === 'anonymise' ? (
                <>
                  This will permanently replace personal data for <strong>{deleteDialog?.entityName}</strong> with placeholder values. 
                  Invoice records will be retained. <strong>This cannot be undone.</strong>
                </>
              ) : (
                <>
                  This will soft-delete <strong>{deleteDialog?.entityName}</strong>. 
                  The record can be recovered by an administrator if needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={deleteDialog?.action === 'anonymise' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleteDialog?.action === 'anonymise' ? 'Anonymise' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
