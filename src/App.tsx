import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { RouteGuard, PublicRoute } from "@/components/auth/RouteGuard";

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Teachers from "./pages/Teachers";
import Locations from "./pages/Locations";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Reports from "./pages/Reports";
import PayrollReport from "./pages/reports/Payroll";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

// Portal Pages
import PortalHome from "./pages/portal/PortalHome";
import PortalSchedule from "./pages/portal/PortalSchedule";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalMessages from "./pages/portal/PortalMessages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              
              {/* Onboarding (requires auth but not onboarding completion) */}
              <Route path="/onboarding" element={
                <RouteGuard requireOnboarding={false}>
                  <Onboarding />
                </RouteGuard>
              } />
              
              {/* Portal routes (parent only) */}
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
              <Route path="/calendar" element={<RouteGuard><CalendarPage /></RouteGuard>} />
              <Route path="/students" element={<RouteGuard><Students /></RouteGuard>} />
              <Route path="/students/:id" element={<RouteGuard><StudentDetail /></RouteGuard>} />
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
              <Route path="/invoices" element={<RouteGuard><Invoices /></RouteGuard>} />
              <Route path="/invoices/:id" element={<RouteGuard><InvoiceDetail /></RouteGuard>} />
              <Route path="/reports" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
                  <Reports />
                </RouteGuard>
              } />
              <Route path="/reports/payroll" element={
                <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
                  <PayrollReport />
                </RouteGuard>
              } />
              <Route path="/messages" element={<RouteGuard><Messages /></RouteGuard>} />
              <Route path="/settings" element={<RouteGuard><Settings /></RouteGuard>} />
              
              {/* Redirects */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
