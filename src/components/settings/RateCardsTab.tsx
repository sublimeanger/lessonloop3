import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, PoundSterling } from 'lucide-react';
import { useRateCards, useCreateRateCard, useUpdateRateCard, useDeleteRateCard, type RateCard } from '@/hooks/useRateCards';
import { useOrg } from '@/contexts/OrgContext';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrencyMinor } from '@/lib/utils';

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes (1 hour)' },
  { value: '90', label: '90 minutes (1.5 hours)' },
  { value: '120', label: '120 minutes (2 hours)' },
];

interface RateCardFormData {
  name: string;
  duration_mins: number;
  rate_amount: number; // In pounds for input, converted to pence on save
  is_default: boolean;
}

const defaultFormData: RateCardFormData = {
  name: '',
  duration_mins: 30,
  rate_amount: 30,
  is_default: false,
};

export function RateCardsTab() {
  const { currentOrg } = useOrg();
  const { data: rateCards = [], isLoading } = useRateCards();
  const createRateCard = useCreateRateCard();
  const updateRateCard = useUpdateRateCard();
  const deleteRateCard = useDeleteRateCard();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RateCardFormData>(defaultFormData);

  const currency = currentOrg?.currency_code || 'GBP';

  const handleOpenCreate = () => {
    setEditingCard(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (card: RateCard) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      duration_mins: card.duration_mins,
      rate_amount: card.rate_amount / 100, // Convert pence to pounds for display
      is_default: card.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      name: formData.name,
      duration_mins: formData.duration_mins,
      rate_amount: Math.round(formData.rate_amount * 100), // Convert pounds to pence
      is_default: formData.is_default,
      currency_code: currency,
    };

    if (editingCard) {
      await updateRateCard.mutateAsync({ id: editingCard.id, ...payload });
    } else {
      await createRateCard.mutateAsync(payload);
    }

    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteRateCard.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const isSaving = createRateCard.isPending || updateRateCard.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Rate Cards</CardTitle>
            <CardDescription>
              Define pricing tiers for lessons by duration
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rate Card
          </Button>
        </CardHeader>
        <CardContent>
          {rateCards.length === 0 ? (
            <EmptyState
              icon={PoundSterling}
              title="No rate cards yet"
              description="Create rate cards to define your lesson pricing by duration. These will be used when generating invoices."
              actionLabel="Add Rate Card"
              onAction={handleOpenCreate}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.name}</TableCell>
                    <TableCell>{card.duration_mins} mins</TableCell>
                    <TableCell>{formatCurrencyMinor(card.rate_amount, card.currency_code)}</TableCell>
                    <TableCell>
                      {card.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(card)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(card.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Edit Rate Card' : 'New Rate Card'}</DialogTitle>
            <DialogDescription>
              {editingCard
                ? 'Update the rate card details'
                : 'Create a new rate card for lesson pricing'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Standard 30 min lesson"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={formData.duration_mins.toString()}
                onValueChange={(v) => setFormData((f) => ({ ...f, duration_mins: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate (£)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                placeholder="30.00"
                value={formData.rate_amount}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, rate_amount: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Set as default</div>
                <div className="text-sm text-muted-foreground">
                  Used when no exact duration match is found
                </div>
              </div>
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData((f) => ({ ...f, is_default: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !formData.name || formData.rate_amount <= 0}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCard ? 'Save Changes' : 'Create Rate Card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Existing invoices will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {deleteRateCard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
