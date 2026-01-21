import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { LoadingState } from '@/components/shared/LoadingState';

interface RouteGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireOnboarding?: boolean;
  allowedRoles?: AppRole[];
  redirectTo?: string;
}

export function RouteGuard({
  children,
  requireAuth = true,
  requireOnboarding = true,
  allowedRoles,
  redirectTo = '/login',
}: RouteGuardProps) {
  const { user, profile, isLoading: authLoading } = useAuth();
  const { currentRole, currentOrg, isLoading: orgLoading } = useOrg();
  const location = useLocation();

  // Wait for auth to load first
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Check authentication
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // For onboarding route specifically, allow through even without profile
  if (location.pathname === '/onboarding' && user) {
    return <>{children}</>;
  }

  // Check onboarding completion
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
  }

  // For routes that require onboarding completion, wait for org context
  if (requireAuth && requireOnboarding && user && profile?.has_completed_onboarding && orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Check role-based access using currentRole from org membership
  if (allowedRoles && allowedRoles.length > 0) {
    if (!currentRole) {
      return <Navigate to="/dashboard" replace />;
    }
    
    const hasAllowedRole = allowedRoles.includes(currentRole);
    if (!hasAllowedRole) {
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
  const { user, profile, isLoading: authLoading } = useAuth();
  const { currentRole, isLoading: orgLoading } = useOrg();
  const location = useLocation();
  const [forceShow, setForceShow] = useState(false);

  // Timeout to prevent infinite loading - after 3s, force show the page
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Wait for auth to load (with timeout escape)
  if (authLoading && !forceShow) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Not authenticated - show public page
  if (!user) {
    return <>{children}</>;
  }

  // User is authenticated - redirect appropriately
  // If profile doesn't exist or onboarding not complete, go to onboarding
  if (!profile || !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // User has completed onboarding - wait for org context (with timeout)
  if (orgLoading && !forceShow) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Redirect based on role
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
