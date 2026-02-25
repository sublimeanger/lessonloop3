import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { LogoHorizontal } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ForgotPassword() {
  usePageMeta('Forgot Password | LessonLoop', 'Reset your LessonLoop password');
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailInvalid(true);
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }
    setEmailInvalid(false);

    setIsLoading(true);
    const { error } = await resetPassword(trimmedEmail);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Reset failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setEmailSent(true);
      setCooldownSeconds(60);
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
        <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <LogoHorizontal size="lg" />
            </div>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              Click the link in the email to reset your password.
              If you don't see it, check your spam folder.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={async () => {
                setIsLoading(true);
                const { error } = await resetPassword(email.trim());
                setIsLoading(false);
                if (!error) {
                  setCooldownSeconds(60);
                  toast({ title: 'Reset email resent', description: 'Check your inbox.' });
                }
              }}
              disabled={isLoading || cooldownSeconds > 0}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
              ) : cooldownSeconds > 0 ? (
                `Resend in ${cooldownSeconds}s`
              ) : (
                'Resend reset email'
              )}
            </Button>
            <Link to="/login" className="w-full">
              <Button variant="ghost" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <LogoHorizontal size="lg" />
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleReset}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoFocus
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailInvalid(false); }}
                aria-invalid={emailInvalid}
                disabled={isLoading}
                autoComplete="email"
                className="h-11"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
