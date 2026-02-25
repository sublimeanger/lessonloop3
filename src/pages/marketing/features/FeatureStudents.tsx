import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Users, Search, AlertTriangle, FileText, Music,
  GraduationCap, Phone, Shield, Tag, History,
  Calendar, Receipt, MessageSquare, ArrowRight,
  ChevronRight, Star, BookOpen, Upload,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "Can I store guardian/parent contact details?", answer: "Yes. Each student can have one or more guardians linked to their profile, each with their own email, phone, and portal access." },
  { question: "Can I track which instruments a student learns?", answer: "Absolutely. Assign one or more instruments per student, each with their own grade level and exam board." },
  { question: "Can I import students from a spreadsheet?", answer: "Yes. LessonLoop has a CSV import tool that maps your columns to student fields. Import hundreds of students in minutes." },
  { question: "Is student data GDPR compliant?", answer: "Yes. All student data is isolated per organisation with row-level security. You can export or delete student data at any time to comply with data requests." },
  { question: "Can I add custom notes to a student profile?", answer: "Yes. Each student profile has a notes section for lesson observations, medical notes, or anything else you need to remember." },
];

/* ─── Hero profile card data ─── */
const STUDENT_PROFILE = {
  name: "Olivia Chen",
  age: 12,
  instruments: [
    { name: "Piano", grade: "Grade 5", board: "ABRSM", color: "hsl(var(--teal))" },
    { name: "Violin", grade: "Grade 3", board: "Trinity", color: "hsl(var(--violet))" },
  ],
  guardian: "Dr. Sarah Chen",
  phone: "07700 900123",
  email: "sarah.chen@email.co.uk",
  attendance: 94,
  lessonsThisTerm: 18,
  nextLesson: "Tue 4 Mar, 16:00",
  notes: "Working on Grade 5 pieces for June exam. Needs extra sight-reading practice.",
};

const GRADE_HISTORY = [
  { grade: "Grade 5", date: "Sep 2025", status: "current" },
  { grade: "Grade 4", date: "Mar 2025", status: "passed", result: "Merit" },
  { grade: "Grade 3", date: "Jul 2024", status: "passed", result: "Distinction" },
  { grade: "Grade 2", date: "Dec 2023", status: "passed", result: "Pass" },
  { grade: "Grade 1", date: "Jun 2023", status: "passed", result: "Merit" },
];

