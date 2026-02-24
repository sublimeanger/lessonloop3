import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import {
  useResourceCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type ResourceCategory,
} from '@/hooks/useResourceCategories';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCategoriesModal({ open, onOpenChange }: ManageCategoriesModalProps) {
  const { data: categories = [], isLoading } = useResourceCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({ name: newName.trim(), color: newColor });
    setNewName('');
  };

  const startEdit = (cat: ResourceCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || PRESET_COLORS[4]);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateMutation.mutateAsync({ id: editingId, name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:max-h-[90vh] sm:max-w-[420px] sm:rounded-lg sm:border sm:p-6">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="New category name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-1">
              {PRESET_COLORS.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${newColor === c ? 'scale-125 border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Select colour ${c}`}
                />
              ))}
            </div>
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No categories yet. Create one above.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[300px] overflow-y-auto">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center gap-2 group">
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 5).map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`h-4 w-4 rounded-full border-2 ${editColor === c ? 'border-foreground' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdate} disabled={updateMutation.isPending}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={cat.color ? { backgroundColor: cat.color, color: '#fff' } : undefined}
                      >
                        {cat.name}
                      </Badge>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 opacity-100 transition-opacity sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => startEdit(cat)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 opacity-100 transition-opacity text-destructive hover:text-destructive sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => deleteMutation.mutate(cat.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
