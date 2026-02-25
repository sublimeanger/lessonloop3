import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import {
  ClipboardCheck, Clock, AlertTriangle, XCircle, CheckCircle,
  Bell, BarChart3, Calendar, FileText, Zap, Shield,
  Receipt, Users, Sparkles, ArrowRight, ChevronRight,
  Check, X, AlertCircle, Minus,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "How do I mark attendance?", answer: "Open the daily register or click into any lesson. Mark each student as present, absent, late, or cancelled with one tap." },
  { question: "Can I record absence reasons?", answer: "Yes. Choose from categories like illness, holiday, or no-show. Add free-text notes for additional context." },
  { question: "Are parents notified of absences?", answer: "You can configure automatic notifications when a student is marked absent. Parents see attendance in their portal too." },
  { question: "Can I see attendance trends over time?", answer: "Yes. Attendance reports show per-student, per-teacher, and per-instrument trends across any date range." },
  { question: "Does attendance affect billing?", answer: "It can. When generating invoices from the schedule, you choose whether to bill for attended lessons only or all scheduled lessons." },
];

/* ─── Register data ─── */
type AttendanceStatus = "present" | "absent" | "late" | "unmarked";

interface RegisterStudent {
  id: number;
  name: string;
  instrument: string;
  time: string;
  defaultStatus: AttendanceStatus;
  reason?: string;
}

const REGISTER_STUDENTS: RegisterStudent[] = [
  { id: 1, name: "Olivia Chen", instrument: "Piano", time: "09:00", defaultStatus: "present" },
  { id: 2, name: "James Mitchell", instrument: "Guitar", time: "09:30", defaultStatus: "present" },
  { id: 3, name: "Amara Obi", instrument: "Violin", time: "10:00", defaultStatus: "absent", reason: "Illness" },
  { id: 4, name: "Felix Ward", instrument: "Drums", time: "10:30", defaultStatus: "late" },
  { id: 5, name: "Sophie Taylor", instrument: "Piano", time: "11:00", defaultStatus: "unmarked" },
  { id: 6, name: "Noah Patel", instrument: "Cello", time: "11:30", defaultStatus: "unmarked" },
];

const STATUS_CONFIG: Record<AttendanceStatus, { icon: typeof Check; label: string; bg: string; text: string; ring: string }> = {
  present: { icon: Check, label: "Present", bg: "bg-[hsl(var(--emerald)/0.12)]", text: "text-[hsl(var(--emerald))]", ring: "ring-[hsl(var(--emerald)/0.3)]" },
  absent: { icon: X, label: "Absent", bg: "bg-[hsl(var(--coral)/0.12)]", text: "text-[hsl(var(--coral))]", ring: "ring-[hsl(var(--coral)/0.3)]" },
  late: { icon: Clock, label: "Late", bg: "bg-[hsl(var(--coral)/0.08)]", text: "text-[hsl(var(--coral-dark))]", ring: "ring-[hsl(var(--coral)/0.2)]" },
  unmarked: { icon: Minus, label: "—", bg: "bg-secondary/60", text: "text-muted-foreground/50", ring: "ring-border/30" },
};

