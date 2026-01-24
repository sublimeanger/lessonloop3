import { useState, useEffect } from 'react';
import { format, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCancellationNoticeSetting } from '@/hooks/useMakeUpCredits';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Plus, Trash2, Loader2, Upload, Calendar as CalendarIconSolid, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClosureDate {
  id: string;
  date: string;
  reason: string;
  location_id: string | null;
  applies_to_all_locations: boolean;
  location?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
}

// UK school holiday presets
const UK_PRESETS = [
  { name: 'Christmas 2024/25', dates: [
    { start: '2024-12-21', end: '2025-01-05', reason: 'Christmas Holiday' }
  ]},
  { name: 'February Half Term 2025', dates: [
    { start: '2025-02-17', end: '2025-02-21', reason: 'February Half Term' }
  ]},
  { name: 'Easter 2025', dates: [
    { start: '2025-04-07', end: '2025-04-21', reason: 'Easter Holiday' }
  ]},
  { name: 'May Half Term 2025', dates: [
    { start: '2025-05-26', end: '2025-05-30', reason: 'May Half Term' }
  ]},
  { name: 'Summer 2025', dates: [
    { start: '2025-07-21', end: '2025-09-01', reason: 'Summer Holiday' }
  ]},
  { name: 'October Half Term 2025', dates: [
    { start: '2025-10-27', end: '2025-10-31', reason: 'October Half Term' }
  ]},
  { name: 'Christmas 2025/26', dates: [
    { start: '2025-12-22', end: '2026-01-04', reason: 'Christmas Holiday' }
  ]},
];

