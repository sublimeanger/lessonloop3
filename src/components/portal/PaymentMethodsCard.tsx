import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { useSavedPaymentMethods, type SavedCard } from '@/hooks/useSavedPaymentMethods';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { platform } from '@/lib/platform';
import { NativePaymentNotice } from '@/components/shared/NativePaymentNotice';

const brandIcons: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  diners: 'Diners',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

function getBrandLabel(brand: string): string {
  return brandIcons[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function PaymentMethodsCard() {
  const { cards, defaultPaymentMethodId, autoPayEnabled, isLoading, removeCard, isRemoving } = useSavedPaymentMethods();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingAutoPay, setUpdatingAutoPay] = useState(false);

  const handleRemove = (pmId: string) => {
    setRemovingId(pmId);
    removeCard(pmId, {
      onSettled: () => setRemovingId(null),
    });
  };

  const handleToggleAutoPay = async (enabled: boolean) => {
    if (!currentOrg?.id) return;
    setUpdatingAutoPay(true);
    try {
      const { error } = await supabase.functions.invoke('stripe-update-payment-preferences', {
        body: { orgId: currentOrg.id, autoPayEnabled: enabled },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['saved-payment-methods', currentOrg.id] });
      toast({ title: enabled ? 'Auto-pay enabled' : 'Auto-pay disabled' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to update', description: message, variant: 'destructive' });
    } finally {
      setUpdatingAutoPay(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (platform.isNative) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NativePaymentNotice message="To manage your payment methods and auto-pay preferences, please visit lessonloop.net in your browser." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment Methods
        </CardTitle>
        <CardDescription>
          Manage your saved cards and auto-pay preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cards.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              No saved payment methods yet. Cards will be saved when you make a payment.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cards.map((card) => (
                <SavedCardRow
                  key={card.id}
                  card={card}
                  isDefault={card.id === defaultPaymentMethodId}
                  onRemove={() => handleRemove(card.id)}
                  isRemoving={removingId === card.id && isRemoving}
                />
              ))}
            </div>

            <Separator />

            {/* Auto-pay toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="auto-pay" className="text-sm font-medium cursor-pointer">
                  Auto-pay installments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically pay future installments using your default card
                </p>
              </div>
              <Switch
                id="auto-pay"
                checked={autoPayEnabled}
                onCheckedChange={handleToggleAutoPay}
                disabled={updatingAutoPay || cards.length === 0}
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Card details are securely stored by Stripe</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SavedCardRow({
  card,
  isDefault,
  onRemove,
  isRemoving,
}: {
  card: SavedCard;
  isDefault: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {getBrandLabel(card.brand)} ending in {card.last4}
            </span>
            {isDefault && (
              <Badge variant="secondary" className="text-xs">Default</Badge>
            )}
          </div>
          {card.expMonth && card.expYear && (
            <p className="text-xs text-muted-foreground">
              Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={isRemoving}
        className="text-destructive hover:text-destructive h-8 w-8 p-0"
      >
        {isRemoving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
