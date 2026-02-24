import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { MapPin, User, Receipt, Edit, Loader2, Check, X } from 'lucide-react';
import { useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useRateCards } from '@/hooks/useRateCards';

interface TeachingDefaultsCardProps {
  studentId: string;
  defaultLocationId: string | null;
  defaultTeacherId: string | null;
  defaultRateCardId: string | null;
  onUpdate?: () => void;
  readOnly?: boolean;
}

export function TeachingDefaultsCard({ 
  studentId, 
  defaultLocationId, 
  defaultTeacherId, 
  defaultRateCardId,
  onUpdate,
  readOnly = false
}: TeachingDefaultsCardProps) {
  const { isOrgAdmin, currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Use shared cached hooks instead of local fetches
  const { teachers, locations } = useTeachersAndLocations();
  const { data: rateCards = [], isLoading: rateCardsLoading } = useRateCards();

  const isLoading = !teachers.length && !locations.length && rateCardsLoading;
  
  // Edit form values
  const [editLocationId, setEditLocationId] = useState(defaultLocationId || '');
  const [editTeacherId, setEditTeacherId] = useState(defaultTeacherId || '');
  const [editRateCardId, setEditRateCardId] = useState(defaultRateCardId || '');
  
  // Derive display names from cached data
  const locationName = useMemo(() => {
    if (!defaultLocationId) return null;
    return locations.find(l => l.id === defaultLocationId)?.name || null;
  }, [locations, defaultLocationId]);

  const teacherName = useMemo(() => {
    if (!defaultTeacherId) return null;
    return teachers.find(t => t.id === defaultTeacherId)?.name || null;
  }, [teachers, defaultTeacherId]);

  const rateCardName = useMemo(() => {
    if (!defaultRateCardId) return null;
    const rate = rateCards.find(r => r.id === defaultRateCardId);
    if (!rate) return null;
    return `${rate.name} - £${(rate.rate_amount / 100).toFixed(2)} / ${rate.duration_mins} mins`;
  }, [rateCards, defaultRateCardId]);
  
  const handleSave = async () => {
    setIsSaving(true);
    
    const { error } = await supabase
      .from('students')
      .update({
        default_location_id: editLocationId || null,
        default_teacher_id: editTeacherId || null,
        default_rate_card_id: editRateCardId || null,
      })
      .eq('id', studentId)
      .eq('org_id', currentOrg!.id);
    
    if (error) {
      toast({ title: 'Failed to save teaching defaults', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Teaching defaults updated' });
      if (currentOrg && user) {
        logAudit(currentOrg.id, user.id, 'student.defaults_updated', 'student', studentId, {
          before: { default_location_id: defaultLocationId, default_teacher_id: defaultTeacherId, default_rate_card_id: defaultRateCardId },
          after: { default_location_id: editLocationId || null, default_teacher_id: editTeacherId || null, default_rate_card_id: editRateCardId || null },
        });
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
          <CardTitle>Teaching Defaults</CardTitle>
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
          <CardTitle>Teaching Defaults</CardTitle>
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
              <Select value={editLocationId || 'none'} onValueChange={(v) => setEditLocationId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
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
              <Select value={editTeacherId || 'none'} onValueChange={(v) => setEditTeacherId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {teachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                Rate Card
              </Label>
              <Select value={editRateCardId || 'none'} onValueChange={(v) => setEditRateCardId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {rateCards.map(rate => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {rate.name} - £{(rate.rate_amount / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
