import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Calendar,
  CreditCard,
  GraduationCap,
  Users,
  ClipboardCheck,
  Home as HomeIcon,
  MessageSquare,
  Music,
  FolderOpen,
  BarChart3,
  MapPin,
  Sparkles,
  Building2,
  User,
  Guitar,
  Piano,
  Theater,
  ArrowRight,
  Flag,
} from "lucide-react";
import { LogoHorizontal } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Navigation Data ──────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  desc: string;
}

interface NavColumn {
  label: string;
  items: NavItem[];
}

const featureColumns: NavColumn[] = [
  {
    label: "Core",
    items: [
      { name: "Scheduling", href: "/features/scheduling", icon: Calendar, desc: "Lessons, terms & timetables" },
      { name: "Billing", href: "/features/billing", icon: CreditCard, desc: "Invoices & online payments" },
      { name: "Students", href: "/features/students", icon: GraduationCap, desc: "Profiles & progress tracking" },
      { name: "Teachers", href: "/features/teachers", icon: Users, desc: "Staff management & payroll" },
      { name: "Attendance", href: "/features/attendance", icon: ClipboardCheck, desc: "Registers & make-ups" },
    ],
  },
  {
    label: "Engage",
    items: [
      { name: "Parent Portal", href: "/features/parent-portal", icon: HomeIcon, desc: "Self-serve for families" },
      { name: "Messaging", href: "/features/messaging", icon: MessageSquare, desc: "In-app communication" },
      { name: "Practice Tracking", href: "/features/practice-tracking", icon: Music, desc: "Assignments & logs" },
      { name: "Resources", href: "/features/resources", icon: FolderOpen, desc: "Sheet music & files" },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Reports", href: "/features/reports", icon: BarChart3, desc: "Revenue & analytics" },
      { name: "Locations", href: "/features/locations", icon: MapPin, desc: "Multi-venue management" },
      { name: "LoopAssist AI", href: "/features/loopassist", icon: Sparkles, desc: "AI-powered assistant" },
    ],
  },
];

const useCaseItems: NavItem[] = [
  { name: "Music Academies", href: "/for/music-academies", icon: Building2, desc: "Multi-teacher schools" },
  { name: "Solo Teachers", href: "/for/solo-teachers", icon: User, desc: "Independent educators" },
  { name: "Piano Schools", href: "/for/piano-schools", icon: Piano, desc: "Keyboard-focused studios" },
  { name: "Guitar Schools", href: "/for/guitar-schools", icon: Guitar, desc: "String instrument studios" },
  { name: "Performing Arts", href: "/for/performing-arts", icon: Theater, desc: "Dance, drama & more" },
];

interface CompareItem {
  name: string;
  href: string;
}

const compareItems: CompareItem[] = [
  { name: "vs My Music Staff", href: "/compare/lessonloop-vs-my-music-staff" },
  { name: "vs Teachworks", href: "/compare/lessonloop-vs-teachworks" },
  { name: "vs Opus 1", href: "/compare/lessonloop-vs-opus1" },
  { name: "vs Jackrabbit Music", href: "/compare/lessonloop-vs-jackrabbit-music" },
  { name: "vs Fons", href: "/compare/lessonloop-vs-fons" },
];

const directLinks = [
  { name: "Pricing", href: "/pricing" },
  { name: "Blog", href: "/blog" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

// ─── Shared Sub-components ────────────────────────────────

function MegaMenuItem({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavigationMenuLink asChild>
      <Link
        to={item.href}
        onClick={onClick}
        className="group/item flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/item:bg-primary/10 group-hover/item:text-primary">
          <item.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{item.desc}</div>
        </div>
      </Link>
    </NavigationMenuLink>
  );
}

// ─── Mobile Accordion Section ─────────────────────────────

function MobileAccordionSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-4 text-lg font-medium text-foreground"
      >
        {title}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 opacity-40" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-3 pl-4 pr-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavItem({
  item,
  onClick,
}: {
  item: NavItem;
  onClick: () => void;
}) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <item.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{item.name}</span>
    </Link>
  );
}

// ─── Main Navbar ──────────────────────────────────────────

