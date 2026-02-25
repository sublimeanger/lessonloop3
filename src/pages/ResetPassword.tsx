import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoHorizontal } from '@/components/brand/Logo';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { PasswordStrengthIndicator, PASSWORD_MIN_LENGTH } from '@/components/auth/PasswordStrengthIndicator';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ResetPassword() {
  usePageMeta('Reset Password | LessonLoop', 'Set a new password for your LessonLoop account');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionError(false);
      }
    });

    // Fallback timeout — if no session after 5 seconds, show error
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && mounted) {
        setSessionError(true);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      toast({ title: 'Passwords don\'t match', description: 'Please make sure your passwords match.', variant: 'destructive' });
      return;
    }
    setPasswordMismatch(false);

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast({ title: 'Password too short', description: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast({ title: 'Password updated', description: 'Your password has been successfully reset.' });

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
        <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <LogoHorizontal size="lg" />
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Reset link expired</h2>
            <p className="text-muted-foreground mb-6">
              This password reset link is no longer valid. Please request a new one.
            </p>
            <Button
              className="w-full h-11 gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
              onClick={() => navigate('/forgot-password')}
            >
              Request new reset link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
        <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <LogoHorizontal size="lg" />
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Password updated</h2>
            <p className="text-muted-foreground">
              Your password has been successfully reset. Redirecting to your dashboard…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <LogoHorizontal size="lg" />
          </div>
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  autoFocus
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className="pl-10 pr-10 h-11"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-11 w-11 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={password} visible={passwordFocused || password.length > 0} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMismatch(false); }}
                  aria-invalid={passwordMismatch}
                  className="pl-10 h-11"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full h-11 gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
