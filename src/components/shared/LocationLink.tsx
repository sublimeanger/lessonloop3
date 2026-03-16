import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { MapPin, DoorOpen } from 'lucide-react';

interface LocationLinkProps {
  locationId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline clickable element for location names.
 * Opens a lightweight popover showing location details and rooms.
 */
export function LocationLink({ locationId, children, className }: LocationLinkProps) {
  const [open, setOpen] = useState(false);
  const { currentOrg } = useOrg();

  const { data: location } = useQuery({
    queryKey: ['location-peek', locationId, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, is_archived, rooms(id, name)')
        .eq('id', locationId!)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!locationId && !!currentOrg?.id,
    staleTime: STALE_STABLE,
  });

  if (!locationId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'text-primary/80 hover:text-primary hover:underline decoration-primary/30 cursor-pointer transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
            'inline-flex items-center min-h-[44px] sm:min-h-0 text-left',
            className,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm">{location?.name || 'Loading…'}</span>
          {location?.is_archived && (
            <Badge variant="secondary" className="text-micro">Archived</Badge>
          )}
        </div>
        {location?.address && (
          <p className="text-xs text-muted-foreground pl-6">{location.address}</p>
        )}
        {location?.rooms && location.rooms.length > 0 && (
          <div className="pl-6 space-y-1">
            <p className="text-micro font-medium text-muted-foreground">Rooms</p>
            {(location.rooms as { id: string; name: string }[]).map((room) => (
              <div key={room.id} className="flex items-center gap-1.5 text-xs text-foreground">
                <DoorOpen className="h-3 w-3 text-muted-foreground" />
                {room.name}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
