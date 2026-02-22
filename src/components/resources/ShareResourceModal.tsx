import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Users } from 'lucide-react';
import { useShareResource, ResourceWithShares } from '@/hooks/useResources';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ShareResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceWithShares | null;
}

export function ShareResourceModal({ open, onOpenChange, resource }: ShareResourceModalProps) {
  const { currentOrg } = useOrg();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const shareMutation = useShareResource();

  // Fetch all active students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-for-sharing', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('org_id', currentOrg.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('first_name');

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id && open,
  });

  // Initialize selection from existing shares
  useEffect(() => {
    if (resource?.resource_shares) {
      setSelectedStudents(resource.resource_shares.map(s => s.student_id));
    } else {
      setSelectedStudents([]);
    }
  }, [resource]);

  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = new Set(filteredStudents.map(s => s.id));
    const allFilteredSelected = filteredStudents.every(s => selectedStudents.includes(s.id));

    if (allFilteredSelected) {
      setSelectedStudents(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      setSelectedStudents(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleSubmit = async () => {
    if (!resource) return;

    try {
      await shareMutation.mutateAsync({
        resourceId: resource.id,
        studentIds: selectedStudents,
      });
      onOpenChange(false);
    } catch {
      // Hook's onError already shows a toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Share Resource</DialogTitle>
          <DialogDescription>
            Select which students should have access to "{resource?.title}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {studentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>No students found</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedStudents.length} selected ({filteredStudents.filter(s => selectedStudents.includes(s.id)).length} shown)
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {filteredStudents.every(s => selectedStudents.includes(s.id)) ? 'Deselect all' : 'Select all'}
                </Button>
              </div>

              <ScrollArea className="h-[250px] border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredStudents.map(student => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <span>
                        {student.first_name} {student.last_name}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={shareMutation.isPending}
          >
            {shareMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
