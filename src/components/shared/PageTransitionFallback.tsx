import { useEffect, useState } from 'react';

/**
 * A minimal, branded loading indicator for Suspense boundaries.
 * Shows nothing for fast loads (<150ms), then a subtle branded
 * indicator — never a skeleton that causes layout shift.
 */
export function PageTransitionFallback() {
  const [phase, setPhase] = useState<'hidden' | 'bar' | 'logo'>('hidden');

  useEffect(() => {
    // Show progress bar quickly (150ms)
    const barTimer = setTimeout(() => setPhase('bar'), 150);
    // If still loading after 800ms, show logo
    const logoTimer = setTimeout(() => setPhase('logo'), 800);
    return () => {
      clearTimeout(barTimer);
      clearTimeout(logoTimer);
    };
  }, []);

  if (phase === 'hidden') {
    // Invisible placeholder prevents layout jump
    return <div className="min-h-[200px]" />;
  }

  if (phase === 'bar') {
    return (
      <div className="min-h-[200px] relative">
        {/* Thin animated bar at top of content area */}
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-full">
          <div className="h-full w-1/3 bg-primary/60 rounded-full animate-slide-bar" />
        </div>
      </div>
    );
  }

  // 'logo' phase — show centered logo for longer loads
  return (
    <div className="min-h-[300px] flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/favicon.svg"
          alt=""
          className="h-10 w-10 animate-logo-breathe"
          aria-hidden="true"
        />
        <div className="w-24 h-0.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 bg-primary/60 rounded-full animate-slide-bar" />
        </div>
      </div>
    </div>
  );
}
