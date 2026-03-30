import { ReactNode, useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Button } from '@/components/ui/button';
import { AppShellSkeleton } from '@/components/shared/LoadingState';

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
    const forceTimer = setTimeout(() => setForceTimeout(true), 8000);
    return () => {
      clearTimeout(escapeTimer);
      clearTimeout(forceTimer);
    };
  }, []);

  useEffect(() => {
    if (forceTimeout && onForceRedirect) {
      logger.warn('[RouteGuard] Force timeout reached - redirecting');
      onForceRedirect();
    }
  }, [forceTimeout, onForceRedirect]);

  return (
    <div className="relative">
      <AppShellSkeleton />
      {showEscape && onLogout && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Button variant="secondary" size="sm" onClick={onLogout} className="shadow-lg">
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
  const { user, profile, isInitialised, signOut } = useAuth();
  const { currentRole, hasInitialised: orgInitialised, refreshOrganisations } = useOrg();
  const location = useLocation();
  const navigate = useNavigate();

  // Grace period: when isInitialised fires but profile is null (hard timeout race),
  // wait up to 3s for the recovery effect in AuthContext to fill in the profile
  // before redirecting to onboarding.
  const profileGraceRef = useRef(false);
  const [profileGraceDone, setProfileGraceDone] = useState(false);

  useEffect(() => {
    // Only start grace period when we have a user, are initialised, but profile is null
    if (isInitialised && user && !profile && !profileGraceRef.current) {
      profileGraceRef.current = true;
      logger.debug('[RouteGuard] Profile null after init — waiting for recovery');
      const timer = setTimeout(() => {
        logger.debug('[RouteGuard] Profile grace period expired');
        setProfileGraceDone(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    // If profile arrives during grace, cancel it
    if (profile && profileGraceRef.current) {
      profileGraceRef.current = false;
      setProfileGraceDone(false);
    }
  }, [isInitialised, user, profile]);

  // Role grace period: when orgInitialised fires but currentRole is null,
  // the membership may still be propagating after invite acceptance.
  // Wait up to 5s and retry org fetch before redirecting to /portal/home.
  const roleGraceRef = useRef(false);
  const [roleGraceDone, setRoleGraceDone] = useState(false);
  const roleRetryDoneRef = useRef(false);

  useEffect(() => {
    if (orgInitialised && user && !currentRole && !roleGraceRef.current) {
      roleGraceRef.current = true;
      roleRetryDoneRef.current = false;
      logger.debug('[RouteGuard] Role null after org init — waiting for membership propagation');
      const timer = setTimeout(() => {
        logger.debug('[RouteGuard] Role grace period expired');
        setRoleGraceDone(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
    // If role arrives during grace, cancel it
    if (currentRole && roleGraceRef.current) {
      roleGraceRef.current = false;
      setRoleGraceDone(false);
      roleRetryDoneRef.current = false;
    }
  }, [orgInitialised, user, currentRole]);

  // When role grace expires, retry org fetch once before giving up
  useEffect(() => {
    if (roleGraceDone && !currentRole && !roleRetryDoneRef.current) {
      roleRetryDoneRef.current = true;
      logger.debug('[RouteGuard] Role grace expired — retrying org fetch');
      refreshOrganisations();
    }
  }, [roleGraceDone, currentRole, refreshOrganisations]);

  const handleForceRedirect = () => {
    // If we have a user but profile load failed, go to onboarding
    // Onboarding will self-heal and create profile if needed
    if (user) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/auth', { replace: true });
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

  // SPECIAL: Verify-email page - just need auth, nothing else
  if (location.pathname === '/verify-email' && user) {
    return <>{children}</>;
  }

  // Email verification check - block unverified users from protected routes
  // Allow /onboarding and /verify-email through
  if (requireAuth && user && !user.email_confirmed_at) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/verify-email" replace />;
    }
  }

  // SPECIAL: Onboarding page - just need auth, nothing else
  if (location.pathname === '/onboarding' && user) {
    return <>{children}</>;
  }

  // For protected routes, check onboarding status
  if (requireAuth && requireOnboarding) {
    // If profile is null after auth init, wait for the recovery grace period
    // before redirecting — this prevents false onboarding redirects when the
    // hard timeout fires before profile fetch completes.
    if (profile === null) {
      if (!profileGraceDone) {
        // Still waiting for recovery — show loading
        return <AuthLoading onLogout={signOut} onForceRedirect={handleForceRedirect} />;
      }
      logger.warn('[RouteGuard] Profile still null after grace period - redirecting to onboarding');
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
      // Role is null — membership may still be propagating after invite acceptance.
      // Wait for grace period before redirecting to avoid white screen.
      if (!roleGraceDone) {
        return <AuthLoading onLogout={signOut} onForceRedirect={handleForceRedirect} />;
      }
      // Grace expired and retry done — user genuinely has no staff membership
      logger.warn('[RouteGuard] Role still null after grace period - redirecting to /portal/home');
      return <Navigate to="/portal/home" replace />;
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
  const { user, profile, isInitialised } = useAuth();
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
    // Preserve invite return URL through onboarding - don't consume it here
    return <Navigate to="/onboarding" replace />;
  }

  // Check for stored invite return URL (survives onboarding redirect)
  // SEC: Only allow relative paths starting with /accept-invite to prevent open-redirect
  const inviteReturn = (() => { try { return sessionStorage.getItem('lessonloop_invite_return'); } catch { return null; } })();
  if (inviteReturn && inviteReturn.startsWith('/accept-invite')) {
    try { sessionStorage.removeItem('lessonloop_invite_return'); } catch { /* storage unavailable */ }
    return <Navigate to={inviteReturn} replace />;
  }

  // Wait for org context to initialise before role-based redirects
  if (!orgInitialised) {
    return <AuthLoading />;
  }

  // Authenticated and onboarded - redirect to appropriate dashboard
  const fromState = (location.state as { from?: { pathname: string; search?: string } })?.from;
  // SEC: Only allow relative paths to prevent open-redirect attacks
  const rawFrom = fromState ? fromState.pathname + (fromState.search || '') : null;
  const from = rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : null;

  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
