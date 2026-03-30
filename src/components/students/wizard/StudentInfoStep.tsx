import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import {
  useInstruments, useExamBoards, useGradeLevels,
  getGradesForBoard, groupInstrumentsByCategory, getInstrumentCategoryIcon,
} from '@/hooks/useInstruments';
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { AddInstrumentDialog } from './AddInstrumentDialog';

export interface StudentInfoData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  notes: string;
  instrumentId: string;
  examBoardId: string;
  currentGradeId: string;
}

interface StudentInfoStepProps {
  data: StudentInfoData;
  onChange: (data: StudentInfoData) => void;
}

export function StudentInfoStep({ data, onChange }: StudentInfoStepProps) {
  const { currentOrg } = useOrg();
  const { data: instruments } = useInstruments();
  const { data: examBoards } = useExamBoards();
  const { data: gradeLevels } = useGradeLevels();
  const defaultApplied = useRef(false);
  const [addInstrumentOpen, setAddInstrumentOpen] = useState(false);

  const update = (field: keyof StudentInfoData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Pre-fill default exam board on first render if not already set
  useEffect(() => {
    if (
      !defaultApplied.current &&
      currentOrg?.default_exam_board_id &&
      !data.examBoardId
    ) {
      defaultApplied.current = true;
      onChange({ ...data, examBoardId: currentOrg.default_exam_board_id });
    }
  }, [currentOrg?.default_exam_board_id]);

  const grouped = groupInstrumentsByCategory(instruments || []);
  const availableGrades = getGradesForBoard(
    gradeLevels || [],
    data.examBoardId || null,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Instrument & Grade (simplified) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Instrument</Label>
          <Select
            value={data.instrumentId}
            onValueChange={(v) => {
              if (v === '__add_new__') {
                setAddInstrumentOpen(true);
                return;
              }
              update('instrumentId', v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(grouped).map(([category, items]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{getInstrumentCategoryIcon(category)} {category}</SelectLabel>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
              <SelectItem value="__add_new__" className="text-primary font-medium">
                <Plus className="h-3.5 w-3.5 mr-1 inline" /> Add new instrument
              </SelectItem>
            </SelectContent>
          </Select>
          <AddInstrumentDialog
            open={addInstrumentOpen}
            onOpenChange={setAddInstrumentOpen}
            onCreated={(id) => update('instrumentId', id)}
          />
        </div>
        <div className="space-y-2">
          <Label>Exam Board</Label>
          <Select
            value={data.examBoardId}
            onValueChange={(v) => {
              update('examBoardId', v);
              update('currentGradeId', '');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not doing exams</SelectItem>
              {(examBoards || []).map((eb) => (
                <SelectItem key={eb.id} value={eb.id}>{eb.short_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Current Grade</Label>
          <Select value={data.currentGradeId} onValueChange={(v) => update('currentGradeId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {availableGrades.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You can add more instruments and set target grades on the student profile page.
      </p>

      <div className="space-y-2">
        <Label htmlFor="wizard-notes">Notes <span className="text-muted-foreground font-normal">(medical, learning needs, etc.)</span></Label>
        <Textarea
          id="wizard-notes"
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="e.g. hearing difficulty in left ear, requires large print music…"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">This information is only visible to staff members.</p>
      </div>
    </div>
  );
}
