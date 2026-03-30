import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { INSTRUMENT_CATEGORIES, useAddCustomInstrument } from '@/hooks/useInstruments';

interface AddInstrumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (instrumentId: string) => void;
}

export function AddInstrumentDialog({ open, onOpenChange, onCreated }: AddInstrumentDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const addMutation = useAddCustomInstrument();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    addMutation.mutate(
      { name: trimmed, category },
      {
        onSuccess: (result: any) => {
          onCreated(result.id);
          setName('');
          setCategory('Other');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Add Instrument</DialogTitle>
          <DialogDescription>
            Create a custom instrument for your organisation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inst-name">Instrument name</Label>
            <Input
              id="inst-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Harp"
              autoFocus
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || addMutation.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
