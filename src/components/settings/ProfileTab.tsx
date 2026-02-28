import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Loader2, LogOut, ShieldAlert, Mail, Eye, EyeOff, Lock, X, Camera, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { platform } from '@/lib/platform';
import { pickImageSafely } from '@/lib/native/camera';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ProfileTab() {
  const { profile, updateProfile, user, signOut, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEmailProvider, setIsEmailProvider] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Sync from profile context (already fetched via AuthContext)
  useEffect(() => {
    if (profile) {
      const nameParts = (profile.full_name || '').split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setPhone(profile.phone || '');
      setAvatarUrl((profile as unknown as Record<string, unknown>).avatar_url as string | null);
    }
  }, [profile]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) setEmail(data.user.email);
      setIsEmailProvider(data.user?.app_metadata?.provider === 'email');
    };
    getUser();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullName = `${firstName} ${lastName}`.trim();
      const { error } = await updateProfile({ full_name: fullName, phone });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Profile updated', description: 'Your profile has been saved.' }),
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const uploadAvatarFile = async (file: File) => {
    if (!user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 1024 * 1024) {
      toast({ title: 'File too large', description: 'Avatar must be under 1MB', variant: 'destructive' });
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;

      // Remove old avatar (best-effort)
      if (avatarUrl) {
        try {
          const oldPath = avatarUrl.split('/avatars/')[1];
          if (oldPath) await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)]);
        } catch { /* non-blocking */ }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as Record<string, unknown>)
        .eq('id', user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: 'Avatar uploaded' });
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    await uploadAvatarFile(file);
  };

  const handleAvatarPickNative = async () => {
    const { file, error } = await pickImageSafely({
      maxSize: 1024 * 1024,
      accept: ['image/jpeg', 'image/png'],
    });
    if (error) {
      toast({ title: 'Photo error', description: error, variant: 'destructive' });
      return;
    }
    if (file) {
      await uploadAvatarFile(file);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    try {
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/avatars/')[1];
        if (oldPath) await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)]);
      }
      await supabase.from('profiles').update({ avatar_url: null } as Record<string, unknown>).eq('id', user.id);
      setAvatarUrl(null);
      toast({ title: 'Avatar removed' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  const changeEmailMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const trimmed = emailAddress.trim().toLowerCase();
      if (!trimmed) throw new Error('Please enter an email address');
      if (trimmed === email) throw new Error('This is already your current email');
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Confirmation sent',
        description: 'A confirmation link has been sent to your new email address. Click it to complete the change.',
      });
      setShowEmailDialog(false);
      setNewEmail('');
    },
    onError: (err: Error) => {
      toast({
        title: 'Email change failed',
        description: err.message || 'Unable to change email. The address may already be in use.',
        variant: 'destructive',
      });
    },
  });

  // Password validation
  const getPasswordError = () => {
    if (!newPassword) return null;
    if (newPassword.length < 8) return 'Password must be at least 8 characters';
    if (confirmPassword && newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const canSubmitPassword = newPassword.length >= 8 && newPassword === confirmPassword;

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!canSubmitPassword) throw new Error('Please fix password errors');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordTouched(false);
    },
    onError: (err: Error) => toast({ title: 'Password change failed', description: err.message, variant: 'destructive' }),
  });

  const globalSignOutMutation = useMutation({
    mutationFn: () => supabase.auth.signOut({ scope: 'global' }),
    onError: () => toast({ title: 'Error', description: 'Failed to sign out of all devices', variant: 'destructive' }),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/account-delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete account');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: 'Account deleted', description: 'Your account has been permanently deleted.' });
      await signOut();
      navigate('/login');
    },
    onError: (err: Error) => toast({ title: 'Deletion failed', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      {/* Email Change Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={(open) => { setShowEmailDialog(open); if (!open) setNewEmail(''); }}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-lg sm:border sm:p-6">
          <DialogHeader>
            <DialogTitle>Change email address</DialogTitle>
            <DialogDescription>
              A confirmation link will be sent to your new email. Your email won't change until you click it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current email</Label>
              <Input value={email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter your new email address"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changeEmailMutation.mutate(newEmail)}
              disabled={changeEmailMutation.isPending || !newEmail.trim()}
            >
              {changeEmailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Profile photo" className="object-cover" />
                ) : (
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
                )}
              </Avatar>
              {avatarUrl && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleRemoveAvatar}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={avatarUploading}
                onClick={platform.isNative ? handleAvatarPickNative : () => fileInputRef.current?.click()}
              >
                {avatarUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {avatarUrl ? 'Change Photo' : 'Upload Photo'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 1MB</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex gap-2">
              <Input id="email" type="email" value={email} disabled className="bg-muted flex-1" />
              <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Change
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
            />
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Security
          </CardTitle>
          <CardDescription>Manage sessions across your devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out of all devices</p>
              <p className="text-sm text-muted-foreground">
                This will end all active sessions, including this one. You'll need to log in again.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately end all your active sessions on every device. You will be signed out and redirected to the login page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => globalSignOutMutation.mutate()}
                    disabled={globalSignOutMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {globalSignOutMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Yes, sign out everywhere
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Section — only for email/password users */}
      {isEmailProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="Minimum 8 characters"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {passwordTouched && newPassword && newPassword.length < 8 && (
                <p className="text-xs text-destructive">Password must be at least 8 characters</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            <Button
              onClick={() => { setPasswordTouched(true); if (canSubmitPassword) changePasswordMutation.mutate(); }}
              disabled={changePasswordMutation.isPending || !canSubmitPassword}
            >
              {changePasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Account Section */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Account
          </CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="text-sm text-muted-foreground">
                Once deleted, your account cannot be recovered. All your data, including profile information, organisation memberships, and settings will be permanently removed.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="shrink-0">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent and cannot be undone. All your data will be permanently deleted, including your profile, organisation memberships, and settings. You will be signed out immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAccountMutation.mutate()}
                    disabled={deleteAccountMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAccountMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
