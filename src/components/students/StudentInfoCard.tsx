import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CreditBalanceBadge } from './CreditBalanceBadge';
import { TeachingDefaultsCard } from './TeachingDefaultsCard';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { Loader2, Mail, Phone, Calendar } from 'lucide-react';
import { isValidEmail, isValidPhone } from '@/lib/validation';
import type { Student } from '@/hooks/useStudentDetailPage';

interface StudentInfoCardProps {
  student: Student;
  isEditing: boolean;
  isSaving: boolean;
  isOrgAdmin: boolean;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  handleSave: () => void;
  fetchStudent: () => void;
}

export function StudentInfoCard({
  student,
  isEditing,
  isSaving,
  isOrgAdmin,
  firstName, setFirstName,
  lastName, setLastName,
  email, setEmail,
  phone, setPhone,
  dob, setDob,
  notes, setNotes,
  handleSave,
  fetchStudent,
}: StudentInfoCardProps) {
  return (
    <SectionErrorBoundary name="Overview">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Information</CardTitle>
              <CardDescription>Personal details and contact information</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <CreditBalanceBadge studentId={student.id} />
              <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
              {(() => {
                const checks = [
                  { label: 'Email', done: !!student.email },
                  { label: 'Phone', done: !!student.phone },
                  { label: 'DOB', done: !!student.dob },
                  { label: 'Location', done: !!student.default_location_id },
                  { label: 'Teacher', done: !!student.default_teacher_id },
                  { label: 'Rate card', done: !!student.default_rate_card_id },
                ];
                const completed = checks.filter(c => c.done).length;
                if (completed < checks.length) {
                  const missing = checks.filter(c => !c.done).map(c => c.label).join(', ');
                  return (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs" title={`Missing: ${missing}`}>
                      {completed}/{checks.length} complete
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First name *</Label>
                  <Input id="edit-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  {!firstName.trim() && <p className="text-xs text-destructive">First name is required</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last name *</Label>
                  <Input id="edit-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  {!lastName.trim() && <p className="text-xs text-destructive">Last name is required</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {email.trim() && !isValidEmail(email.trim()) && <p className="text-xs text-destructive">Invalid email format</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  {phone.trim() && !isValidPhone(phone.trim()) && <p className="text-xs text-destructive">Invalid phone format</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dob">Date of birth</Label>
                <Input id="edit-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <Button onClick={handleSave} disabled={isSaving || !firstName.trim() || !lastName.trim() || (!!email.trim() && !isValidEmail(email.trim())) || (!!phone.trim() && !isValidPhone(phone.trim()))}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {student.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{student.email}</span>
                  </div>
                )}
                {student.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{student.phone}</span>
                  </div>
                )}
                {student.dob && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(student.dob).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
              {student.notes && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">{student.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <TeachingDefaultsCard
          studentId={student.id}
          defaultLocationId={student.default_location_id}
          defaultTeacherId={student.default_teacher_id}
          defaultRateCardId={student.default_rate_card_id}
          onUpdate={fetchStudent}
          readOnly={!isOrgAdmin}
        />
      </div>
    </SectionErrorBoundary>
  );
}
