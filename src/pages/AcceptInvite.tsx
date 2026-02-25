import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DetailSkeleton } from '@/components/shared/LoadingState';
import { Loader2, CheckCircle, XCircle, Music, Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator, PASSWORD_MIN_LENGTH } from '@/components/auth/PasswordStrengthIndicator';
import { usePageMeta } from '@/hooks/usePageMeta';

async function waitForProfile(userId: string): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (data) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

interface InviteDetails {
  email: string;
  role: string;
  org_id: string;
  expires_at: string;
}

interface OrganisationDetails {
  name: string;
  org_type: string;
}

/**
 * Compare a full email against a redacted email from invite-get (e.g. "j***@domain.com").
 * invite-get redacts emails for security, so we can only compare first char + domain.
 * The server (invite-accept) does the authoritative email match check.
 */
function emailLikelyMatches(fullEmail: string, redactedEmail: string): boolean {
  const [fullLocal, fullDomain] = fullEmail.toLowerCase().split('@');
  const [redactedLocal, redactedDomain] = redactedEmail.toLowerCase().split('@');
  if (!fullDomain || !redactedDomain) return false;
  if (fullDomain !== redactedDomain) return false;
  if (fullLocal.charAt(0) !== redactedLocal.charAt(0)) return false;
  return true;
}

export default function AcceptInvite() {
  usePageMeta('Accept Invite | LessonLoop', 'Accept your invitation to join a LessonLoop organisation');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const token = searchParams.get('token');

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [organisation, setOrganisation] = useState<OrganisationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiredOrgName, setExpiredOrgName] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // For new user signup
  const [signupEmail, setSignupEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInvite();
    } else {
      setError('Invalid invitation link');
      setIsLoading(false);
    }
  }, [token]);

  const fetchInvite = async () => {
    if (!token) return;

    try {
      const response = await supabase.functions.invoke('invite-get', {
        body: { token },
      });

      if (response.error) {
        setError(response.error.message || 'Failed to fetch invitation');
        setIsLoading(false);
        return;
      }

      const data = response.data;

      if (data.error) {
        setError(data.error);
        if (data.organisation?.name) {
          setExpiredOrgName(data.organisation.name);
        }
        setIsLoading(false);
        return;
      }

      setInvite(data.invite);
      setOrganisation(data.organisation);
      setIsLoading(false);
    } catch (err) {
      logger.error('Error fetching invite:', err);
      setError('Failed to load invitation');
      setIsLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!invite || !token) return;

    setIsAccepting(true);

    try {
      const response = await supabase.functions.invoke('invite-accept', {
        body: { token },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to accept invitation');
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Welcome!',
        description: `You've joined ${organisation?.name || 'the organisation'}`
      });

      await refreshProfile();

      if (data.role === 'parent') {
        navigate('/portal/home');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  const signUpAndAccept = async () => {
    if (!invite || !token) return;

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setPasswordMismatch(false);

    const trimmedEmail = signupEmail.trim().toLowerCase();
    const trimmedName = fullName.trim();
    if (!trimmedEmail) {
      toast({ title: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    if (!trimmedName) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast({
        title: 'Password too short',
        description: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }

    setIsAccepting(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const profileReady = await waitForProfile(authData.user.id);

        if (!profileReady) {
          toast({
            title: 'Account created',
            description: 'Setup is still processing. Please try logging in shortly.',
          });
          navigate('/login');
          return;
        }

        const response = await supabase.functions.invoke('invite-accept', {
          body: { token },
        });

        const data = response.data;

        if (response.error || data?.error) {
          const errMsg = data?.error || response.error?.message || 'Failed to accept invitation';
          if (typeof errMsg === 'string' && errMsg.toLowerCase().includes('email')) {
            toast({
              title: 'Email mismatch',
              description: `The invite was sent to ${invite.email}. Please sign up with that email address.`,
              variant: 'destructive',
            });
            setIsAccepting(false);
            return;
          }
          throw new Error(errMsg);
        }

        await supabase
          .from('profiles')
          .update({ full_name: trimmedName })
          .eq('id', authData.user.id);

        toast({
          title: 'Account created!',
          description: `Welcome to ${organisation?.name || 'the organisation'}`
        });

        if (data.role === 'parent') {
          navigate('/portal/home');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4">
        <div className="w-full max-w-md">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    const isExpired = error.toLowerCase().includes('expired');
    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
        <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <CardContent className="flex flex-col items-center py-12">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">
              {isExpired ? 'Invitation expired' : 'Invalid invitation'}
            </h2>
            <p className="mt-2 text-center text-muted-foreground">
              {isExpired
                ? `This invitation link has expired.${expiredOrgName ? ` Please contact ${expiredOrgName} and ask them to send a new invitation.` : ' Please contact your academy administrator and ask them to send a new invitation.'}`
                : error}
            </p>
            <Button asChild className="mt-6 h-11">
              <Link to="/login">Go to sign in</Link>
            </Button>
            {isExpired && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                If you already have an account, you can log in and your administrator can resend the invite from Settings &gt; Team.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  // User is already logged in
  if (user) {
    const emailMatches = user.email ? emailLikelyMatches(user.email, invite.email) : false;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
        <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Join {organisation?.name || 'Organisation'}</CardTitle>
            <CardDescription>
              You've been invited to join as a <strong>{invite.role}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailMatches && (
              <div className="rounded-lg bg-warning/10 p-4 text-sm text-warning border border-warning/20">
                <p>This invitation was sent to <strong>{invite.email}</strong>, but you're logged in as <strong>{user.email}</strong>.</p>
                <p className="mt-2">Please log out and sign in with the invited email, or ask for a new invitation.</p>
              </div>
            )}
            <Button
              onClick={acceptInvite}
              disabled={isAccepting || !emailMatches}
              className="w-full h-11"
            >
              {isAccepting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Accept invitation</>
              )}
            </Button>
            {!emailMatches && (
              <Button
                variant="outline"
                onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                className="w-full h-11"
              >
                Log out and use correct email
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // New user signup form
  return (
    <div className="flex min-h-[100dvh] items-center justify-center gradient-hero-light p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {organisation?.name || 'Organisation'}</CardTitle>
          <CardDescription>
            Create your account to join as a <strong>{invite.role}</strong>
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => { e.preventDefault(); signUpAndAccept(); }}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="Enter your email address"
                autoComplete="email"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                This invite was sent to <strong>{invite.email}</strong>. Please use the matching email address.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
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
              <PasswordStrengthIndicator password={password} visible={password.length > 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMismatch(false); }}
                  aria-invalid={passwordMismatch}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
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
            <p className="text-xs text-muted-foreground text-center">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="font-medium text-primary hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              disabled={isAccepting || !signupEmail.trim() || !fullName.trim() || !password}
              className="w-full h-11 gradient-accent shadow-glow-teal hover:opacity-90 transition-opacity"
            >
              {isAccepting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</>
              ) : (
                'Create account & join'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                state={{ from: { pathname: '/accept-invite', search: `?token=${token}` } }}
                onClick={() => { try { sessionStorage.setItem('lessonloop_invite_return', `/accept-invite?token=${token}`); } catch { /* storage unavailable */ } }}
                className="text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
