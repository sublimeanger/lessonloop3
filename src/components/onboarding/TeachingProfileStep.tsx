import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { OrgType } from '@/hooks/useOnboardingState';

// ── Chip selector component ────────────────────────────────────────────────

interface ChipOption {
  value: string;
  label: string;
}

function ChipSelector({
  options,
  selected,
  onToggle,
  allowCustom,
  customPlaceholder = 'Add other...',
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
}) {
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleAddCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onToggle(trimmed);
    }
    setCustomValue('');
    setShowCustomInput(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selected.includes(opt.value);
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(opt.value)}
            className={`
              inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }
            `}
          >
            {opt.label}
            {isActive && <X className="h-3 w-3" />}
          </motion.button>
        );
      })}

      {/* Custom entries that aren't in default options */}
      {selected.filter(s => !options.some(o => o.value === s)).map(custom => (
        <motion.button
          key={custom}
          type="button"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onToggle(custom)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 text-primary px-3.5 py-1.5 text-sm font-medium shadow-sm"
        >
          {custom}
          <X className="h-3 w-3" />
        </motion.button>
      ))}

      {allowCustom && !showCustomInput && (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 px-3.5 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          {customPlaceholder}
        </button>
      )}

      {showCustomInput && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'auto', opacity: 1 }}
          className="flex items-center gap-1"
        >
          <Input
            autoFocus
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); }
              if (e.key === 'Escape') setShowCustomInput(false);
            }}
            onBlur={() => { if (customValue.trim()) handleAddCustom(); else setShowCustomInput(false); }}
            placeholder="e.g. Harp"
            className="h-8 w-28 text-sm"
          />
        </motion.div>
      )}
    </div>
  );
}

// ── Range chip selector ────────────────────────────────────────────────────

