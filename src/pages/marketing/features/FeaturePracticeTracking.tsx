import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Music2, Clock, AlertTriangle, BookOpen, Timer,
  Target, Trophy, Bell, BarChart3, Calendar,
  Users, Sparkles, ArrowRight, ChevronRight,
  Check, Flame, Star,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "Can students log their own practice?", answer: "Yes. Students (or parents on their behalf) can log practice sessions from the parent portal, including duration, what they practised, and notes." },
  { question: "Can teachers set practice assignments?", answer: "Absolutely. Teachers create practice assignments with descriptions, targets, and due dates. Students see them in the portal." },
  { question: "Can I see how much a student has practised?", answer: "Yes. Practice logs are visible on the student profile and in the parent portal. Teachers can review before each lesson." },
  { question: "Does practice tracking work on mobile?", answer: "Yes. The parent portal is fully responsive. Students and parents can log practice from any device." },
  { question: "Is practice tracking included in all plans?", answer: "Practice tracking is available on Pro and Academy plans." },
];

/* ─── Hero: Practice Week Card ─── */
const PRACTICE_DAYS = [
  { day: "Mon", mins: 25, done: true },
  { day: "Tue", mins: 30, done: true },
  { day: "Wed", mins: 0, done: false },
  { day: "Thu", mins: 20, done: true },
  { day: "Fri", mins: 35, done: true },
  { day: "Sat", mins: 15, done: true },
  { day: "Sun", mins: 0, done: false },
];

const ASSIGNMENTS = [
  { title: "Scales — C, G, D major", target: "15 mins/day", due: "Fri 7 Mar", progress: 80, status: "on-track" as const },
  { title: "Für Elise — bars 1–16", target: "Hands together", due: "Fri 7 Mar", progress: 60, status: "on-track" as const },
  { title: "Sight-reading — Grade 4 book", target: "2 exercises", due: "Fri 7 Mar", progress: 30, status: "behind" as const },
];

function HeroPracticeCard() {
  const totalMins = PRACTICE_DAYS.reduce((sum, d) => sum + d.mins, 0);
  const streak = 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-[hsl(var(--coral)/0.06)] to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Practice This Week</h3>
              <p className="text-xs text-muted-foreground">Olivia Chen · Piano</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--coral)/0.12)]">
              <Flame className="w-3 h-3 text-[hsl(var(--coral))]" />
              <span className="text-[10px] font-bold text-[hsl(var(--coral))]">{streak}-day streak</span>
            </div>
          </div>
        </div>

        {/* Weekly heatmap */}
        <div className="px-5 py-4 border-b border-border/30">
          <div className="flex items-end justify-between gap-2">
            {PRACTICE_DAYS.map((d, i) => (
              <motion.div
                key={d.day}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.35, ease: "easeOut" }}
                className="flex-1 flex flex-col items-center gap-1.5 origin-bottom"
              >
                {d.mins > 0 && (
                  <span className="text-[9px] font-bold text-muted-foreground">{d.mins}m</span>
                )}
                <div
                  className={`w-full rounded-lg transition-all ${
                    d.mins >= 30 ? "bg-[hsl(var(--coral))]" :
                    d.mins >= 15 ? "bg-[hsl(var(--coral)/0.6)]" :
                    d.mins > 0 ? "bg-[hsl(var(--coral)/0.3)]" :
                    "bg-secondary/60"
                  }`}
                  style={{ height: d.mins > 0 ? `${Math.max(d.mins * 1.5, 12)}px` : "8px" }}
                />
                <span className={`text-[10px] font-medium ${d.done ? "text-foreground" : "text-muted-foreground/40"}`}>
                  {d.day}
                </span>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-3 flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{totalMins} mins</span></span>
            <span className="text-muted-foreground">Target: <span className="font-bold text-primary">150 mins</span></span>
          </motion.div>
        </div>

        {/* Assignments */}
        <div className="px-5 py-3 space-y-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assignments</p>
          {ASSIGNMENTS.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.12 }}
              className="space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground">{a.target} · Due {a.due}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  a.status === "on-track"
                    ? "bg-[hsl(var(--emerald)/0.12)] text-[hsl(var(--emerald))]"
                    : "bg-[hsl(var(--coral)/0.12)] text-[hsl(var(--coral))]"
                }`}>
                  {a.status === "on-track" ? "On track" : "Behind"}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${a.progress}%` }}
                  transition={{ delay: 0.9 + i * 0.12, duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    a.status === "on-track" ? "bg-[hsl(var(--emerald))]" : "bg-[hsl(var(--coral))]"
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-[hsl(var(--teal-light))] text-xs font-bold shadow-lg"
      >
        Portal-ready
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
        className="absolute bottom-16 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-[hsl(var(--violet-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Trophy className="w-3 h-3" /> Gamified
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: Target, title: "Practice assignments", description: "Create assignments with descriptions, targets, and due dates. Students and parents see them instantly in the portal.", accent: "coral" },
  { icon: Timer, title: "Practice logging", description: "Students or parents log sessions with duration, focus area, and notes. Built right into the portal.", accent: "teal" },
  { icon: Trophy, title: "Streaks & progress", description: "Practice streaks and weekly totals keep students motivated. See who's putting in the work.", accent: "coral" },
  { icon: Bell, title: "Practice reminders", description: "Automated reminders nudge students and parents about upcoming goals and incomplete assignments.", accent: "violet" },
  { icon: BarChart3, title: "Teacher insights", description: "Review practice logs before each lesson. Know what a student worked on and how much time they spent.", accent: "teal" },
  { icon: Calendar, title: "Linked to lessons", description: "Assignments connect to lesson dates. See what was assigned after each lesson and track completion.", accent: "emerald" },
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
  { num: "01", title: "Set assignments", description: "After a lesson, create a practice assignment with what to practise, how long, and when it's due.", icon: Target },
  { num: "02", title: "Students log practice", description: "Students or parents log sessions in the portal — duration, focus area, and notes.", icon: Timer },
  { num: "03", title: "Review before teaching", description: "See the practice log before the next lesson. Know exactly what was done and adjust your plan.", icon: BookOpen },
];

