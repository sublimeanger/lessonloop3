import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  MapPin, Clock, AlertTriangle, Building2, DoorOpen,
  CalendarDays, Users, Eye, Layers,
  Calendar, Receipt, Sparkles, ArrowRight, ChevronRight,
  Check, X,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "Can I manage multiple teaching locations?", answer: "Yes. Create as many locations as you need, each with their own address, rooms, availability, and closure dates." },
  { question: "Can I assign teachers to specific locations?", answer: "Absolutely. Teachers can be assigned to one or more locations. Their availability is set per location." },
  { question: "Do rooms have their own availability?", answer: "Yes. Each room within a location can have its own availability windows and capacity. The scheduler respects room availability." },
  { question: "Can I set closure dates per location?", answer: "Yes. Set location-specific closure dates (e.g., building maintenance) or organisation-wide closures (e.g., bank holidays)." },
  { question: "Can I see utilisation per location?", answer: "Yes. Utilisation reports show how much each location and room is being used, helping you optimise space." },
];

/* ─── Hero: Location Map Mockup ─── */
const LOCATIONS = [
  {
    name: "Main Studio",
    address: "14 High Street, Richmond TW9",
    rooms: [
      { name: "Room 1 — Grand Piano", capacity: 1, utilisation: 87 },
      { name: "Room 2 — Upright", capacity: 1, utilisation: 72 },
      { name: "Room 3 — Ensemble", capacity: 8, utilisation: 54 },
    ],
    teachers: 4,
    status: "open" as const,
  },
  {
    name: "Westfield Centre",
    address: "Unit 12, Westfield Shopping Centre W12",
    rooms: [
      { name: "Studio A", capacity: 1, utilisation: 91 },
      { name: "Studio B", capacity: 1, utilisation: 68 },
    ],
    teachers: 2,
    status: "open" as const,
  },
  {
    name: "St Mary's School",
    address: "Church Lane, Twickenham TW1",
    rooms: [
      { name: "Music Room", capacity: 15, utilisation: 45 },
    ],
    teachers: 1,
    status: "closure" as const,
    closureNote: "Half-term: 17–21 Feb",
  },
];

function HeroLocationMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Locations</h3>
            <p className="text-xs text-muted-foreground">3 venues · 6 rooms · 7 teachers</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"
          >
            <MapPin className="w-3 h-3" /> Add location
          </motion.div>
        </div>

        {/* Location cards */}
        {LOCATIONS.map((loc, i) => (
          <motion.div
            key={loc.name}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.18, duration: 0.4 }}
            className="px-5 py-4 border-b border-border/20 last:border-0"
          >
            {/* Location header */}
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-bold text-foreground truncate">{loc.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-6">{loc.address}</p>
              </div>
              {loc.status === "open" ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--emerald)/0.12)] text-[hsl(var(--emerald))] flex-shrink-0">
                  Open
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--coral)/0.12)] text-[hsl(var(--coral))] flex-shrink-0">
                  Closure
                </span>
              )}
            </div>

            {/* Closure note */}
            {loc.closureNote && (
              <div className="ml-6 mb-2 text-[10px] text-[hsl(var(--coral))] bg-[hsl(var(--coral)/0.06)] px-2 py-1 rounded-md inline-block">
                {loc.closureNote}
              </div>
            )}

            {/* Rooms */}
            <div className="ml-6 space-y-1.5">
              {loc.rooms.map((room) => (
                <div key={room.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <DoorOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-[11px] text-foreground truncate">{room.name}</span>
                    <span className="text-[9px] text-muted-foreground flex-shrink-0">Cap: {room.capacity}</span>
                  </div>
                  {/* Utilisation bar */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          room.utilisation >= 80 ? "bg-[hsl(var(--emerald))]" :
                          room.utilisation >= 50 ? "bg-primary" :
                          "bg-[hsl(var(--coral)/0.6)]"
                        }`}
                        style={{ width: `${room.utilisation}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground w-7 text-right">{room.utilisation}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Teacher count */}
            <div className="ml-6 mt-2 flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{loc.teachers} teacher{loc.teachers !== 1 ? "s" : ""} assigned</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg"
      >
        No double-bookings
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
        className="absolute bottom-12 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-[hsl(var(--violet-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Layers className="w-3 h-3" /> Utilisation tracked
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: Building2, title: "Multiple locations", description: "Add as many teaching venues as you need. Each has its own address, contact details, and settings.", accent: "teal" },
  { icon: DoorOpen, title: "Room management", description: "Create rooms within each location. Set capacity, availability windows, and equipment lists.", accent: "violet" },
  { icon: CalendarDays, title: "Location-specific closures", description: "Set closure dates per location or across the whole organisation. Lessons skip closures automatically.", accent: "coral" },
  { icon: Users, title: "Teacher assignment", description: "Assign teachers to locations. Their availability is scoped to the locations where they teach.", accent: "emerald" },
  { icon: Eye, title: "Cross-location visibility", description: "Admins see all locations in one calendar view. Filter by venue, room, or teacher.", accent: "teal" },
  { icon: Layers, title: "Utilisation tracking", description: "See how much each room and location is used. Identify spare capacity or bottlenecks.", accent: "violet" },
] as const;

const ACCENT_STYLES: Record<string, string> = {
  teal: "border-l-[hsl(var(--teal))] bg-[hsl(var(--teal)/0.04)]",
  violet: "border-l-[hsl(var(--violet))] bg-[hsl(var(--violet)/0.04)]",
  coral: "border-l-[hsl(var(--coral))] bg-[hsl(var(--coral)/0.04)]",
  emerald: "border-l-[hsl(var(--emerald))] bg-[hsl(var(--emerald)/0.04)]",
};

const ICON_STYLES: Record<string, string> = {
  teal: "text-[hsl(var(--teal))]",
  violet: "text-[hsl(var(--violet))]",
  coral: "text-[hsl(var(--coral))]",
  emerald: "text-[hsl(var(--emerald))]",
};

/* ─── Utilisation comparison ─── */
const UTILISATION_DATA = [
  { room: "Room 1 — Grand Piano", location: "Main Studio", mon: 100, tue: 80, wed: 100, thu: 60, fri: 100, avg: 87 },
  { room: "Studio A", location: "Westfield", mon: 100, tue: 100, wed: 80, thu: 100, fri: 80, avg: 91 },
  { room: "Room 3 — Ensemble", location: "Main Studio", mon: 40, tue: 60, wed: 80, thu: 40, fri: 60, avg: 54 },
  { room: "Music Room", location: "St Mary's", mon: 60, tue: 40, wed: 60, thu: 20, fri: 40, avg: 45 },
];

const DAYS_HEADER = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function UtilisationHeatmap() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/40">
        <h3 className="text-sm font-bold text-foreground">Room Utilisation Heatmap</h3>
        <p className="text-[10px] text-muted-foreground">This week · All locations</p>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(5,36px)_44px] gap-1 px-5 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        <span>Room</span>
        {DAYS_HEADER.map((d) => <span key={d} className="text-center">{d}</span>)}
        <span className="text-right">Avg</span>
      </div>

      {/* Rows */}
      {UTILISATION_DATA.map((row, i) => (
        <motion.div
          key={row.room}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.08 }}
          className="grid grid-cols-[1fr_repeat(5,36px)_44px] gap-1 px-5 py-2 border-t border-border/15 items-center"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">{row.room}</p>
            <p className="text-[9px] text-muted-foreground">{row.location}</p>
          </div>
          {[row.mon, row.tue, row.wed, row.thu, row.fri].map((val, d) => (
            <div
              key={d}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold mx-auto ${
                val >= 90 ? "bg-[hsl(var(--emerald))] text-white" :
                val >= 70 ? "bg-[hsl(var(--emerald)/0.3)] text-[hsl(var(--emerald))]" :
                val >= 50 ? "bg-[hsl(var(--teal)/0.15)] text-[hsl(var(--teal))]" :
                "bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]"
              }`}
            >
              {val}
            </div>
          ))}
          <span className={`text-[11px] font-bold text-right ${row.avg >= 70 ? "text-[hsl(var(--emerald))]" : "text-[hsl(var(--coral))]"}`}>
            {row.avg}%
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Steps ─── */
const STEPS = [
  { num: "01", title: "Add locations", description: "Create each teaching venue with its address and details. Add rooms within each location.", icon: Building2 },
  { num: "02", title: "Set availability & closures", description: "Define when each room is available and set closure dates for holidays or maintenance.", icon: CalendarDays },
  { num: "03", title: "Schedule with confidence", description: "The calendar respects room availability and prevents clashes. Lessons skip closures automatically.", icon: Calendar },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Calendar, title: "Scheduling", description: "Rooms and locations feed directly into the calendar. No double-bookings, no manual checks.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Receipt, title: "Reports", description: "Utilisation reports show how each location and room is performing across the term.", to: "/features/reports", linkText: "Explore reporting features" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which rooms have availability, or find the best location for a new lesson.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureLocations() {
  usePageMeta(
    "Location & Room Management for Music Schools | LessonLoop",
    "Manage multiple teaching locations and rooms. Set availability, closure dates, and room capacity — all connected to your schedule. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/locations",
      ogTitle: "Location & Room Management for Music Schools | LessonLoop",
      ogDescription: "Multi-location management with rooms, availability, closure dates, and utilisation tracking for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/locations",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Location & Room Management"
        description="Multi-location and room management for music schools — availability, closure dates, capacity, and utilisation."
        canonical="https://lessonloop.co.uk/features/locations"
        breadcrumbName="Locations"
        faqs={faqs}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-24 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", y: bgY }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">Locations & Rooms</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Multiple locations,{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                  one platform
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Manage every teaching venue, room, and availability window in one place. Closure dates, room capacity, and teacher assignments — all connected to your calendar.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/features"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-secondary transition-colors"
                >
                  All features
                </Link>
              </div>
            </motion.div>

            {/* Right: location mockup */}
            <div className="relative">
              <HeroLocationMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section className="relative bg-[hsl(var(--ink))] py-20 lg:py-28 overflow-hidden">
        <motion.div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--coral))] mb-4">The Problem</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Growing locations means growing <span className="text-[hsl(var(--coral))]">complexity</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              More venues, more rooms, more scheduling clashes. Without structure, expansion becomes chaos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Room double-bookings", description: "Two teachers scheduled in the same room at the same time. It happens more than you'd like." },
              { icon: Clock, title: "Closure dates are manual", description: "One venue closed for maintenance, another open as normal. Tracking which closures apply where is error-prone." },
              { icon: Building2, title: "No overview across locations", description: "You can't see what's happening at each venue without checking multiple spreadsheets or calendars." },
            ].map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="group p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--coral)/0.15)] flex items-center justify-center mb-4">
                  <pain.icon className="w-5 h-5 text-[hsl(var(--coral))]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{pain.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{pain.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES ═══ */}
      <section ref={parallaxRef} className="relative bg-background py-20 lg:py-28 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Locations and rooms built into the <span className="text-primary">scheduler</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Every location, room, and availability window is connected to the calendar. The system prevents conflicts automatically.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className={`p-6 rounded-2xl border-l-4 ${ACCENT_STYLES[cap.accent]} border border-border/30 hover:shadow-lg transition-shadow duration-300`}
              >
                <cap.icon className={`w-6 h-6 mb-3 ${ICON_STYLES[cap.accent]}`} />
                <h3 className="font-bold text-foreground mb-2">{cap.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ UTILISATION HEATMAP ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--emerald))]">Utilisation</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                See where your rooms are <span className="text-[hsl(var(--emerald))]">busy and where they're free</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A colour-coded heatmap shows utilisation across every room and day. Spot spare capacity, identify bottlenecks, and optimise your timetable.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  Explore reporting features <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/scheduling" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  See how scheduling uses rooms <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Right: heatmap */}
            <UtilisationHeatmap />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Locations set up in <span className="text-primary">minutes</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative text-center"
              >
                <span className="text-[80px] font-black text-foreground/[0.04] leading-none absolute -top-4 left-1/2 -translate-x-1/2 select-none pointer-events-none">
                  {step.num}
                </span>
                <div className="relative z-10 space-y-4 pt-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-16 -right-4 z-10">
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RELATED FEATURES ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Works hand-in-hand with</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {RELATED.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
              >
                <Link
                  to={r.to}
                  className="block p-6 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full"
                >
                  <r.icon className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-bold text-foreground mb-2">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.description}</p>
                  <span className="text-sm font-semibold text-primary inline-flex items-center gap-1">
                    {r.linkText} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group border border-border/50 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer p-5 text-foreground font-semibold hover:bg-secondary/30 transition-colors">
                  {faq.question}
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative bg-[hsl(var(--ink))] py-20 lg:py-28 overflow-hidden">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 blur-3xl"
          style={{ background: "radial-gradient(ellipse, hsl(var(--teal)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Scale to multiple locations <span className="text-[hsl(var(--teal-light))]">with ease.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Rooms, availability, closure dates, and utilisation — all managed from one platform, connected to your calendar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
            >
              View plans and pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
