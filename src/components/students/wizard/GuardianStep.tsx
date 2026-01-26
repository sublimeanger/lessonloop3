import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

export type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';

export interface GuardianData {
  addGuardian: boolean;
  mode: 'existing' | 'new';
  existingGuardianId: string;
  newGuardianName: string;
  newGuardianEmail: string;
  newGuardianPhone: string;
  relationship: RelationshipType;
  isPrimaryPayer: boolean;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

interface GuardianStepProps {
  data: GuardianData;
  onChange: (data: GuardianData) => void;
}

export function GuardianStep({ data, onChange }: GuardianStepProps) {
  const { currentOrg } = useOrg();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const fetchGuardians = async () => {
      if (!currentOrg) return;
      setIsLoading(true);
      const { data: g } = await supabase
        .from('guardians')
        .select('id, full_name, email')
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null)
        .order('full_name');
      setGuardians(g || []);
      setIsLoading(false);
    };
    fetchGuardians();
  }, [currentOrg]);
  
  const update = <K extends keyof GuardianData>(field: K, value: GuardianData[K]) => {
    onChange({ ...data, [field]: value });
  };
  
  return (
    <div className="space-y-6">
      {/* Toggle to add guardian */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="add-guardian" className="font-medium cursor-pointer">
              Add a parent or guardian
            </Label>
            <p className="text-sm text-muted-foreground">
              Link someone who will receive invoices and communications
            </p>
          </div>
        </div>
        <Switch
          id="add-guardian"
          checked={data.addGuardian}
          onCheckedChange={(checked) => update('addGuardian', checked)}
        />
      </div>
      
      {data.addGuardian && (
        <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2">
          {/* Mode selector */}
          <RadioGroup
            value={data.mode}
            onValueChange={(v) => update('mode', v as 'existing' | 'new')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="mode-existing" />
              <Label htmlFor="mode-existing" className="cursor-pointer">Link existing guardian</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new" className="cursor-pointer">Create new guardian</Label>
            </div>
          </RadioGroup>
          
          {data.mode === 'existing' ? (
            <div className="space-y-2">
              <Label>Select guardian</Label>
              <Select
                value={data.existingGuardianId}
                onValueChange={(v) => update('existingGuardianId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? 'Loading...' : 'Select a guardian...'} />
                </SelectTrigger>
                <SelectContent>
                  {guardians.length === 0 && !isLoading && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No guardians yet. Create a new one instead.
                    </div>
                  )}
                  {guardians.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.full_name} {g.email && <span className="text-muted-foreground">({g.email})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="new-guardian-name">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-guardian-name"
                  value={data.newGuardianName}
                  onChange={(e) => update('newGuardianName', e.target.value)}
                  placeholder="Sarah Wilson"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-guardian-email">Email</Label>
                  <Input
                    id="new-guardian-email"
                    type="email"
                    value={data.newGuardianEmail}
                    onChange={(e) => update('newGuardianEmail', e.target.value)}
                    placeholder="sarah@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-guardian-phone">Phone</Label>
                  <Input
                    id="new-guardian-phone"
                    type="tel"
                    value={data.newGuardianPhone}
                    onChange={(e) => update('newGuardianPhone', e.target.value)}
                    placeholder="+44 7700 900000"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Relationship & Primary Payer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select
                value={data.relationship}
                onValueChange={(v) => update('relationship', v as RelationshipType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mother">Mother</SelectItem>
                  <SelectItem value="father">Father</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Primary payer
              </Label>
              <div className="flex items-center gap-2 h-10">
                <Switch
                  id="primary-payer"
                  checked={data.isPrimaryPayer}
                  onCheckedChange={(checked) => update('isPrimaryPayer', checked)}
                />
                <Label htmlFor="primary-payer" className="text-sm text-muted-foreground cursor-pointer">
                  Receives invoices
                </Label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
