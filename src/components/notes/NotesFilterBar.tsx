import { useState } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { NotesExplorerFilters } from '@/hooks/useNotesExplorer';
import type { DateRange } from 'react-day-picker';

interface Teacher {
  id: string;
  display_name: string;
}

interface NotesFilterBarProps {
  filters: NotesExplorerFilters;
  onFiltersChange: (filters: NotesExplorerFilters) => void;
  teachers: Teacher[];
  isTeacherRole: boolean;
}

type Preset = 'today' | 'this_week' | 'last_7' | 'this_month' | 'custom';

export function NotesFilterBar({ filters, onFiltersChange, teachers, isTeacherRole }: NotesFilterBarProps) {
  const [preset, setPreset] = useState<Preset>('last_7');
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (p) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'this_week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'last_7':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case 'this_month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        return;
    }

    onFiltersChange({
      ...filters,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  const handleDateRange = (range: DateRange | undefined) => {
    if (range?.from) {
      setPreset('custom');
      onFiltersChange({
        ...filters,
        startDate: startOfDay(range.from).toISOString(),
        endDate: range.to ? endOfDay(range.to).toISOString() : endOfDay(range.from).toISOString(),
      });
    }
  };

  const handleSearch = () => {
    onFiltersChange({ ...filters, searchQuery: searchInput || undefined });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      {/* Date presets */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'today', label: 'Today' },
          { key: 'this_week', label: 'This Week' },
          { key: 'last_7', label: 'Last 7 Days' },
          { key: 'this_month', label: 'This Month' },
        ].map(p => (
          <Button
            key={p.key}
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => applyPreset(p.key as Preset)}
          >
            {p.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant={preset === 'custom' ? 'default' : 'outline'} size="sm">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: new Date(filters.startDate),
                to: new Date(filters.endDate),
              }}
              onSelect={handleDateRange}
              numberOfMonths={2}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Teacher filter */}
      {!isTeacherRole && (
        <Select
          value={filters.teacherId || 'all'}
          onValueChange={(v) => onFiltersChange({ ...filters, teacherId: v === 'all' ? null : v })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Teachers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teachers</SelectItem>
            {teachers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Visibility filter */}
      <Select
        value={filters.visibilityFilter || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, visibilityFilter: v as any })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Notes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Notes</SelectItem>
          <SelectItem value="parent_visible">Parent-Visible</SelectItem>
          <SelectItem value="private">Private Only</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="flex gap-1.5 flex-1 min-w-[200px]">
        <Input
          placeholder="Search notes..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
