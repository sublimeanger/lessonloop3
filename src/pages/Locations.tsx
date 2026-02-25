import { useState, useMemo } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, MapPin, ChevronDown, Loader2, Trash2, Edit, DoorOpen, Lock, Search, Star, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfWeek, endOfWeek } from 'date-fns';

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
  country_code: string;
  notes: string | null;
  is_primary: boolean;
  is_archived: boolean;
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
  usePageMeta('Locations | LessonLoop', 'Manage your teaching locations and rooms');
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
    staleTime: STALE_STABLE,
  });
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterTab, setFilterTabState] = useState<FilterTab>(() => {
    const urlType = searchParams.get('type') as FilterTab | null;
    return urlType && ['all', 'school', 'studio', 'home', 'online'].includes(urlType) ? urlType : 'all';
  });
  const setFilterTab = (tab: FilterTab) => {
    setFilterTabState(tab);
    if (tab === 'all') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };
  const [showArchived, setShowArchived] = useState(false);
  
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
  const [locCountry, setLocCountry] = useState(currentOrg?.country_code || 'GB');
  
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

  // Location usage stats
  const locationIds = useMemo(() => locations.map(l => l.id), [locations]);
  const { data: locationStats } = useQuery({
    queryKey: ['location-usage-stats', currentOrg?.id, locationIds],
    queryFn: async () => {
      if (!currentOrg || locationIds.length === 0) return {};
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

      const [lessonsResult, teachersResult, roomLessonsResult] = await Promise.all([
        supabase
          .from('lessons')
          .select('location_id')
          .eq('org_id', currentOrg.id)
          .in('location_id', locationIds)
          .gte('start_at', weekStart)
          .lte('start_at', weekEnd)
          .neq('status', 'cancelled'),
        supabase
          .from('lessons')
          .select('location_id, teacher_id')
          .eq('org_id', currentOrg.id)
          .in('location_id', locationIds)
          .gte('start_at', weekStart)
          .lte('start_at', weekEnd)
          .neq('status', 'cancelled'),
        supabase
          .from('lessons')
          .select('room_id')
          .eq('org_id', currentOrg.id)
          .in('location_id', locationIds)
          .not('room_id', 'is', null)
          .gte('start_at', new Date().toISOString())
          .neq('status', 'cancelled')
          .limit(500),
      ]);

      const stats: Record<string, { lessonCount: number; teacherCount: number }> = {};
      const roomBookings: Record<string, number> = {};
      locationIds.forEach(id => { stats[id] = { lessonCount: 0, teacherCount: 0 }; });

      (lessonsResult.data || []).forEach(l => {
        if (l.location_id && stats[l.location_id]) stats[l.location_id].lessonCount++;
      });

      const teachersByLoc: Record<string, Set<string>> = {};
      (teachersResult.data || []).forEach(l => {
        if (l.location_id && l.teacher_id) {
          if (!teachersByLoc[l.location_id]) teachersByLoc[l.location_id] = new Set();
          teachersByLoc[l.location_id].add(l.teacher_id);
        }
      });
      Object.entries(teachersByLoc).forEach(([locId, set]) => {
        if (stats[locId]) stats[locId].teacherCount = set.size;
      });

      (roomLessonsResult.data || []).forEach(l => {
        if (l.room_id) roomBookings[l.room_id] = (roomBookings[l.room_id] || 0) + 1;
      });

      return { locationStats: stats, roomBookings };
    },
    enabled: !!currentOrg && locationIds.length > 0,
    // Uses default SEMI_STABLE (2 min)
  });

  // Filtered locations
  const filteredLocations = useMemo(() => {
    let list = locations;
    if (!showArchived) list = list.filter(l => !l.is_archived);
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
  }, [locations, filterTab, search, showArchived]);

  const typeCounts = useMemo(() => {
    const active = showArchived ? locations : locations.filter(l => !l.is_archived);
    const counts: Record<string, number> = { all: active.length, studio: 0, school: 0, home: 0, online: 0 };
    active.forEach(l => { counts[l.location_type]++; });
    return counts;
  }, [locations, showArchived]);

  const archivedCount = useMemo(() => locations.filter(l => l.is_archived).length, [locations]);

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
      setLocCountry(location.country_code || currentOrg?.country_code || 'GB');
    } else {
      setEditingLocation(null);
      setLocName('');
      setLocType('studio');
      setLocAddress1('');
      setLocAddress2('');
      setLocCity('');
      setLocPostcode('');
      setLocNotes('');
      setLocCountry(currentOrg?.country_code || 'GB');
    }
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!locName.trim() || !currentOrg) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    
    // Require address for physical locations
    if (locType !== 'online' && !locAddress1.trim() && !locCity.trim()) {
      toast({ title: 'Address required', description: 'Physical locations need at least an address or city.', variant: 'destructive' });
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
      country_code: locCountry,
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

  const handleArchiveLocation = async (location: Location) => {
    if (!currentOrg) return;
    const newArchived = !location.is_archived;
    const { error } = await supabase
      .from('locations')
      .update({ is_archived: newArchived })
      .eq('id', location.id)
      .eq('org_id', currentOrg.id);
    if (error) {
      toast({ title: 'Error updating location', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newArchived ? 'Location archived' : 'Location restored' });
      invalidateLocations();
    }
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

    // Clean up location-specific closure dates.
    // Note: rooms and closure_dates are removed via DB ON DELETE CASCADE constraints;
    // explicit deletes here serve as a defensive fallback.
    const { error: closureErr } = await supabase.from('closure_dates').delete().eq('location_id', locationId);
    if (closureErr) {
      toast({ title: 'Error deleting closure dates', description: closureErr.message, variant: 'destructive' });
      setDeleteLocDialog(prev => ({ ...prev, isDeleting: false }));
      return;
    }

    const { error } = await supabase.from('locations').delete().eq('id', locationId).eq('org_id', currentOrg!.id);
    if (error) {
      toast({ title: 'Error deleting location', description: error.message, variant: 'destructive' });
    } else {
      // Auto-promote another location if we deleted the primary
      const deletedLocation = locations.find(l => l.id === locationId);
      if (deletedLocation?.is_primary) {
        const { data: remaining } = await supabase
          .from('locations')
          .select('id, name')
          .eq('org_id', currentOrg!.id)
          .neq('id', locationId)
          .eq('is_archived', false)
          .order('created_at')
          .limit(1);
        if (remaining && remaining.length > 0) {
          await supabase.from('locations').update({ is_primary: true }).eq('id', remaining[0].id).eq('org_id', currentOrg!.id);
          toast({ title: 'Location deleted', description: `Primary location auto-assigned to ${remaining[0].name}.` });
        } else {
          toast({ title: 'Location deleted' });
        }
      } else {
        toast({ title: 'Location deleted' });
      }
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

    // Check for duplicate room name within the same location
    let dupQuery = supabase
      .from('rooms')
      .select('id')
      .eq('location_id', roomLocationId)
      .ilike('name', roomName.trim());
    if (editingRoom) {
      dupQuery = dupQuery.neq('id', editingRoom.id);
    }
    const { data: existingRooms } = await dupQuery;
    if (existingRooms && existingRooms.length > 0) {
      toast({ title: 'Name already in use', description: 'A room with this name already exists at this location.', variant: 'destructive' });
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
        // Check for over-capacity lessons if capacity was reduced
        if (parsedCapacity !== null && editingRoom.capacity !== null && parsedCapacity < editingRoom.capacity) {
          const { data: futureLessons } = await supabase
            .from('lessons')
            .select('id, title, start_at, lesson_participants(id)')
            .eq('room_id', editingRoom.id)
            .eq('org_id', currentOrg.id)
            .gte('start_at', new Date().toISOString())
            .neq('status', 'cancelled');

          const overCapacity = (futureLessons || []).filter(
            (l: any) => (l.lesson_participants?.length || 0) > parsedCapacity!
          );

          if (overCapacity.length > 0) {
            toast({
              title: 'Warning: Over-capacity lessons',
              description: `${overCapacity.length} upcoming lesson${overCapacity.length > 1 ? 's' : ''} now exceed${overCapacity.length === 1 ? 's' : ''} this room's capacity. Review these bookings.`,
            });
          }
        }

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
    const { error } = await supabase.from('rooms').delete().eq('id', deleteRoomDialog.roomId).eq('org_id', currentOrg!.id);
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
              className="h-11 pl-9"
            />
          </div>

          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1 sm:w-fit">
            {FILTER_PILLS.map((pill) => (
              <button
                type="button"
                key={pill.value}
                onClick={() => setFilterTab(pill.value)}
                className={cn(
                  'min-h-11 rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-all',
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
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              className={cn(
                'min-h-11 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all',
                showArchived ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
            </button>
          )}
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
        <div className="rounded-xl border bg-card p-8 text-center">
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
                <div className="p-4">
                  {/* Top row: icon + name + badges */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg shrink-0">
                      {LOCATION_TYPE_ICONS[location.location_type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('font-semibold text-sm', location.is_archived && 'text-muted-foreground')}>{location.name}</span>
                        {location.is_archived && <Badge variant="secondary" className="text-micro shrink-0">Archived</Badge>}
                        {location.is_primary && !location.is_archived && <Badge className="text-micro shrink-0">Primary</Badge>}
                        <Badge variant="outline" className="capitalize text-micro shrink-0">{location.location_type}</Badge>
                      </div>
                      {/* Address */}
                      {(location.address_line_1 || location.city) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          <span className="truncate">
                            {[location.address_line_1, location.city, location.postcode].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      {/* Usage stats */}
                      {locationStats?.locationStats && locationStats.locationStats[location.id] && (
                        <div className="text-micro mt-1">
                          {locationStats.locationStats[location.id].lessonCount > 0 ? (
                            <span className="text-muted-foreground">
                              {locationStats.locationStats[location.id].lessonCount} lesson{locationStats.locationStats[location.id].lessonCount !== 1 ? 's' : ''} this week
                              {locationStats.locationStats[location.id].teacherCount > 0 && ` · ${locationStats.locationStats[location.id].teacherCount} teacher${locationStats.locationStats[location.id].teacherCount !== 1 ? 's' : ''}`}
                            </span>
                          ) : (
                            <span className="text-warning">No upcoming lessons</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom action bar */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-0.5">
                      {(location.address_line_1 || location.city) && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.address_line_1, location.city, location.postcode].filter(Boolean).join(', '))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Directions</span>
                        </a>
                      )}
                      {isOrgAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={location.is_primary ? 'Primary location' : `Set ${location.name} as primary location`}
                            title={location.is_primary ? 'Primary location' : 'Set as primary'}
                            onClick={(e) => { e.stopPropagation(); handleSetPrimary(location.id); }}
                          >
                            <Star className={cn('h-4 w-4', location.is_primary && 'fill-primary text-primary')} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${location.name}`} onClick={() => openLocationDialog(location)} disabled={location.is_archived}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={location.is_archived ? `Restore ${location.name}` : `Archive ${location.name}`}
                            title={location.is_archived ? 'Restore location' : 'Archive location'}
                            onClick={() => handleArchiveLocation(location)}
                          >
                            {location.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          </Button>
                          {location.is_archived && (
                            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${location.name}`} onClick={() => initiateDeleteLocation(location)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs">
                        <DoorOpen className="h-4 w-4" />
                        {location.rooms?.length || 0} Room{(location.rooms?.length || 0) !== 1 ? 's' : ''}
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
                        <Button variant="outline" size="sm" onClick={() => openRoomDialog(location.id)} className="h-11 gap-1 text-xs sm:h-8">
                          <Plus className="h-3 w-3" />
                          Add Room
                        </Button>
                      )}
                    </div>
                    {!location.rooms || location.rooms.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-6">
                        <DoorOpen className="h-6 w-6 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">No rooms yet. Add rooms to schedule lessons in specific spaces.</p>
                        {isOrgAdmin && (
                          <Button variant="outline" size="sm" onClick={() => openRoomDialog(location.id)} className="h-11 gap-1 text-xs sm:h-8">
                            <Plus className="h-3 w-3" />
                            Add Room
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {location.rooms.map((room) => (
                          <div key={room.id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <DoorOpen className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="text-sm font-medium truncate">{room.name}</span>
                                {room.capacity && <span className="text-xs text-muted-foreground shrink-0">· {room.capacity} cap</span>}
                              </div>
                              <div className="text-micro mt-0.5 ml-5">
                                {(locationStats?.roomBookings?.[room.id] ?? 0) > 0 ? (
                                  <span className="text-muted-foreground">{locationStats?.roomBookings?.[room.id]} upcoming</span>
                                ) : (
                                  <span className="text-muted-foreground/60">No bookings</span>
                                )}
                              </div>
                            </div>
                            {isOrgAdmin && (
                              <div className="flex gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit room ${room.name}`} onClick={() => openRoomDialog(location.id, room)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete room ${room.name}`} onClick={() => initiateDeleteRoom(room)}>
                                  <Trash2 className="h-3.5 w-3.5" />
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
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg sm:border sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <DialogDescription>Configure your teaching venue details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input autoFocus value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Main Studio" />
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
              <Label>Address Line 1{locType !== 'online' && <span className="text-destructive ml-0.5">*</span>}</Label>
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
              <Label>Country</Label>
              <Select value={locCountry} onValueChange={setLocCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="IE">Ireland</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="NZ">New Zealand</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="ES">Spain</SelectItem>
                  <SelectItem value="IT">Italy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={locNotes} onChange={(e) => setLocNotes(e.target.value)} placeholder="Parking available behind building..." rows={3} maxLength={500} />
              <p className={cn('text-micro text-right', locNotes.length > 500 ? 'text-destructive' : 'text-muted-foreground')}>{locNotes.length}/500</p>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation} disabled={isLocationSaving}>
              {isLocationSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingLocation ? 'Save changes' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:border sm:p-6">
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
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoom} disabled={isRoomSaving}>
              {isRoomSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingRoom ? 'Save changes' : 'Add Room'}
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
