import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Music } from 'lucide-react';

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

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const token = searchParams.get('token');
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [organisation, setOrganisation] = useState<OrganisationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  
  // For new user signup
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
        setIsLoading(false);
        return;
      }

      setInvite(data.invite);
      setOrganisation(data.organisation);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching invite:', err);
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
      
      // Navigate based on role - parents go to portal, staff go to dashboard
      if (data.role === 'parent') {
        navigate('/portal/home');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  const signUpAndAccept = async () => {
    if (!invite || !token) return;
    
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    
    if (password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    
    setIsAccepting(true);
    
    try {
      // Sign up the new user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      
      if (signUpError) throw signUpError;
      
      if (authData.user) {
        // Wait for profile trigger and session to be established
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Now accept the invite using the edge function
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

        // Update profile with full name (edge function handles onboarding flag)
        await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', authData.user.id);
        
        toast({ 
          title: 'Account created!', 
          description: `Welcome to ${organisation?.name || 'the organisation'}` 
        });
        
        // Navigate based on role - parents go to portal, staff go to dashboard
        if (data.role === 'parent') {
          navigate('/portal/home');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Invalid Invitation</h2>
            <p className="mt-2 text-center text-muted-foreground">{error}</p>
            <Button asChild className="mt-6">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  // User is already logged in
  if (user) {
    // Check if logged-in user email matches invite
    const emailMatches = user.email?.toLowerCase() === invite.email.toLowerCase();
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
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
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p>This invitation was sent to <strong>{invite.email}</strong>, but you're logged in as <strong>{user.email}</strong>.</p>
                <p className="mt-2">Please log out and sign in with the invited email, or ask for a new invitation.</p>
              </div>
            )}
            <Button 
              onClick={acceptInvite} 
              disabled={isAccepting || !emailMatches} 
              className="w-full"
            >
              {isAccepting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Accept Invitation</>
              )}
            </Button>
            {!emailMatches && (
              <Button 
                variant="outline" 
                onClick={() => supabase.auth.signOut().then(() => window.location.reload())} 
                className="w-full"
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {organisation?.name || 'Organisation'}</CardTitle>
          <CardDescription>
            Create your account to join as a <strong>{invite.role}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={invite.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
            />
          </div>
          <Button 
            onClick={signUpAndAccept} 
            disabled={isAccepting || !fullName || !password} 
            className="w-full"
          >
            {isAccepting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</>
            ) : (
              'Create Account & Join'
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to={`/login?redirect=/accept-invite?token=${token}`} className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
