import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { AppRole } from '@/contexts/AuthContext';
import { ExternalRedirect } from '@/components/shared/ExternalRedirect';
import { AuthRedirect } from '@/components/shared/AuthRedirect';

// ─── Types ───────────────────────────────────────────────

export type RouteAuth = 'public' | 'protected' | 'auth-only' | 'public-auth-redirect';

export interface RouteConfig {
  path: string;
  component: LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
  auth: RouteAuth;
  allowedRoles?: AppRole[];
  requireOnboarding?: boolean;
  label: string;
  /** If true, the component is eagerly loaded (not lazy) */
  eager?: boolean;
}

// ─── Eagerly loaded auth pages ───────────────────────────
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';

// ─── Lazy: Auth ──────────────────────────────────────────
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const ZoomOAuthCallback = lazy(() => import('@/pages/ZoomOAuthCallback'));

// ─── Lazy: App ───────────────────────────────────────────
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const Students = lazy(() => import('@/pages/Students'));
const StudentDetail = lazy(() => import('@/pages/StudentDetail'));
const StudentsImport = lazy(() => import('@/pages/StudentsImport'));
const Teachers = lazy(() => import('@/pages/Teachers'));
const Locations = lazy(() => import('@/pages/Locations'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const InvoiceDetail = lazy(() => import('@/pages/InvoiceDetail'));
const Reports = lazy(() => import('@/pages/Reports'));
const PayrollReport = lazy(() => import('@/pages/reports/Payroll'));
const RevenueReport = lazy(() => import('@/pages/reports/Revenue'));
const OutstandingReport = lazy(() => import('@/pages/reports/Outstanding'));
const LessonsDeliveredReport = lazy(() => import('@/pages/reports/LessonsDelivered'));
const CancellationReport = lazy(() => import('@/pages/reports/Cancellations'));
const UtilisationReport = lazy(() => import('@/pages/reports/Utilisation'));
const Messages = lazy(() => import('@/pages/Messages'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Practice = lazy(() => import('@/pages/Practice'));
const Resources = lazy(() => import('@/pages/Resources'));
const DailyRegister = lazy(() => import('@/pages/DailyRegister'));
const BatchAttendance = lazy(() => import('@/pages/BatchAttendance'));
const Help = lazy(() => import('@/pages/Help'));
const MakeUpDashboard = lazy(() => import('@/pages/MakeUpDashboard'));
const Leads = lazy(() => import('@/pages/Leads'));
const LeadDetail = lazy(() => import('@/pages/LeadDetail'));
const TeacherPerformanceReport = lazy(() => import('@/pages/reports/TeacherPerformance'));

// ─── Lazy: Public ───────────────────────────────────────
const BookingPage = lazy(() => import('@/pages/public/BookingPage'));

// ─── Lazy: Portal ────────────────────────────────────────
const PortalHome = lazy(() => import('@/pages/portal/PortalHome'));
const PortalSchedule = lazy(() => import('@/pages/portal/PortalSchedule'));
const PortalPractice = lazy(() => import('@/pages/portal/PortalPractice'));
const PortalResources = lazy(() => import('@/pages/portal/PortalResources'));
const PortalInvoices = lazy(() => import('@/pages/portal/PortalInvoices'));
const PortalMessages = lazy(() => import('@/pages/portal/PortalMessages'));
const PortalProfile = lazy(() => import('@/pages/portal/PortalProfile'));

// ─── External redirect helper ───────────────────────────
const MARKETING_BASE = 'https://lessonloop.net';

function makeExternalRedirect(path: string) {
  return () => ExternalRedirect({ to: `${MARKETING_BASE}${path}` });
}

// ─── Route definitions ──────────────────────────────────

/** Routes that redirect authenticated users away (login/signup) */
export const publicAuthRoutes: RouteConfig[] = [
  { path: '/auth', component: Login, auth: 'public-auth-redirect', label: 'Auth', eager: true },
  { path: '/login', component: Login, auth: 'public-auth-redirect', label: 'Login', eager: true },
  { path: '/signup', component: Signup, auth: 'public-auth-redirect', label: 'Sign Up', eager: true },
  { path: '/forgot-password', component: ForgotPassword, auth: 'public-auth-redirect', label: 'Forgot Password', eager: true },
];

/** Routes that require auth but NOT onboarding */
export const authOnlyRoutes: RouteConfig[] = [
  { path: '/onboarding', component: Onboarding, auth: 'auth-only', requireOnboarding: false, label: 'Onboarding' },
  { path: '/verify-email', component: VerifyEmail, auth: 'auth-only', requireOnboarding: false, label: 'Verify Email' },
  { path: '/accept-invite', component: AcceptInvite, auth: 'public', label: 'Accept Invite' },
  { path: '/auth/zoom/callback', component: ZoomOAuthCallback, auth: 'public', label: 'Zoom OAuth Callback' },
];

/** Portal routes (parent role) */
export const portalRoutes: RouteConfig[] = [
  { path: '/portal/home', component: PortalHome, auth: 'protected', allowedRoles: ['parent'], label: 'Home' },
  { path: '/portal/schedule', component: PortalSchedule, auth: 'protected', allowedRoles: ['parent'], label: 'Schedule' },
  { path: '/portal/practice', component: PortalPractice, auth: 'protected', allowedRoles: ['parent'], label: 'Practice' },
  { path: '/portal/resources', component: PortalResources, auth: 'protected', allowedRoles: ['parent'], label: 'Resources' },
  { path: '/portal/invoices', component: PortalInvoices, auth: 'protected', allowedRoles: ['parent'], label: 'Invoices & Payments' },
  { path: '/portal/messages', component: PortalMessages, auth: 'protected', allowedRoles: ['parent'], label: 'Messages' },
  { path: '/portal/profile', component: PortalProfile, auth: 'protected', allowedRoles: ['parent'], label: 'Profile' },
];

/** Main app routes (staff roles) */
export const appRoutes: RouteConfig[] = [
  { path: '/dashboard', component: Dashboard, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher', 'finance'], label: 'Dashboard' },
  { path: '/register', component: DailyRegister, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Register' },
  { path: '/calendar', component: CalendarPage, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Calendar' },
  { path: '/batch-attendance', component: BatchAttendance, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Batch Attendance' },
  { path: '/students', component: Students, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Students' },
  { path: '/students/import', component: StudentsImport, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Import Students' },
  { path: '/students/:id', component: StudentDetail, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Student Detail' },
  { path: '/teachers', component: Teachers, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Teachers' },
  { path: '/locations', component: Locations, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Locations' },
  { path: '/invoices', component: Invoices, auth: 'protected', allowedRoles: ['owner', 'admin', 'finance'], label: 'Invoices' },
  { path: '/invoices/:id', component: InvoiceDetail, auth: 'protected', allowedRoles: ['owner', 'admin', 'finance'], label: 'Invoice Detail' },
  { path: '/reports', component: Reports, auth: 'protected', allowedRoles: ['owner', 'admin', 'finance', 'teacher'], label: 'Reports' },
  { path: '/reports/payroll', component: PayrollReport, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher', 'finance'], label: 'Payroll Report' },
  { path: '/reports/revenue', component: RevenueReport, auth: 'protected', allowedRoles: ['owner', 'admin', 'finance'], label: 'Revenue Report' },
  { path: '/reports/outstanding', component: OutstandingReport, auth: 'protected', allowedRoles: ['owner', 'admin', 'finance'], label: 'Outstanding Report' },
  { path: '/reports/lessons', component: LessonsDeliveredReport, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Lessons Delivered' },
  { path: '/reports/cancellations', component: CancellationReport, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Cancellation Report' },
  { path: '/reports/utilisation', component: UtilisationReport, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Utilisation Report' },
  { path: '/messages', component: Messages, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher', 'finance'], label: 'Messages' },
  { path: '/practice', component: Practice, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Practice' },
  { path: '/resources', component: Resources, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher'], label: 'Resources' },
  { path: '/make-ups', component: MakeUpDashboard, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Make-Ups' },
  { path: '/leads', component: Leads, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Leads' },
  { path: '/leads/:id', component: LeadDetail, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Lead Detail' },
  { path: '/reports/teacher-performance', component: TeacherPerformanceReport, auth: 'protected', allowedRoles: ['owner', 'admin'], label: 'Teacher Performance' },
  { path: '/settings', component: Settings, auth: 'protected', allowedRoles: ['owner', 'admin', 'teacher', 'finance'], label: 'Settings' },
  { path: '/help', component: Help, auth: 'protected', label: 'Help' },
];

/** Marketing routes — redirect to external static site */
export const marketingRoutes: RouteConfig[] = [
  // Root: auth-aware redirect
  { path: '/', component: AuthRedirect, auth: 'public', label: 'Home' },

  // Public pages that stay in-app
  { path: '/reset-password', component: ResetPassword, auth: 'public', label: 'Reset Password' },
  { path: '/book/:slug', component: BookingPage, auth: 'public', label: 'Book' },

  // External redirects to lessonloop.net
  { path: '/features', component: makeExternalRedirect('/features'), auth: 'public', label: 'Features' },
  { path: '/pricing', component: makeExternalRedirect('/pricing'), auth: 'public', label: 'Pricing' },
  { path: '/about', component: makeExternalRedirect('/about'), auth: 'public', label: 'About' },
  { path: '/blog', component: makeExternalRedirect('/blog'), auth: 'public', label: 'Blog' },
  { path: '/blog/:slug', component: makeExternalRedirect('/blog/:slug'), auth: 'public', label: 'Blog Post' },
  { path: '/contact', component: makeExternalRedirect('/contact'), auth: 'public', label: 'Contact' },
  { path: '/privacy', component: makeExternalRedirect('/privacy'), auth: 'public', label: 'Privacy Policy' },
  { path: '/terms', component: makeExternalRedirect('/terms'), auth: 'public', label: 'Terms of Service' },
  { path: '/gdpr', component: makeExternalRedirect('/gdpr'), auth: 'public', label: 'GDPR' },
  { path: '/cookies', component: makeExternalRedirect('/cookies'), auth: 'public', label: 'Cookie Policy' },
  { path: '/kickstarter', component: makeExternalRedirect('/kickstarter'), auth: 'public', label: 'Kickstarter' },
  { path: '/report', component: makeExternalRedirect('/report'), auth: 'public', label: 'Report' },
  { path: '/zoom-integration', component: makeExternalRedirect('/zoom-integration'), auth: 'public', label: 'Zoom Guide' },
  { path: '/uk', component: makeExternalRedirect('/uk'), auth: 'public', label: 'UK' },
  { path: '/features/scheduling', component: makeExternalRedirect('/features/scheduling'), auth: 'public', label: 'Scheduling' },
  { path: '/features/billing', component: makeExternalRedirect('/features/billing'), auth: 'public', label: 'Billing' },
  { path: '/features/parent-portal', component: makeExternalRedirect('/features/parent-portal'), auth: 'public', label: 'Parent Portal' },
  { path: '/features/loopassist', component: makeExternalRedirect('/features/loopassist'), auth: 'public', label: 'LoopAssist' },
  { path: '/features/students', component: makeExternalRedirect('/features/students'), auth: 'public', label: 'Students' },
  { path: '/features/teachers', component: makeExternalRedirect('/features/teachers'), auth: 'public', label: 'Teachers' },
  { path: '/features/attendance', component: makeExternalRedirect('/features/attendance'), auth: 'public', label: 'Attendance' },
  { path: '/features/practice-tracking', component: makeExternalRedirect('/features/practice-tracking'), auth: 'public', label: 'Practice Tracking' },
  { path: '/features/messaging', component: makeExternalRedirect('/features/messaging'), auth: 'public', label: 'Messaging' },
  { path: '/features/reports', component: makeExternalRedirect('/features/reports'), auth: 'public', label: 'Reports' },
  { path: '/features/locations', component: makeExternalRedirect('/features/locations'), auth: 'public', label: 'Locations' },
  { path: '/features/resources', component: makeExternalRedirect('/features/resources'), auth: 'public', label: 'Resources' },
  { path: '/compare/lessonloop-vs-my-music-staff', component: makeExternalRedirect('/compare/lessonloop-vs-my-music-staff'), auth: 'public', label: 'vs My Music Staff' },
  { path: '/compare/lessonloop-vs-teachworks', component: makeExternalRedirect('/compare/lessonloop-vs-teachworks'), auth: 'public', label: 'vs Teachworks' },
  { path: '/compare/lessonloop-vs-opus1', component: makeExternalRedirect('/compare/lessonloop-vs-opus1'), auth: 'public', label: 'vs Opus 1' },
  { path: '/compare/lessonloop-vs-jackrabbit-music', component: makeExternalRedirect('/compare/lessonloop-vs-jackrabbit-music'), auth: 'public', label: 'vs Jackrabbit Music' },
  { path: '/compare/lessonloop-vs-fons', component: makeExternalRedirect('/compare/lessonloop-vs-fons'), auth: 'public', label: 'vs Fons' },
  { path: '/for/music-academies', component: makeExternalRedirect('/for/music-academies'), auth: 'public', label: 'Music Academies' },
  { path: '/for/solo-teachers', component: makeExternalRedirect('/for/solo-teachers'), auth: 'public', label: 'Solo Teachers' },
  { path: '/for/piano-schools', component: makeExternalRedirect('/for/piano-schools'), auth: 'public', label: 'Piano Schools' },
  { path: '/for/guitar-schools', component: makeExternalRedirect('/for/guitar-schools'), auth: 'public', label: 'Guitar Schools' },
  { path: '/for/performing-arts', component: makeExternalRedirect('/for/performing-arts'), auth: 'public', label: 'Performing Arts' },
];

/** 404 route */
export const notFoundRoute: RouteConfig = {
  path: '*', component: NotFound, auth: 'public', label: 'Not Found',
};

/** All routes flattened – useful for lookups */
export const allRoutes: RouteConfig[] = [
  ...publicAuthRoutes,
  ...authOnlyRoutes,
  ...portalRoutes,
  ...appRoutes,
  ...marketingRoutes,
];

/**
 * Find a route config by path (exact match only, no param resolution).
 */
export function findRoute(path: string): RouteConfig | undefined {
  return allRoutes.find((r) => r.path === path);
}

/**
 * Check if a role has access to a given route path.
 */
export function canRoleAccess(path: string, role: AppRole): boolean {
  const route = findRoute(path);
  if (!route) return false;
  if (!route.allowedRoles || route.allowedRoles.length === 0) return true;
  return route.allowedRoles.includes(role);
}
