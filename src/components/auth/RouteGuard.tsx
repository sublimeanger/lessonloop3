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

// Loading component with timeout and escape hatch
function AuthLoading({ onLogout, message = 'Loading...' }: { onLogout?: () => void; message?: string }) {
  const [showEscape, setShowEscape] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowEscape(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {showEscape && onLogout && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">Taking longer than expected?</p>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Logout and try again
          </Button>
        </div>
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
  const { user, profile, isLoading: authLoading, isInitialised: authInitialised, signOut } = useAuth();
  const { currentRole, isLoading: orgLoading, hasInitialised: orgInitialised } = useOrg();
  const location = useLocation();

  // Wait for auth to initialise (with built-in timeout in AuthContext)
  if (!authInitialised || authLoading) {
    return <AuthLoading onLogout={signOut} message="Checking authentication..." />;
  }

  // Not authenticated - redirect to login
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // SPECIAL CASE: Onboarding page - always allow authenticated users through
  // No profile check, no org check, just auth
  if (location.pathname === '/onboarding' && user) {
    return <>{children}</>;
  }

  // For other protected routes, check profile exists
  // If user exists but no profile yet (trigger still running), brief wait
  if (requireAuth && user && !profile) {
    return <AuthLoading onLogout={signOut} message="Loading your profile..." />;
  }

  // Check onboarding completion (only if profile exists)
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // For role-restricted routes, wait for org context to initialise
  if (allowedRoles && allowedRoles.length > 0) {
    // Brief wait for org to initialise
    if (!orgInitialised) {
      return <AuthLoading onLogout={signOut} message="Loading organisation..." />;
    }
    
    // No role means no org membership - redirect to dashboard
    if (!currentRole) {
      return <Navigate to="/dashboard" replace />;
    }
    
    // Check role access
    if (!allowedRoles.includes(currentRole)) {
      if (currentRole === 'parent') {
        return <Navigate to="/portal/home" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

// Wrapper for public routes that redirect authenticated users
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading: authLoading, isInitialised: authInitialised, signOut } = useAuth();
  const { currentRole } = useOrg();
  const location = useLocation();

  // Wait for auth to initialise
  if (!authInitialised || authLoading) {
    return <AuthLoading message="Loading..." />;
  }

  // Not authenticated - show public page
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated - redirect appropriately
  // If no profile or not onboarded, go to onboarding
  if (!profile || !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Get intended destination from state or use role-based default
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
