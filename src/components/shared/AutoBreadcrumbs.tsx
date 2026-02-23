import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { allRoutes } from '@/config/routes';

interface AutoBreadcrumbsProps {
  /** Title for the current page — used for dynamic segments like :id */
  currentPageTitle?: string;
}

/** Top-level segment → path mapping (only app routes that act as parents) */
const ROOT_SEGMENTS: Record<string, string> = {
  dashboard: '/dashboard',
  students: '/students',
  teachers: '/teachers',
  invoices: '/invoices',
  calendar: '/calendar',
  reports: '/reports',
  settings: '/settings',
  messages: '/messages',
  practice: '/practice',
  resources: '/resources',
  register: '/register',
  locations: '/locations',
  'make-ups': '/make-ups',
  help: '/help',
  'batch-attendance': '/batch-attendance',
  portal: '/portal/home',
};

/** Look up a label from the centralised route config */
function findLabel(path: string): string | undefined {
  const route = allRoutes.find((r) => r.path === path);
  return route?.label;
}

/**
 * Builds breadcrumb entries from the current URL path.
 * Skips rendering when on a top-level page (no crumbs needed).
 */
export function AutoBreadcrumbs({ currentPageTitle }: AutoBreadcrumbsProps) {
  const { pathname } = useLocation();

  // Strip trailing slash and split
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);

  // Don't render breadcrumbs on top-level or root pages
  if (segments.length <= 1) return null;

  // Build crumbs
  const crumbs: { label: string; href?: string }[] = [];

  // Always start with Dashboard (or Portal Home for portal routes)
  const isPortal = segments[0] === 'portal';
  crumbs.push({
    label: isPortal ? 'Home' : 'Dashboard',
    href: isPortal ? '/portal/home' : '/dashboard',
  });

  let accumulatedPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    accumulatedPath += `/${segment}`;

    // Skip the first segment if it's the dashboard/portal root (already added above)
    if (i === 0 && (segment === 'dashboard' || segment === 'portal')) continue;
    // For portal, also skip the second segment if it's 'home'
    if (isPortal && i === 1 && segment === 'home') continue;

    const isLast = i === segments.length - 1;
    const isDynamic = segment.match(/^[0-9a-f-]{36}$/) || !isNaN(Number(segment));

    if (isDynamic) {
      // Dynamic segment — use currentPageTitle or a fallback
      crumbs.push({
        label: isLast && currentPageTitle ? currentPageTitle : 'Details',
      });
    } else {
      // Static segment — look up from route config or ROOT_SEGMENTS
      const routeLabel = findLabel(accumulatedPath);
      const fallbackLabel = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      crumbs.push({
        label: routeLabel || fallbackLabel,
        href: isLast ? undefined : accumulatedPath,
      });
    }
  }

  // If we only have the root crumb, don't render
  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <BreadcrumbItem key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              {isLast || !crumb.href ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
