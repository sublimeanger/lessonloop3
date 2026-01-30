import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, User, Receipt, Edit, Loader2, Check, X } from 'lucide-react';

interface TeachingDefaultsCardProps {
  studentId: string;
  defaultLocationId: string | null;
  defaultTeacherId: string | null; // Now teachers.id
  defaultRateCardId: string | null;
  onUpdate?: () => void;
  readOnly?: boolean;
}

interface Location {
  id: string;
  name: string;
  location_type: string;
}

interface Teacher {
  id: string;
  display_name: string;
}

interface RateCard {
  id: string;
  name: string;
  rate_amount: number;
  duration_mins: number;
}

export function TeachingDefaultsCard({ 
  studentId, 
  defaultLocationId, 
  defaultTeacherId, 
  defaultRateCardId,
  onUpdate,
  readOnly = false
}: TeachingDefaultsCardProps) {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Options
  const [locations, setLocations] = useState<Location[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  
  // Current display values
  const [locationName, setLocationName] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [rateCardName, setRateCardName] = useState<string | null>(null);
  
  // Edit form values
  const [editLocationId, setEditLocationId] = useState(defaultLocationId || '');
  const [editTeacherId, setEditTeacherId] = useState(defaultTeacherId || '');
  const [editRateCardId, setEditRateCardId] = useState(defaultRateCardId || '');
  
  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrg) return;
      setIsLoading(true);
      
      // Fetch options - now using teachers table instead of org_memberships
      const [locsRes, teachersRes, ratesRes] = await Promise.all([
        supabase.from('locations').select('id, name, location_type').eq('org_id', currentOrg.id).order('name'),
        supabase.from('teachers').select('id, display_name').eq('org_id', currentOrg.id).eq('status', 'active').order('display_name'),
        supabase.from('rate_cards').select('id, name, rate_amount, duration_mins').eq('org_id', currentOrg.id).order('name'),
      ]);
      
      setLocations(locsRes.data || []);
      setRateCards(ratesRes.data || []);
      
      const teacherList = (teachersRes.data || []).map((t: any) => ({
        id: t.id,
        display_name: t.display_name,
      }));
      setTeachers(teacherList);
      
      // Set display names
      if (defaultLocationId) {
        const loc = locsRes.data?.find(l => l.id === defaultLocationId);
        setLocationName(loc?.name || null);
      }
      if (defaultTeacherId) {
        const teacher = teacherList.find((t: Teacher) => t.id === defaultTeacherId);
        setTeacherName(teacher?.display_name || null);
      }
      if (defaultRateCardId) {
        const rate = ratesRes.data?.find(r => r.id === defaultRateCardId);
        if (rate) {
          setRateCardName(`${rate.name} - £${(rate.rate_amount / 100).toFixed(2)} / ${rate.duration_mins} mins`);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [currentOrg, defaultLocationId, defaultTeacherId, defaultRateCardId]);
  
  const handleSave = async () => {
    setIsSaving(true);
    
    const { error } = await supabase
      .from('students')
      .update({
        default_location_id: editLocationId || null,
        default_teacher_id: editTeacherId || null, // Now uses teacher_id
        default_rate_card_id: editRateCardId || null,
      })
      .eq('id', studentId);
    
    if (error) {
      toast({ title: 'Error saving defaults', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Teaching defaults updated' });
      
      // Update display names
      const loc = locations.find(l => l.id === editLocationId);
      setLocationName(loc?.name || null);
      
      const teacher = teachers.find(t => t.id === editTeacherId);
      setTeacherName(teacher?.display_name || null);
      
      const rate = rateCards.find(r => r.id === editRateCardId);
      if (rate) {
        setRateCardName(`${rate.name} - £${(rate.rate_amount / 100).toFixed(2)} / ${rate.duration_mins} mins`);
      } else {
        setRateCardName(null);
      }
      
      setIsEditing(false);
      onUpdate?.();
    }
    
    setIsSaving(false);
  };
  
  const handleCancel = () => {
    setEditLocationId(defaultLocationId || '');
    setEditTeacherId(defaultTeacherId || '');
    setEditRateCardId(defaultRateCardId || '');
    setIsEditing(false);
  };
  
  const hasDefaults = locationName || teacherName || rateCardName;
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teaching Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Teaching Defaults</CardTitle>
          <CardDescription className="text-xs">
            Auto-populate when scheduling lessons
          </CardDescription>
        </div>
        {isOrgAdmin && !readOnly && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Location
              </Label>
              <Select value={editLocationId} onValueChange={setEditLocationId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Teacher
              </Label>
              <Select value={editTeacherId} onValueChange={setEditTeacherId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                Rate Card
              </Label>
              <Select value={editRateCardId} onValueChange={setEditRateCardId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default</SelectItem>
                  {rateCards.map(rate => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {rate.name} - £{(rate.rate_amount / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        ) : hasDefaults ? (
          <div className="space-y-2">
            {locationName && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{locationName}</span>
              </div>
            )}
            {teacherName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{teacherName}</span>
              </div>
            )}
            {rateCardName && (
              <div className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>{rateCardName}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No defaults set. Click Edit to configure.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
