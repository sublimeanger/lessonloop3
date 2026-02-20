import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface NotificationPreferences {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_marketing: boolean;
}

const defaults: NotificationPreferences = {
  email_lesson_reminders: true,
  email_invoice_reminders: true,
  email_payment_receipts: true,
  email_marketing: false,
};

export function NotificationsTab() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['notification-prefs', currentOrg?.id, user?.id];

  const { data: serverPrefs } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('org_id', currentOrg!.id)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            email_lesson_reminders: data.email_lesson_reminders,
            email_invoice_reminders: data.email_invoice_reminders,
            email_payment_receipts: data.email_payment_receipts,
            email_marketing: data.email_marketing,
          }
        : defaults;
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });

  const [prefs, setPrefs] = useState<NotificationPreferences>(defaults);
  const [hydrated, setHydrated] = useState(false);

  if (serverPrefs && !hydrated) {
    setPrefs(serverPrefs);
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ org_id: currentOrg!.id, user_id: user!.id, ...prefs }, { onConflict: 'org_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Notifications saved', description: 'Your notification preferences have been updated.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const items: { key: keyof NotificationPreferences; label: string; description: string }[] = [
    { key: 'email_lesson_reminders', label: 'Lesson reminders', description: 'Get notified before upcoming lessons' },
    { key: 'email_invoice_reminders', label: 'Invoice reminders', description: 'Reminders for unpaid invoices' },
    { key: 'email_payment_receipts', label: 'Payment receipts', description: 'Confirmation when an invoice is paid' },
    { key: 'email_marketing', label: 'Marketing emails', description: 'Product updates and tips' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose what notifications you receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{label}</div>
              <div className="text-sm text-muted-foreground">{description}</div>
            </div>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, [key]: checked }))}
            />
          </div>
        ))}
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}