function RangeSelector({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(opt.value)}
            className={`
              rounded-xl border-2 px-4 py-2 text-sm font-medium transition-all duration-200
              ${isActive
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40'
              }
            `}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Instruments ────────────────────────────────────────────────────────────

const POPULAR_INSTRUMENTS: ChipOption[] = [
  { value: 'Piano', label: 'Piano' },
  { value: 'Guitar', label: 'Guitar' },
  { value: 'Violin', label: 'Violin' },
  { value: 'Voice', label: 'Voice' },
  { value: 'Drums', label: 'Drums' },
  { value: 'Flute', label: 'Flute' },
  { value: 'Cello', label: 'Cello' },
  { value: 'Saxophone', label: 'Saxophone' },
  { value: 'Clarinet', label: 'Clarinet' },
  { value: 'Trumpet', label: 'Trumpet' },
  { value: 'Ukulele', label: 'Ukulele' },
  { value: 'Bass', label: 'Bass' },
];

const STUDENT_RANGES = [
  { value: '1-10', label: '1-10' },
  { value: '11-25', label: '11-25' },
  { value: '26-50', label: '26-50' },
  { value: '50+', label: '50+' },
];

const TEAM_SIZES = [
  { value: '1-3', label: '1-3' },
  { value: '4-10', label: '4-10' },
  { value: '11-25', label: '11-25' },
  { value: '25+', label: '25+' },
];

const LOCATION_COUNTS = [
  { value: '1', label: '1' },
  { value: '2-3', label: '2-3' },
  { value: '4+', label: '4+' },
];

const SCHOOL_COUNTS = [
  { value: '1-5', label: '1-5' },
  { value: '6-15', label: '6-15' },
  { value: '16+', label: '16+' },
];

// ── Main component ─────────────────────────────────────────────────────────

interface TeachingProfileStepProps {
  orgType: OrgType;
  orgName: string;
  studentCount: string;
  teamSize: string;
  locationCount: string;
  instruments: string[];
  alsoTeaches: boolean;
  onOrgNameChange: (name: string) => void;
  onStudentCountChange: (count: string) => void;
  onTeamSizeChange: (size: string) => void;
  onLocationCountChange: (count: string) => void;
  onInstrumentsChange: (instruments: string[]) => void;
  onAlsoTeachesChange: (teaches: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export function TeachingProfileStep({
  orgType, orgName, studentCount, teamSize, locationCount, instruments, alsoTeaches,
  onOrgNameChange, onStudentCountChange, onTeamSizeChange, onLocationCountChange,
  onInstrumentsChange, onAlsoTeachesChange, onNext, onBack,
}: TeachingProfileStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const toggleInstrument = (value: string) => {
    onInstrumentsChange(
      instruments.includes(value)
        ? instruments.filter(i => i !== value)
        : [...instruments, value]
    );
  };

  const isSolo = orgType === 'solo_teacher';
  const isStudioOrAcademy = orgType === 'studio' || orgType === 'academy';
  const isAgency = orgType === 'agency';

  return (
    <motion.div
      key="teaching"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">
          {isSolo ? 'About Your Teaching' : 'About Your Organisation'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isSolo
            ? "Help us personalise your experience."
            : "A few details to set up your workspace."
          }
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Org name (studio/academy/agency only) */}
            {!isSolo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-2"
              >
                <Label htmlFor="orgName">
                  {isAgency ? 'Agency Name' : isStudioOrAcademy ? 'Studio / School Name' : 'Organisation Name'}
                </Label>
                <Input
                  id="orgName"
                  placeholder={isAgency ? "e.g. Melody Teaching Agency" : "e.g. Harmony Music Studio"}
                  value={orgName}
                  maxLength={100}
                  onChange={(e) => onOrgNameChange(e.target.value)}
                  autoComplete="organization"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">You can change this later in Settings.</p>
              </motion.div>
            )}

            {/* Solo teacher: student count + instruments */}
            {isSolo && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-3"
                >
                  <Label>How many students do you currently teach?</Label>
                  <RangeSelector
                    options={STUDENT_RANGES}
                    value={studentCount}
                    onChange={onStudentCountChange}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <Label>What instruments do you teach?</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Select all that apply — this helps us personalise your experience.</p>
                  <ChipSelector
                    options={POPULAR_INSTRUMENTS}
                    selected={instruments}
                    onToggle={toggleInstrument}
                    allowCustom
                    customPlaceholder="Add other..."
                  />
                </motion.div>
              </>
            )}

            {/* Studio/Academy: team size + locations + also teaches */}
            {isStudioOrAcademy && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-3"
                >
                  <Label>How many teachers work with you?</Label>
                  <RangeSelector
                    options={TEAM_SIZES}
                    value={teamSize}
                    onChange={onTeamSizeChange}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <Label>How many teaching locations?</Label>
                  <RangeSelector
                    options={LOCATION_COUNTS}
                    value={locationCount}
                    onChange={onLocationCountChange}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-start gap-3 rounded-xl border border-border p-4"
                >
                  <Checkbox
                    id="alsoTeaches"
                    checked={alsoTeaches}
                    onCheckedChange={(checked) => onAlsoTeachesChange(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="alsoTeaches" className="cursor-pointer font-medium leading-none">
                      I also teach lessons
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      We'll add you as a teacher so you can be assigned to lessons.
                    </p>
                  </div>
                </motion.div>
              </>
            )}

            {/* Agency: team size + school count */}
            {isAgency && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-3"
                >
                  <Label>How many teachers do you manage?</Label>
                  <RangeSelector
                    options={TEAM_SIZES}
                    value={teamSize}
                    onChange={onTeamSizeChange}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <Label>How many client schools?</Label>
                  <RangeSelector
                    options={SCHOOL_COUNTS}
                    value={locationCount}
                    onChange={onLocationCountChange}
                  />
                </motion.div>
              </>
            )}

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex justify-between pt-2"
            >
              <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" size="lg">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </form>
    </motion.div>
  );
}
