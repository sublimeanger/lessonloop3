import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  BarChart3, Clock, AlertTriangle, PoundSterling, TrendingUp,
  FileText, Download, PieChart, Users, CalendarDays, Filter,
  Calendar, Receipt, Sparkles, ArrowRight, ChevronRight,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "What reports are available?", answer: "Revenue, outstanding invoices, payroll, lessons delivered, cancellation rates, teacher utilisation, and attendance trends." },
  { question: "Can I export reports?", answer: "Yes. Export any report as PDF or CSV for your records, accountant, or board meetings." },
  { question: "Can I filter reports by date range?", answer: "Absolutely. Filter by term, month, custom date range, teacher, location, or instrument." },
  { question: "Are reports real-time?", answer: "Yes. Reports pull from your live data. Revenue, attendance, and lesson counts are always up to date." },
  { question: "Can teachers see reports?", answer: "Teachers see their own payroll and lesson delivery reports. Revenue and financial reports are restricted to owners and admins." },
];

/* ─── Hero: Dashboard Mockup ─── */
const KPI_CARDS = [
  { label: "Revenue this term", value: "£14,280", change: "+12%", positive: true },
  { label: "Outstanding", value: "£1,640", change: "8 invoices", positive: false },
  { label: "Lessons delivered", value: "312", change: "+6% vs last term", positive: true },
  { label: "Attendance rate", value: "94%", change: "+2pp", positive: true },
];

const REVENUE_BARS = [
  { month: "Sep", amount: 4200 },
  { month: "Oct", amount: 4800 },
  { month: "Nov", amount: 5100 },
  { month: "Dec", amount: 3600 },
  { month: "Jan", amount: 4900 },
  { month: "Feb", amount: 5300 },
];

const AGEING_ROWS = [
  { band: "0–7 days", count: 3, total: "£420" },
  { band: "8–30 days", count: 2, total: "£580" },
  { band: "31–60 days", count: 2, total: "£440" },
  { band: "60+ days", count: 1, total: "£200" },
];

