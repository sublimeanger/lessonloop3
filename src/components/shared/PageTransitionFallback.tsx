import { useEffect, useState } from 'react';

/**
 * A minimal, non-jarring loading indicator for Suspense boundaries.
 * Shows a thin top progress bar after a short delay — never a skeleton.
 * This prevents layout shift and avoids the "flash of skeleton" problem.
 */
export function PageTransitionFallback() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return <div className="min-h-[200px]" />;

  return (
    <div className="min-h-[200px] relative">
      {/* Thin animated bar at top of content area */}
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-full">
        <div className="h-full w-1/3 bg-primary/60 rounded-full animate-slide-bar" />
      </div>
    </div>
  );
}
