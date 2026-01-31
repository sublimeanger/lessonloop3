import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
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

function AuthLoading({ onLogout, onForceRedirect }: { onLogout?: () => void; onForceRedirect?: () => void }) {
  const [showEscape, setShowEscape] = useState(false);
  const [forceTimeout, setForceTimeout] = useState(false);
  
  useEffect(() => {
    const escapeTimer = setTimeout(() => setShowEscape(true), 2000);
    // Force redirect after 8 seconds to prevent infinite hang
    const forceTimer = setTimeout(() => setForceTimeout(true), 8000);
    return () => {
      clearTimeout(escapeTimer);
      clearTimeout(forceTimer);
    };
  }, []);

  // After 8 seconds, force redirect to onboarding as safe default
  useEffect(() => {
    if (forceTimeout && onForceRedirect) {
      console.warn('[RouteGuard] Force timeout reached - redirecting');
      onForceRedirect();
    }
  }, [forceTimeout, onForceRedirect]);

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
  const navigate = useNavigate();

  const handleForceRedirect = () => {
    // If we have a user but profile load failed, go to onboarding
    // Onboarding will self-heal and create profile if needed
    if (user) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  // Wait for INITIAL auth to complete - once initialised, never show loading again
  // This prevents the loading spinner from appearing on tab switches
  if (!isInitialised) {
    return <AuthLoading onLogout={signOut} onForceRedirect={handleForceRedirect} />;
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
  if (requireAuth && requireOnboarding) {
    // If profile is null after auth init, treat as needing onboarding
    // The onboarding page will self-heal and create profile if needed
    if (profile === null) {
      console.warn('[RouteGuard] Profile is null - redirecting to onboarding for self-heal');
      return <Navigate to="/onboarding" replace />;
    }
    if (!profile.has_completed_onboarding) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // For role-restricted routes
  if (allowedRoles && allowedRoles.length > 0) {
    if (!orgInitialised) {
      return <AuthLoading onLogout={signOut} onForceRedirect={handleForceRedirect} />;
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
  const { currentRole, hasInitialised: orgInitialised } = useOrg();
  const location = useLocation();

  // Wait for INITIAL auth only - don't block on subsequent loading states
  if (!isInitialised) {
    return <AuthLoading />;
  }

  // Not authenticated - show public page
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated - wait for profile to load (profile is null when truly missing, loading shows spinner)
  // If profile is still loading (isLoading was true), we'd have returned above
  // If profile is null after auth init, user needs onboarding
  if (profile === null || !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Wait for org context to initialise before role-based redirects
  if (!orgInitialised) {
    return <AuthLoading />;
  }

  // Authenticated and onboarded - redirect to appropriate dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
