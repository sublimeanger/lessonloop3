import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, Music, Briefcase } from 'lucide-react';

interface TeacherLinkProps {
  teacherId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline clickable element for teacher names.
 * Opens a lightweight read-only teacher info sheet on click.
 */
export function TeacherLink({ teacherId, children, className }: TeacherLinkProps) {
  const [open, setOpen] = useState(false);

  if (!teacherId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn(
          'text-primary/80 hover:text-primary hover:underline decoration-primary/30 cursor-pointer transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
          'inline-flex items-center min-h-[44px] sm:min-h-0 text-left',
          className,
        )}
      >
        {children}
      </button>
      {open && (
        <TeacherPeekSheet teacherId={teacherId} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

function TeacherPeekSheet({ teacherId, open, onOpenChange }: { teacherId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { currentOrg } = useOrg();

  const { data: teacher } = useQuery({
    queryKey: ['teacher-peek', teacherId, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, display_name, email, phone, instruments, employment_type, bio, status')
        .eq('id', teacherId)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!currentOrg?.id,
    staleTime: STALE_STABLE,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{teacher?.display_name || 'Teacher'}</SheetTitle>
        </SheetHeader>
        {teacher && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={teacher.status === 'active' ? 'default' : 'secondary'}>
                {teacher.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {teacher.employment_type}
              </Badge>
            </div>

            {teacher.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${teacher.email}`} className="text-primary hover:underline truncate">
                  {teacher.email}
                </a>
              </div>
            )}

            {teacher.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${teacher.phone}`} className="text-primary hover:underline">
                  {teacher.phone}
                </a>
              </div>
            )}

            {teacher.instruments && teacher.instruments.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{teacher.instruments.join(', ')}</span>
              </div>
            )}

            {teacher.bio && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">{teacher.bio}</div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
