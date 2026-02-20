import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Sparkles, ChevronDown, Check } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import { Logo, LogoWordmark } from '@/components/brand/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function Header() {
  const { currentOrg, organisations, setCurrentOrg } = useOrg();
  const { setIsOpen } = useLoopAssistUI();
  const { totalActionable, hasCritical } = useProactiveAlerts();
  const hasMultipleOrgs = organisations.length > 1;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />

        {/* Brand logo */}
        <div className="flex items-center gap-2">
          <Logo size="md" />
          <LogoWordmark className="text-base hidden sm:block" />
        </div>

        {/* Org switcher — only if multiple orgs */}
        {currentOrg && hasMultipleOrgs && (
          <>
            <span className="text-border mx-1">|</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm font-medium h-8 px-2">
                  <span className="truncate max-w-[160px]">{currentOrg.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {organisations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => setCurrentOrg(org.id)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{org.name}</span>
                    {org.id === currentOrg.id && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Right side — LoopAssist */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground relative',
          hasCritical && 'text-destructive'
        )}
        onClick={() => setIsOpen(true)}
        title="LoopAssist (Space or Cmd+J)"
        data-tour="loopassist-button"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">LoopAssist</span>

        {totalActionable > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-destructive-foreground',
              hasCritical ? 'bg-destructive' : 'bg-warning'
            )}
          >
            {totalActionable > 9 ? '9+' : totalActionable}
          </span>
        )}
      </Button>
    </header>
  );
}
