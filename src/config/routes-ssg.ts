/**
 * SSG marketing route definitions — ONLY imported when __SSG_MODE__ is set.
 *
 * This file is kept separate from routes.ts so that Vite never encounters
 * the marketing page import() calls during normal (non-SSG) dev/build.
 * It is conditionally loaded via `await import('./routes-ssg')` in routes.ts.
 */
import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import { ExternalRedirect } from '@/components/shared/ExternalRedirect';
import { AuthRedirect } from '@/components/shared/AuthRedirect';
import type { RouteConfig } from './routes';

const MARKETING_BASE = 'https://lessonloop.net';

function makeExternalRedirect(path: string) {
  return () => ExternalRedirect({ to: `${MARKETING_BASE}${path}` });
}

/**
 * Wrap a dynamic import so it retries once on failure, then falls back to
 * `fallbackComponent` instead of crashing the app.
 */
function safeLazy(
  importFn: () => Promise<{ default: ComponentType<any> }>,
  fallbackComponent: ComponentType<any>,
): LazyExoticComponent<ComponentType<any>> {
  return lazy(() => {
    const fallbackModule = { default: fallbackComponent };
    try {
      return importFn().catch(() => {
        return new Promise<{ default: ComponentType<any> }>((resolve) =>
          setTimeout(() => {
            try {
              resolve(importFn().catch(() => fallbackModule));
            } catch {
              resolve(fallbackModule);
            }
          }, 200),
        );
      });
    } catch {
      return Promise.resolve(fallbackModule);
    }
  });
}

