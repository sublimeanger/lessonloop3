import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, Users, CalendarDays, CreditCard, BarChart3, MapPin,
  AlertTriangle, Clock, FileSpreadsheet, ShieldAlert, Repeat, UserCheck,
  ArrowRight, ChevronRight, GraduationCap, Music, Shield, Sparkles,
  CheckCircle2, Layers, DoorOpen, Receipt,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/music-academies";

const FAQS = [
  { question: "Can LessonLoop handle multiple locations?", answer: "Yes. Add unlimited locations, each with their own rooms, closure dates, and teacher assignments. All managed from one dashboard." },
  { question: "Does it support team billing and payroll?", answer: "Absolutely. Run bulk billing across all students, track teacher hours, and generate payroll reports by location or term." },
  { question: "What roles and permissions are available?", answer: "LessonLoop supports Owner, Admin, Teacher, Finance, and Parent roles, each with tailored dashboards and data access." },
  { question: "Is there a parent portal?", answer: "Yes. Parents can view schedules, pay invoices, track practice, and message teachers through a dedicated family portal." },
  { question: "Can I migrate from another platform?", answer: "Yes. We offer guided migration support. Import students, guardians, and lesson data via CSV or with our team's help." },
];

/* ─── Hero: Academy Dashboard Mockup ─── */
const KPI_CARDS = [
  { label: "Active Students", value: "247", change: "+12 this term", positive: true },
  { label: "Monthly Revenue", value: "£18,450", change: "+8.3% vs last month", positive: true },
  { label: "Room Utilisation", value: "84%", change: "3 locations", positive: true },
  { label: "Outstanding", value: "£2,140", change: "6 invoices overdue", positive: false },
];

const TODAY_LESSONS = [
  { time: "09:00", student: "Emma W.", teacher: "Ms Davies", room: "Room 1", instrument: "Piano" },
  { time: "09:30", student: "Oliver P.", teacher: "Mr Shah", room: "Studio A", instrument: "Violin" },
  { time: "10:00", student: "Group — Grade 3", teacher: "Ms Davies", room: "Ensemble", instrument: "Theory" },
  { time: "10:30", student: "James R.", teacher: "Mr Thompson", room: "Room 2", instrument: "Guitar" },
];

