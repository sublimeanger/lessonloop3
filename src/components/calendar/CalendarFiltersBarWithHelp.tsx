import { CalendarFiltersBar } from './CalendarFiltersBar';
import { HelpTooltip } from '@/components/shared/HelpTooltip';
import type { CalendarFilters } from './types';

interface CalendarFiltersBarWithHelpProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  teachers: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  rooms: Array<{ id: string; name: string; location_id: string }>;
}

export function CalendarFiltersBarWithHelp(props: CalendarFiltersBarWithHelpProps) {
  return (
    <div className="flex items-center gap-2">
      <CalendarFiltersBar {...props} />
      <HelpTooltip 
        content="Filter the calendar by teacher, location, or room to focus on specific schedules." 
        articleId="calendar-views"
      />
    </div>
  );
}
