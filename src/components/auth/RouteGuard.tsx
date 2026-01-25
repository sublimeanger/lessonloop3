import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireOnboarding?: boolean;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

function AuthLoading({ onLogout }: { onLogout?: () => void }) {
  const [showEscape, setShowEscape] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowEscape(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
      {showEscape && onLogout && (
        <Button variant="ghost" size="sm" onClick={onLogout} className="mt-4">
          Logout and try again
        </Button>
      )}
    </div>
  );
}

export function RouteGuard({
  children,
  requireAuth = true,
  requireOnboarding = true,
  allowedRoles,
  redirectTo = '/login',
}: RouteGuardProps) {
  const { user, profile, isLoading, isInitialised, signOut } = useAuth();
  const { currentRole, hasInitialised: orgInitialised } = useOrg();
  const location = useLocation();

  // Wait for auth to initialise (max 4s via hard timeout)
  if (!isInitialised || isLoading) {
    return <AuthLoading onLogout={signOut} />;
  }

  // Not authenticated - redirect to login
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // SPECIAL: Onboarding page - just need auth, nothing else
  if (location.pathname === '/onboarding' && user) {
    return <>{children}</>;
  }

  // For protected routes, check onboarding status
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // For role-restricted routes
  if (allowedRoles && allowedRoles.length > 0) {
    if (!orgInitialised) {
      return <AuthLoading onLogout={signOut} />;
    }
    
    if (!currentRole) {
      return <Navigate to="/dashboard" replace />;
    }
    
    if (!allowedRoles.includes(currentRole)) {
      if (currentRole === 'parent') {
        return <Navigate to="/portal/home" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

// Public route wrapper - redirects authenticated users
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading, isInitialised } = useAuth();
  const { currentRole } = useOrg();
  const location = useLocation();

  if (!isInitialised || isLoading) {
    return <AuthLoading />;
  }

  // Not authenticated - show public page
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated but no onboarding - go to onboarding
  if (!profile || !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Authenticated and onboarded - redirect to app
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
