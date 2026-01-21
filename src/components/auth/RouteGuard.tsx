import { ReactNode } from 'react';
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

  // CRITICAL: If user exists but profile is still null, wait for it
  if (requireAuth && user && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Check onboarding completion (except for onboarding page itself)
  // IMPORTANT: Don't wait for orgLoading here - users in onboarding won't have orgs yet
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
    // User is on onboarding page and hasn't completed it - let them through
    return <>{children}</>;
  }

  // For routes that require onboarding completion, wait for org context
  if (requireAuth && requireOnboarding && user && orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // If authenticated but no org/role yet (and completed onboarding), edge case
  if (requireAuth && user && profile?.has_completed_onboarding && !currentOrg && !currentRole && !orgLoading) {
    // User has completed onboarding but has no org - might be data issue
    // Let them through but they'll see limited content or could redirect to onboarding
  }

  // Check role-based access using currentRole from org membership
  if (allowedRoles && allowedRoles.length > 0) {
    // If currentRole is still loading or null, we need to wait or deny
    if (!currentRole) {
      // No role in current org - redirect appropriately
      return <Navigate to="/dashboard" replace />;
    }
    
    const hasAllowedRole = allowedRoles.includes(currentRole);
    if (!hasAllowedRole) {
      // If parent trying to access staff routes, send to portal
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

  // Wait for auth to fully load (including profile fetch)
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // If authenticated, redirect based on onboarding status and role
  if (user) {
    // CRITICAL: If user exists but profile is still null, wait for it
    // This prevents premature redirects during profile loading
    if (!profile) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <LoadingState message="Loading..." />
        </div>
      );
    }
    
    // If user hasn't completed onboarding, send them there immediately
    if (!profile.has_completed_onboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    
    // User has completed onboarding - wait for org context to determine role
    if (orgLoading) {
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

  return <>{children}</>;
}