function CancellationNoticeSetting() {
  const { noticeHours, updateNoticeHours } = useCancellationNoticeSetting();
  const [localHours, setLocalHours] = useState(noticeHours);

  useEffect(() => {
    setLocalHours(noticeHours);
  }, [noticeHours]);

  return (
    <div className="space-y-2">
      <div className="font-medium">Cancellation notice period</div>
      <div className="text-sm text-muted-foreground">
        Students who cancel with at least this much notice will receive a make-up credit
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Input
          type="number"
          min="0"
          max="168"
          value={localHours}
          onChange={(e) => setLocalHours(parseInt(e.target.value) || 0)}
          className="w-20"
        />
        <span className="text-sm text-muted-foreground">hours</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateNoticeHours.mutate(localHours)}
          disabled={localHours === noticeHours || updateNoticeHours.isPending}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function SchedulingSettingsTab() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  const [closures, setClosures] = useState<ClosureDate[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockScheduling, setBlockScheduling] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Add closure modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'range' | 'preset'>('single');
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const fetchData = async () => {
    if (!currentOrg) return;
    setIsLoading(true);

    // Fetch closures
    const { data: closureData } = await supabase
      .from('closure_dates')
      .select('*, location:locations(name)')
      .eq('org_id', currentOrg.id)
      .order('date', { ascending: true });

    setClosures((closureData as ClosureDate[]) || []);

    // Fetch locations
    const { data: locationData } = await supabase
      .from('locations')
      .select('id, name')
      .eq('org_id', currentOrg.id)
      .order('name');

    setLocations(locationData || []);

    // Get org setting
    setBlockScheduling(currentOrg.block_scheduling_on_closures ?? true);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrg?.id]);

  const handleBlockSchedulingChange = async (checked: boolean) => {
    if (!currentOrg) return;
    setBlockScheduling(checked);

    const { error } = await supabase
      .from('organisations')
      .update({ block_scheduling_on_closures: checked })
      .eq('id', currentOrg.id);

    if (error) {
      toast({ title: 'Error saving setting', variant: 'destructive' });
      setBlockScheduling(!checked);
    } else {
      toast({ title: 'Setting updated' });
      refreshOrganisations();
    }
  };

  const addClosureDates = async (dates: { date: Date; reason: string }[]) => {
    if (!currentOrg || !user) return;
    setIsSaving(true);

    try {
      const inserts = dates.map(d => ({
        org_id: currentOrg.id,
        date: format(d.date, 'yyyy-MM-dd'),
        reason: d.reason,
        location_id: selectedLocationId === 'all' ? null : selectedLocationId,
        applies_to_all_locations: selectedLocationId === 'all',
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('closure_dates')
        .upsert(inserts, { onConflict: 'org_id,location_id,date' });

      if (error) throw error;

      toast({ title: `${dates.length} closure date${dates.length > 1 ? 's' : ''} added` });
      fetchData();
      resetModal();
    } catch (error: any) {
      toast({ title: 'Error adding closures', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSingle = () => {
    if (!singleDate || !reason.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    addClosureDates([{ date: singleDate, reason: reason.trim() }]);
  };

  const handleAddRange = () => {
    if (!startDate || !endDate || !reason.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(date => ({
      date,
      reason: reason.trim(),
    }));
    addClosureDates(dates);
  };

  const handleAddPreset = () => {
    const preset = UK_PRESETS.find(p => p.name === selectedPreset);
    if (!preset) return;

    const allDates: { date: Date; reason: string }[] = [];
    for (const range of preset.dates) {
      const dates = eachDayOfInterval({
        start: parseISO(range.start),
        end: parseISO(range.end),
      }).map(date => ({ date, reason: range.reason }));
      allDates.push(...dates);
    }
    addClosureDates(allDates);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('closure_dates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting closure', variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const handleDeleteBulk = async (reason: string) => {
    if (!currentOrg) return;
    const { error } = await supabase
      .from('closure_dates')
      .delete()
      .eq('org_id', currentOrg.id)
      .eq('reason', reason);

    if (error) {
      toast({ title: 'Error deleting closures', variant: 'destructive' });
    } else {
      toast({ title: 'Closures removed' });
      fetchData();
    }
  };

  const resetModal = () => {
    setIsAddModalOpen(false);
    setAddMode('single');
    setSingleDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setSelectedLocationId('all');
    setSelectedPreset('');
  };

  // Group closures by reason for display
  const groupedClosures = closures.reduce((acc, closure) => {
    const key = closure.reason;
    if (!acc[key]) acc[key] = [];
    acc[key].push(closure);
    return acc;
  }, {} as Record<string, ClosureDate[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scheduling Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIconSolid className="h-5 w-5" />
            Scheduling Settings
          </CardTitle>
          <CardDescription>Configure how lesson scheduling works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Block scheduling on closure dates</div>
              <div className="text-sm text-muted-foreground">
                Prevent lessons from being scheduled on closure dates
              </div>
            </div>
            <Switch
              checked={blockScheduling}
              onCheckedChange={handleBlockSchedulingChange}
            />
          </div>
          
          <Separator />
          
          <CancellationNoticeSetting />
        </CardContent>
      </Card>

      {/* Closure Dates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Term Closure Dates</CardTitle>
              <CardDescription>Manage school holidays and closure dates</CardDescription>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Closure
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedClosures).length === 0 ? (
            <div className="text-center py-8">
              <CalendarIconSolid className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <h3 className="mt-4 font-medium">No closure dates set</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add school holidays and closure dates to prevent scheduling conflicts.
              </p>
              <Button onClick={() => setIsAddModalOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add First Closure
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedClosures).map(([reasonKey, dates]) => {
                const sortedDates = dates.sort((a, b) => a.date.localeCompare(b.date));
                const firstDate = sortedDates[0];
                const lastDate = sortedDates[sortedDates.length - 1];
                const isRange = dates.length > 1;

                return (
                  <div key={reasonKey} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{reasonKey}</span>
                        {!firstDate.applies_to_all_locations && firstDate.location && (
                          <Badge variant="outline" className="text-xs">
                            {firstDate.location.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isRange ? (
                          <>
                            {format(parseISO(firstDate.date), 'd MMM yyyy')} – {format(parseISO(lastDate.date), 'd MMM yyyy')}
                            <span className="ml-2 text-xs">({dates.length} days)</span>
                          </>
                        ) : (
                          format(parseISO(firstDate.date), 'EEEE, d MMMM yyyy')
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteBulk(reasonKey)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Closure Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={resetModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Closure Dates</DialogTitle>
            <DialogDescription>Add single dates, date ranges, or import UK school holidays</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <Button
                variant={addMode === 'single' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setAddMode('single')}
              >
                Single Date
              </Button>
              <Button
                variant={addMode === 'range' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setAddMode('range')}
              >
                Date Range
              </Button>
              <Button
                variant={addMode === 'preset' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setAddMode('preset')}
              >
                UK Holidays
              </Button>
            </div>

            {/* Location selector */}
            {locations.length > 0 && (
              <div className="space-y-2">
                <Label>Apply to</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {addMode === 'single' && (
              <>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {singleDate ? format(singleDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={singleDate}
                        onSelect={setSingleDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Bank Holiday, Staff Training"
                  />
                </div>
              </>
            )}

            {addMode === 'range' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'dd MMM') : 'Start'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'dd MMM') : 'End'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => startDate ? date < startDate : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Christmas Holiday, Easter Break"
                  />
                </div>
              </>
            )}

            {addMode === 'preset' && (
              <div className="space-y-2">
                <Label>Select UK School Holiday</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a holiday period" />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_PRESETS.map(preset => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreset && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {UK_PRESETS.find(p => p.name === selectedPreset)?.dates.map(d => (
                        <div key={d.start}>
                          {format(parseISO(d.start), 'd MMM')} – {format(parseISO(d.end), 'd MMM yyyy')}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetModal}>Cancel</Button>
            <Button
              onClick={
                addMode === 'single' ? handleAddSingle :
                addMode === 'range' ? handleAddRange :
                handleAddPreset
              }
              disabled={
                isSaving ||
                (addMode === 'single' && (!singleDate || !reason.trim())) ||
                (addMode === 'range' && (!startDate || !endDate || !reason.trim())) ||
                (addMode === 'preset' && !selectedPreset)
              }
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Closures
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