/* ─── Interactive Register Hero ─── */
function HeroRegisterCard() {
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>(() =>
    Object.fromEntries(REGISTER_STUDENTS.map((s) => [s.id, s.defaultStatus]))
  );

  const cycleStatus = (id: number) => {
    const order: AttendanceStatus[] = ["present", "absent", "late", "unmarked"];
    setStatuses((prev) => {
      const current = prev[id];
      const next = order[(order.indexOf(current) + 1) % order.length];
      return { ...prev, [id]: next };
    });
  };

  const counts = Object.values(statuses).reduce(
    (acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-[hsl(var(--emerald)/0.06)] to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Daily Register</h3>
              <p className="text-xs text-muted-foreground">Tuesday 4 March 2026 · 6 lessons</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[hsl(var(--emerald)/0.12)] text-[hsl(var(--emerald))]">
                {counts.present || 0} present
              </span>
              {(counts.absent || 0) > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[hsl(var(--coral)/0.12)] text-[hsl(var(--coral))]">
                  {counts.absent} absent
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rows */}
        {REGISTER_STUDENTS.map((student, i) => {
          const status = statuses[student.id];
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;

          return (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.35 }}
              className="px-5 py-3 flex items-center gap-3 border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors"
            >
              {/* Time */}
              <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">{student.time}</span>

              {/* Student info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{student.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{student.instrument}</span>
                  {status === "absent" && student.reason && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--coral)/0.08)] text-[hsl(var(--coral))]">
                      {student.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Status button */}
              <button
                onClick={() => cycleStatus(student.id)}
                className={`w-8 h-8 rounded-lg ${config.bg} ring-1 ${config.ring} flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer`}
                aria-label={`Mark ${student.name} attendance`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.text}`} />
              </button>
            </motion.div>
          );
        })}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="px-5 py-3 bg-secondary/30 text-center"
        >
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Tap</span> any status icon to cycle through states
          </p>
        </motion.div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg"
      >
        One-tap marking
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute bottom-12 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--coral))] text-[hsl(var(--coral-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Bell className="w-3 h-3" /> Parent alerts
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: CheckCircle, title: "One-tap marking", description: "Present, absent, late, or cancelled — mark each student with a single tap from the daily register.", accent: "emerald" },
  { icon: FileText, title: "Absence categorisation", description: "Record reasons like illness, holiday, or no-show. Add notes for context. Build a clear absence record.", accent: "coral" },
  { icon: Bell, title: "Parent notifications", description: "Automatically notify parents when their child is marked absent. They also see attendance in the portal.", accent: "violet" },
  { icon: BarChart3, title: "Attendance reports", description: "Per-student, per-teacher, and per-instrument trends. Spot patterns before they become problems.", accent: "teal" },
  { icon: Zap, title: "Batch attendance", description: "Mark attendance for group lessons or a full day in one go. Perfect for busy teaching days.", accent: "emerald" },
  { icon: Shield, title: "Audit trail", description: "Every attendance mark is timestamped and linked to the teacher who recorded it. Full accountability.", accent: "violet" },
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

/* ─── Trend data ─── */
const TREND_WEEKS = [
  { week: "W1", rate: 96 },
  { week: "W2", rate: 92 },
  { week: "W3", rate: 88 },
  { week: "W4", rate: 94 },
  { week: "W5", rate: 90 },
  { week: "W6", rate: 97 },
  { week: "W7", rate: 93 },
  { week: "W8", rate: 95 },
];

/* ─── Steps ─── */
const STEPS = [
  { num: "01", title: "Open the register", description: "The daily register shows today's lessons with all students. Open it before, during, or after teaching.", icon: ClipboardCheck },
  { num: "02", title: "Mark each student", description: "Tap present, absent, late, or cancelled. Add an absence reason if needed. Done in seconds.", icon: CheckCircle },
  { num: "03", title: "Review and report", description: "Attendance data flows into student profiles, reports, and billing. Parents see it in their portal.", icon: BarChart3 },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Receipt, title: "Invoicing & Billing", description: "Bill for attended lessons only or all scheduled lessons. Attendance drives accurate invoicing.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: Users, title: "Parent Portal", description: "Parents see their child's attendance history in real time. No need for manual reports.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist who's been absent recently, or get attendance trend summaries this term.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureAttendance() {
  usePageMeta(
    "Attendance Tracking for Music Lessons — Register, Reports & Alerts | LessonLoop",
    "Track music lesson attendance with a daily register, absence categorisation, parent notifications, and trend reports. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/attendance",
      ogTitle: "Attendance Tracking for Music Lessons | LessonLoop",
      ogDescription: "Daily register, absence categorisation, parent notifications, and attendance trend reports for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/attendance",
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
        featureName="Attendance Tracking"
        description="Music lesson attendance tracking with daily register, absence categorisation, parent notifications, and trend reports."
        canonical="https://lessonloop.co.uk/features/attendance"
        breadcrumbName="Attendance"
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
          style={{ background: "radial-gradient(circle, hsl(var(--emerald)) 0%, transparent 70%)", y: bgY }}
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--emerald)/0.1)] border border-[hsl(var(--emerald)/0.2)]">
                <ClipboardCheck className="w-4 h-4 text-[hsl(var(--emerald))]" />
                <span className="text-sm font-semibold text-[hsl(var(--emerald))] tracking-wide">Attendance Tracking</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Attendance tracking that{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--emerald))] to-[hsl(var(--emerald-dark))] bg-clip-text text-transparent">
                  takes seconds
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                A daily register built for music teachers. Mark attendance in one tap, categorise absences, notify parents, and track trends — all connected to your schedule and billing.
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

            {/* Right: interactive register */}
            <div className="relative">
              <HeroRegisterCard />
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
              Attendance shouldn't be <span className="text-[hsl(var(--coral))]">guesswork</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Scribbled notes, forgotten marks, and no idea who's been absent three weeks in a row.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Clock, title: "Takes too long", description: "Marking attendance in a spreadsheet or notebook after every lesson. Tedious and easy to forget." },
              { icon: AlertTriangle, title: "No absence patterns", description: "You don't notice a student has missed four lessons until a parent asks why they're being billed." },
              { icon: XCircle, title: "No parent visibility", description: "Parents don't know if their child was marked present or absent unless you tell them manually." },
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
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--emerald))] mb-4">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Attendance built into your <span className="text-[hsl(var(--emerald))]">workflow</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Mark attendance from the daily register or directly on any lesson. Everything flows into reports and billing automatically.
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

      {/* ═══ ATTENDANCE TREND ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Left: visual trend */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-border/60 bg-card shadow-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Attendance Rate</h3>
                  <p className="text-xs text-muted-foreground">Autumn Term 2025 · All students</p>
                </div>
                <span className="text-2xl font-bold text-[hsl(var(--emerald))]">93%</span>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-2 h-32">
                {TREND_WEEKS.map((w, i) => (
                  <motion.div
                    key={w.week}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: "easeOut" }}
                    className="flex-1 flex flex-col items-center gap-1 origin-bottom"
                  >
                    <div
                      className={`w-full rounded-t-md ${w.rate >= 93 ? "bg-[hsl(var(--emerald))]" : w.rate >= 90 ? "bg-[hsl(var(--emerald)/0.6)]" : "bg-[hsl(var(--coral)/0.6)]"}`}
                      style={{ height: `${(w.rate - 80) * 5}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{w.week}</span>
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--emerald))]" /> ≥93%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--emerald)/0.6)]" /> 90–92%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--coral)/0.6)]" /> &lt;90%</span>
              </div>
            </motion.div>

            {/* Right: copy */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-5"
            >
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--emerald))]">Trend Reports</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Spot patterns <span className="text-[hsl(var(--emerald))]">before they become problems</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                See attendance rates by week, student, teacher, or instrument. Identify drops early, support struggling students, and keep parents informed.
              </p>
              <div className="space-y-3 pt-2">
                <Link to="/features/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  Explore reporting features <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  See student profiles <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Attendance in <span className="text-[hsl(var(--emerald))]">three taps</span></h2>
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
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--emerald)/0.1)] flex items-center justify-center mx-auto">
                    <step.icon className="w-6 h-6 text-[hsl(var(--emerald))]" />
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
                  <r.icon className="w-6 h-6 text-[hsl(var(--emerald))] mb-3" />
                  <h3 className="font-bold text-foreground mb-2">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.description}</p>
                  <span className="text-sm font-semibold text-[hsl(var(--emerald))] inline-flex items-center gap-1">
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--emerald)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Never lose track of attendance <span className="text-[hsl(var(--emerald-light))]">again.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            A daily register that takes seconds, not minutes. Connected to billing, parent notifications, and trend reports.
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
