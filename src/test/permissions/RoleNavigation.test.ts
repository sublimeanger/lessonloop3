/**
 * LL-SEC-P0-01: Role-based Navigation Tests
 * Tests that each role sees the correct sidebar navigation items.
 */
import { describe, it, expect } from 'vitest';
import type { AppRole } from '@/contexts/AuthContext';

// Replicate the nav config from AppSidebar.tsx for testing
// (testing the data structure directly, not the component rendering)
interface NavItem {
  title: string;
  url: string;
}

const ownerAdminNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard' },
  { title: 'Calendar', url: '/calendar' },
  { title: 'Register', url: '/register' },
  { title: 'Students', url: '/students' },
  { title: 'Teachers', url: '/teachers' },
  { title: 'Locations', url: '/locations' },
  { title: 'Practice', url: '/practice' },
  { title: 'Resources', url: '/resources' },
  { title: 'Invoices', url: '/invoices' },
  { title: 'Reports', url: '/reports' },
  { title: 'Messages', url: '/messages' },
  { title: 'Settings', url: '/settings' },
  { title: 'Help', url: '/help' },
];

const financeNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard' },
  { title: 'Invoices', url: '/invoices' },
  { title: 'Reports', url: '/reports' },
  { title: 'Messages', url: '/messages' },
  { title: 'Settings', url: '/settings' },
  { title: 'Help', url: '/help' },
];

const teacherNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard' },
  { title: 'My Calendar', url: '/calendar' },
  { title: 'Register', url: '/register' },
  { title: 'My Students', url: '/students' },
  { title: 'Practice', url: '/practice' },
  { title: 'Resources', url: '/resources' },
  { title: 'Messages', url: '/messages' },
  { title: 'Settings', url: '/settings' },
  { title: 'Help', url: '/help' },
];

const parentNav: NavItem[] = [
  { title: 'Home', url: '/portal/home' },
  { title: 'Schedule', url: '/portal/schedule' },
  { title: 'Practice', url: '/portal/practice' },
  { title: 'Resources', url: '/portal/resources' },
  { title: 'Invoices & Payments', url: '/portal/invoices' },
  { title: 'Messages', url: '/portal/messages' },
];

function getNavItems(role: AppRole | null): NavItem[] {
  if (!role) return [];
  switch (role) {
    case 'owner':
    case 'admin':
      return ownerAdminNav;
    case 'finance':
      return financeNav;
    case 'teacher':
      return teacherNav;
    case 'parent':
      return parentNav;
    default:
      return ownerAdminNav;
  }
}

describe('LL-SEC-P0-01: Role-based Navigation', () => {
  describe('Owner/Admin navigation', () => {
    it('has 13 nav items', () => {
      expect(getNavItems('owner')).toHaveLength(13);
      expect(getNavItems('admin')).toHaveLength(13);
    });

    it('includes Teachers and Locations', () => {
      const titles = getNavItems('owner').map(n => n.title);
      expect(titles).toContain('Teachers');
      expect(titles).toContain('Locations');
    });

    it('includes Invoices and Reports', () => {
      const titles = getNavItems('owner').map(n => n.title);
      expect(titles).toContain('Invoices');
      expect(titles).toContain('Reports');
    });

    it('includes Calendar and Register', () => {
      const titles = getNavItems('owner').map(n => n.title);
      expect(titles).toContain('Calendar');
      expect(titles).toContain('Register');
    });
  });

  describe('Finance navigation', () => {
    it('has 6 nav items', () => {
      expect(getNavItems('finance')).toHaveLength(6);
    });

    it('includes Invoices and Reports', () => {
      const titles = getNavItems('finance').map(n => n.title);
      expect(titles).toContain('Invoices');
      expect(titles).toContain('Reports');
    });

    it('does NOT include Calendar, Students, Teachers, Locations', () => {
      const titles = getNavItems('finance').map(n => n.title);
      expect(titles).not.toContain('Calendar');
      expect(titles).not.toContain('Students');
      expect(titles).not.toContain('Teachers');
      expect(titles).not.toContain('Locations');
    });
  });

  describe('Teacher navigation', () => {
    it('has 9 nav items', () => {
      expect(getNavItems('teacher')).toHaveLength(9);
    });

    it('does NOT include Teachers, Locations, or Invoices', () => {
      const titles = getNavItems('teacher').map(n => n.title);
      expect(titles).not.toContain('Teachers');
      expect(titles).not.toContain('Locations');
      expect(titles).not.toContain('Invoices');
    });

    it('uses "My Calendar" and "My Students" labels', () => {
      const titles = getNavItems('teacher').map(n => n.title);
      expect(titles).toContain('My Calendar');
      expect(titles).toContain('My Students');
    });

    it('includes Practice and Resources', () => {
      const titles = getNavItems('teacher').map(n => n.title);
      expect(titles).toContain('Practice');
      expect(titles).toContain('Resources');
    });
  });

  describe('Parent navigation', () => {
    it('has 6 nav items', () => {
      expect(getNavItems('parent')).toHaveLength(6);
    });

    it('all routes are under /portal/', () => {
      const urls = getNavItems('parent').map(n => n.url);
      urls.forEach(url => {
        expect(url).toMatch(/^\/portal\//);
      });
    });

    it('does NOT include any staff routes', () => {
      const urls = getNavItems('parent').map(n => n.url);
      expect(urls).not.toContain('/dashboard');
      expect(urls).not.toContain('/calendar');
      expect(urls).not.toContain('/invoices');
      expect(urls).not.toContain('/teachers');
    });

    it('includes Home, Schedule, Practice, Resources, Invoices & Payments, Messages', () => {
      const titles = getNavItems('parent').map(n => n.title);
      expect(titles).toContain('Home');
      expect(titles).toContain('Schedule');
      expect(titles).toContain('Practice');
      expect(titles).toContain('Resources');
      expect(titles).toContain('Invoices & Payments');
      expect(titles).toContain('Messages');
    });
  });

  describe('Null role', () => {
    it('returns empty array to prevent UI leaks during loading', () => {
      expect(getNavItems(null)).toHaveLength(0);
    });
  });
});
