import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, Music, Briefcase, FileText, ExternalLink } from 'lucide-react';
import { formatCurrencyMinor } from '@/lib/utils';

interface TeacherLinkProps {
  teacherId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline clickable element for teacher names.
 * Parent role → small popover (name, instruments, bio).
 * All other roles → role-filtered sheet.
 */
export function TeacherLink({ teacherId, children, className }: TeacherLinkProps) {
  const { currentRole } = useOrg();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!teacherId) {
    return <span className={className}>{children}</span>;
  }

  const isParent = currentRole === 'parent';

  if (isParent) {
    return (
      <TeacherParentPopover teacherId={teacherId} className={className}>
        {children}
      </TeacherParentPopover>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
        className={cn(
          'text-primary/80 hover:text-primary hover:underline decoration-primary/30 cursor-pointer transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm',
          'inline-flex items-center min-h-[44px] sm:min-h-0 text-left',
          className,
        )}
      >
        {children}
      </button>
      {sheetOpen && (
        <TeacherPeekSheet teacherId={teacherId} open={sheetOpen} onOpenChange={setSheetOpen} />
      )}
    </>
  );
}

/* ─── Parent-only popover (name, instruments, bio) ─── */

function TeacherParentPopover({ teacherId, children, className }: { teacherId: string; children: React.ReactNode; className?: string }) {
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);

  const { data: teacher } = useQuery({
    queryKey: ['teacher-peek-parent', teacherId, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, display_name, instruments, bio')
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
      <PopoverContent className="w-72 p-4" align="start" onClick={(e) => e.stopPropagation()}>
        {teacher ? (
          <div className="space-y-2">
            <p className="font-medium text-sm">{teacher.display_name}</p>
            {teacher.instruments && teacher.instruments.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Music className="h-3.5 w-3.5 shrink-0" />
                <span>{teacher.instruments.join(', ')}</span>
              </div>
            )}
            {teacher.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{teacher.bio}</p>
            )}
            {!teacher.instruments?.length && !teacher.bio && (
              <p className="text-sm text-muted-foreground">No additional info available.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Staff sheet (role-filtered) ─── */

function TeacherPeekSheet({ teacherId, open, onOpenChange }: { teacherId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { currentOrg, currentRole, isOrgAdmin } = useOrg();
  const navigate = useNavigate();

  const { data: teacher } = useQuery({
    queryKey: ['teacher-peek', teacherId, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, display_name, email, phone, instruments, employment_type, bio, status, pay_rate_type, pay_rate_value')
        .eq('id', teacherId)
        .eq('org_id', currentOrg!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!currentOrg?.id,
    staleTime: STALE_STABLE,
  });

  // Determine what to show based on role
  const isFinance = currentRole === 'finance';
  const isTeacher = currentRole === 'teacher';
  // Admin/Owner see everything
  const showContact = isOrgAdmin || isTeacher;
  const showPayRate = isOrgAdmin || isFinance;
  const showEmployment = isOrgAdmin;
  const showBio = true; // everyone can see bio
  const showFullRecord = isOrgAdmin || isFinance;

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
              {showEmployment && (
                <Badge variant="outline" className="capitalize">
                  {teacher.employment_type}
                </Badge>
              )}
            </div>

            {showContact && teacher.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${teacher.email}`} className="text-primary hover:underline truncate">
                  {teacher.email}
                </a>
              </div>
            )}

            {showContact && teacher.phone && (
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

            {showPayRate && teacher.pay_rate_type && teacher.pay_rate_value != null && (
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Pay Rate</p>
                  <p className="text-sm text-foreground">
                    {formatCurrencyMinor(Math.round((teacher.pay_rate_value ?? 0) * 100), currentOrg?.currency_code)}{' '}
                    {teacher.pay_rate_type === 'per_lesson' ? '/ lesson' : teacher.pay_rate_type === 'hourly' ? '/ hour' : '(%)'}
                  </p>
                </div>
              </div>
            )}

            {showBio && teacher.bio && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Bio</span>
                  </div>
                  {teacher.bio}
                </div>
              </>
            )}

            {showFullRecord && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 min-h-11 sm:min-h-9"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/teachers?highlight=${teacherId}`);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Full Record
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
