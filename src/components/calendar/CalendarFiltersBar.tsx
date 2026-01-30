import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarFilters } from './types';

interface CalendarFiltersBarProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
}

export function CalendarFiltersBar({ filters, onChange, teachers, locations, rooms }: CalendarFiltersBarProps) {
  const filteredRooms = filters.location_id 
    ? rooms.filter(r => r.location_id === filters.location_id)
    : [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Teacher:</Label>
        <Select 
          value={filters.teacher_id || 'all'} 
          onValueChange={(v) => onChange({ ...filters, teacher_id: v === 'all' ? null : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All teachers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teachers</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Location:</Label>
        <Select 
          value={filters.location_id || 'all'} 
          onValueChange={(v) => onChange({ ...filters, location_id: v === 'all' ? null : v, room_id: null })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filters.location_id && filteredRooms.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Room:</Label>
          <Select 
            value={filters.room_id || 'all'} 
            onValueChange={(v) => onChange({ ...filters, room_id: v === 'all' ? null : v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rooms</SelectItem>
              {filteredRooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
