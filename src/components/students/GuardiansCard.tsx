import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { Loader2, Plus, UserPlus, Send, Copy } from 'lucide-react';
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
            <div className="flex flex-col items-center py-8 text-center">
              <UserPlus className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No guardians linked</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a parent or guardian for billing and communication.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {guardians.map((sg) => (
                <div key={sg.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sg.guardian?.full_name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{sg.relationship}</Badge>
                      {sg.is_primary_payer && <Badge className="text-xs">Primary Payer</Badge>}
                      {sg.guardian?.user_id && (
                        <Badge variant="secondary" className="text-xs">Portal Access</Badge>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                      {sg.guardian?.email && <span>{sg.guardian.email}</span>}
                      {sg.guardian?.phone && <span>{sg.guardian.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                          <div className="flex items-center gap-2">
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
        <DialogContent>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsGuardianDialogOpen(false); resetGuardianForm(); }}>Cancel</Button>
            <Button onClick={handleAddGuardian} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : 'Add Guardian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionErrorBoundary>
  );
}
