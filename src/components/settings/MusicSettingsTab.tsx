import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Music, Plus, Pencil, Trash2, Loader2, Settings2 } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  useInstruments, useExamBoards,
  useAddCustomInstrument, useUpdateCustomInstrument, useDeleteCustomInstrument,
  groupInstrumentsByCategory, getInstrumentCategoryIcon,
  INSTRUMENT_CATEGORIES,
} from '@/hooks/useInstruments';
import type { Instrument } from '@/hooks/useInstruments';

export function MusicSettingsTab() {
  const { currentOrg } = useOrg();
  const { data: instruments } = useInstruments();
  const { data: examBoards } = useExamBoards();
  const addMutation = useAddCustomInstrument();
  const updateMutation = useUpdateCustomInstrument();
  const deleteMutation = useDeleteCustomInstrument();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default exam board state
  const [savingDefault, setSavingDefault] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Other');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Instrument | null>(null);

  const customInstruments = (instruments || []).filter((i) => i.is_custom && i.org_id === currentOrg?.id);
  const builtInGrouped = groupInstrumentsByCategory(
    (instruments || []).filter((i) => !i.is_custom),
  );

  const currentDefaultBoard = (currentOrg as any)?.default_exam_board_id || null;

  const handleSetDefaultBoard = async (boardId: string) => {
    if (!currentOrg) return;
    const value = boardId === 'none' ? null : boardId;
    // Skip if unchanged
    if (value === (currentDefaultBoard || null)) return;
    setSavingDefault(true);
    try {
      const { error } = await (supabase as any)
        .from('organisations')
        .update({ default_exam_board_id: value })
        .eq('id', currentOrg.id);
      if (error) throw error;
      // Refresh org context
      queryClient.invalidateQueries({ queryKey: ['organisation'] });
      queryClient.invalidateQueries({ queryKey: ['current-org'] });
      toast({ title: value ? 'Default exam board set' : 'Default exam board cleared' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSavingDefault(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate(
      { name: newName.trim(), category: newCategory },
      {
        onSuccess: () => {
          setNewName('');
          setNewCategory('Other');
          setShowAddForm(false);
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate(
      { id: editingId, name: editName.trim(), category: editCategory },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const startEdit = (inst: Instrument) => {
    setEditingId(inst.id);
    setEditName(inst.name);
    setEditCategory(inst.category);
  };

  return (
    <div className="space-y-6">
      {/* Default Exam Board */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Default Exam Board</CardTitle>
              <CardDescription>
                Pre-select this exam board when adding instruments to students
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select
              value={currentDefaultBoard || 'none'}
              onValueChange={handleSetDefaultBoard}
              disabled={savingDefault}
            >
              <SelectTrigger>
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default (ask each time)</SelectItem>
                {(examBoards || []).map((eb) => (
                  <SelectItem key={eb.id} value={eb.id}>
                    {eb.short_name} — {eb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingDefault && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Instruments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Custom Instruments</CardTitle>
              <CardDescription>
                Add instruments not in the built-in list (e.g. Banjo, Erhu, Tin Whistle)
              </CardDescription>
            </div>
          </div>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {/* Add form */}
          {showAddForm && (
            <div className="rounded-lg border p-4 space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Banjo"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTRUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {getInstrumentCategoryIcon(cat)} {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewName(''); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Add Instrument
                </Button>
              </div>
            </div>
          )}

          {/* Custom instruments list */}
          {customInstruments.length === 0 ? (
            !showAddForm && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No custom instruments yet. The built-in list covers most common instruments.
              </p>
            )
          ) : (
            <div className="space-y-2">
              {customInstruments.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3">
                  {editingId === inst.id ? (
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="max-w-[200px] h-8"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                      />
                      <Select value={editCategory} onValueChange={setEditCategory}>
                        <SelectTrigger className="max-w-[150px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INSTRUMENT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {getInstrumentCategoryIcon(cat)} {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="default" className="h-8" onClick={handleUpdate} disabled={updateMutation.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getInstrumentCategoryIcon(inst.category)} {inst.name}
                        </span>
                        <Badge variant="outline" className="text-xs">{inst.category}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(inst)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(inst)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Built-in Instruments Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Built-in Instruments</CardTitle>
          <CardDescription>Reference list — these are available to all organisations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(builtInGrouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {getInstrumentCategoryIcon(category)} {category}
                </p>
                <ul className="text-sm space-y-0.5">
                  {items.map((i) => (
                    <li key={i.id} className="text-muted-foreground">{i.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom instrument?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". If any students
              have this instrument assigned, the deletion will fail — you'll need
              to remove it from those students first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
