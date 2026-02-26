import { Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { toast } from "@/hooks/use-toast";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { LoopAssistProvider } from "@/contexts/LoopAssistContext";
import { TourProvider } from "@/components/tours/TourProvider";
import { RouteGuard, PublicRoute } from "@/components/auth/RouteGuard";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppShellSkeleton } from "@/components/shared/LoadingState";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { initPushNotifications, teardownPushNotifications } from "@/services/pushNotifications";
import {
  publicAuthRoutes,
  authOnlyRoutes,
  portalRoutes,
  appRoutes,
  marketingRoutes,
  notFoundRoute,
  type RouteConfig,
} from "@/config/routes";

// ─── Query client ────────────────────────────────────────

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error(`[QueryCache] Error in query ${JSON.stringify(query.queryKey)}:`, error);
      if (
        error instanceof TypeError &&
        error.message.toLowerCase().includes('fetch')
      ) {
        toast({
          title: 'Connection issue',
          description: 'Retrying…',
          variant: 'destructive',
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      logger.error('[MutationCache] Mutation error:', error);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Default: SEMI_STABLE tier (2 min). See src/config/query-stale-times.ts for all tiers.
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
    },
    mutations: {
      retry: false,
    },
  },
});

// ─── Route element helpers ───────────────────────────────

function renderRouteElement(route: RouteConfig) {
  const Component = route.component;

  switch (route.auth) {
    case 'public-auth-redirect':
      return (
        <PublicRoute>
          <Component />
        </PublicRoute>
      );

    case 'auth-only':
      return (
        <RouteGuard requireOnboarding={route.requireOnboarding ?? false}>
          <Component />
        </RouteGuard>
      );

    case 'protected':
      return (
        <RouteGuard allowedRoles={route.allowedRoles}>
          <Component />
        </RouteGuard>
      );

    case 'public':
    default:
      return <Component />;
  }
}

function renderRoutes(routes: RouteConfig[]) {
  return routes.map((route) => (
    <Route key={route.path} path={route.path} element={renderRouteElement(route)} />
  ));
}

// ─── Native platform initialiser ─────────────────────────

function NativeInitializer() {
  useAndroidBackButton();

  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const pushInitRef = useRef(false);
  const nativeInitRef = useRef(false);

  // One-time native app init (status bar, keyboard, deep links, etc.)
  useEffect(() => {
    if (nativeInitRef.current) return;
    nativeInitRef.current = true;
    import('@/lib/native/init').then(({ initNativeApp }) => {
      // Use window.location-based navigation as a fallback
      initNativeApp((path: string) => {
        window.location.href = path;
      });
    });
  }, []);

  // Push notification registration (after auth)
  useEffect(() => {
    if (user && currentOrg && !pushInitRef.current) {
      pushInitRef.current = true;
      initPushNotifications(user.id, currentOrg.id);
    }
    if (!user) {
      pushInitRef.current = false;
      teardownPushNotifications();
    }
  }, [user, currentOrg]);

  return null;
}

// ─── App ─────────────────────────────────────────────────

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <OrgProvider>
              <NativeInitializer />
              <LoopAssistProvider>
                <TourProvider>
                  <ScrollToTop />
                  <OfflineBanner />
                  <Toaster />
                  
                  <Suspense fallback={<AppShellSkeleton />}>
                    <Routes>
                      {/* Public auth routes (redirect if logged in) */}
                      {renderRoutes(publicAuthRoutes)}

                      {/* Auth-only routes (onboarding, verify, accept-invite) */}
                      {renderRoutes(authOnlyRoutes)}

                      {/* Portal redirect */}
                      <Route path="/portal" element={<Navigate to="/portal/home" replace />} />

                      {/* Portal routes (parent) */}
                      {renderRoutes(portalRoutes)}

                      {/* Protected app routes (staff) */}
                      {renderRoutes(appRoutes)}

                      {/* Public marketing routes */}
                      <Route path="/demo" element={<Navigate to="/contact?subject=demo" replace />} />
                      {renderRoutes(marketingRoutes)}

                      {/* 404 */}
                      <Route path={notFoundRoute.path} element={<notFoundRoute.component />} />
                    </Routes>
                  </Suspense>
                </TourProvider>
              </LoopAssistProvider>
            </OrgProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
