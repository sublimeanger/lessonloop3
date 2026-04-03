import { Suspense, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { toast } from "@/hooks/use-toast";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrgProvider, useOrg } from "@/contexts/OrgContext";
import { LoopAssistProvider } from "@/contexts/LoopAssistContext";
import { RouteGuard, PublicRoute } from "@/components/auth/RouteGuard";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppShellSkeleton } from "@/components/shared/LoadingState";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { initPushNotifications, teardownPushNotifications } from "@/services/pushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { platform } from "@/lib/platform";
import {
  publicAuthRoutes,
  authOnlyRoutes,
  portalRoutes,
  appRoutes,
  marketingRoutes,
  notFoundRoute,
  isSSG,
  loadSSGRoutes,
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
      refetchOnMount: true,   // Refetch stale data on mount (stale-while-revalidate)
      retry: 1,               // Fail fast — 1 retry instead of 3
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
  const navigate = useNavigate();

  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const pushInitRef = useRef(false);
  const nativeInitRef = useRef(false);

  // One-time native app init (status bar, keyboard, deep links, etc.)
  useEffect(() => {
    if (nativeInitRef.current) return;
    nativeInitRef.current = true;
    import('@/lib/native/init').then(({ initNativeApp }) => {
      initNativeApp((path: string) => {
        navigate(path);
      });
    });
  }, []);

  // Push notification registration (after auth)
  useEffect(() => {
    if (user && currentOrg && !pushInitRef.current) {
      pushInitRef.current = true;
      initPushNotifications(user.id, currentOrg.id, navigate);
    }
    if (!user) {
      pushInitRef.current = false;
      teardownPushNotifications();
    }
  }, [user, currentOrg]);

  // Refresh auth session and invalidate stale data when app returns from background
  useEffect(() => {
    if (!platform.isNative) return;

    let listener: { remove: () => void } | null = null;

    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) return;

        // Refresh auth session (may have expired while backgrounded)
        try {
          const { error } = await supabase.auth.getSession();
          if (error) {
            console.warn('[resume] Session refresh failed:', error.message);
          }
        } catch (e) {
          console.error('[resume] Auth refresh error:', e);
        }

        // Invalidate all queries to refresh stale data
        queryClient.invalidateQueries();
      }).then((h) => { listener = h; });
    });

    return () => {
      listener?.remove();
    };
  }, []);

  return null;
}

// ─── App ─────────────────────────────────────────────────

const App = () => {
  // In SSG mode (prerender script), dynamically load marketing page components
  // before rendering. In normal mode isSSG is false so ready starts true (zero overhead).
  const [ready, setReady] = useState(!isSSG);
  useEffect(() => {
    if (isSSG) {
      loadSSGRoutes().then(() => setReady(true));
    }
  }, []);

  if (!ready) return <AppShellSkeleton />;

  return (
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

                        {/* Public/redirect routes (marketing redirects + public pages) */}
                        <Route path="/demo" element={<Navigate to="/contact?subject=demo" replace />} />
                        {renderRoutes(marketingRoutes)}

                        {/* 404 */}
                        <Route path={notFoundRoute.path} element={<notFoundRoute.component />} />
                      </Routes>
                    </Suspense>
                </LoopAssistProvider>
              </OrgProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
