import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CalendarDays, Receipt, Megaphone, Smartphone } from 'lucide-react';

interface NotificationPreferences {
  email_lesson_reminders: boolean;
  email_invoice_reminders: boolean;
  email_payment_receipts: boolean;
  email_makeup_offers: boolean;
  email_marketing: boolean;
  sms_lesson_reminders: boolean;
  sms_invoice_reminders: boolean;
  sms_payment_receipts: boolean;
  sms_lesson_cancellations: boolean;
}

const defaults: NotificationPreferences = {
  email_lesson_reminders: true,
  email_invoice_reminders: true,
  email_payment_receipts: true,
  email_makeup_offers: true,
  email_marketing: false,
  sms_lesson_reminders: false,
  sms_invoice_reminders: false,
  sms_payment_receipts: false,
  sms_lesson_cancellations: false,
};

interface NotifItem {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}

interface NotifCategory {
  title: string;
  icon: React.ReactNode;
  description: string;
  items: NotifItem[];
}

export function NotificationsTab() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['notification-prefs', currentOrg?.id, user?.id];

  // Check if org has SMS enabled
  const { data: smsSettings } = useQuery({
    queryKey: ['org-sms-settings', currentOrg?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('org_sms_settings')
        .select('sms_enabled')
        .eq('org_id', currentOrg!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentOrg?.id,
  });

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
            email_makeup_offers: data.email_makeup_offers,
            email_marketing: data.email_marketing,
            sms_lesson_reminders: data.sms_lesson_reminders ?? false,
            sms_invoice_reminders: data.sms_invoice_reminders ?? false,
            sms_payment_receipts: data.sms_payment_receipts ?? false,
            sms_lesson_cancellations: data.sms_lesson_cancellations ?? false,
          }
        : defaults;
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });

  const [prefs, setPrefs] = useState<NotificationPreferences>(defaults);
  const isDirty = !!serverPrefs && JSON.stringify(prefs) !== JSON.stringify(serverPrefs);

  useEffect(() => {
    if (serverPrefs) {
      setPrefs(serverPrefs);
    }
  }, [serverPrefs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ org_id: currentOrg!.id, user_id: user!.id, ...prefs } as Record<string, unknown>, { onConflict: 'org_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Notifications saved', description: 'Your notification preferences have been updated.' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const categories: NotifCategory[] = [
    {
      title: 'Lessons & Scheduling',
      icon: <CalendarDays className="h-5 w-5 text-primary" />,
      description: 'Stay on top of your teaching schedule',
      items: [
        {
          key: 'email_lesson_reminders',
          label: 'Lesson reminders',
          description: 'Receive an email reminder 24 hours before each scheduled lesson',
        },
        {
          key: 'email_makeup_offers',
          label: 'Make-up offers',
          description: 'Get notified when a make-up lesson slot becomes available for your child',
        },
      ],
    },
    {
      title: 'Billing & Payments',
      icon: <Receipt className="h-5 w-5 text-primary" />,
      description: 'Invoice and payment notifications',
      items: [
        {
          key: 'email_invoice_reminders',
          label: 'Invoice reminders',
          description: 'Receive reminders when invoices are due or overdue',
        },
        {
          key: 'email_payment_receipts',
          label: 'Payment receipts',
          description: 'Get a confirmation email when a payment is recorded against your invoice',
        },
      ],
    },
    {
      title: 'Communications',
      icon: <Megaphone className="h-5 w-5 text-primary" />,
      description: 'Product updates and general communications',
      items: [
        {
          key: 'email_marketing',
          label: 'Marketing emails',
          description: 'Occasional product updates, tips, and feature announcements from LessonLoop',
        },
      ],
    },
  ];

  // Conditionally add SMS category when org has SMS enabled
  if (smsSettings?.sms_enabled) {
    categories.push({
      title: 'SMS Notifications',
      icon: <Smartphone className="h-5 w-5 text-primary" />,
      description: 'Receive text message alerts for important events',
      items: [
        {
          key: 'sms_lesson_reminders',
          label: 'Lesson reminders (SMS)',
          description: 'Get a text 24 hours before each lesson',
        },
        {
          key: 'sms_invoice_reminders',
          label: 'Invoice reminders (SMS)',
          description: 'Text alerts for overdue invoices',
        },
        {
          key: 'sms_payment_receipts',
          label: 'Payment confirmations (SMS)',
          description: 'Text confirmation when payments are recorded',
        },
        {
          key: 'sms_lesson_cancellations',
          label: 'Cancellation alerts (SMS)',
          description: 'Immediate text when a lesson is cancelled',
        },
      ],
    });
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <Card key={cat.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {cat.icon}
              {cat.title}
            </CardTitle>
            <CardDescription>{cat.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cat.items.map(({ key, label, description }) => (
              <div key={key} className="flex items-start justify-between gap-4 py-2">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
                </div>
                <Switch
                  checked={prefs[key]}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, [key]: checked }))}
                  className="shrink-0 mt-0.5"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !isDirty}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
        {isDirty && <span className="text-sm text-muted-foreground">(unsaved changes)</span>}
      </div>
    </div>
  );
}
