import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  UserCheck, Clock, AlertTriangle, Users, CalendarDays,
  Music, MapPin, PoundSterling, Shield, Eye, BarChart3,
  Calendar, Receipt, Sparkles, ArrowRight, ChevronRight,
  Mail, Check, X,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "Can teachers set their own availability?", answer: "Yes. Each teacher defines their weekly availability blocks by day, time, and location. Admins can view and adjust availability across the team." },
  { question: "Can I assign teachers to specific locations?", answer: "Absolutely. Teachers can be assigned to one or more locations, each with their own availability and room access." },
  { question: "Does LessonLoop track teacher pay?", answer: "Yes. Set hourly or per-lesson pay rates for each teacher. Payroll reports calculate earnings automatically from delivered lessons." },
  { question: "Can teachers see only their own schedule?", answer: "Yes. Role-based access ensures teachers see only their own students, lessons, and schedules. Admins see everything." },
  { question: "Can I invite teachers to join LessonLoop?", answer: "Yes. Send an email invite with the teacher role. They sign up, set their availability, and start seeing their schedule immediately." },
];

/* ─── Hero: Teacher Roster mockup ─── */
const TEACHERS = [
  {
    initials: "JW", name: "James Wilson", instruments: ["Piano", "Theory"],
    locations: ["Main Studio", "Westfield"], rate: "£32/hr", status: "active",
    lessonsThisWeek: 24, availability: [true, true, false, true, true, false, false],
  },
  {
    initials: "SP", name: "Sarah Patel", instruments: ["Violin", "Viola"],
    locations: ["Main Studio"], rate: "£35/hr", status: "active",
    lessonsThisWeek: 18, availability: [true, false, true, true, false, true, false],
  },
  {
    initials: "MB", name: "Marcus Brown", instruments: ["Guitar", "Bass"],
    locations: ["Westfield", "Online"], rate: "£28/hr", status: "active",
    lessonsThisWeek: 21, availability: [false, true, true, false, true, true, false],
  },
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function HeroRosterCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Teaching Team</h3>
            <p className="text-xs text-muted-foreground">3 active teachers · This week</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"
          >
            <Mail className="w-3 h-3" /> Invite teacher
          </motion.div>
        </div>

        {/* Column headers */}
        <div className="px-5 py-2.5 grid grid-cols-[1fr_100px_70px] gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/30">
          <span>Teacher</span>
          <span className="text-center">Availability</span>
          <span className="text-right">Lessons</span>
        </div>

        {/* Rows */}
        {TEACHERS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
            className="px-5 py-3.5 grid grid-cols-[1fr_100px_70px] gap-2 items-center border-b border-border/20 last:border-0 hover:bg-secondary/30 transition-colors"
          >
            {/* Teacher info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(var(--violet))] to-[hsl(var(--violet-dark))] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{t.initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.instruments.map((inst) => (
                    <span key={inst} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{inst}</span>
                  ))}
                  <span className="text-[10px] font-semibold text-primary">{t.rate}</span>
                </div>
              </div>
            </div>

            {/* Availability dots */}
            <div className="flex items-center justify-center gap-1">
              {t.availability.map((available, d) => (
                <div
                  key={d}
                  className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] ${
                    available
                      ? "bg-[hsl(var(--emerald)/0.15)] text-[hsl(var(--emerald))]"
                      : "bg-secondary/60 text-muted-foreground/30"
                  }`}
                >
                  {available ? <Check className="w-2 h-2" /> : <X className="w-2 h-2" />}
                </div>
              ))}
            </div>

            {/* Lessons count */}
            <div className="text-right">
              <span className="text-sm font-bold text-foreground">{t.lessonsThisWeek}</span>
              <span className="text-xs text-muted-foreground ml-1">/wk</span>
            </div>
          </motion.div>
        ))}

        {/* Footer summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="px-5 py-3 bg-secondary/30 flex items-center justify-between text-xs"
        >
          <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">63 lessons</span> this week</span>
          <span className="text-muted-foreground">Payroll: <span className="font-bold text-primary">£2,016</span></span>
        </motion.div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg"
      >
        Role-based access
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute bottom-12 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--coral))] text-[hsl(var(--coral-light))] text-xs font-bold shadow-lg"
      >
        Auto payroll calc
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: CalendarDays, title: "Availability management", description: "Teachers set weekly availability by day, time, and location. The scheduler respects these automatically.", accent: "violet" },
  { icon: PoundSterling, title: "Pay rates & payroll", description: "Set hourly or per-lesson pay rates. Payroll reports calculate earnings from delivered lessons automatically.", accent: "emerald" },
  { icon: MapPin, title: "Multi-location assignment", description: "Assign teachers to one or more locations. Each location has its own rooms and availability windows.", accent: "coral" },
  { icon: Eye, title: "Role-based access", description: "Teachers see only their own students and schedule. Admins and owners see the full picture.", accent: "teal" },
  { icon: Music, title: "Instrument specialisations", description: "Record which instruments each teacher covers. Match teachers to students by instrument and availability.", accent: "violet" },
  { icon: BarChart3, title: "Performance insights", description: "Track lessons delivered, cancellation rates, and utilisation per teacher. Spot trends and support your team.", accent: "emerald" },
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

/* ─── Steps ─── */
const STEPS = [
  { num: "01", title: "Invite teachers", description: "Send an email invite with the teacher role. Teachers sign up and set their own availability.", icon: Mail },
  { num: "02", title: "Assign locations & rates", description: "Link teachers to locations, set pay rates, and assign instrument specialisations.", icon: MapPin },
  { num: "03", title: "Schedule with confidence", description: "The calendar respects availability, prevents conflicts, and teachers see only their own schedule.", icon: Calendar },
];

/* ─── Role comparison ─── */
const ROLE_FEATURES = [
  { feature: "Own schedule", teacher: true, admin: true },
  { feature: "Own students", teacher: true, admin: true },
  { feature: "Set availability", teacher: true, admin: true },
  { feature: "View all teachers", teacher: false, admin: true },
  { feature: "Payroll reports", teacher: false, admin: true },
  { feature: "Revenue reports", teacher: false, admin: true },
  { feature: "Manage billing", teacher: false, admin: true },
  { feature: "Invite team", teacher: false, admin: true },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Calendar, title: "Scheduling", description: "Teacher availability feeds directly into the calendar. No double-booking or scheduling outside hours.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Receipt, title: "Invoicing & Billing", description: "Payroll reports generated from delivered lessons — matching pay rates to actual teaching.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which teachers have capacity, who's delivered the most lessons, or who needs cover.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureTeachers() {
  usePageMeta(
    "Teacher Management for Music Schools — Availability, Payroll & Profiles | LessonLoop",
    "Manage music teachers with availability scheduling, payroll tracking, role-based access, and multi-location assignment. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/teachers",
      ogTitle: "Teacher Management for Music Schools | LessonLoop",
      ogDescription: "Availability scheduling, payroll tracking, role-based access, and multi-location assignment for music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/teachers",
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
        featureName="Teacher Management"
        description="Music teacher management with availability scheduling, payroll tracking, role-based access, and multi-location support."
        canonical="https://lessonloop.co.uk/features/teachers"
        breadcrumbName="Teachers"
        faqs={faqs}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-24 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--violet)) 0%, transparent 70%)", y: bgY }}
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--violet)/0.1)] border border-[hsl(var(--violet)/0.2)]">
                <UserCheck className="w-4 h-4 text-[hsl(var(--violet))]" />
                <span className="text-sm font-semibold text-[hsl(var(--violet))] tracking-wide">Teacher Management</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Manage your teaching team{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--violet))] to-[hsl(var(--violet-dark))] bg-clip-text text-transparent">
                  with clarity
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Availability scheduling, payroll tracking, role-based access, and multi-location assignment — everything you need to run a team of music teachers.
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

            {/* Right: interactive roster card */}
            <div className="relative">
              <HeroRosterCard />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section className="relative bg-[hsl(var(--ink))] py-20 lg:py-28 overflow-hidden">
        <motion.div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--coral))] mb-4">The Problem</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Managing teachers shouldn't mean <span className="text-[hsl(var(--coral))]">more admin</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Coordinating availability, calculating pay, and controlling access — it's a full-time job on its own.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Clock, title: "Availability chaos", description: "Tracking who teaches when, where, and for how long — across multiple locations — using spreadsheets or WhatsApp." },
              { icon: AlertTriangle, title: "Payroll is manual", description: "Counting lessons, calculating hours, applying different rates — all done by hand every month. Errors are inevitable." },
              { icon: Users, title: "No role separation", description: "Teachers can see other teachers' schedules, student details, or billing info they shouldn't have access to." },
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
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))] mb-4">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Teacher tools built for <span className="text-[hsl(var(--violet))]">music schools</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Every teacher gets their own profile, schedule, and role-based view — while admins get full visibility across the team.
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

      {/* ═══ ROLE COMPARISON ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary">Role-Based Access</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Teachers see theirs. <span className="text-primary">Admins see everything.</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Role-based access means teachers only see their own students and schedule. No accidental data exposure. No awkward billing visibility.
              </p>
              <div className="pt-2">
                <Link to="/features/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  Explore reporting features <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Right: comparison table */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
            >
              <div className="grid grid-cols-[1fr_80px_80px] gap-0">
                {/* Header */}
                <div className="px-5 py-3 border-b border-border/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">Feature</div>
                <div className="px-3 py-3 border-b border-border/40 text-xs font-bold text-[hsl(var(--violet))] uppercase tracking-wider text-center">Teacher</div>
                <div className="px-3 py-3 border-b border-border/40 text-xs font-bold text-primary uppercase tracking-wider text-center">Admin</div>

                {ROLE_FEATURES.map((row, i) => (
                  <motion.div
                    key={row.feature}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="contents"
                  >
                    <div className="px-5 py-3 border-b border-border/20 text-sm text-foreground">{row.feature}</div>
                    <div className="px-3 py-3 border-b border-border/20 flex items-center justify-center">
                      {row.teacher ? (
                        <div className="w-5 h-5 rounded-full bg-[hsl(var(--emerald)/0.15)] flex items-center justify-center">
                          <Check className="w-3 h-3 text-[hsl(var(--emerald))]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                          <X className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-3 border-b border-border/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-[hsl(var(--emerald)/0.15)] flex items-center justify-center">
                        <Check className="w-3 h-3 text-[hsl(var(--emerald))]" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Your team set up in <span className="text-[hsl(var(--violet))]">minutes</span></h2>
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
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--violet)/0.1)] flex items-center justify-center mx-auto">
                    <step.icon className="w-6 h-6 text-[hsl(var(--violet))]" />
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
                  <r.icon className="w-6 h-6 text-[hsl(var(--violet))] mb-3" />
                  <h3 className="font-bold text-foreground mb-2">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.description}</p>
                  <span className="text-sm font-semibold text-[hsl(var(--violet))] inline-flex items-center gap-1">
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Run your teaching team <span className="text-[hsl(var(--violet-light))]">smoothly.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Availability, payroll, and role-based access — everything to manage a team of music teachers in one platform.
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
