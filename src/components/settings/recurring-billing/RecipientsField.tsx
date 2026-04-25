import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Check, Pause, ChevronsUpDown, Users } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import type { RecipientWithStudent } from '@/hooks/useRecurringTemplateRecipients';

interface RecipientsFieldProps {
  templateId: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  existingRecipients: RecipientWithStudent[];
}

export function RecipientsField({
  selectedIds,
  onChange,
  existingRecipients,
}: RecipientsFieldProps) {
  const [open, setOpen] = useState(false);
  const { data: allStudents = [] } = useStudents();

  const activeStudents = useMemo(
    () => allStudents.filter((s) => s.status === 'active'),
    [allStudents],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeChip = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  const addAll = () => {
    const merged = new Set(selectedIds);
    for (const s of activeStudents) merged.add(s.id);
    onChange(Array.from(merged));
  };

  // Previously-paused recipients: in existingRecipients, is_active = false,
  // and not currently in selectedIds.
  const pausedNotSelected = useMemo(
    () =>
      existingRecipients.filter(
        (r) => !r.is_active && !selectedSet.has(r.student_id),
      ),
    [existingRecipients, selectedSet],
  );

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of activeStudents) {
      map.set(s.id, `${s.first_name} ${s.last_name}`);
    }
    // Fall back to existing recipients' joined name (covers paused students
    // who may have been deactivated since being added).
    for (const r of existingRecipients) {
      if (r.student && !map.has(r.student.id)) {
        map.set(r.student.id, `${r.student.first_name} ${r.student.last_name}`);
      }
    }
    return map;
  }, [activeStudents, existingRecipients]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {selectedIds.length === 0
                  ? 'Add recipients'
                  : `Add recipients (${selectedIds.length} selected)`}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search students…" />
              <CommandList>
                <CommandEmpty>No active students found.</CommandEmpty>
                <CommandGroup>
                  {activeStudents.map((s) => {
                    const isSelected = selectedSet.has(s.id);
                    return (
                      <CommandItem
                        key={s.id}
                        onSelect={() => toggle(s.id)}
                        className="gap-2"
                      >
                        <span className="flex-1 truncate">
                          {s.first_name} {s.last_name}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addAll}
          disabled={activeStudents.length === 0}
        >
          Add all active students
        </Button>
      </div>

      {(selectedIds.length > 0 || pausedNotSelected.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <Badge key={id} variant="default" className="gap-1">
              {studentNameById.get(id) || 'Unknown'}
              <button
                type="button"
                onClick={() => removeChip(id)}
                className="ml-1 rounded hover:bg-background/20"
                aria-label="Remove recipient"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {pausedNotSelected.map((r) => (
            <Badge
              key={r.id}
              variant="outline"
              className="gap-1 opacity-50 cursor-pointer hover:opacity-75"
              onClick={() => onChange([...selectedIds, r.student_id])}
              title="Click to restore this paused recipient"
            >
              <Pause className="h-3 w-3" />
              {studentNameById.get(r.student_id) || 'Unknown'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