function HeroDashboardMockup() {
  const maxAmount = Math.max(...REVENUE_BARS.map((b) => b.amount));

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
            <h3 className="text-sm font-bold text-foreground">Reports Dashboard</h3>
            <p className="text-xs text-muted-foreground">Autumn Term 2025 · All locations</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/40 text-xs font-medium text-muted-foreground"
          >
            <Download className="w-3 h-3" /> Export
          </motion.div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-0 border-b border-border/30">
          {KPI_CARDS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`px-4 py-3 ${i % 2 === 0 ? "border-r border-border/30" : ""} ${i < 2 ? "border-b border-border/30" : ""}`}
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
              <span className={`text-[10px] font-semibold ${kpi.positive ? "text-[hsl(var(--emerald))]" : "text-[hsl(var(--coral))]"}`}>
                {kpi.change}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="px-5 py-4 border-b border-border/30">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Monthly Revenue</p>
          <div className="flex items-end gap-2 h-20">
            {REVENUE_BARS.map((bar, i) => (
              <motion.div
                key={bar.month}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.7 + i * 0.08, duration: 0.4, ease: "easeOut" }}
                className="flex-1 flex flex-col items-center gap-1 origin-bottom"
              >
                <span className="text-[8px] font-bold text-muted-foreground">£{(bar.amount / 1000).toFixed(1)}k</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-[hsl(var(--teal-light))]"
                  style={{ height: `${(bar.amount / maxAmount) * 100}%` }}
                />
                <span className="text-[9px] text-muted-foreground">{bar.month}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Ageing mini-table */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Outstanding Ageing</p>
          {AGEING_ROWS.map((row, i) => (
            <motion.div
              key={row.band}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1 + i * 0.08 }}
              className="flex items-center justify-between py-1.5 border-b border-border/15 last:border-0"
            >
              <span className="text-xs text-foreground">{row.band}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">{row.count} inv</span>
                <span className={`text-xs font-bold ${row.band.includes("60") ? "text-[hsl(var(--coral))]" : "text-foreground"}`}>{row.total}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg"
      >
        Real-time data
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute bottom-8 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-[hsl(var(--violet-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Download className="w-3 h-3" /> PDF / CSV
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: PoundSterling, title: "Revenue reports", description: "Total revenue by term, month, teacher, or instrument. Compare periods and spot trends.", accent: "teal" },
  { icon: TrendingUp, title: "Outstanding ageing", description: "Invoices overdue by 7, 30, 60, or 90+ days. Know exactly who owes what and for how long.", accent: "coral" },
  { icon: Users, title: "Payroll reports", description: "Teacher earnings calculated from delivered lessons and pay rates. Export for your payroll provider.", accent: "violet" },
  { icon: CalendarDays, title: "Lessons delivered", description: "Count lessons by teacher, student, instrument, or location. Track delivery against expectations.", accent: "emerald" },
  { icon: PieChart, title: "Utilisation & cancellations", description: "Room utilisation, teacher capacity, and cancellation rates. Optimise your schedule.", accent: "teal" },
  { icon: Filter, title: "Flexible filters", description: "Filter any report by date range, term, teacher, location, or instrument. Drill down to the detail.", accent: "violet" },
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

/* ─── Report types showcase ─── */
const REPORT_TYPES = [
  { icon: PoundSterling, title: "Revenue", description: "Total income by period, teacher, instrument, or location.", color: "teal" },
  { icon: TrendingUp, title: "Outstanding", description: "Aged debt breakdown — 7, 30, 60, 90+ day bands.", color: "coral" },
  { icon: Users, title: "Payroll", description: "Per-teacher earnings from delivered lessons.", color: "violet" },
  { icon: CalendarDays, title: "Delivery", description: "Lesson counts vs expectations by any dimension.", color: "emerald" },
  { icon: PieChart, title: "Utilisation", description: "Room and teacher capacity usage rates.", color: "teal" },
  { icon: BarChart3, title: "Attendance", description: "Per-student and per-teacher attendance trends.", color: "coral" },
];

/* ─── Steps ─── */
const STEPS = [
  { num: "01", title: "Open reports", description: "Navigate to reports. All reports are pre-built and ready — no configuration needed.", icon: BarChart3 },
  { num: "02", title: "Filter and explore", description: "Choose your date range, teacher, location, or instrument. Reports update instantly.", icon: Filter },
  { num: "03", title: "Export and share", description: "Download as PDF or CSV. Share with your accountant, co-owner, or board.", icon: Download },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Receipt, title: "Invoicing & Billing", description: "Revenue and outstanding reports are built directly from your invoice and payment data.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: Calendar, title: "Scheduling", description: "Lessons delivered and utilisation reports come from your actual calendar data.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist for quick summaries — revenue this term, outstanding totals, or cancellation trends.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureReports() {
  usePageMeta(
    "Reports for Music Schools — Revenue, Attendance & Payroll | LessonLoop",
    "Real-time reports for music schools. Revenue, outstanding invoices, payroll, attendance, and utilisation — with PDF/CSV export. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/reports",
      ogTitle: "Reports for Music Schools | LessonLoop",
      ogDescription: "Revenue, outstanding invoices, payroll, attendance, and utilisation reports — all real-time with PDF/CSV export.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/reports",
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
        featureName="Reports & Analytics"
        description="Real-time reports for music schools — revenue, outstanding invoices, payroll, attendance, and teacher utilisation."
        canonical="https://lessonloop.co.uk/features/reports"
        breadcrumbName="Reports"
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
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">Reports & Analytics</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Know exactly how your school is{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                  performing
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Revenue, outstanding invoices, payroll, attendance, and utilisation — real-time reports built from your actual schedule and billing data.
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

            {/* Right: dashboard mockup */}
            <div className="relative">
              <HeroDashboardMockup />
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
              Running blind <span className="text-[hsl(var(--coral))]">costs you money</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Without clear reports, you can't see what's working, what's overdue, or where you're losing income.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "No revenue visibility", description: "How much did you earn this term? How much is outstanding? Without reports, you're guessing." },
              { icon: Clock, title: "Manual calculations", description: "Adding up lessons, calculating teacher pay, and tallying invoices in spreadsheets — every single month." },
              { icon: PoundSterling, title: "Money slipping through", description: "Overdue invoices go unnoticed. Cancellation patterns aren't tracked. Revenue leaks you can't see." },
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
              Reports that answer the questions that <span className="text-primary">matter</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Every report is built from your real data — schedule, attendance, invoices, and payments. Always up to date, always accurate.
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

      {/* ═══ REPORT TYPES GRID ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))] mb-4">Report Library</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Six reports. <span className="text-[hsl(var(--violet))]">Zero configuration.</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Every report is pre-built and ready. Open, filter, export. No setup required.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {REPORT_TYPES.map((report, i) => (
              <motion.div
                key={report.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-center"
              >
                <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                  report.color === "teal" ? "bg-[hsl(var(--teal)/0.1)]" :
                  report.color === "coral" ? "bg-[hsl(var(--coral)/0.1)]" :
                  report.color === "violet" ? "bg-[hsl(var(--violet)/0.1)]" :
                  "bg-[hsl(var(--emerald)/0.1)]"
                }`}>
                  <report.icon className={`w-5 h-5 ${ICON_STYLES[report.color]}`} />
                </div>
                <h3 className="font-bold text-foreground text-sm mb-1">{report.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{report.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 space-y-2"
          >
            <Link to="/features/billing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
              See how invoicing powers revenue reports <ChevronRight className="w-4 h-4" />
            </Link>
            <br />
            <Link to="/features/attendance" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
              See how attendance tracking feeds reports <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Insights in <span className="text-primary">seconds</span></h2>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Reports are powered by</h2>
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
            Stop guessing. <span className="text-[hsl(var(--teal-light))]">Start knowing.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Revenue, payroll, attendance, and utilisation — all calculated from your real data. No spreadsheets required.
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
