import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Sparkles, ChevronDown, Building2, Check } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import { Logo, LogoWordmark } from '@/components/brand/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function Header() {
  const { currentOrg, organisations, setCurrentOrg } = useOrg();
  const { setIsOpen } = useLoopAssistUI();
  const { totalActionable, hasCritical } = useProactiveAlerts();
  const hasMultipleOrgs = organisations.length > 1;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <LogoWordmark className="hidden sm:inline-flex" />
        </div>
        
        {/* Org Selector */}
        {currentOrg && (
          <>
            <span className="text-muted-foreground">/</span>
            {hasMultipleOrgs ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 font-medium">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentOrg.name}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Switch Organisation</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {organisations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => setCurrentOrg(org.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{org.name}</span>
                      </div>
                      {org.id === currentOrg.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">{currentOrg.name}</span>
              </div>
            )}
          </>
        )}
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        className={cn(
          "gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary relative",
          hasCritical && "border-destructive/50 hover:border-destructive"
        )}
        onClick={() => setIsOpen(true)}
        title="LoopAssist (Space or Cmd+J)"
        data-tour="loopassist-button"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">LoopAssist</span>
        
        {/* Alert badge */}
        {totalActionable > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-destructive-foreground",
              hasCritical ? "bg-destructive" : "bg-warning"
            )}
          >
            {totalActionable > 9 ? '9+' : totalActionable}
          </span>
        )}
      </Button>
    </header>
  );
}
