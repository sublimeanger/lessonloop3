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

  // Wait for both auth and org context to load
  if (authLoading || (user && orgLoading)) {
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

  // Check onboarding completion (except for onboarding page itself)
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // If authenticated but no org/role yet (and not onboarding), redirect to onboarding
  if (requireAuth && user && profile?.has_completed_onboarding && !currentOrg && !currentRole) {
    // User has completed onboarding but has no org - could be edge case
    // Allow them through but they'll see limited content
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // If authenticated, redirect based on onboarding status and role
  if (user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    
    if (profile && !profile.has_completed_onboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    
    // Wait for org context if needed
    if (orgLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <LoadingState message="Loading..." />
        </div>
      );
    }
    
    // Redirect parents to portal, others to dashboard or previous location
    if (currentRole === 'parent') {
      return <Navigate to="/portal/home" replace />;
    }
    
    return <Navigate to={from || '/dashboard'} replace />;
  }

  return <>{children}</>;
}
