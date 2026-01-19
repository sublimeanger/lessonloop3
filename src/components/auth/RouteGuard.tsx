import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
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
  const { user, profile, roles, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
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

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some((role) => roles.includes(role));
    if (!hasAllowedRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

// Wrapper for public routes that redirect authenticated users
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // If authenticated, redirect based on onboarding status
  if (user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    
    if (profile && !profile.has_completed_onboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    
    return <Navigate to={from || '/dashboard'} replace />;
  }

  return <>{children}</>;
}