export function MarketingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const location = useLocation();
  const { user, isInitialised, isParent } = useAuth();
  const isLoggedIn = isInitialised && !!user;
  const dashboardHref = isParent ? "/portal/home" : "/dashboard";

  const isFeaturesActive = location.pathname.startsWith("/features");
  const isSolutionsActive =
    location.pathname.startsWith("/for/") || location.pathname.startsWith("/compare/");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenMobileSection(null);
  }, [location.pathname]);

  const toggleMobileSection = (section: string) => {
    setOpenMobileSection((prev) => (prev === section ? null : section));
  };

  const closeMobile = () => setIsMobileMenuOpen(false);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          "bg-background/95 backdrop-blur-xl border-b border-border/50",
          isScrolled && "shadow-sm"
        )}
      >
        <div className="container mx-auto px-6 lg:px-8">
          <nav className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="relative z-10 shrink-0">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <LogoHorizontal size="lg" />
              </motion.div>
            </Link>

            {/* ─── Desktop Navigation ─── */}
            <NavigationMenu className="hidden lg:flex">
              <NavigationMenuList>
                {/* Features Mega Menu */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={cn(
                      "relative bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground",
                      isFeaturesActive && "text-foreground"
                    )}
                  >
                    Features
                    {isFeaturesActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[680px] p-5">
                      <div className="grid grid-cols-3 gap-x-6">
                        {featureColumns.map((col) => (
                          <div key={col.label}>
                            <div className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                              {col.label}
                            </div>
                            <div className="space-y-0.5">
                              {col.items.map((item) => (
                                <MegaMenuItem key={item.href} item={item} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t pt-3">
                        <NavigationMenuLink asChild>
                          <Link
                            to="/features"
                            className="inline-flex items-center gap-1.5 px-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                          >
                            Explore all features
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </NavigationMenuLink>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Solutions Mega Menu */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className={cn(
                      "relative bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground",
                      isSolutionsActive && "text-foreground"
                    )}
                  >
                    Solutions
                    {isSolutionsActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[520px] p-5">
                      <div className="grid grid-cols-2 gap-x-6">
                        {/* Use Cases */}
                        <div>
                          <div className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                            Who it's for
                          </div>
                          <div className="space-y-0.5">
                            {useCaseItems.map((item) => (
                              <MegaMenuItem key={item.href} item={item} />
                            ))}
                          </div>
                          <div className="mt-3 border-t pt-3">
                            <NavigationMenuLink asChild>
                              <Link
                                to="/uk"
                                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <Flag className="h-4 w-4 text-muted-foreground" />
                                Built for the UK
                              </Link>
                            </NavigationMenuLink>
                          </div>
                        </div>

                        {/* Compare */}
                        <div>
                          <div className="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                            Compare
                          </div>
                          <div className="space-y-0.5">
                            {compareItems.map((item) => (
                              <NavigationMenuLink key={item.href} asChild>
                                <Link
                                  to={item.href}
                                  className="flex items-center justify-between rounded-lg px-2.5 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  {item.name}
                                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                                </Link>
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Direct Links */}
                {directLinks.map((link) => (
                  <NavigationMenuItem key={link.name}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={link.href}
                        className={cn(
                          "relative inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                          "text-foreground/70 hover:text-foreground",
                          location.pathname === link.href && "text-foreground"
                        )}
                      >
                        {link.name}
                        {location.pathname === link.href && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                        )}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>

            {/* ─── Desktop CTAs ─── */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              {isLoggedIn ? (
                <Link to={dashboardHref}>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button className="font-semibold px-6 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </motion.div>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="font-medium text-foreground hover:bg-accent">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button className="font-semibold px-6 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25">
                        Start free
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </motion.div>
                  </Link>
                </>
              )}
            </div>

            {/* ─── Mobile Menu Button ─── */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden relative z-10 p-2.5 rounded-xl transition-colors text-foreground hover:bg-accent"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </nav>
        </div>
      </motion.header>

      {/* ─── Mobile Menu ─── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
              onClick={closeMobile}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[24rem] bg-background shadow-2xl"
            >
              <div className="flex flex-col h-full pt-24 pb-8 px-2 overflow-y-auto">
                <nav className="flex-1 space-y-0.5">
                  {/* Features Accordion */}
                  <MobileAccordionSection
                    title="Features"
                    isOpen={openMobileSection === "features"}
                    onToggle={() => toggleMobileSection("features")}
                  >
                    {featureColumns.map((col) => (
                      <div key={col.label} className="mb-3">
                        <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {col.label}
                        </div>
                        {col.items.map((item) => (
                          <MobileNavItem key={item.href} item={item} onClick={closeMobile} />
                        ))}
                      </div>
                    ))}
                    <Link
                      to="/features"
                      onClick={closeMobile}
                      className="mt-1 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary"
                    >
                      All features
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </MobileAccordionSection>

                  {/* Solutions Accordion */}
                  <MobileAccordionSection
                    title="Solutions"
                    isOpen={openMobileSection === "solutions"}
                    onToggle={() => toggleMobileSection("solutions")}
                  >
                    <div className="mb-3">
                      <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Who it's for
                      </div>
                      {useCaseItems.map((item) => (
                        <MobileNavItem key={item.href} item={item} onClick={closeMobile} />
                      ))}
                      <Link
                        to="/uk"
                        onClick={closeMobile}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
                      >
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Built for the UK</span>
                      </Link>
                    </div>
                    <div>
                      <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Compare
                      </div>
                      {compareItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={closeMobile}
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {item.name}
                          <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                        </Link>
                      ))}
                    </div>
                  </MobileAccordionSection>

                  {/* Direct Links */}
                  {directLinks.map((link, index) => (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={link.href}
                        onClick={closeMobile}
                        className={cn(
                          "flex items-center justify-between px-4 py-4 text-lg font-medium rounded-xl transition-colors",
                          location.pathname === link.href
                            ? "text-primary bg-primary/10"
                            : "text-foreground hover:bg-accent"
                        )}
                      >
                        {link.name}
                        <ChevronRight className="w-5 h-5 opacity-40" />
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3 pt-6 mx-2 border-t border-border"
                >
                  {isLoggedIn ? (
                    <Link to={dashboardHref} onClick={closeMobile} className="block">
                      <Button className="w-full h-12 font-semibold shadow-lg shadow-primary/25">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" onClick={closeMobile} className="block">
                        <Button variant="outline" className="w-full h-12 font-medium">
                          Sign in
                        </Button>
                      </Link>
                      <Link to="/signup" onClick={closeMobile} className="block">
                        <Button className="w-full h-12 font-semibold shadow-lg shadow-primary/25">
                          Start free trial
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
