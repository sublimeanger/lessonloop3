import { useState, useEffect, useMemo } from 'react';
import { format, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { getUKHolidayPresets } from '@/lib/holidayPresets';
import { useClosureDateSettings } from '@/hooks/useClosureDateSettings';
import { TermManagementCard } from '@/components/settings/TermManagementCard';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCancellationNoticeSetting } from '@/hooks/useMakeUpCredits';
import { useMakeUpPolicies, useWaitlistExpiry, ABSENCE_REASON_LABELS, ELIGIBILITY_OPTIONS, type Eligibility } from '@/hooks/useMakeUpPolicies';
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
      {localHours === 0 && (
        <p className="text-xs text-warning mt-1">
          A 0-hour notice period means all cancellations qualify for a make-up credit.
        </p>
      )}
    </div>
  );
}

function ScheduleHoursSetting() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { toast } = useToast();
  const [startHour, setStartHour] = useState(currentOrg?.schedule_start_hour ?? 7);
  const [endHour, setEndHour] = useState(currentOrg?.schedule_end_hour ?? 21);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStartHour(currentOrg?.schedule_start_hour ?? 7);
    setEndHour(currentOrg?.schedule_end_hour ?? 21);
  }, [currentOrg?.schedule_start_hour, currentOrg?.schedule_end_hour]);

  const hasChanges = startHour !== (currentOrg?.schedule_start_hour ?? 7) || endHour !== (currentOrg?.schedule_end_hour ?? 21);

  const handleSave = async () => {
    if (!currentOrg) return;
    if (endHour <= startHour + 1) {
      toast({ title: 'End hour must be at least 2 hours after start hour', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await supabase
      .from('organisations')
      .update({ schedule_start_hour: startHour, schedule_end_hour: endHour })
      .eq('id', currentOrg.id);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Error saving schedule hours', variant: 'destructive' });
    } else {
      toast({ title: 'Schedule hours updated' });
      refreshOrganisations();
    }
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">Calendar visible hours</div>
      <div className="text-sm text-muted-foreground">
        Set the start and end hours shown on the calendar time grid
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="start-hour" className="text-sm whitespace-nowrap">From</Label>
          <Input
            id="start-hour"
            type="number"
            min={0}
            max={22}
            value={startHour}
            onChange={(e) => setStartHour(Math.min(22, Math.max(0, parseInt(e.target.value) || 0)))}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="end-hour" className="text-sm whitespace-nowrap">To</Label>
          <Input
            id="end-hour"
            type="number"
            min={1}
            max={23}
            value={endHour}
            onChange={(e) => setEndHour(Math.min(23, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-20"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}

type ReschedulePolicy = 'self_service' | 'request_only' | 'admin_locked';

function ParentReschedulePolicySetting() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<ReschedulePolicy>(
    (currentOrg?.parent_reschedule_policy as ReschedulePolicy) || 'request_only'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentOrg?.parent_reschedule_policy) {
      setPolicy(currentOrg.parent_reschedule_policy as ReschedulePolicy);
    }
  }, [currentOrg?.parent_reschedule_policy]);

  const handlePolicyChange = async (newPolicy: ReschedulePolicy) => {
    if (!currentOrg) return;
    setPolicy(newPolicy);
    setIsSaving(true);

    const { error } = await supabase
      .from('organisations')
      .update({ parent_reschedule_policy: newPolicy })
      .eq('id', currentOrg.id);

    setIsSaving(false);

    if (error) {
      toast({ title: 'Error saving setting', variant: 'destructive' });
      setPolicy((currentOrg.parent_reschedule_policy as ReschedulePolicy) || 'request_only');
    } else {
      toast({ title: 'Parent rescheduling policy updated' });
      refreshOrganisations();
    }
  };

  const policies: { value: ReschedulePolicy; label: string; description: string }[] = [
    {
      value: 'self_service',
      label: 'Self-service',
      description: 'Parents can view available slots and propose new times. You approve with one click.',
    },
    {
      value: 'request_only',
      label: 'Request only',
      description: 'Parents send a message request. You handle scheduling manually.',
    },
    {
      value: 'admin_locked',
      label: 'Disabled',
      description: 'Parents cannot request reschedules through the portal. They must contact you directly.',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="font-medium">Parent rescheduling</div>
        <div className="text-sm text-muted-foreground">
          How should parents request lesson changes through the portal?
        </div>
      </div>
      <div className="space-y-3">
        {policies.map((p) => (
          <label
            key={p.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
              policy === p.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'
            )}
          >
            <input
              type="radio"
              name="reschedule-policy"
              value={p.value}
              checked={policy === p.value}
              onChange={() => handlePolicyChange(p.value)}
              disabled={isSaving}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium">{p.label}</div>
              <div className="text-sm text-muted-foreground">{p.description}</div>
            </div>
            {isSaving && policy === p.value && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

function MakeUpPolicySettings() {
  const { policies, isLoading, updatePolicy } = useMakeUpPolicies();
  const { expiryWeeks, updateExpiry } = useWaitlistExpiry();
  const [localExpiry, setLocalExpiry] = useState(expiryWeeks);

  useEffect(() => {
    setLocalExpiry(expiryWeeks);
  }, [expiryWeeks]);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIconSolid className="h-5 w-5" />
          Make-Up Policy
        </CardTitle>
        <CardDescription>
          Configure how each absence reason is handled for make-up eligibility
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Policy table */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Absence Reason</th>
                <th className="text-left p-3 font-medium">Make-Up Eligibility</th>
                <th className="text-center p-3 font-medium">Releases Slot</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => {
                const meta = ABSENCE_REASON_LABELS[policy.absence_reason];
                return (
                  <tr key={policy.id} className="border-b last:border-b-0">
                    <td className="p-3">
                      <span className="mr-2">{meta?.emoji}</span>
                      {meta?.label || policy.absence_reason}
                    </td>
                    <td className="p-3">
                      <Select
                        value={policy.eligibility}
                        onValueChange={(val) =>
                          updatePolicy.mutate({ id: policy.id, eligibility: val as Eligibility })
                        }
                      >
                        <SelectTrigger className="w-[180px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {ELIGIBILITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-center">
                      <Switch
                        checked={policy.releases_slot}
                        onCheckedChange={(checked) =>
                          updatePolicy.mutate({ id: policy.id, releases_slot: checked })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Separator />

        {/* Waitlist expiry */}
        <div className="space-y-2">
          <div className="font-medium">Waitlist expiry</div>
          <div className="text-sm text-muted-foreground">
            Waitlist entries automatically expire after this many weeks
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Entries expire after</span>
            <Input
              type="number"
              min={1}
              max={52}
              value={localExpiry}
              onChange={(e) => setLocalExpiry(parseInt(e.target.value) || 8)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">weeks</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateExpiry.mutate(localExpiry)}
              disabled={localExpiry === expiryWeeks || updateExpiry.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SchedulingSettingsTab() {
  const { currentOrg, refreshOrganisations } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const ukPresets = useMemo(() => getUKHolidayPresets(), []);

  const {
    closures,
    locations,
    isLoading,
    addClosureDates: addClosureDatesHook,
    addPreset: addPresetHook,
    deleteClosure,
    deleteBulk,
    isSaving,
  } = useClosureDateSettings();

  const [blockScheduling, setBlockScheduling] = useState(true);

  // Add closure modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'range' | 'preset'>('single');
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    setBlockScheduling(currentOrg?.block_scheduling_on_closures ?? true);
  }, [currentOrg?.block_scheduling_on_closures]);

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

  const handleAddSingle = () => {
    if (!singleDate || !reason.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    addClosureDatesHook([{ date: singleDate, reason: reason.trim() }], selectedLocationId);
    resetModal();
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
    if (dates.length > 365) {
      toast({ title: 'Range too large', description: 'Closure date ranges cannot exceed 365 days.', variant: 'destructive' });
      return;
    }
    addClosureDatesHook(dates, selectedLocationId);
    resetModal();
  };

  const handleAddPreset = () => {
    const preset = ukPresets.find(p => p.name === selectedPreset);
    if (!preset) return;
    addPresetHook(preset, selectedLocationId);
    resetModal();
  };

  const handleDeleteBulk = (reasonKey: string) => {
    deleteBulk(reasonKey);
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
  }, {} as Record<string, { id: string; date: string; reason: string; location_id: string | null; applies_to_all_locations: boolean; location?: { name: string } | null }[]>);

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

          <ScheduleHoursSetting />
          
          <Separator />
          
          <CancellationNoticeSetting />
          
          <Separator />
          
          <ParentReschedulePolicySetting />
        </CardContent>
      </Card>

      {/* Make-Up Policy */}
      <MakeUpPolicySettings />

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

      {/* Terms Management */}
      <TermManagementCard />

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
              <div className="space-y-3">
                <Label>Select UK School Holiday</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a holiday period" />
                  </SelectTrigger>
                  <SelectContent>
                    {ukPresets.map(preset => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  These are approximate dates based on typical UK school calendars. Please verify with your local education authority.
                </p>
                {selectedPreset && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {ukPresets.find(p => p.name === selectedPreset)?.dates.map(dr => (
                        <div key={dr.start}>
                          {format(parseISO(dr.start), 'd MMM')} – {format(parseISO(dr.end), 'd MMM yyyy')}
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
