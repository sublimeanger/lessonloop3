import { RefObject } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LessonType } from '../types';

interface StudentSelectorProps {
  students: { id: string; name: string }[];
  selectedStudents: string[];
  setSelectedStudents: React.Dispatch<React.SetStateAction<string[]>>;
  lessonType: LessonType;
  isMobile: boolean;
  studentsOpen: boolean;
  setStudentsOpen: (open: boolean) => void;
  studentSheetOpen: boolean;
  setStudentSheetOpen: (open: boolean) => void;
  onStudentToggle: (studentId: string) => void;
  studentSelectorRef: RefObject<HTMLButtonElement>;
}

export function StudentSelector({
  students,
  selectedStudents,
  setSelectedStudents,
  lessonType,
  isMobile,
  studentsOpen,
  setStudentsOpen,
  studentSheetOpen,
  setStudentSheetOpen,
  onStudentToggle,
  studentSelectorRef,
}: StudentSelectorProps) {
  const selectorContent = (
    <Command>
      <CommandInput placeholder="Search students..." className="min-h-[44px]" />
      <CommandList className={isMobile ? "max-h-[60vh]" : ""}>
        <CommandEmpty>No students found.</CommandEmpty>
        <CommandGroup>
          {students.map((student) => (
            <CommandItem
              key={student.id}
              onSelect={() => onStudentToggle(student.id)}
              className="min-h-[44px]"
            >
              <Checkbox
                checked={selectedStudents.includes(student.id)}
                className="mr-2"
              />
              {student.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <div className="space-y-2">
      <Label>Student{lessonType === 'group' ? 's' : ''}</Label>
      {isMobile ? (
        <>
          <Button
            ref={studentSelectorRef}
            variant="outline"
            className="w-full justify-start text-left font-normal min-h-[44px]"
            onClick={() => setStudentSheetOpen(true)}
          >
            {selectedStudents.length === 0 ? (
              <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
            ) : (
              <span className="truncate">
                {selectedStudents.map(id => students.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
              </span>
            )}
          </Button>
          <Sheet open={studentSheetOpen} onOpenChange={setStudentSheetOpen}>
            <SheetContent side="bottom" className="h-[85vh] p-0" hideCloseButton>
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Select Student{lessonType === 'group' ? 's' : ''}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                {selectorContent}
              </div>
              {lessonType === 'group' && (
                <div className="p-4 border-t">
                  <Button className="w-full min-h-[44px]" onClick={() => setStudentSheetOpen(false)}>
                    Done ({selectedStudents.length} selected)
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={studentsOpen} onOpenChange={setStudentsOpen}>
          <PopoverTrigger asChild>
            <Button ref={studentSelectorRef} variant="outline" className="w-full justify-start text-left font-normal">
              {selectedStudents.length === 0 ? (
                <span className="text-muted-foreground">Select student{lessonType === 'group' ? 's' : ''}...</span>
              ) : (
                <span className="truncate">
                  {selectedStudents.map(id => students.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            {selectorContent}
          </PopoverContent>
        </Popover>
      )}
      {selectedStudents.length > 0 && lessonType === 'group' && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedStudents.map(id => {
            const student = students.find(s => s.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {student?.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setSelectedStudents(prev => prev.filter(s => s !== id))}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
