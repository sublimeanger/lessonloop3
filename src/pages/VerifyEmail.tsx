import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LogoHorizontal } from '@/components/brand/Logo';
import { Separator } from '@/components/ui/separator';

export default function VerifyEmail() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) throw error;
      toast({ title: 'Verification email sent', description: 'Please check your inbox.' });
      setCooldownSeconds(60);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend verification email';
      toast({ title: 'Resend failed', description: message, variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user?.email_confirmed_at) {
      toast({ title: 'Email verified!', description: 'Redirecting…' });
      navigate('/onboarding');
    } else {
      toast({ title: 'Not yet verified', description: 'Please check your inbox.' });
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <LogoHorizontal size="lg" />
          </div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription className="text-base">
            We've sent a verification link to{' '}
            <span className="font-medium text-foreground">{user?.email}</span>.
            Please check your inbox and click the link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleResend}
            disabled={resending || cooldownSeconds > 0}
            className="w-full h-11"
            variant="default"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend verification email'}
          </Button>

          <Button onClick={handleRefresh} variant="outline" className="w-full h-11">
            I've verified — check again
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button onClick={signOut} variant="ghost" className="w-full h-11 text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out and use a different email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