function HeroAcademyDashboard() {
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
            <h3 className="text-sm font-bold text-foreground">Academy Dashboard</h3>
            <p className="text-xs text-muted-foreground">Richmond Music Academy · 3 locations</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--emerald)/0.12)] text-[hsl(var(--emerald))] text-[10px] font-bold"
          >
            <CheckCircle2 className="w-3 h-3" /> All systems normal
          </motion.div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-px bg-border/30">
          {KPI_CARDS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-card px-4 py-3"
            >
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
              <p className={`text-[9px] font-medium mt-0.5 ${kpi.positive ? "text-[hsl(var(--emerald))]" : "text-[hsl(var(--coral))]"}`}>
                {kpi.change}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Today's lessons */}
        <div className="px-5 py-3 border-t border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Today's Lessons</p>
          {TODAY_LESSONS.map((lesson, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0"
            >
              <span className="text-[11px] font-bold text-primary w-10 flex-shrink-0">{lesson.time}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">{lesson.student}</p>
                <p className="text-[9px] text-muted-foreground">{lesson.teacher} · {lesson.room}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex-shrink-0">{lesson.instrument}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-white text-xs font-bold shadow-lg"
      >
        Multi-location
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
        className="absolute bottom-20 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Shield className="w-3 h-3" /> Role-based access
      </motion.div>
    </motion.div>
  );
}

/* ─── Pain points ─── */
const PAIN_POINTS = [
  { icon: AlertTriangle, title: "Scheduling collisions", description: "Double-booked rooms and teacher clashes eat into lesson time and parent trust." },
  { icon: Clock, title: "Hours lost on invoicing", description: "Manual spreadsheets for termly billing across 50+ families is unsustainable." },
  { icon: FileSpreadsheet, title: "Scattered data", description: "Student notes in one app, finances in another, attendance on paper — nothing talks to anything." },
  { icon: ShieldAlert, title: "No role boundaries", description: "Everyone sees everything. Teachers access financials, parents email personal numbers." },
  { icon: Repeat, title: "Repetitive admin", description: "Copy-pasting reminders, re-entering term dates, manually chasing overdue payments." },
  { icon: UserCheck, title: "Onboarding new staff", description: "Training each new teacher on a patchwork of tools wastes weeks every hire." },
];

/* ─── Features ─── */
const FEATURES = [
  { icon: CalendarDays, title: "Drag-and-drop scheduling", description: "Visual calendar with conflict detection, recurring lessons, and room allocation across locations.", to: "/features/scheduling", linkText: "Explore scheduling features", accent: "teal" },
  { icon: CreditCard, title: "Automated billing runs", description: "Generate termly or monthly invoices for every family in minutes. GBP, VAT-ready.", to: "/features/billing", linkText: "See invoicing and billing", accent: "coral" },
  { icon: Users, title: "Parent portal", description: "Parents view schedules, pay invoices, track practice, and message teachers — all self-serve.", to: "/features/parent-portal", linkText: "View the parent portal", accent: "violet" },
  { icon: MapPin, title: "Multi-location management", description: "Separate rooms, closure dates, and teacher rosters per venue. One unified dashboard.", to: "/features/locations", linkText: "Manage locations", accent: "emerald" },
  { icon: BarChart3, title: "Revenue & utilisation reports", description: "Track income, outstanding balances, room utilisation, and teacher performance at a glance.", to: "/features/reports", linkText: "Explore reports", accent: "teal" },
  { icon: Building2, title: "Roles & permissions", description: "Owner, Admin, Teacher, Finance, and Parent roles with tailored dashboards and data boundaries.", to: "/features/teachers", linkText: "Teacher management", accent: "violet" },
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

/* ─── Scale metrics ─── */
const SCALE_METRICS = [
  { label: "Students managed", value: "10,000+", icon: GraduationCap },
  { label: "Lessons scheduled", value: "250,000+", icon: CalendarDays },
  { label: "Invoices generated", value: "£2M+", icon: Receipt },
  { label: "Locations supported", value: "Unlimited", icon: MapPin },
];

/* ─── Roles visual ─── */
const ROLES = [
  { role: "Owner", description: "Full control. Settings, billing, reports, and all data.", color: "hsl(var(--coral))" },
  { role: "Admin", description: "Manage scheduling, students, and teachers. No billing settings.", color: "hsl(var(--teal))" },
  { role: "Teacher", description: "Own schedule, student notes, and attendance. No financials.", color: "hsl(var(--violet))" },
  { role: "Finance", description: "Invoicing, payments, and reports. No schedule editing.", color: "hsl(var(--emerald))" },
  { role: "Parent", description: "View schedule, pay invoices, track practice. Portal only.", color: "hsl(var(--muted-foreground))" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function ForMusicAcademies() {
  usePageMeta(
    "Music Academy Management Software | LessonLoop",
    "All-in-one scheduling, billing, and parent communication for multi-teacher music academies. Built for the UK. Free 30-day trial.",
    {
      ogTitle: "Music Academy Management Software | LessonLoop",
      ogDescription: "Run your music academy with LessonLoop — scheduling, invoicing, attendance, and parent portals in one platform.",
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
        name="Music Academy Management"
        description="All-in-one scheduling, billing, attendance, and parent communication software for multi-teacher music academies."
        canonical={CANONICAL}
        breadcrumbName="Music Academies"
        faqs={FAQS}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-24 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">For Music Academies</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Run your academy with{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                  clarity, not chaos
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Multi-teacher timetabling, automated invoicing, parent portals, and performance reports — everything a growing academy needs, in one platform built for UK music education.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start free trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-secondary transition-colors"
                >
                  View plans and pricing
                </Link>
              </div>
            </motion.div>

            <div className="relative">
              <HeroAcademyDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {SCALE_METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <m.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </motion.div>
            ))}
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
              Scaling an academy shouldn't mean scaling <span className="text-[hsl(var(--coral))]">admin</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              More teachers, more locations, more parents to manage — and a growing tangle of tools that don't talk to each other.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PAIN_POINTS.map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
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

      {/* ═══ FEATURES ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Purpose-Built</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Everything your academy <span className="text-primary">needs</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Purpose-built features that grow with you — from 5 teachers to 50.
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

      {/* ═══ ROLES SECTION ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))]">Roles & Permissions</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Everyone sees only <span className="text-[hsl(var(--violet))]">what they need</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Five distinct roles with tailored dashboards. Teachers see their schedule. Parents see their children. Admins see everything. Nobody sees what they shouldn't.
              </p>
              <div className="pt-2">
                <Link to="/features/teachers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  Learn about teacher management <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Roles visual */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-border/40">
                <h3 className="text-sm font-bold text-foreground">Team Roles</h3>
                <p className="text-[10px] text-muted-foreground">5 roles · Scoped dashboards</p>
              </div>
              {ROLES.map((r, i) => (
                <motion.div
                  key={r.role}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="px-5 py-3 border-b border-border/15 last:border-0 flex items-center gap-3"
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-foreground">{r.role}</p>
                    <p className="text-[9px] text-muted-foreground">{r.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
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
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-primary-foreground">"</span>
            </div>
            <blockquote className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
              LessonLoop replaced four separate tools for us. Our admin team saves over 10 hours a week and parents actually pay on time now.
            </blockquote>
            <div>
              <p className="font-bold text-foreground">Sarah M.</p>
              <p className="text-sm text-muted-foreground">Academy Director, London</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARISON STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">How we compare</h2>
            <p className="text-sm text-muted-foreground mt-2">See how LessonLoop stacks up against alternatives</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
              { label: "vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
              { label: "vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
              { label: "vs Jackrabbit Music", to: "/compare/lessonloop-vs-jackrabbit-music" },
              { label: "vs Fons", to: "/compare/lessonloop-vs-fons" },
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
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--teal)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Ready to streamline your <span className="text-[hsl(var(--teal-light,var(--teal)))]">music academy?</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Join UK academies using LessonLoop to schedule, bill, and communicate — without the admin overload.
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
