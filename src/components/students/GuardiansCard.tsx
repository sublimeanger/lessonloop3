import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { InlineEmptyState } from '@/components/shared/EmptyState';
import { Loader2, Plus, UserPlus, Send, Copy, Pencil } from 'lucide-react';
import type { Guardian, StudentGuardian, RelationshipType, GuardianInviteStatus } from '@/hooks/useStudentDetailPage';

interface GuardiansCardProps {
  guardians: StudentGuardian[];
  allGuardians: Guardian[];
  isOrgAdmin: boolean;
  isSaving: boolean;

  // Dialog state
  isGuardianDialogOpen: boolean;
  setIsGuardianDialogOpen: (v: boolean) => void;
  isNewGuardian: boolean;
  setIsNewGuardian: (v: boolean) => void;
  selectedGuardianId: string;
  setSelectedGuardianId: (v: string) => void;
  newGuardianName: string;
  setNewGuardianName: (v: string) => void;
  newGuardianEmail: string;
  setNewGuardianEmail: (v: string) => void;
  newGuardianPhone: string;
  setNewGuardianPhone: (v: string) => void;
  relationship: RelationshipType;
  setRelationship: (v: RelationshipType) => void;
  isPrimaryPayer: boolean;
  setIsPrimaryPayer: (v: boolean) => void;
  handleAddGuardian: () => void;
  resetGuardianForm: () => void;

  // Invite state
  invitingGuardianId: string | null;
  guardianInvites: Record<string, GuardianInviteStatus>;
  handleInviteGuardian: (guardian: Guardian, existingInviteId?: string) => void;
  handleCopyInviteLink: (token: string) => void;

  // Removal
  initiateGuardianRemoval: (sg: StudentGuardian) => void;

  // Edit guardian
  editGuardianDialog: {
    open: boolean;
    guardianId: string;
    fullName: string;
    email: string;
    phone: string;
  };
  setEditGuardianDialog: React.Dispatch<React.SetStateAction<{
    open: boolean;
    guardianId: string;
    fullName: string;
    email: string;
    phone: string;
  }>>;
  isEditGuardianSaving: boolean;
  handleEditGuardian: (guardian: Guardian) => void;
  handleSaveGuardianEdit: () => void;
}

