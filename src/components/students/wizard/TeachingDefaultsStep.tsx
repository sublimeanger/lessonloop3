import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, User, Receipt, Info } from 'lucide-react';

export interface TeachingDefaultsData {
  locationId: string;
  teacherId: string; // Now refers to teachers.id, not user_id
  rateCardId: string;
}

interface Location {
  id: string;
  name: string;
  location_type: string;
}

interface Teacher {
  id: string;
  display_name: string;
  isLinked: boolean;
}

interface RateCard {
  id: string;
  name: string;
  rate_amount: number;
  duration_mins: number;
  currency_code: string;
}

interface TeachingDefaultsStepProps {
  data: TeachingDefaultsData;
  onChange: (data: TeachingDefaultsData) => void;
}

export function TeachingDefaultsStep({ data, onChange }: TeachingDefaultsStepProps) {
  const { currentOrg } = useOrg();
  const [locations, setLocations] = useState<Location[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrg) return;
      setIsLoading(true);
      
      // Fetch locations
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name, location_type')
        .eq('org_id', currentOrg.id)
        .order('name');
      
      // Fetch teachers from new teachers table
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id, display_name, user_id')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .order('display_name');
      
      const teacherList: Teacher[] = (teacherData || []).map(t => ({
        id: t.id,
        display_name: t.display_name,
        isLinked: !!t.user_id,
      }));
      
      // Fetch rate cards
      const { data: rates } = await supabase
        .from('rate_cards')
        .select('id, name, rate_amount, duration_mins, currency_code')
        .eq('org_id', currentOrg.id)
        .order('name');
      
      setLocations(locs || []);
      setTeachers(teacherList);
      setRateCards(rates || []);
      setIsLoading(false);
    };
    
    fetchData();
  }, [currentOrg]);
  
  const update = <K extends keyof TeachingDefaultsData>(field: K, value: TeachingDefaultsData[K]) => {
    onChange({ ...data, [field]: value });
  };
  
  const formatRate = (rate: RateCard) => {
    const amount = rate.rate_amount / 100;
    return `${rate.name} - £${amount.toFixed(2)} / ${rate.duration_mins} mins`;
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          Set defaults to speed up lesson scheduling. These will auto-populate when you create lessons for this student.
        </p>
      </div>
      
      {/* Location / School */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          School / Location
        </Label>
        <Select
          value={data.locationId}
          onValueChange={(v) => update('locationId', v === 'none' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Loading...' : 'Select location (optional)'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No default location</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
                {loc.location_type === 'school' && (
                  <span className="ml-2 text-muted-foreground">(School)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {locations.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">
            No locations yet. You can add them in Settings → Locations.
          </p>
        )}
      </div>
      
      {/* Default Teacher */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Default Teacher
        </Label>
        <Select
          value={data.teacherId}
          onValueChange={(v) => update('teacherId', v === 'none' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Loading...' : 'Select teacher (optional)'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No default teacher</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Default Rate Card */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Default Rate Card
        </Label>
        <Select
          value={data.rateCardId}
          onValueChange={(v) => update('rateCardId', v === 'none' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? 'Loading...' : 'Select rate card (optional)'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No default rate</SelectItem>
            {rateCards.map((rate) => (
              <SelectItem key={rate.id} value={rate.id}>
                {formatRate(rate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rateCards.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground">
            No rate cards yet. You can add them in Settings → Rate Cards.
          </p>
        )}
      </div>
    </div>
  );
}
