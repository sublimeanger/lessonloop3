import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  Users, 
  FileText, 
  Settings, 
  LayoutDashboard, 
  Search,
  Plus,
  ArrowRight
} from "lucide-react";
import { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { Badge } from "@/components/ui/badge";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}

export function KeyboardShortcutsDialog({ 
  open, 
  onOpenChange,
  shortcuts 
}: KeyboardShortcutsDialogProps) {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Boost your productivity with these shortcuts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
              <div className="grid gap-2">
                {categoryShortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between text-sm">
                    <span>{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.displayKey?.split(' ').map((k, i) => (
                        <kbd key={i} className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/calendar'))}>
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/students'))}>
            <Users className="mr-2 h-4 w-4" />
            Students
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/invoices'))}>
            <FileText className="mr-2 h-4 w-4" />
            Invoices
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => navigate('/calendar?action=new'))}>
            <Plus className="mr-2 h-4 w-4" />
            New Lesson
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/students/new'))}>
            <Users className="mr-2 h-4 w-4" />
            Add Student
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}