export function GuardiansCard({
  guardians,
  allGuardians,
  isOrgAdmin,
  isSaving,
  isGuardianDialogOpen, setIsGuardianDialogOpen,
  isNewGuardian, setIsNewGuardian,
  selectedGuardianId, setSelectedGuardianId,
  newGuardianName, setNewGuardianName,
  newGuardianEmail, setNewGuardianEmail,
  newGuardianPhone, setNewGuardianPhone,
  relationship, setRelationship,
  isPrimaryPayer, setIsPrimaryPayer,
  handleAddGuardian,
  resetGuardianForm,
  invitingGuardianId,
  guardianInvites,
  handleInviteGuardian,
  handleCopyInviteLink,
  initiateGuardianRemoval,
  editGuardianDialog, setEditGuardianDialog,
  isEditGuardianSaving,
  handleEditGuardian,
  handleSaveGuardianEdit,
}: GuardiansCardProps) {
  return (
    <SectionErrorBoundary name="Guardians">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Guardians</CardTitle>
            <CardDescription>Parents and guardians linked to this student</CardDescription>
          </div>
          {isOrgAdmin && (
            <Button onClick={() => setIsGuardianDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Guardian
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {guardians.length === 0 ? (
            <InlineEmptyState
              icon={UserPlus}
              message="No guardians linked yet. Add a parent or guardian for billing and communication."
              actionLabel={isOrgAdmin ? "Add Guardian" : undefined}
              onAction={isOrgAdmin ? () => setIsGuardianDialogOpen(true) : undefined}
            />
          ) : (
            <div className="space-y-3">
              {guardians.map((sg) => (
                <div key={sg.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{sg.guardian?.full_name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{sg.relationship}</Badge>
                      {sg.is_primary_payer && <Badge className="text-xs">Primary Payer</Badge>}
                      {sg.guardian?.user_id && (
                        <Badge variant="secondary" className="text-xs">Portal Access</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
                      {sg.guardian?.email && <span>{sg.guardian.email}</span>}
                      {sg.guardian?.phone && <span>{sg.guardian.phone}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isOrgAdmin && !sg.guardian?.user_id && sg.guardian?.email && (() => {
                      const inviteStatus = guardianInvites[sg.guardian.id];
                      const isInviting = invitingGuardianId === sg.guardian.id;

                      if (!inviteStatus || inviteStatus.inviteStatus === 'none') {
                        return (
                          <Button variant="outline" size="sm" onClick={() => handleInviteGuardian(sg.guardian!)} disabled={isInviting} className="gap-1">
                            {isInviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Invite
                          </Button>
                        );
                      } else if (inviteStatus.inviteStatus === 'pending') {
                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Invite Pending</Badge>
                            {inviteStatus.token && (
                              <Button variant="ghost" size="sm" onClick={() => handleCopyInviteLink(inviteStatus.token!)} className="gap-1 text-xs">
                                <Copy className="h-3 w-3" />
                                Copy Link
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleInviteGuardian(sg.guardian!, inviteStatus.inviteId!)} disabled={isInviting} className="gap-1 text-xs">
                              {isInviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              Resend
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {isOrgAdmin && sg.guardian && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditGuardian(sg.guardian!)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isOrgAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => initiateGuardianRemoval(sg)}>Remove</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Guardian Dialog */}
      <Dialog open={isGuardianDialogOpen} onOpenChange={setIsGuardianDialogOpen}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Guardian</DialogTitle>
            <DialogDescription>Link a parent or guardian to this student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button variant={isNewGuardian ? 'outline' : 'default'} onClick={() => setIsNewGuardian(false)} className="flex-1">
                Existing Guardian
              </Button>
              <Button variant={isNewGuardian ? 'default' : 'outline'} onClick={() => setIsNewGuardian(true)} className="flex-1">
                New Guardian
              </Button>
            </div>

            {isNewGuardian ? (
              <>
                <div className="space-y-2">
                  <Label>Full name *</Label>
                  <Input value={newGuardianName} onChange={(e) => setNewGuardianName(e.target.value)} placeholder="Sarah Wilson" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newGuardianEmail} onChange={(e) => setNewGuardianEmail(e.target.value)} placeholder="sarah@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" value={newGuardianPhone} onChange={(e) => setNewGuardianPhone(e.target.value)} placeholder="+44 7700 900000" />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Select guardian</Label>
                <Select value={selectedGuardianId} onValueChange={setSelectedGuardianId}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {allGuardians.filter(g => !guardians.some(sg => sg.guardian_id === g.id)).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select value={relationship} onValueChange={(v) => setRelationship(v as RelationshipType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary payer?</Label>
                <Select value={isPrimaryPayer ? 'yes' : 'no'} onValueChange={(v) => setIsPrimaryPayer(v === 'yes')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => { setIsGuardianDialogOpen(false); resetGuardianForm(); }}>Cancel</Button>
            <Button onClick={handleAddGuardian} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : 'Add Guardian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Guardian Dialog */}
      <Dialog open={editGuardianDialog.open} onOpenChange={(open) => setEditGuardianDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Guardian</DialogTitle>
            <DialogDescription>Update contact details for this guardian.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full name *</Label>
              <Input
                value={editGuardianDialog.fullName}
                onChange={(e) => setEditGuardianDialog(prev => ({ ...prev, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editGuardianDialog.email}
                onChange={(e) => setEditGuardianDialog(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={editGuardianDialog.phone}
                onChange={(e) => setEditGuardianDialog(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditGuardianDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button onClick={handleSaveGuardianEdit} disabled={isEditGuardianSaving || !editGuardianDialog.fullName.trim()}>
              {isEditGuardianSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionErrorBoundary>
  );
}
