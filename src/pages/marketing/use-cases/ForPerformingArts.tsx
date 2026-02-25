import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Theater, CalendarDays, CreditCard, Users, MapPin, BarChart3,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, UserX, BookOpen,
  ArrowRight, ChevronRight, Sparkles, Music2, Drama, Palette,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/performing-arts";

const FAQS = [
  { question: "Does LessonLoop support drama, dance, and music together?", answer: "Yes. Add any instrument or discipline as a subject. Schedule drama, dance, singing, and instrumental lessons all in the same calendar." },
  { question: "Can I manage rehearsals and performances?", answer: "Schedule one-off or recurring events like rehearsals, showcases, and performances alongside regular lessons." },
  { question: "Does it handle different age groups?", answer: "Absolutely. Group students by age, level, or discipline. Schedule age-appropriate classes and bill families accordingly." },
  { question: "Is there a limit on the number of teachers?", answer: "No. Add as many teachers as you need, each with their own availability, subjects, and schedule." },
  { question: "Can parents see all their children's activities in one place?", answer: "Yes. The family portal shows every child's timetable, invoices, attendance, and messages across all disciplines." },
];

/* ─── Discipline colours ─── */
const DISC = {
  Music: { bg: "bg-[hsl(var(--teal)/0.12)]", text: "text-[hsl(var(--teal))]", dot: "bg-[hsl(var(--teal))]" },
  Drama: { bg: "bg-[hsl(var(--coral)/0.12)]", text: "text-[hsl(var(--coral))]", dot: "bg-[hsl(var(--coral))]" },
  Dance: { bg: "bg-[hsl(var(--violet)/0.12)]", text: "text-[hsl(var(--violet))]", dot: "bg-[hsl(var(--violet))]" },
  Singing: { bg: "bg-[hsl(var(--emerald)/0.12)]", text: "text-[hsl(var(--emerald))]", dot: "bg-[hsl(var(--emerald))]" },
} as const;

type Discipline = keyof typeof DISC;

/* ─── Hero Timetable Mockup ─── */
const TIMETABLE_SLOTS = [
  { time: "09:00", discipline: "Music" as Discipline, name: "Grade 3 Piano", teacher: "Mrs Chen", room: "Studio 1", students: 1 },
  { time: "09:30", discipline: "Dance" as Discipline, name: "Junior Ballet", teacher: "Miss Patel", room: "Hall A", students: 12 },
  { time: "10:00", discipline: "Drama" as Discipline, name: "LAMDA Acting", teacher: "Mr Hughes", room: "Black Box", students: 6 },
  { time: "10:30", discipline: "Singing" as Discipline, name: "Musical Theatre", teacher: "Miss Lloyd", room: "Hall A", students: 8 },
  { time: "11:00", discipline: "Music" as Discipline, name: "Violin Ensemble", teacher: "Mrs Chen", room: "Studio 2", students: 5 },
];

