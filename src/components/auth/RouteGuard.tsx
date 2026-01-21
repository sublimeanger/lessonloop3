import { ReactNode } from 'react';
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

// Simple loading component with logout escape
function AuthLoading({ onLogout }: { onLogout?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
      {onLogout && (
        <Button variant="ghost" size="sm" onClick={onLogout} className="mt-4">
          Stuck? Click to logout
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
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const { currentRole, isLoading: orgLoading } = useOrg();
  const location = useLocation();

  // Only show loading for initial auth check, with escape hatch
  if (authLoading) {
    return <AuthLoading onLogout={signOut} />;
  }

  // Not authenticated - redirect to login
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Special case: onboarding page - always allow authenticated users through
  if (location.pathname === '/onboarding' && user) {
    return <>{children}</>;
  }

  // Check onboarding completion
  if (requireAuth && requireOnboarding && profile && !profile.has_completed_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // For role-restricted routes, wait for org context (briefly)
  if (allowedRoles && allowedRoles.length > 0 && orgLoading) {
    return <AuthLoading onLogout={signOut} />;
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
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

// Wrapper for public routes that redirect authenticated users
export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const { currentRole, isLoading: orgLoading } = useOrg();
  const location = useLocation();

  // Brief loading state for initial auth check
  if (authLoading) {
    return <AuthLoading />;
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

  // Don't wait for org loading - just redirect
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  
  if (currentRole === 'parent') {
    return <Navigate to="/portal/home" replace />;
  }

  return <Navigate to={from || '/dashboard'} replace />;
}
