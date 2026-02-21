import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { toast } from "@/hooks/use-toast";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { LoopAssistProvider } from "@/contexts/LoopAssistContext";
import { TourProvider } from "@/components/tours/TourProvider";
import { RouteGuard, PublicRoute } from "@/components/auth/RouteGuard";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppShellSkeleton } from "@/components/shared/LoadingState";

// Eagerly loaded entry-point pages (auth)
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";

// Marketing Pages – grouped into one chunk via shared comment
const MarketingHome = lazy(() => import("./pages/marketing/Home"));
const Features = lazy(() => import("./pages/marketing/Features"));
const Pricing = lazy(() => import("./pages/marketing/Pricing"));
const About = lazy(() => import("./pages/marketing/About"));
const Blog = lazy(() => import("./pages/marketing/Blog"));
const BlogPost = lazy(() => import("./pages/marketing/BlogPost"));
const Contact = lazy(() => import("./pages/marketing/Contact"));
const Privacy = lazy(() => import("./pages/marketing/Privacy"));
const Terms = lazy(() => import("./pages/marketing/Terms"));
const GDPR = lazy(() => import("./pages/marketing/GDPR"));
const Cookies = lazy(() => import("./pages/marketing/Cookies"));
const Kickstarter = lazy(() => import("./pages/marketing/Kickstarter"));

// Auth Pages (lazy – not entry points)
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));

// App Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Students = lazy(() => import("./pages/Students"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const StudentsImport = lazy(() => import("./pages/StudentsImport"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Locations = lazy(() => import("./pages/Locations"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Reports = lazy(() => import("./pages/Reports"));
const PayrollReport = lazy(() => import("./pages/reports/Payroll"));
const RevenueReport = lazy(() => import("./pages/reports/Revenue"));
const OutstandingReport = lazy(() => import("./pages/reports/Outstanding"));
const LessonsDeliveredReport = lazy(() => import("./pages/reports/LessonsDelivered"));
const CancellationReport = lazy(() => import("./pages/reports/Cancellations"));
const UtilisationReport = lazy(() => import("./pages/reports/Utilisation"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Practice = lazy(() => import("./pages/Practice"));
const Resources = lazy(() => import("./pages/Resources"));
const DailyRegister = lazy(() => import("./pages/DailyRegister"));
const BatchAttendance = lazy(() => import("./pages/BatchAttendance"));
const Help = lazy(() => import("./pages/Help"));

// Portal Pages – grouped into one chunk
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalSchedule = lazy(() => import("./pages/portal/PortalSchedule"));
const PortalPractice = lazy(() => import("./pages/portal/PortalPractice"));
const PortalResources = lazy(() => import("./pages/portal/PortalResources"));
const PortalInvoices = lazy(() => import("./pages/portal/PortalInvoices"));
const PortalMessages = lazy(() => import("./pages/portal/PortalMessages"));

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
      staleTime: 5 * 60 * 1000,
      retry: 3,
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <OrgProvider>
              <LoopAssistProvider>
                <TourProvider>
                  <ScrollToTop />
                  <OfflineBanner />
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={<AppShellSkeleton />}>
            <Routes>
              {/* Public auth routes – eagerly loaded */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              
              {/* Onboarding */}
              <Route path="/onboarding" element={
                <RouteGuard requireOnboarding={false}>
                  <Onboarding />
                </RouteGuard>
              } />

              {/* Email verification */}
              <Route path="/verify-email" element={
                <RouteGuard requireOnboarding={false}>
                  <VerifyEmail />
                </RouteGuard>
              } />
              
               <Route path="/portal" element={<Navigate to="/portal/home" replace />} />
               {/* Portal routes (parent only) – portal chunk */}
              <Route path="/portal/home" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalHome />
                </RouteGuard>
              } />
              <Route path="/portal/schedule" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalSchedule />
                </RouteGuard>
              } />
              <Route path="/portal/practice" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalPractice />
                </RouteGuard>
              } />
              <Route path="/portal/resources" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalResources />
                </RouteGuard>
              } />
              <Route path="/portal/invoices" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalInvoices />
                </RouteGuard>
              } />
              <Route path="/portal/messages" element={
                <RouteGuard allowedRoles={['parent']}>
                  <PortalMessages />
                </RouteGuard>
              } />
              
              {/* Protected app routes */}
              <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
              <Route path="/register" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <DailyRegister />
                </RouteGuard>
              } />
              <Route path="/calendar" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <CalendarPage />
                </RouteGuard>
              } />
              <Route path="/batch-attendance" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <BatchAttendance />
                </RouteGuard>
              } />
              <Route path="/students" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <Students />
                </RouteGuard>
              } />
              <Route path="/students/import" element={
                <RouteGuard allowedRoles={['owner', 'admin']}>
                  <StudentsImport />
                </RouteGuard>
              } />
              <Route path="/students/:id" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <StudentDetail />
                </RouteGuard>
              } />
              <Route path="/teachers" element={
                <RouteGuard allowedRoles={['owner', 'admin']}>
                  <Teachers />
                </RouteGuard>
              } />
              <Route path="/locations" element={
                <RouteGuard allowedRoles={['owner', 'admin']}>
                  <Locations />
                </RouteGuard>
              } />
              <Route path="/invoices" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
                  <Invoices />
                </RouteGuard>
              } />
              <Route path="/invoices/:id" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
                  <InvoiceDetail />
                </RouteGuard>
              } />
              <Route path="/reports" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance', 'teacher']}>
                  <Reports />
                </RouteGuard>
              } />
              <Route path="/reports/payroll" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher', 'finance']}>
                  <PayrollReport />
                </RouteGuard>
              } />
              <Route path="/reports/revenue" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
                  <RevenueReport />
                </RouteGuard>
              } />
              <Route path="/reports/outstanding" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
                  <OutstandingReport />
                </RouteGuard>
              } />
              <Route path="/reports/lessons" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <LessonsDeliveredReport />
                </RouteGuard>
              } />
              <Route path="/reports/cancellations" element={
                <RouteGuard allowedRoles={['owner', 'admin']}>
                  <CancellationReport />
                </RouteGuard>
              } />
              <Route path="/reports/utilisation" element={
                <RouteGuard allowedRoles={['owner', 'admin']}>
                  <UtilisationReport />
                </RouteGuard>
              } />
              <Route path="/messages" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher', 'finance']}>
                  <Messages />
                </RouteGuard>
              } />
              <Route path="/practice" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <Practice />
                </RouteGuard>
              } />
              <Route path="/resources" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <Resources />
                </RouteGuard>
              } />
              <Route path="/settings" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher', 'finance']}>
                  <Settings />
                </RouteGuard>
              } />
              <Route path="/help" element={
                <RouteGuard>
                  <Help />
                </RouteGuard>
              } />
              
              {/* Public Marketing Routes – marketing chunk */}
              <Route path="/" element={<MarketingHome />} />
              <Route path="/features" element={<Features />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/gdpr" element={<GDPR />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/kickstarter" element={<Kickstarter />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
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
