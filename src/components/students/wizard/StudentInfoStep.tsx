import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface StudentInfoData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  notes: string;
}

interface StudentInfoStepProps {
  data: StudentInfoData;
  onChange: (data: StudentInfoData) => void;
}

export function StudentInfoStep({ data, onChange }: StudentInfoStepProps) {
  const update = (field: keyof StudentInfoData, value: string) => {
    onChange({ ...data, [field]: value });
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wizard-firstName">
            First name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="wizard-firstName"
            value={data.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Emma"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wizard-lastName">
            Last name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="wizard-lastName"
            value={data.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Wilson"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="wizard-dob">Date of birth</Label>
        <Input
          id="wizard-dob"
          type="date"
          value={data.dob}
          onChange={(e) => update('dob', e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wizard-email">Email (optional)</Label>
          <Input
            id="wizard-email"
            type="email"
            value={data.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="emma@example.com"
          />
          <p className="text-xs text-muted-foreground">For older students who manage their own lessons</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wizard-phone">Phone (optional)</Label>
          <Input
            id="wizard-phone"
            type="tel"
            value={data.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+44 7700 900000"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="wizard-notes">Notes</Label>
        <Textarea
          id="wizard-notes"
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Grade 5 piano, preparing for exam..."
          rows={3}
        />
      </div>
    </div>
  );
}