export function buildSSGMarketingRoutes(): RouteConfig[] {
  return [
    { path: '/', component: safeLazy(() => import('@/pages/marketing/Home'), AuthRedirect), auth: 'public', label: 'Home' },
    { path: '/features', component: safeLazy(() => import('@/pages/marketing/Features'), makeExternalRedirect('/features')), auth: 'public', label: 'Features' },
    { path: '/pricing', component: safeLazy(() => import('@/pages/marketing/Pricing'), makeExternalRedirect('/pricing')), auth: 'public', label: 'Pricing' },
    { path: '/about', component: safeLazy(() => import('@/pages/marketing/About'), makeExternalRedirect('/about')), auth: 'public', label: 'About' },
    { path: '/blog', component: safeLazy(() => import('@/pages/marketing/Blog'), makeExternalRedirect('/blog')), auth: 'public', label: 'Blog' },
    { path: '/blog/:slug', component: safeLazy(() => import('@/pages/marketing/BlogPost'), makeExternalRedirect('/blog/:slug')), auth: 'public', label: 'Blog Post' },
    { path: '/contact', component: safeLazy(() => import('@/pages/marketing/Contact'), makeExternalRedirect('/contact')), auth: 'public', label: 'Contact' },
    { path: '/privacy', component: safeLazy(() => import('@/pages/marketing/Privacy'), makeExternalRedirect('/privacy')), auth: 'public', label: 'Privacy Policy' },
    { path: '/terms', component: safeLazy(() => import('@/pages/marketing/Terms'), makeExternalRedirect('/terms')), auth: 'public', label: 'Terms of Service' },
    { path: '/gdpr', component: safeLazy(() => import('@/pages/marketing/GDPR'), makeExternalRedirect('/gdpr')), auth: 'public', label: 'GDPR' },
    { path: '/cookies', component: safeLazy(() => import('@/pages/marketing/Cookies'), makeExternalRedirect('/cookies')), auth: 'public', label: 'Cookie Policy' },
    { path: '/kickstarter', component: safeLazy(() => import('@/pages/marketing/Kickstarter'), makeExternalRedirect('/kickstarter')), auth: 'public', label: 'Kickstarter' },
    { path: '/report', component: safeLazy(() => import('@/pages/marketing/ReportDownload'), makeExternalRedirect('/report')), auth: 'public', label: 'Report' },
    { path: '/zoom-integration', component: safeLazy(() => import('@/pages/marketing/ZoomGuide'), makeExternalRedirect('/zoom-integration')), auth: 'public', label: 'Zoom Guide' },
    { path: '/uk', component: safeLazy(() => import('@/pages/marketing/UK'), makeExternalRedirect('/uk')), auth: 'public', label: 'UK' },
    { path: '/features/scheduling', component: safeLazy(() => import('@/pages/marketing/features/FeatureScheduling'), makeExternalRedirect('/features/scheduling')), auth: 'public', label: 'Scheduling' },
    { path: '/features/billing', component: safeLazy(() => import('@/pages/marketing/features/FeatureBilling'), makeExternalRedirect('/features/billing')), auth: 'public', label: 'Billing' },
    { path: '/features/parent-portal', component: safeLazy(() => import('@/pages/marketing/features/FeatureParentPortal'), makeExternalRedirect('/features/parent-portal')), auth: 'public', label: 'Parent Portal' },
    { path: '/features/loopassist', component: safeLazy(() => import('@/pages/marketing/features/FeatureLoopAssist'), makeExternalRedirect('/features/loopassist')), auth: 'public', label: 'LoopAssist' },
    { path: '/features/students', component: safeLazy(() => import('@/pages/marketing/features/FeatureStudents'), makeExternalRedirect('/features/students')), auth: 'public', label: 'Students' },
    { path: '/features/teachers', component: safeLazy(() => import('@/pages/marketing/features/FeatureTeachers'), makeExternalRedirect('/features/teachers')), auth: 'public', label: 'Teachers' },
    { path: '/features/attendance', component: safeLazy(() => import('@/pages/marketing/features/FeatureAttendance'), makeExternalRedirect('/features/attendance')), auth: 'public', label: 'Attendance' },
    { path: '/features/practice-tracking', component: safeLazy(() => import('@/pages/marketing/features/FeaturePracticeTracking'), makeExternalRedirect('/features/practice-tracking')), auth: 'public', label: 'Practice Tracking' },
    { path: '/features/messaging', component: safeLazy(() => import('@/pages/marketing/features/FeatureMessaging'), makeExternalRedirect('/features/messaging')), auth: 'public', label: 'Messaging' },
    { path: '/features/reports', component: safeLazy(() => import('@/pages/marketing/features/FeatureReports'), makeExternalRedirect('/features/reports')), auth: 'public', label: 'Reports' },
    { path: '/features/locations', component: safeLazy(() => import('@/pages/marketing/features/FeatureLocations'), makeExternalRedirect('/features/locations')), auth: 'public', label: 'Locations' },
    { path: '/features/resources', component: safeLazy(() => import('@/pages/marketing/features/FeatureResources'), makeExternalRedirect('/features/resources')), auth: 'public', label: 'Resources' },
    { path: '/compare/lessonloop-vs-my-music-staff', component: safeLazy(() => import('@/pages/marketing/compare/VsMyMusicStaff'), makeExternalRedirect('/compare/lessonloop-vs-my-music-staff')), auth: 'public', label: 'vs My Music Staff' },
    { path: '/compare/lessonloop-vs-teachworks', component: safeLazy(() => import('@/pages/marketing/compare/VsTeachworks'), makeExternalRedirect('/compare/lessonloop-vs-teachworks')), auth: 'public', label: 'vs Teachworks' },
    { path: '/compare/lessonloop-vs-opus1', component: safeLazy(() => import('@/pages/marketing/compare/VsOpus1'), makeExternalRedirect('/compare/lessonloop-vs-opus1')), auth: 'public', label: 'vs Opus 1' },
    { path: '/compare/lessonloop-vs-jackrabbit-music', component: safeLazy(() => import('@/pages/marketing/compare/VsJackrabbitMusic'), makeExternalRedirect('/compare/lessonloop-vs-jackrabbit-music')), auth: 'public', label: 'vs Jackrabbit Music' },
    { path: '/compare/lessonloop-vs-fons', component: safeLazy(() => import('@/pages/marketing/compare/VsFons'), makeExternalRedirect('/compare/lessonloop-vs-fons')), auth: 'public', label: 'vs Fons' },
    { path: '/for/music-academies', component: safeLazy(() => import('@/pages/marketing/use-cases/ForMusicAcademies'), makeExternalRedirect('/for/music-academies')), auth: 'public', label: 'Music Academies' },
    { path: '/for/solo-teachers', component: safeLazy(() => import('@/pages/marketing/use-cases/ForSoloTeachers'), makeExternalRedirect('/for/solo-teachers')), auth: 'public', label: 'Solo Teachers' },
    { path: '/for/piano-schools', component: safeLazy(() => import('@/pages/marketing/use-cases/ForPianoSchools'), makeExternalRedirect('/for/piano-schools')), auth: 'public', label: 'Piano Schools' },
    { path: '/for/guitar-schools', component: safeLazy(() => import('@/pages/marketing/use-cases/ForGuitarSchools'), makeExternalRedirect('/for/guitar-schools')), auth: 'public', label: 'Guitar Schools' },
    { path: '/for/performing-arts', component: safeLazy(() => import('@/pages/marketing/use-cases/ForPerformingArts'), makeExternalRedirect('/for/performing-arts')), auth: 'public', label: 'Performing Arts' },
  ];
}
