import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCreateLead, SOURCE_LABELS, type LeadSource, type CreateLeadInput } from '@/hooks/useLeads';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChildForm {
  first_name: string;
  last_name: string;
  age: string;
  instrument: string;
  experience_level: string;
}

const EMPTY_CHILD: ChildForm = {
  first_name: '',
  last_name: '',
  age: '',
  instrument: '',
  experience_level: '',
};

const SOURCES = Object.entries(SOURCE_LABELS) as [LeadSource, string][];
const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateLeadModal({ open, onOpenChange }: CreateLeadModalProps) {
  const isMobile = useIsMobile();
  const createLead = useCreateLead();

  // Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('manual');
  const [preferredInstrument, setPreferredInstrument] = useState('');
  const [notes, setNotes] = useState('');
  const [children, setChildren] = useState<ChildForm[]>([{ ...EMPTY_CHILD }]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setSource('manual');
    setPreferredInstrument('');
    setNotes('');
    setChildren([{ ...EMPTY_CHILD }]);
    setErrors({});
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Delay reset so close animation finishes
    setTimeout(resetForm, 200);
  }, [onOpenChange, resetForm]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!contactName.trim()) {
      newErrors.contactName = 'Contact name is required';
    }

    const validChildren = children.filter((c) => c.first_name.trim());
    if (validChildren.length === 0) {
      newErrors.children = 'At least one child with a first name is required';
    }

    children.forEach((child, idx) => {
      if (!child.first_name.trim() && children.length === 1) {
        newErrors[`child_${idx}_first_name`] = 'First name is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [contactName, children]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    const validChildren = children.filter((c) => c.first_name.trim());

    const input: CreateLeadInput = {
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      source,
      preferred_instrument: preferredInstrument.trim() || undefined,
      notes: notes.trim() || undefined,
      children: validChildren.map((child) => ({
        first_name: child.first_name.trim(),
        last_name: child.last_name.trim() || undefined,
        age: child.age ? parseInt(child.age, 10) : null,
        instrument: child.instrument.trim() || undefined,
        experience_level: child.experience_level || undefined,
      })),
    };

    await createLead.mutateAsync(input);
    handleClose();
  }, [validate, children, contactName, contactEmail, contactPhone, source, preferredInstrument, notes, createLead, handleClose]);

  const addChild = useCallback(() => {
    setChildren((prev) => [...prev, { ...EMPTY_CHILD }]);
  }, []);

  const removeChild = useCallback((index: number) => {
    setChildren((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateChild = useCallback((index: number, field: keyof ChildForm, value: string) => {
    setChildren((prev) =>
      prev.map((child, i) => (i === index ? { ...child, [field]: value } : child)),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Form body (shared between Dialog and Drawer)
  // ---------------------------------------------------------------------------

  const formBody = (
    <div className="space-y-5 px-1 max-h-[65vh] overflow-y-auto">
      {/* Contact info section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>

        <div className="space-y-1.5">
          <Label htmlFor="contact_name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact_name"
            placeholder="Parent / guardian name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={errors.contactName ? 'border-destructive' : ''}
          />
          {errors.contactName && (
            <p className="text-xs text-destructive">{errors.contactName}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="email@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              placeholder="+44 7..."
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferred_instrument">Preferred Instrument</Label>
            <Input
              id="preferred_instrument"
              placeholder="e.g. Piano"
              value={preferredInstrument}
              onChange={(e) => setPreferredInstrument(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Children section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">
            Children <span className="text-destructive">*</span>
          </h4>
          <Button type="button" variant="outline" size="sm" onClick={addChild} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Add Child
          </Button>
        </div>

        {errors.children && (
          <p className="text-xs text-destructive">{errors.children}</p>
        )}

        {children.map((child, idx) => (
          <div key={idx} className="relative rounded-lg border bg-card p-3 space-y-2">
            {children.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeChild(idx)}
                aria-label="Remove child"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="First name"
                  value={child.first_name}
                  onChange={(e) => updateChild(idx, 'first_name', e.target.value)}
                  className={cn(
                    'h-8 text-sm',
                    errors[`child_${idx}_first_name`] ? 'border-destructive' : '',
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name</Label>
                <Input
                  placeholder="Last name"
                  value={child.last_name}
                  onChange={(e) => updateChild(idx, 'last_name', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Age</Label>
                <Input
                  type="number"
                  placeholder="Age"
                  min={1}
                  max={99}
                  value={child.age}
                  onChange={(e) => updateChild(idx, 'age', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instrument</Label>
                <Input
                  placeholder="e.g. Violin"
                  value={child.instrument}
                  onChange={(e) => updateChild(idx, 'instrument', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Level</Label>
                <Select
                  value={child.experience_level}
                  onValueChange={(v) => updateChild(idx, 'experience_level', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const footer = (
    <>
      <Button variant="outline" onClick={handleClose} className="min-h-[44px]">
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={createLead.isPending}
        className="min-h-[44px]"
      >
        {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Create Lead
      </Button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Responsive rendering
  // ---------------------------------------------------------------------------

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>New Lead</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <DrawerFooter className="flex-row justify-end gap-2">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
