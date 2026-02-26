import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShellSkeleton } from '@/components/shared/LoadingState';

/**
 * Root route handler: redirects to /login if not authenticated,
 * or /dashboard if authenticated.
 */
export function AuthRedirect() {
  const { user, isInitialised } = useAuth();

  if (!isInitialised) {
    return <AppShellSkeleton />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
