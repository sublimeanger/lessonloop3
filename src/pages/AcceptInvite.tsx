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
  id: string;
  email: string;
  role: string;
  org_id: string;
  expires_at: string;
  organisation?: {
    name: string;
  };
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const token = searchParams.get('token');
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
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
    
    // Fetch invite with org details - need to bypass RLS for public access
    const { data, error: fetchError } = await supabase
      .from('invites')
      .select(`
        id,
        email,
        role,
        org_id,
        expires_at,
        accepted_at
      `)
      .eq('token', token)
      .maybeSingle();
    
    if (fetchError || !data) {
      setError('Invitation not found or has expired');
      setIsLoading(false);
      return;
    }
    
    if (data.accepted_at) {
      setError('This invitation has already been accepted');
      setIsLoading(false);
      return;
    }
    
    if (new Date(data.expires_at) < new Date()) {
      setError('This invitation has expired');
      setIsLoading(false);
      return;
    }
    
    // Fetch org name separately
    const { data: orgData } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', data.org_id)
      .maybeSingle();
    
    setInvite({
      ...data,
      organisation: orgData || undefined,
    } as InviteDetails);
    setIsLoading(false);
  };

  const acceptInviteForExistingUser = async () => {
    if (!invite || !user) return;
    
    setIsAccepting(true);
    
    try {
      // Create org membership
      const { error: membershipError } = await supabase
        .from('org_memberships')
        .insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role as any,
          status: 'active',
        });
      
      if (membershipError) {
        if (membershipError.message.includes('duplicate')) {
          toast({ title: 'Already a member', description: 'You are already a member of this organisation.' });
        } else {
          throw membershipError;
        }
      }
      
      // Mark invite as accepted
      await supabase
        .from('invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);
      
      // Update user's current org
      await supabase
        .from('profiles')
        .update({ current_org_id: invite.org_id })
        .eq('id', user.id);
      
      toast({ title: 'Welcome!', description: `You've joined ${invite.organisation?.name || 'the organisation'}` });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  const acceptInviteForNewUser = async () => {
    if (!invite) return;
    
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
        // Wait a moment for the profile trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create org membership
        const { error: membershipError } = await supabase
          .from('org_memberships')
          .insert({
            org_id: invite.org_id,
            user_id: authData.user.id,
            role: invite.role as any,
            status: 'active',
          });
        
        if (membershipError) {
          console.error('Membership error:', membershipError);
        }
        
        // Mark invite as accepted
        await supabase
          .from('invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invite.id);
        
        // Update profile with org and onboarding complete
        await supabase
          .from('profiles')
          .update({ 
            current_org_id: invite.org_id,
            has_completed_onboarding: true,
            full_name: fullName,
          })
          .eq('id', authData.user.id);
        
        toast({ title: 'Account created!', description: `Welcome to ${invite.organisation?.name || 'the organisation'}` });
        navigate('/dashboard');
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
            <CardTitle>Join {invite.organisation?.name || 'Organisation'}</CardTitle>
            <CardDescription>
              You've been invited to join as a <strong>{invite.role}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailMatches && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p>This invitation was sent to <strong>{invite.email}</strong>, but you're logged in as <strong>{user.email}</strong>.</p>
                <p className="mt-2">You can still accept it with your current account.</p>
              </div>
            )}
            <Button 
              onClick={acceptInviteForExistingUser} 
              disabled={isAccepting} 
              className="w-full"
            >
              {isAccepting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Accept Invitation</>
              )}
            </Button>
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
          <CardTitle>Join {invite.organisation?.name || 'Organisation'}</CardTitle>
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
            onClick={acceptInviteForNewUser} 
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
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