/* ─── The loop visual ─── */
const LOOP_STEPS = [
  { label: "Lesson", sublabel: "Teacher assigns practice", color: "hsl(var(--teal))" },
  { label: "Practice", sublabel: "Student logs at home", color: "hsl(var(--coral))" },
  { label: "Review", sublabel: "Teacher checks progress", color: "hsl(var(--violet))" },
  { label: "Adjust", sublabel: "Tailor the next lesson", color: "hsl(var(--emerald))" },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Users, title: "Parent Portal", description: "Practice assignments and logs live in the parent portal. Parents stay engaged in their child's learning.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: Calendar, title: "Scheduling", description: "Practice assignments link to lesson dates. See what was assigned after each lesson.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist which students haven't logged practice this week or summarise practice trends.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeaturePracticeTracking() {
  usePageMeta(
    "Practice Tracking for Music Students — Assignments, Logs & Progress | LessonLoop",
    "Set practice assignments, track student practice time, and monitor progress between lessons. Built into the parent portal. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/practice-tracking",
      ogTitle: "Practice Tracking for Music Students | LessonLoop",
      ogDescription: "Set practice assignments, track student practice time, and monitor progress between lessons. Built into the parent portal.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/practice-tracking",
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
        featureName="Practice Tracking"
        description="Practice tracking for music students — assignments, logs, and progress monitoring between lessons."
        canonical="https://lessonloop.co.uk/features/practice-tracking"
        breadcrumbName="Practice Tracking"
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
          style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)", y: bgY }}
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--coral)/0.1)] border border-[hsl(var(--coral)/0.2)]">
                <Music2 className="w-4 h-4 text-[hsl(var(--coral))]" />
                <span className="text-sm font-semibold text-[hsl(var(--coral))] tracking-wide">Practice Tracking</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Bridge the gap{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--coral))] to-[hsl(var(--coral-dark))] bg-clip-text text-transparent">
                  between lessons
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Set practice assignments, track time, and monitor progress — all built into the parent portal so students and parents stay engaged.
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

            {/* Right: interactive practice card */}
            <div className="relative">
              <HeroPracticeCard />
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
              What happens between lessons <span className="text-[hsl(var(--coral))]">matters</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              You set homework, but have no idea if it was done. Students forget, parents don't know what to encourage, and progress stalls.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "No accountability", description: "Students forget what to practise. No record of what was assigned or completed." },
              { icon: Clock, title: "No visibility for parents", description: "Parents want to help but don't know what was assigned or how much is expected." },
              { icon: BookOpen, title: "Progress is invisible", description: "Without tracking, conversations about progress are based on gut feeling, not data." },
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
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--coral))] mb-4">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Practice tracking built for <span className="text-[hsl(var(--coral))]">music education</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Assign practice, track time, and see progress — all connected to the student profile and parent portal.
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

      {/* ═══ THE PRACTICE LOOP ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">The Practice Loop</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              A continuous cycle of <span className="text-primary">improvement</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Practice tracking closes the loop between lessons. Every lesson informs practice, and every practice session informs the next lesson.
            </p>
          </div>

          {/* Loop visual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {LOOP_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="relative text-center"
              >
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{ backgroundColor: step.color }}
                >
                  {i + 1}
                </div>
                <h3 className="font-bold text-foreground text-sm">{step.label}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{step.sublabel}</p>

                {/* Arrow connector */}
                {i < LOOP_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-2 z-10">
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Circular arrow hint */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8"
          >
            <span className="text-xs text-muted-foreground italic">↻ The loop repeats every lesson, building consistent habits</span>
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Practice tracking <span className="text-[hsl(var(--coral))]">made simple</span></h2>
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
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--coral)/0.1)] flex items-center justify-center mx-auto">
                    <step.icon className="w-6 h-6 text-[hsl(var(--coral))]" />
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
                  <r.icon className="w-6 h-6 text-[hsl(var(--coral))] mb-3" />
                  <h3 className="font-bold text-foreground mb-2">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.description}</p>
                  <span className="text-sm font-semibold text-[hsl(var(--coral))] inline-flex items-center gap-1">
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--coral)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Make practice <span className="text-[hsl(var(--coral-light))]">count.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Practice assignments, student logs, and progress insights — all built into the parent portal. Bridge the gap between lessons.
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
