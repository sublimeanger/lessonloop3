import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) throw error;
      toast.success('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    // Re-fetch session to check if email has been confirmed
    const { data } = await supabase.auth.getUser();
    if (data.user?.email_confirmed_at) {
      toast.success('Email verified! Redirecting…');
      // Force a page reload to re-evaluate auth state
      window.location.href = '/onboarding';
    } else {
      toast.info('Email not yet verified. Please check your inbox.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
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
          <Button onClick={handleResend} disabled={resending} className="w-full" variant="default">
            {resending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Resend verification email
          </Button>

          <Button onClick={handleRefresh} variant="outline" className="w-full">
            I've verified — check again
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button onClick={signOut} variant="ghost" className="w-full text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out and use a different email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
