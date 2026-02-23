import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MapPin, User, AlertCircle } from 'lucide-react';
import type { FilterCriteria } from '@/hooks/useBulkMessage';

interface Location {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface RecipientFilterProps {
  filters: FilterCriteria;
  onFiltersChange: (filters: FilterCriteria) => void;
  locations: Location[];
  teachers: Teacher[];
  recipientCount: number;
  isLoading?: boolean;
}

export function RecipientFilter({
  filters,
  onFiltersChange,
  locations,
  teachers,
  recipientCount,
  isLoading,
}: RecipientFilterProps) {
  const handleLocationToggle = (locationId: string) => {
    const current = filters.location_ids || [];
    const updated = current.includes(locationId)
      ? current.filter(id => id !== locationId)
      : [...current, locationId];
    onFiltersChange({ ...filters, location_ids: updated.length > 0 ? updated : undefined });
  };

  const handleTeacherToggle = (teacherId: string) => {
    const current = filters.teacher_ids || [];
    const updated = current.includes(teacherId)
      ? current.filter(id => id !== teacherId)
      : [...current, teacherId];
    onFiltersChange({ ...filters, teacher_ids: updated.length > 0 ? updated : undefined });
  };

  const handleStatusChange = (status: 'active' | 'inactive' | 'all') => {
    onFiltersChange({ ...filters, status });
  };

  const handleOverdueToggle = (checked: boolean) => {
    onFiltersChange({ ...filters, has_overdue_invoice: checked || undefined });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    (filters.location_ids && filters.location_ids.length > 0) ||
    (filters.teacher_ids && filters.teacher_ids.length > 0) ||
    filters.status === 'inactive' ||
    filters.has_overdue_invoice;

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Filter Recipients</h4>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Student Status */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Student Status</Label>
        <ToggleGroup
          type="single"
          value={filters.status || 'active'}
          onValueChange={(v) => v && handleStatusChange(v as 'active' | 'inactive' | 'all')}
          className="justify-start"
        >
          {(['active', 'inactive', 'all'] as const).map((status) => (
            <ToggleGroupItem key={status} value={status} className="capitalize text-sm px-3">
              {status}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Locations */}
      {locations.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Locations
          </Label>
          <div className="flex flex-wrap gap-2">
            {locations.map((location) => (
              <label
                key={location.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                  filters.location_ids?.includes(location.id)
                    ? 'bg-primary/10 border-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <Checkbox
                  checked={filters.location_ids?.includes(location.id) || false}
                  onCheckedChange={() => handleLocationToggle(location.id)}
                  className="sr-only"
                />
                <span className="text-sm">{location.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Teachers */}
      {teachers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            Teachers
          </Label>
          <div className="flex flex-wrap gap-2">
            {teachers.map((teacher) => (
              <label
                key={teacher.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                  filters.teacher_ids?.includes(teacher.id)
                    ? 'bg-primary/10 border-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <Checkbox
                  checked={filters.teacher_ids?.includes(teacher.id) || false}
                  onCheckedChange={() => handleTeacherToggle(teacher.id)}
                  className="sr-only"
                />
                <span className="text-sm">{teacher.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Invoice Filter */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.has_overdue_invoice || false}
            onCheckedChange={(checked) => handleOverdueToggle(checked as boolean)}
          />
          <span className="text-sm flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-destructive" />
            Only guardians with overdue invoices
          </span>
        </label>
      </div>

      {/* Recipient Count Preview */}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Recipients:</span>
          <Badge variant={recipientCount > 0 ? 'default' : 'secondary'}>
            {isLoading ? '...' : recipientCount} guardian{recipientCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
    </div>
  );
}
