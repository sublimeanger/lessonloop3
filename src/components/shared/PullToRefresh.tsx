import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { platform } from '@/lib/platform';
import { haptics } from '@/lib/native/haptics';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!platform.isNative) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY.current) * 0.5);
    setPullDistance(Math.min(distance, THRESHOLD * 1.5));
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      haptics.impact();
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, onRefresh]);

  if (!platform.isNative) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn('relative', className)}
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all"
          style={{ height: refreshing ? 40 : pullDistance }}
        >
          <Loader2 className={cn(
            'h-5 w-5 text-primary transition-opacity',
            refreshing ? 'animate-spin opacity-100' : pullDistance >= THRESHOLD ? 'opacity-100' : 'opacity-50'
          )} />
        </div>
      )}
      {children}
    </div>
  );
}
