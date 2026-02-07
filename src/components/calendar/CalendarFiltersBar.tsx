import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarFilters } from './types';
import { TeacherWithColour } from './teacherColours';
import { cn } from '@/lib/utils';

interface CalendarFiltersBarProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  teachers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
  teachersWithColours?: TeacherWithColour[];
}

export function CalendarFiltersBar({ filters, onChange, teachers, locations, rooms, teachersWithColours }: CalendarFiltersBarProps) {
  const filteredRooms = filters.location_id 
    ? rooms.filter(r => r.location_id === filters.location_id)
    : [];

  // Find the selected teacher's colour for the trigger dot
  const selectedTeacher = teachersWithColours?.find(t => t.id === filters.teacher_id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Teacher filter with colour dots */}
      <Select 
        value={filters.teacher_id || 'all'} 
        onValueChange={(v) => onChange({ ...filters, teacher_id: v === 'all' ? null : v })}
      >
        <SelectTrigger className="w-[160px] sm:w-[200px] h-9">
          <div className="flex items-center gap-2 truncate">
            {selectedTeacher && (
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', selectedTeacher.colour.bg)} />
            )}
            <SelectValue placeholder="All teachers" />
          </div>
        </SelectTrigger>
        <SelectContent className="z-[60]">
          <SelectItem value="all">
            <span className="font-medium">All teachers</span>
          </SelectItem>
          {(teachersWithColours || teachers.map(t => ({ ...t, userId: null, colour: undefined }))).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex items-center gap-2">
                {'colour' in t && t.colour && (
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', t.colour.bg)} />
                )}
                <span className="truncate">{t.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Location filter */}
      <Select 
        value={filters.location_id || 'all'} 
        onValueChange={(v) => onChange({ ...filters, location_id: v === 'all' ? null : v, room_id: null })}
      >
        <SelectTrigger className="w-[140px] sm:w-[180px] h-9">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent className="z-[60]">
          <SelectItem value="all">All locations</SelectItem>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Room filter (conditional) */}
      {filters.location_id && filteredRooms.length > 0 && (
        <Select 
          value={filters.room_id || 'all'} 
          onValueChange={(v) => onChange({ ...filters, room_id: v === 'all' ? null : v })}
        >
          <SelectTrigger className="w-[120px] sm:w-[150px] h-9">
            <SelectValue placeholder="All rooms" />
          </SelectTrigger>
          <SelectContent className="z-[60]">
            <SelectItem value="all">All rooms</SelectItem>
            {filteredRooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
