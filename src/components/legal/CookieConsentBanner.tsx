import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  acceptAll,
  essentialOnly,
  getConsent,
  hasConsentDecision,
  setConsent,
} from '@/lib/cookieConsent';

/**
 * GDPR / UK DPA cookie consent banner.
 *
 * Behaviour:
 * - Renders fixed-bottom banner if no consent decision yet
 * - "Accept all" / "Essential only" / "Manage preferences"
 * - Manage preferences opens a dialog with toggleable analytics + marketing
 * - Dismisses immediately on any decision; cookie persists 365d
 * - Respects native platform: hidden on iOS/Android Capacitor builds
 *   (App Store ToS handles consent there; this is web-specific)
 */
export function CookieConsentBanner() {
  const [decided, setDecided] = useState<boolean>(true); // default true to avoid SSR flash
  const [open, setOpen] = useState(false);
  const [pendingAnalytics, setPendingAnalytics] = useState(false);
  const [pendingMarketing, setPendingMarketing] = useState(false);

  useEffect(() => {
    setDecided(hasConsentDecision());
  }, []);

  if (decided) return null;

  const handleAcceptAll = () => {
    acceptAll();
    setDecided(true);
  };

  const handleEssentialOnly = () => {
    essentialOnly();
    setDecided(true);
  };

  const handleOpenManage = () => {
    const cur = getConsent();
    setPendingAnalytics(cur?.analytics ?? false);
    setPendingMarketing(cur?.marketing ?? false);
    setOpen(true);
  };

  const handleSavePreferences = () => {
    setConsent({ analytics: pendingAnalytics, marketing: pendingMarketing });
    setOpen(false);
    setDecided(true);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg"
        data-testid="cookie-consent-banner"
      >
        <div className="container mx-auto flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            We use essential cookies to make LessonLoop work. With your consent, we may also use
            analytics cookies to understand how you use the site.{' '}
            <a href="/cookies" className="underline hover:text-foreground">
              Learn more
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenManage}
              data-testid="cookie-consent-manage"
            >
              Manage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEssentialOnly}
              data-testid="cookie-consent-essential"
            >
              Essential only
            </Button>
            <Button
              size="sm"
              onClick={handleAcceptAll}
              data-testid="cookie-consent-accept-all"
            >
              Accept all
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose which categories of cookies LessonLoop can use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium">Essential</Label>
                <p className="text-sm text-muted-foreground">
                  Required for sign-in, security, and core functionality. Cannot be turned off.
                </p>
              </div>
              <Switch checked disabled aria-label="Essential cookies (required)" />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="cc-analytics" className="text-sm font-medium">
                  Analytics
                </Label>
                <p className="text-sm text-muted-foreground">
                  Help us understand which features you use so we can improve LessonLoop.
                </p>
              </div>
              <Switch
                id="cc-analytics"
                checked={pendingAnalytics}
                onCheckedChange={setPendingAnalytics}
                data-testid="cookie-consent-analytics-toggle"
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="cc-marketing" className="text-sm font-medium">
                  Marketing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Personalised messaging and product announcements.
                </p>
              </div>
              <Switch
                id="cc-marketing"
                checked={pendingMarketing}
                onCheckedChange={setPendingMarketing}
                data-testid="cookie-consent-marketing-toggle"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences} data-testid="cookie-consent-save">
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
