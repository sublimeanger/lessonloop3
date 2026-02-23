import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Filter, X, CalendarIcon, Mail, Monitor, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useOrg } from '@/contexts/OrgContext';
import { useStudents, type StudentListItem } from '@/hooks/useStudents';
import { useOrgMembers, type OrgMember } from '@/hooks/useOrgMembers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MessageFilters {
  guardian_id?: string;
  student_id?: string;
  sender_user_id?: string;
  channel?: 'email' | 'inapp';
  date_from?: string;
  date_to?: string;
}

interface MessageFiltersBarProps {
  filters: MessageFilters;
  onFiltersChange: (filters: MessageFilters) => void;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

function EntityCombobox({
  label,
  value,
  onSelect,
  options,
  renderOption,
  placeholder = 'Search…',
}: {
  label: string;
  value: string | undefined;
  onSelect: (id: string | undefined) => void;
  options: { id: string; label: string; sublabel?: string }[];
  renderOption?: (opt: { id: string; label: string; sublabel?: string }) => React.ReactNode;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-between rounded-xl text-sm h-9 min-w-[140px] max-w-[220px]',
            !value && 'text-muted-foreground'
          )}
        >
          <span className="truncate">
            {selected ? selected.label : label}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.id}
                  value={opt.label + ' ' + (opt.sublabel || '')}
                  onSelect={() => {
                    onSelect(opt.id === value ? undefined : opt.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt.id ? 'opacity-100' : 'opacity-0')} />
                  {renderOption ? renderOption(opt) : (
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">{opt.sublabel}</span>
                      )}
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MessageFiltersBar({ filters, onFiltersChange }: MessageFiltersBarProps) {
  const [expanded, setExpanded] = useState(false);
  const { currentOrg } = useOrg();

  // Data sources
  const { data: guardians = [] } = useQuery({
    queryKey: ['filter-guardians', currentOrg?.id],
    queryFn: async (): Promise<Guardian[]> => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('guardians')
        .select('id, full_name, email')
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null)
        .order('full_name');
      return (data || []) as Guardian[];
    },
    enabled: !!currentOrg && expanded,
    staleTime: 60_000,
  });

  const { data: students = [] } = useStudents();
  const { members = [] } = useOrgMembers();

  const staffMembers = useMemo(
    () => (members || []).filter((m: OrgMember) => ['owner', 'admin', 'teacher'].includes(m.role)),
    [members]
  );

  const activeCount = [
    filters.guardian_id,
    filters.student_id,
    filters.sender_user_id,
    filters.channel,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  const clearAll = () => onFiltersChange({});

  const updateFilter = <K extends keyof MessageFilters>(key: K, value: MessageFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const guardianOptions = useMemo(
    () => guardians.map(g => ({ id: g.id, label: g.full_name, sublabel: g.email || undefined })),
    [guardians]
  );

  const studentOptions = useMemo(
    () => (students || []).map((s: StudentListItem) => ({
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sublabel: s.email || undefined,
    })),
    [students]
  );

  const staffOptions = useMemo(
    () => staffMembers.map((m: OrgMember) => ({
      id: m.user_id,
      label: m.profile?.full_name || m.profile?.email || 'Unknown',
      sublabel: m.role,
    })),
    [staffMembers]
  );

  return (
    <div className="space-y-3">
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className={cn('gap-2 rounded-xl', activeCount > 0 && 'border-primary text-primary')}
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 rounded-full text-xs">
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Filter panel */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-xl border">
          {/* Guardian */}
          <EntityCombobox
            label="Guardian"
            value={filters.guardian_id}
            onSelect={id => updateFilter('guardian_id', id)}
            options={guardianOptions}
            placeholder="Search guardians…"
          />

          {/* Student */}
          <EntityCombobox
            label="Student"
            value={filters.student_id}
            onSelect={id => updateFilter('student_id', id)}
            options={studentOptions}
            placeholder="Search students…"
          />

          {/* Sender / Staff */}
          <EntityCombobox
            label="Sender"
            value={filters.sender_user_id}
            onSelect={id => updateFilter('sender_user_id', id)}
            options={staffOptions}
            placeholder="Search staff…"
          />

          {/* Channel */}
          <ToggleGroup
            type="single"
            value={filters.channel || ''}
            onValueChange={v => updateFilter('channel', (v || undefined) as MessageFilters['channel'])}
            className="border rounded-xl p-0.5 h-9"
          >
            <ToggleGroupItem value="email" className="gap-1.5 px-2.5 rounded-lg text-xs h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <Mail className="h-3.5 w-3.5" /> Email
            </ToggleGroupItem>
            <ToggleGroupItem value="inapp" className="gap-1.5 px-2.5 rounded-lg text-xs h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <Monitor className="h-3.5 w-3.5" /> In-App
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('rounded-xl text-sm h-9 min-w-[120px]', !filters.date_from && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {filters.date_from ? format(new Date(filters.date_from), 'dd/MM/yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.date_from ? new Date(filters.date_from) : undefined}
                onSelect={d => updateFilter('date_from', d ? d.toISOString().split('T')[0] : undefined)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('rounded-xl text-sm h-9 min-w-[120px]', !filters.date_to && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {filters.date_to ? format(new Date(filters.date_to), 'dd/MM/yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.date_to ? new Date(filters.date_to) : undefined}
                onSelect={d => updateFilter('date_to', d ? d.toISOString().split('T')[0] : undefined)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Clear all */}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5 text-xs h-8 rounded-lg text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
