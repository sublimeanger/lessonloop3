import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { FeatureGate } from '@/components/subscription';
import { useDeleteValidation, DeletionCheckResult } from '@/hooks/useDeleteValidation';
import { DeleteValidationDialog } from '@/components/shared/DeleteValidationDialog';
import { Plus, MapPin, ChevronDown, Loader2, Building, Trash2, Edit, DoorOpen, Lock, Sparkles } from 'lucide-react';

type LocationType = 'school' | 'studio' | 'home' | 'online';

interface Room {
  id: string;
  name: string;
  capacity: number | null;
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

export default function Locations() {
  const { currentOrg, isOrgAdmin } = useOrg();
  const { toast } = useToast();
  const { hasAccess: hasMultiLocation, requiredPlanName } = useFeatureGate('multi_location');
  const { checkLocationDeletion, checkRoomDeletion } = useDeleteValidation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  
  // Location dialog
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
  const fetchLocations = async () => {
    if (!currentOrg) return;
    setIsLoading(true);
    
    const { data: locData, error } = await supabase
      .from('locations')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('name');
    
    if (error) {
      toast({ title: 'Error loading locations', description: error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    
    // Fetch rooms for each location
    const locationsWithRooms: Location[] = [];
    for (const loc of locData || []) {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('location_id', loc.id)
        .order('name');
      
      locationsWithRooms.push({
        ...loc,
        rooms: (rooms || []) as Room[],
      });
    }
    
    setLocations(locationsWithRooms);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, [currentOrg?.id]);

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
    
    // Check multi-location gate when adding (not editing)
    if (!editingLocation && !hasMultiLocation && locations.length >= 1) {
      toast({ 
        title: 'Multi-location requires upgrade', 
        description: `Upgrade to the ${requiredPlanName} plan to add additional locations.`,
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSaving(true);
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
      const { error } = await supabase.from('locations').update(data).eq('id', editingLocation.id);
      if (error) {
        toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Location updated' });
        setIsLocationDialogOpen(false);
        fetchLocations();
      }
    } else {
      const { error } = await supabase.from('locations').insert({ ...data, org_id: currentOrg.id });
      if (error) {
        toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Location added' });
        setIsLocationDialogOpen(false);
        fetchLocations();
      }
    }
    setIsSaving(false);
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

    // Delete rooms first
    const { data: rooms } = await supabase.from('rooms').select('id').eq('location_id', locationId);
    if (rooms && rooms.length > 0) {
      const { error: roomErr } = await supabase.from('rooms').delete().eq('location_id', locationId);
      if (roomErr) {
        toast({ title: 'Error deleting rooms', description: roomErr.message, variant: 'destructive' });
        setDeleteLocDialog(prev => ({ ...prev, isDeleting: false }));
        return;
      }
    }

    const { error } = await supabase.from('locations').delete().eq('id', locationId);
    if (error) {
      toast({ title: 'Error deleting location', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Location deleted' });
      fetchLocations();
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
    
    setIsSaving(true);
    const data = {
      name: roomName.trim(),
      capacity: roomCapacity ? parseInt(roomCapacity) : null,
    };
    
    if (editingRoom) {
      const { error } = await supabase.from('rooms').update(data).eq('id', editingRoom.id);
      if (error) {
        toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Room updated' });
        setIsRoomDialogOpen(false);
        fetchLocations();
      }
    } else {
      const { error } = await supabase.from('rooms').insert({ ...data, location_id: roomLocationId, org_id: currentOrg.id });
      if (error) {
        toast({ title: 'Error creating', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Room added' });
        setIsRoomDialogOpen(false);
        fetchLocations();
      }
    }
    setIsSaving(false);
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
    const { error } = await supabase.from('rooms').delete().eq('id', deleteRoomDialog.roomId);
    if (error) {
      toast({ title: 'Error deleting room', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Room deleted' });
      fetchLocations();
    }
    setDeleteRoomDialog(prev => ({ ...prev, open: false, isDeleting: false }));
  };

  const getLocationTypeIcon = (type: LocationType) => {
    switch (type) {
      case 'online': return '🌐';
      case 'home': return '🏠';
      case 'school': return '🏫';
      default: return '🎵';
    }
  };

  // Solo Teacher: Allow only 1 location, additional locations need upgrade
  const canAddLocation = hasMultiLocation || locations.length === 0;

  return (
    <AppLayout>
      <PageHeader
        title="Locations"
        description="Manage your teaching venues and rooms"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Locations' }]}
        actions={
          isOrgAdmin && (
            <Button 
              onClick={() => openLocationDialog()} 
              className="gap-2"
              disabled={!canAddLocation}
            >
              {!canAddLocation && <Lock className="h-4 w-4" />}
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          )
        }
      />

      {/* Multi-location upgrade prompt for Solo Teacher */}
      {!hasMultiLocation && locations.length >= 1 && (
        <div className="mb-6">
          <FeatureGate feature="multi_location">
            <div />
          </FeatureGate>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No locations yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add your first teaching location to get started.</p>
            {isOrgAdmin && (
              <Button onClick={() => openLocationDialog()} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Location
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {locations.map((location) => (
            <Collapsible
              key={location.id}
              open={expandedLocations.has(location.id)}
              onOpenChange={() => toggleExpanded(location.id)}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{getLocationTypeIcon(location.location_type)}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-lg truncate">{location.name}</CardTitle>
                          {location.is_primary && <Badge>Primary</Badge>}
                          <Badge variant="outline" className="capitalize">{location.location_type}</Badge>
                        </div>
                        {(location.address_line_1 || location.city) && (
                          <CardDescription className="truncate">
                            {[location.address_line_1, location.city, location.postcode].filter(Boolean).join(', ')}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOrgAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openLocationDialog(location)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => initiateDeleteLocation(location)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <DoorOpen className="h-4 w-4" />
                          <span className="hidden sm:inline">{location.rooms?.length || 0} Rooms</span>
                          <span className="sm:hidden">{location.rooms?.length || 0}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedLocations.has(location.id) ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Rooms</h4>
                        {isOrgAdmin && (
                          <Button variant="outline" size="sm" onClick={() => openRoomDialog(location.id)} className="gap-1">
                            <Plus className="h-3 w-3" />
                            Add Room
                          </Button>
                        )}
                      </div>
                      {!location.rooms || location.rooms.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No rooms yet. Add rooms to schedule lessons in specific spaces.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {location.rooms.map((room) => (
                            <div key={room.id} className="flex items-center justify-between rounded-lg border p-3">
                              <div>
                                <span className="font-medium">{room.name}</span>
                                {room.capacity && <span className="text-sm text-muted-foreground ml-2">(Cap: {room.capacity})</span>}
                              </div>
                              {isOrgAdmin && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRoomDialog(location.id, room)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => initiateDeleteRoom(room)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
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
            <Button onClick={handleSaveLocation} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingLocation ? 'Update' : 'Add Location'}
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
              <Input type="number" value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} placeholder="4" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingRoom ? 'Update' : 'Add Room'}
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
