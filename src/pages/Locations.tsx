import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { FeatureGate } from '@/components/subscription';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { Plus, MapPin, ChevronDown, Loader2, Trash2, Edit, DoorOpen, Lock, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type LocationType = 'school' | 'studio' | 'home' | 'online';
type FilterTab = 'all' | LocationType;

interface Room {
  id: string;
  name: string;
  capacity: number | null;
  max_capacity: number | null;
  location_id: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: string;
  name: string;
  location_type: LocationType;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  is_primary: boolean;
  rooms?: Room[];
}

const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
  online: '🌐',
  home: '🏠',
  school: '🏫',
  studio: '🎵',
};

const FILTER_PILLS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'studio', label: 'Studio' },
  { value: 'school', label: 'School' },
  { value: 'home', label: 'Home' },
  { value: 'online', label: 'Online' },
];

export default function Locations() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const { hasAccess: hasMultiLocation, requiredPlanName } = useFeatureGate('multi_location');
  const { checkLocationDeletion, checkRoomDeletion } = useDeleteValidation();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*, rooms(*)')
        .eq('org_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return (data || []).map(loc => ({
        ...loc,
        rooms: (loc.rooms || []) as Room[],
      })) as Location[];
    },
    enabled: !!currentOrg,
    staleTime: 30_000,
  });
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  
  // Location dialog
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isLocationSaving, setIsLocationSaving] = useState(false);
  const [isRoomSaving, setIsRoomSaving] = useState(false);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<LocationType>('studio');
  const [locAddress1, setLocAddress1] = useState('');
  const [locAddress2, setLocAddress2] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locPostcode, setLocPostcode] = useState('');
  const [locNotes, setLocNotes] = useState('');
  
  // Room dialog
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [roomLocationId, setRoomLocationId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');

  // Delete validation state for locations
  const [deleteLocDialog, setDeleteLocDialog] = useState<{
    open: boolean;
    locationId: string;
    locationName: string;
    checkResult: DeletionCheckResult | null;
    isChecking: boolean;
    isDeleting: boolean;
  }>({ open: false, locationId: '', locationName: '', checkResult: null, isChecking: false, isDeleting: false });

  // Delete validation state for rooms
  const [deleteRoomDialog, setDeleteRoomDialog] = useState<{
    open: boolean;
    roomId: string;
    roomName: string;
    checkResult: DeletionCheckResult | null;
    isChecking: boolean;
    isDeleting: boolean;
  }>({ open: false, roomId: '', roomName: '', checkResult: null, isChecking: false, isDeleting: false });

  // Filtered locations
  const filteredLocations = useMemo(() => {
    let list = locations;
    if (filterTab !== 'all') list = list.filter(l => l.location_type === filterTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.address_line_1?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.postcode?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [locations, filterTab, search]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: locations.length, studio: 0, school: 0, home: 0, online: 0 };
    locations.forEach(l => { counts[l.location_type]++; });
    return counts;
  }, [locations]);

  const invalidateLocations = () => queryClient.invalidateQueries({ queryKey: ['locations'] });

  const toggleExpanded = (id: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setLocName(location.name);
      setLocType(location.location_type);
      setLocAddress1(location.address_line_1 || '');
      setLocAddress2(location.address_line_2 || '');
      setLocCity(location.city || '');
      setLocPostcode(location.postcode || '');
      setLocNotes(location.notes || '');
    } else {
      setEditingLocation(null);
      setLocName('');
      setLocType('studio');
      setLocAddress1('');
      setLocAddress2('');
      setLocCity('');
      setLocPostcode('');
      setLocNotes('');
    }
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!locName.trim() || !currentOrg) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    
    if (!editingLocation && !hasMultiLocation && locations.length >= 1) {
      toast({ 
        title: 'Multi-location requires upgrade', 
        description: `Upgrade to the ${requiredPlanName} plan to add additional locations.`,
        variant: 'destructive' 
      });
      return;
    }
    
    // Check for duplicate name within the org
    let dupQuery = supabase
      .from('locations')
      .select('id')
      .eq('org_id', currentOrg.id)
      .ilike('name', locName.trim());
    if (editingLocation) {
      dupQuery = dupQuery.neq('id', editingLocation.id);
    }
    const { data: duplicates } = await dupQuery;
    if (duplicates && duplicates.length > 0) {
      toast({ title: 'Name already in use', description: 'A location with this name already exists.', variant: 'destructive' });
      return;
    }

    setIsLocationSaving(true);
    const data = {
      name: locName.trim(),
      location_type: locType,
      address_line_1: locAddress1.trim() || null,
      address_line_2: locAddress2.trim() || null,
      city: locCity.trim() || null,
      postcode: locPostcode.trim() || null,
      notes: locNotes.trim() || null,
    };
    
    if (editingLocation) {
      const { error } = await supabase.from('locations').update(data).eq('id', editingLocation.id).eq('org_id', currentOrg.id);
      if (error) {
        toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Location updated' });
        setIsLocationDialogOpen(false);
        invalidateLocations();
      }
    } else {
      const { error } = await supabase.from('locations').insert({ ...data, org_id: currentOrg.id });
      if (error) {
        toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Location added' });
        setIsLocationDialogOpen(false);
        invalidateLocations();
      }
    }
    setIsLocationSaving(false);
  };

  const initiateDeleteLocation = async (location: Location) => {
    setDeleteLocDialog({
      open: true,
      locationId: location.id,
      locationName: location.name,
      checkResult: null,
      isChecking: true,
      isDeleting: false,
    });
    const result = await checkLocationDeletion(location.id);
    setDeleteLocDialog(prev => ({ ...prev, checkResult: result, isChecking: false }));
  };

  const confirmDeleteLocation = async () => {
    setDeleteLocDialog(prev => ({ ...prev, isDeleting: true }));
    const { locationId } = deleteLocDialog;

    const { data: rooms } = await supabase.from('rooms').select('id').eq('location_id', locationId);
    if (rooms && rooms.length > 0) {
      const { error: roomErr } = await supabase.from('rooms').delete().eq('location_id', locationId);
      if (roomErr) {
        toast({ title: 'Error deleting rooms', description: roomErr.message, variant: 'destructive' });
        setDeleteLocDialog(prev => ({ ...prev, isDeleting: false }));
        return;
      }
    }

    // Clean up location-specific closure dates
    // TODO: Ideally this entire cascade (rooms → closure_dates → location) should be
    // a single Supabase database function (RPC) for true atomicity.
    const { error: closureErr } = await supabase.from('closure_dates').delete().eq('location_id', locationId);
    if (closureErr) {
      toast({ title: 'Error deleting closure dates', description: closureErr.message, variant: 'destructive' });
      setDeleteLocDialog(prev => ({ ...prev, isDeleting: false }));
      return;
    }

    const { error } = await supabase.from('locations').delete().eq('id', locationId).eq('org_id', currentOrg.id);
    if (error) {
      toast({ title: 'Error deleting location', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Location deleted' });
      invalidateLocations();
    }
    setDeleteLocDialog(prev => ({ ...prev, open: false, isDeleting: false }));
  };

  const openRoomDialog = (locationId: string, room?: Room) => {
    setRoomLocationId(locationId);
    if (room) {
      setEditingRoom(room);
      setRoomName(room.name);
      setRoomCapacity(room.capacity?.toString() || '');
    } else {
      setEditingRoom(null);
      setRoomName('');
      setRoomCapacity('');
    }
    setIsRoomDialogOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!roomName.trim() || !roomLocationId || !currentOrg) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    
    const parsedCapacity = roomCapacity ? parseInt(roomCapacity) : null;
    if (parsedCapacity !== null && (parsedCapacity < 1 || isNaN(parsedCapacity))) {
      toast({ title: 'Capacity must be 1 or more', variant: 'destructive' });
      return;
    }

    setIsRoomSaving(true);
    const data = {
      name: roomName.trim(),
      capacity: parsedCapacity,
      max_capacity: parsedCapacity,
    };
    
    if (editingRoom) {
      const { error } = await supabase.from('rooms').update(data).eq('id', editingRoom.id).eq('org_id', currentOrg.id);
      if (error) {
        toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Room updated' });
        setIsRoomDialogOpen(false);
        invalidateLocations();
      }
    } else {
      const { error } = await supabase.from('rooms').insert({ ...data, location_id: roomLocationId, org_id: currentOrg.id });
      if (error) {
        toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Room added' });
        setIsRoomDialogOpen(false);
        invalidateLocations();
      }
    }
    setIsRoomSaving(false);
  };

  const initiateDeleteRoom = async (room: Room) => {
    setDeleteRoomDialog({
      open: true,
      roomId: room.id,
      roomName: room.name,
      checkResult: null,
      isChecking: true,
      isDeleting: false,
    });
    const result = await checkRoomDeletion(room.id);
    setDeleteRoomDialog(prev => ({ ...prev, checkResult: result, isChecking: false }));
  };

  const confirmDeleteRoom = async () => {
    setDeleteRoomDialog(prev => ({ ...prev, isDeleting: true }));
    const { error } = await supabase.from('rooms').delete().eq('id', deleteRoomDialog.roomId).eq('org_id', currentOrg.id);
    if (error) {
      toast({ title: 'Error deleting room', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Room deleted' });
      invalidateLocations();
    }
    setDeleteRoomDialog(prev => ({ ...prev, open: false, isDeleting: false }));
  };

  const handleSetPrimary = async (locationId: string) => {
    if (!currentOrg) return;

    // Find current primary so we can rollback if needed
    const currentPrimary = locations.find(l => l.is_primary);

    try {
      const { error: clearError } = await supabase
        .from('locations')
        .update({ is_primary: false })
        .eq('org_id', currentOrg.id);

      if (clearError) throw clearError;

      const { error: setError } = await supabase
        .from('locations')
        .update({ is_primary: true })
        .eq('id', locationId)
        .eq('org_id', currentOrg.id);

      if (setError) {
        // Rollback: restore previous primary
        if (currentPrimary) {
          await supabase
            .from('locations')
            .update({ is_primary: true })
            .eq('id', currentPrimary.id)
            .eq('org_id', currentOrg.id);
        }
        throw setError;
      }

      invalidateLocations();
      toast({ title: 'Primary location updated' });
    } catch (error) {
      invalidateLocations();
      toast({ title: 'Failed to update primary location', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const canAddLocation = hasMultiLocation || locations.length === 0;

  return (
    <AppLayout>
      <PageHeader
        title={`Locations${locations.length > 0 ? ` (${locations.length})` : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Locations' }]}
        actions={
          isOrgAdmin && (
            <Button 
              size="sm"
              onClick={() => openLocationDialog()} 
              className="gap-1.5"
              disabled={!canAddLocation}
            >
              {!canAddLocation && <Lock className="h-4 w-4" />}
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Location</span>
            </Button>
          )
        }
      />

      {/* Multi-location upgrade prompt */}
      {!hasMultiLocation && locations.length >= 1 && (
        <div className="mb-4">
          <FeatureGate feature="multi_location">
            <div />
          </FeatureGate>
        </div>
      )}

      {/* Search + Filter pills */}
      {locations.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5 w-fit overflow-x-auto">
            {FILTER_PILLS.map((pill) => (
              <button
                key={pill.value}
                onClick={() => setFilterTab(pill.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all',
                  filterTab === pill.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {pill.label}
                <span className="ml-1 text-muted-foreground">({typeCounts[pill.value] || 0})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first teaching location to get started with scheduling."
          actionLabel={isOrgAdmin ? 'Add Your First Location' : undefined}
          onAction={isOrgAdmin ? () => openLocationDialog() : undefined}
        />
      ) : filteredLocations.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">No locations match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLocations.map((location) => (
            <Collapsible
              key={location.id}
              open={expandedLocations.has(location.id)}
              onOpenChange={() => toggleExpanded(location.id)}
            >
              <div className="rounded-xl border bg-card shadow-sm transition-all hover:shadow-md">
                {/* Location header */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg shrink-0">
                    {LOCATION_TYPE_ICONS[location.location_type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{location.name}</span>
                      {location.is_primary && <Badge className="text-[10px] shrink-0">Primary</Badge>}
                      <Badge variant="outline" className="capitalize text-[10px] shrink-0">{location.location_type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {(location.address_line_1 || location.city) && (
                        <span className="truncate">
                          {[location.address_line_1, location.city, location.postcode].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isOrgAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={location.is_primary ? 'Primary location' : 'Set as primary'}
                          onClick={(e) => { e.stopPropagation(); handleSetPrimary(location.id); }}
                        >
                          <Star className={cn('h-4 w-4', location.is_primary && 'fill-primary text-primary')} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openLocationDialog(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => initiateDeleteLocation(location)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                        <DoorOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">{location.rooms?.length || 0} Room{(location.rooms?.length || 0) !== 1 ? 's' : ''}</span>
                        <span className="sm:hidden">{location.rooms?.length || 0}</span>
                        <ChevronDown className={cn('h-3 w-3 transition-transform', expandedLocations.has(location.id) && 'rotate-180')} />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                {/* Rooms panel */}
                <CollapsibleContent>
                  <div className="border-t px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rooms</h4>
                      {isOrgAdmin && (
                        <Button variant="outline" size="sm" onClick={() => openRoomDialog(location.id)} className="gap-1 h-7 text-xs">
                          <Plus className="h-3 w-3" />
                          Add Room
                        </Button>
                      )}
                    </div>
                    {!location.rooms || location.rooms.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">No rooms yet. Add rooms to schedule lessons in specific spaces.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {location.rooms.map((room) => (
                          <div key={room.id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5">
                            <div className="min-w-0">
                              <span className="text-sm font-medium">{room.name}</span>
                              {room.capacity && <span className="text-xs text-muted-foreground ml-1.5">(Cap: {room.capacity})</span>}
                            </div>
                            {isOrgAdmin && (
                              <div className="flex gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openRoomDialog(location.id, room)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => initiateDeleteRoom(room)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <DialogDescription>Configure your teaching venue details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Main Studio" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={locType} onValueChange={(v) => setLocType(v as LocationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={locAddress1} onChange={(e) => setLocAddress1(e.target.value)} placeholder="123 High Street" />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input value={locAddress2} onChange={(e) => setLocAddress2(e.target.value)} placeholder="Suite 4" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={locCity} onChange={(e) => setLocCity(e.target.value)} placeholder="London" />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={locPostcode} onChange={(e) => setLocPostcode(e.target.value)} placeholder="SW1A 1AA" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={locNotes} onChange={(e) => setLocNotes(e.target.value)} placeholder="Parking available behind building..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation} disabled={isLocationSaving}>
              {isLocationSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingLocation ? 'Update' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
            <DialogDescription>Add a room within this location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room Name *</Label>
              <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Room 1" />
            </div>
            <div className="space-y-2">
              <Label>Capacity (optional)</Label>
              <Input type="number" min="1" step="1" value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} placeholder="4" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} disabled={isRoomSaving}>
              {isRoomSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingRoom ? 'Update' : 'Add Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Validation Dialog */}
      <DeleteValidationDialog
        open={deleteLocDialog.open}
        onOpenChange={(open) => setDeleteLocDialog(prev => ({ ...prev, open }))}
        entityName={deleteLocDialog.locationName}
        entityType="Location"
        checkResult={deleteLocDialog.checkResult}
        isLoading={deleteLocDialog.isChecking}
        onConfirmDelete={confirmDeleteLocation}
        isDeleting={deleteLocDialog.isDeleting}
      />

      {/* Delete Room Validation Dialog */}
      <DeleteValidationDialog
        open={deleteRoomDialog.open}
        onOpenChange={(open) => setDeleteRoomDialog(prev => ({ ...prev, open }))}
        entityName={deleteRoomDialog.roomName}
        entityType="Room"
        checkResult={deleteRoomDialog.checkResult}
        isLoading={deleteRoomDialog.isChecking}
        onConfirmDelete={confirmDeleteRoom}
        isDeleting={deleteRoomDialog.isDeleting}
      />
    </AppLayout>
  );
}
