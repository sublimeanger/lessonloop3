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

  const deleteLocation = async (id: string) => {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      fetchLocations();
    }
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

  const deleteRoom = async (id: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      fetchLocations();
    }
  };

  const getLocationTypeIcon = (type: LocationType) => {
    switch (type) {
      case 'online': return '🌐';
      case 'home': return '🏠';
      case 'school': return '🏫';
      default: return '🎵';
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Locations"
        description="Manage your teaching venues and rooms"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Locations' }]}
        actions={
          isOrgAdmin && (
            <Button onClick={() => openLocationDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Location
            </Button>
          )
        }
      />

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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getLocationTypeIcon(location.location_type)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{location.name}</CardTitle>
                          {location.is_primary && <Badge>Primary</Badge>}
                          <Badge variant="outline" className="capitalize">{location.location_type}</Badge>
                        </div>
                        {(location.address_line_1 || location.city) && (
                          <CardDescription>
                            {[location.address_line_1, location.city, location.postcode].filter(Boolean).join(', ')}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOrgAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openLocationDialog(location)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLocation(location.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <DoorOpen className="h-4 w-4" />
                          {location.rooms?.length || 0} Rooms
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
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRoom(room.id)}>
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
    </AppLayout>
  );
}
