import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGuardianInfo } from '@/hooks/useParentPortal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function PortalProfile() {
  const { user, profile, signOut } = useAuth();
  const { data: guardian, isLoading: guardianLoading } = useGuardianInfo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guardian) {
      setFullName(guardian.full_name || '');
      setPhone(guardian.phone || '');
    }
  }, [guardian]);

  const handleSave = async () => {
    if (!user || !guardian) return;
    if (!fullName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Update guardian record
      const { error: guardianErr } = await supabase
        .from('guardians')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', guardian.id);
      if (guardianErr) throw guardianErr;

      // Update profile record for consistency
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      queryClient.invalidateQueries({ queryKey: ['guardian-info'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Profile updated' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Failed to update profile', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (guardianLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader title="Profile" description="Manage your contact details" />

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || guardian?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Contact your academy to change your email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 07700 900123"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full text-destructive hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