/* ─── Hero profile mockup ─── */
function HeroProfileCard() {
  const p = STUDENT_PROFILE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-md mx-auto"
    >
      {/* Card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header band */}
        <div className="h-20 bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] relative">
          <div className="absolute -bottom-8 left-6">
            <div className="w-16 h-16 rounded-full bg-card border-4 border-card flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-foreground">OC</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="pt-12 px-6 pb-6 space-y-4">
          {/* Name & age */}
          <div>
            <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
            <p className="text-sm text-muted-foreground">Age {p.age}</p>
          </div>

          {/* Instruments */}
          <div className="space-y-2">
            {p.instruments.map((inst, i) => (
              <motion.div
                key={inst.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/40 bg-secondary/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: inst.color }} />
                  <span className="text-sm font-medium text-foreground">{inst.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{inst.board}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{inst.grade}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="text-center py-2 px-1 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold text-foreground">{p.attendance}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attendance</p>
            </div>
            <div className="text-center py-2 px-1 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold text-foreground">{p.lessonsThisTerm}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This term</p>
            </div>
            <div className="text-center py-2 px-1 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold text-foreground">5</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grades</p>
            </div>
          </motion.div>

          {/* Guardian */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border/40 bg-secondary/30"
          >
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{p.guardian}</p>
              <p className="text-xs text-muted-foreground">{p.email}</p>
            </div>
          </motion.div>

          {/* Note preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15 }}
            className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-3 py-1"
          >
            "{p.notes}"
          </motion.div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg"
      >
        GDPR compliant
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute bottom-6 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-[hsl(var(--violet-light))] text-xs font-bold shadow-lg"
      >
        2 instruments linked
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: Music, title: "Instruments & grades", description: "Track which instruments each student learns, their current grade, exam board, and full grade change history.", accent: "teal" },
  { icon: GraduationCap, title: "Grade progression", description: "See a student's grade journey over time. Record exam results and track progress towards the next level.", accent: "violet" },
  { icon: Phone, title: "Guardian links", description: "Link one or more guardians per student. Store contact details and manage portal access from the profile.", accent: "coral" },
  { icon: History, title: "Lesson & attendance history", description: "Every lesson attended, missed, or cancelled — with dates, teachers, and notes.", accent: "emerald" },
  { icon: Tag, title: "Custom notes & tags", description: "Lesson observations, medical notes, custom tags. Filter and search students by any field.", accent: "teal" },
  { icon: Shield, title: "GDPR-compliant records", description: "Data isolated per organisation with row-level security. Export or delete anytime for subject access requests.", accent: "violet" },
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
  { num: "01", title: "Add or import students", description: "Create students individually or bulk-import from CSV. Map your columns and import hundreds in minutes.", icon: Upload },
  { num: "02", title: "Assign instruments & guardians", description: "Link instruments, set grade levels, and connect guardians. Everything is connected from day one.", icon: Music },
  { num: "03", title: "Teach with full context", description: "Before every lesson, see the student's history, grade, notes, and attendance — all in one view.", icon: BookOpen },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Calendar, title: "Scheduling", description: "Students are linked to lessons. See a student's full schedule from their profile.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Receipt, title: "Invoicing & Billing", description: "Rate cards are assigned per student. Invoices generated from their lesson attendance.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: MessageSquare, title: "Parent Portal", description: "Guardians linked to students get portal access to view lessons, invoices, and practice.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureStudents() {
  usePageMeta(
    "Student Management for Music Schools — Profiles, Instruments & Grades | LessonLoop",
    "Manage music students with detailed profiles, instrument tracking, grade history, guardian links, and GDPR-compliant records. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/students",
      ogTitle: "Student Management for Music Schools | LessonLoop",
      ogDescription: "Detailed student profiles with instrument tracking, grade history, guardian links, and GDPR-compliant records.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/students",
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
        featureName="Student Management"
        description="Music student management with detailed profiles, instrument tracking, grade history, and guardian links."
        canonical="https://lessonloop.co.uk/features/students"
        breadcrumbName="Students"
        faqs={faqs}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-28 sm:pt-32 lg:pt-40 pb-20 lg:pb-28">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", y: bgY }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">Student Management</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Every student, every detail,{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                  one place
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Rich profiles with instruments, grades, guardian links, lesson history, and notes — so you always know exactly where each student is on their musical journey.
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

            {/* Right: interactive profile card */}
            <div className="relative">
              <HeroProfileCard />
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
              Student info scattered <span className="text-[hsl(var(--coral))]">everywhere</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Spreadsheets, notebooks, email threads — finding the right information about a student shouldn't require detective work.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Search, title: "Can't find what you need", description: "Grade levels in one spreadsheet, contact details in another, lesson notes in your head. Nothing is connected." },
              { icon: AlertTriangle, title: "Guardian details out of date", description: "Phone numbers change, emails bounce, and you only find out when you need to reach someone urgently." },
              { icon: FileText, title: "No history at a glance", description: "How many lessons this term? What was covered last week? Impossible to answer quickly." },
            ].map((pain, i) => (
              <motion.div
                key={pain.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="group relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
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
              Student profiles built for <span className="text-primary">music teachers</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need — instruments, grades, guardians, attendance, and notes — in one connected profile.
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

      {/* ═══ GRADE TIMELINE ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))]">Grade Journey</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Watch every student's <span className="text-[hsl(var(--violet))]">progress unfold</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                A complete timeline of grade examinations and results. See where they started, where they are now, and what's next.
              </p>
              <div className="pt-2">
                <Link to="/features/attendance" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  Track attendance too <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Right: timeline */}
            <div className="relative">
              <div className="space-y-0">
                {GRADE_HISTORY.map((entry, i) => (
                  <motion.div
                    key={entry.grade + entry.date}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="flex items-start gap-4 relative"
                  >
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-1.5 ${entry.status === "current" ? "bg-primary ring-4 ring-primary/20" : "bg-[hsl(var(--violet))]"}`} />
                      {i < GRADE_HISTORY.length - 1 && <div className="w-px h-12 bg-border/60" />}
                    </div>
                    <div className="pb-6">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-foreground">{entry.grade}</span>
                        {entry.status === "current" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">Current</span>
                        )}
                        {entry.result && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--violet)/0.1)] text-[hsl(var(--violet))]">
                            {entry.result}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{entry.date}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Student records set up in <span className="text-primary">minutes</span></h2>
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
                {/* Watermark number */}
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

                {/* Connector */}
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
            Know every student <span className="text-[hsl(var(--teal))]">inside out.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Rich profiles that connect instruments, grades, guardians, and lesson history — all in one place. No spreadsheets required.
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
