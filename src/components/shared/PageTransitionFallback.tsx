import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function PageTransitionFallback() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
    </div>
  );
}
