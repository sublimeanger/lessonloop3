import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { LogoHorizontal } from '@/components/brand/Logo';
import { Separator } from '@/components/ui/separator';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { AppleIcon } from '@/components/icons/AppleIcon';
import { lovable } from '@/integrations/lovable';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Login() {
  usePageMeta('Log In | LessonLoop', 'Sign in to your LessonLoop account');
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);

  const anyLoading = isLoading || isGoogleLoading || isAppleLoading;

  useEffect(() => {
    if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
      setIsOAuthCallback(true);

      const timeout = setTimeout(() => {
        setIsOAuthCallback(false);
        toast({
          title: 'Sign in timed out',
          description: 'Please try again.',
          variant: 'destructive',
        });
        window.history.replaceState({}, '', '/login');
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/login`,
    });
    setIsGoogleLoading(false);

    if (error) {
      toast({
        title: 'Google sign in failed',
        description: error.message?.includes('popup')
          ? 'Please allow popups for this site and try again'
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAppleLogin = async () => {
    setIsAppleLoading(true);
    const { error } = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: `${window.location.origin}/login`,
    });
    setIsAppleLoading(false);

    if (error) {
      toast({
        title: 'Apple sign in failed',
        description: error.message?.includes('popup')
          ? 'Please allow popups for this site and try again'
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      toast({
        title: 'Missing fields',
        description: 'Please enter your email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setLoginFailed(false);
    const { error } = await signIn(trimmedEmail, password);
    setIsLoading(false);

    if (error) {
      setLoginFailed(true);
      toast({
        title: 'Sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isOAuthCallback) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4">
        <div className="text-center space-y-4">
          <LogoHorizontal size="lg" />
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4">
            <LogoHorizontal size="lg" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your LessonLoop account</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pb-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleGoogleLogin}
            disabled={anyLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-5 w-5" />
            )}
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={handleAppleLogin}
            disabled={anyLoading}
          >
            {isAppleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AppleIcon className="mr-2 h-5 w-5" />
            )}
            Continue with Apple
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
        </CardContent>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoFocus
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLoginFailed(false); }}
                aria-invalid={loginFailed}
                disabled={isLoading}
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  tabIndex={0}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginFailed(false); }}
                  aria-invalid={loginFailed}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10 h-11"
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
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
              disabled={anyLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Get started
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