function HeroTimetable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Saturday Timetable</h3>
            <p className="text-[10px] text-muted-foreground">Riverside Performing Arts · 5 classes</p>
          </div>
          <div className="flex gap-1">
            {(Object.keys(DISC) as Discipline[]).map(d => (
              <span key={d} className={`w-2 h-2 rounded-full ${DISC[d].dot}`} />
            ))}
          </div>
        </div>

        {/* Slots */}
        {TIMETABLE_SLOTS.map((slot, i) => {
          const dc = DISC[slot.discipline];
          return (
            <motion.div
              key={slot.time}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.35 }}
              className="px-5 py-3 border-b border-border/15 last:border-0 flex items-center gap-3"
            >
              {/* Time */}
              <span className="text-[10px] font-mono font-bold text-muted-foreground w-10 flex-shrink-0">{slot.time}</span>

              {/* Colour bar */}
              <div className={`w-1 h-8 rounded-full ${dc.dot} flex-shrink-0`} />

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-foreground truncate">{slot.name}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${dc.bg} ${dc.text}`}>{slot.discipline}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">
                  {slot.teacher} · {slot.room} · {slot.students === 1 ? "1-to-1" : `${slot.students} students`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-white text-xs font-bold shadow-lg"
      >
        4 disciplines
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute bottom-12 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <MapPin className="w-3 h-3" /> 3 rooms
      </motion.div>
    </motion.div>
  );
}

/* ─── Family Portal Mockup ─── */
const FAMILY_CHILDREN = [
  { name: "Olivia", disciplines: ["Ballet", "Piano"], nextClass: "Ballet — Sat 09:30", invoiceStatus: "Paid" },
  { name: "George", disciplines: ["Drama", "Singing"], nextClass: "LAMDA — Sat 10:00", invoiceStatus: "Due" },
];

function FamilyPortalMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/40">
        <h3 className="text-sm font-bold text-foreground">Family Portal</h3>
        <p className="text-[10px] text-muted-foreground">The Thompson Family · 2 children</p>
      </div>

      {FAMILY_CHILDREN.map((child, i) => (
        <motion.div
          key={child.name}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15 }}
          className="px-5 py-4 border-b border-border/15 last:border-0"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {child.name.charAt(0)}
              </div>
              <span className="text-[11px] font-bold text-foreground">{child.name}</span>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${child.invoiceStatus === "Paid" ? "bg-[hsl(var(--emerald)/0.1)] text-[hsl(var(--emerald))]" : "bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]"}`}>
              {child.invoiceStatus}
            </span>
          </div>
          <div className="ml-9 space-y-1">
            <div className="flex flex-wrap gap-1">
              {child.disciplines.map(d => (
                <span key={d} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{d}</span>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground">Next: {child.nextClass}</p>
          </div>
        </motion.div>
      ))}

      <div className="px-5 py-3 bg-secondary/30 flex justify-between items-center">
        <span className="text-[9px] text-muted-foreground">View all schedules & invoices</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

/* ─── Features ─── */
const FEATURES = [
  { icon: CalendarDays, title: "Multi-discipline scheduling", description: "Music, drama, dance, and singing in one calendar. Automatic conflict detection across disciplines and rooms.", to: "/features/scheduling", linkText: "Explore scheduling features", accent: "teal" },
  { icon: CreditCard, title: "Unified family billing", description: "One invoice per family covering all disciplines. Termly, monthly, or custom billing with GBP and VAT.", to: "/features/billing", linkText: "See invoicing and billing", accent: "coral" },
  { icon: Users, title: "Family portal", description: "Parents see every child's timetable, pay invoices, and message teachers — all disciplines in one login.", to: "/features/parent-portal", linkText: "View the family portal", accent: "violet" },
  { icon: MapPin, title: "Venue & room management", description: "Studios, halls, rehearsal rooms — each with capacity, equipment, and availability. No double-bookings.", to: "/features/locations", linkText: "Manage locations", accent: "emerald" },
  { icon: BookOpen, title: "Cross-discipline attendance", description: "Unified registers for every class type. Spot patterns, send absence notifications, track engagement.", to: "/features/attendance", linkText: "See attendance tracking", accent: "teal" },
  { icon: BarChart3, title: "Department reports", description: "Revenue by discipline, attendance by department, teacher utilisation — data across your whole school.", to: "/features/reports", linkText: "Explore reports", accent: "violet" },
] as const;

const ACCENT_BORDER: Record<string, string> = {
  teal: "border-l-[hsl(var(--teal))] bg-[hsl(var(--teal)/0.04)]",
  violet: "border-l-[hsl(var(--violet))] bg-[hsl(var(--violet)/0.04)]",
  coral: "border-l-[hsl(var(--coral))] bg-[hsl(var(--coral)/0.04)]",
  emerald: "border-l-[hsl(var(--emerald))] bg-[hsl(var(--emerald)/0.04)]",
};
const ACCENT_ICON: Record<string, string> = {
  teal: "text-[hsl(var(--teal))]",
  violet: "text-[hsl(var(--violet))]",
  coral: "text-[hsl(var(--coral))]",
  emerald: "text-[hsl(var(--emerald))]",
};

/* ═══════════════════ PAGE ═══════════════════ */
export default function ForPerformingArts() {
  usePageMeta(
    "Performing Arts School Software | LessonLoop",
    "Manage drama, dance, and music classes in one platform. Scheduling, billing, attendance, and parent portals for UK performing arts schools. Free trial.",
    {
      ogTitle: "Performing Arts School Software | LessonLoop",
      ogDescription: "LessonLoop helps performing arts schools schedule classes, manage billing, and communicate with families — all in one place.",
      ogType: "website",
      ogUrl: CANONICAL,
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      canonical: CANONICAL,
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <UseCaseSchema
        name="Performing Arts School Software"
        description="Scheduling, billing, attendance, and parent communication for performing arts schools covering music, drama, and dance."
        canonical={CANONICAL}
        breadcrumbName="Performing Arts"
        faqs={FAQS}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-12 -left-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--violet)/0.1)] border border-[hsl(var(--violet)/0.2)]">
                <Theater className="w-4 h-4 text-[hsl(var(--violet))]" />
                <span className="text-sm font-semibold text-[hsl(var(--violet))] tracking-wide">For Performing Arts Schools</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Every discipline,{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--violet))] via-[hsl(var(--coral))] to-[hsl(var(--teal))] bg-clip-text text-transparent">
                  one stage
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Music, drama, dance, and singing — schedule them all, bill families once, and keep everyone in the loop with a unified portal. Built for UK performing arts schools.
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

            <div className="relative">
              <HeroTimetable />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section className="relative bg-[hsl(var(--ink))] py-20 lg:py-28 overflow-hidden">
        <motion.div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))] mb-4">The Problem</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Multi-discipline schools need{" "}
              <span className="text-[hsl(var(--violet))]">multi-discipline tools</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Generic lesson software wasn't built for schools that run four disciplines from the same building.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Cross-discipline clashes", description: "A student in piano and drama can't be in two rooms at once. Manual timetabling misses conflicts." },
              { icon: Clock, title: "Complex billing", description: "Different rates for different disciplines, group sizes, and term lengths. Invoicing takes days." },
              { icon: FileSpreadsheet, title: "Fragmented registers", description: "Attendance tracked differently for each department. No unified view of student engagement." },
              { icon: Repeat, title: "Rehearsal scheduling", description: "One-off rehearsals and performances don't fit into weekly recurring lesson patterns." },
              { icon: UserX, title: "Staff coordination", description: "Drama teachers, dance instructors, and music tutors all need different schedules and room access." },
              { icon: MapPin, title: "Venue management", description: "Studios, rehearsal rooms, and performance halls each with their own availability and equipment." },
            ].map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--violet)/0.15)] flex items-center justify-center mb-4">
                  <pain.icon className="w-5 h-5 text-[hsl(var(--violet))]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{pain.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{pain.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Purpose-Built</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Built for performing arts <span className="text-primary">schools</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether it's a Saturday school or a full-time academy, LessonLoop adapts to your structure.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className={`p-6 rounded-2xl border-l-4 ${ACCENT_BORDER[feat.accent]} border border-border/30 hover:shadow-lg transition-shadow duration-300`}
              >
                <feat.icon className={`w-6 h-6 mb-3 ${ACCENT_ICON[feat.accent]}`} />
                <h3 className="font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{feat.description}</p>
                <Link to={feat.to} className={`text-sm font-semibold ${ACCENT_ICON[feat.accent]} inline-flex items-center gap-1 hover:underline`}>
                  {feat.linkText} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAMILY PORTAL ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--coral))]">Family Portal</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                One login for{" "}
                <span className="text-[hsl(var(--coral))]">every child, every discipline</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Parents see Olivia's ballet and piano alongside George's drama and singing. One place for timetables, invoices, and messages — no more juggling four different systems.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/parent-portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--coral))] hover:underline">
                  Explore the family portal <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/billing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--coral))] hover:underline">
                  See invoicing and billing <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <FamilyPortalMockup />
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ═══ */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-8 sm:p-12 rounded-3xl border border-border/50 bg-card shadow-md text-center"
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[hsl(var(--violet))] flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">"</span>
            </div>
            <blockquote className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
              We offer piano, violin, drama, and ballet. Before LessonLoop, we had four separate systems. Now it's all in one place and parents couldn't be happier.
            </blockquote>
            <div>
              <p className="font-bold text-foreground">Rachel W.</p>
              <p className="text-sm text-muted-foreground">Performing Arts Director, Birmingham</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARE STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Switching from another platform?</h2>
            <p className="text-sm text-muted-foreground mt-2">See how LessonLoop compares for performing arts schools</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
              { label: "vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
              { label: "vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
              { label: "vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
            ].map((comp) => (
              <Link
                key={comp.to}
                to={comp.to}
                className="px-5 py-2.5 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:bg-secondary hover:-translate-y-0.5 transition-all shadow-sm"
              >
                {comp.label} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq, i) => (
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Give your performing arts school{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--violet))] to-[hsl(var(--teal))] bg-clip-text text-transparent">centre stage software.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Music, drama, dance — one platform to schedule, bill, and engage families across every discipline.
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
