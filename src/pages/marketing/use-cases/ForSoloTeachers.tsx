import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, CalendarDays, CreditCard, Clock, Smartphone, MessageSquare,
  AlertTriangle, FileSpreadsheet, BanknoteIcon, Brain, Sparkles, BookOpen,
  ArrowRight, ChevronRight, CheckCircle2, Music, Globe, Receipt,
  PoundSterling, Send, Bell,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/solo-teachers";

const FAQS = [
  { question: "Is LessonLoop free for solo teachers?", answer: "LessonLoop offers a generous free tier and a 30-day trial of all premium features. Solo teachers can run their entire studio on the free plan." },
  { question: "Do I need technical skills to set up LessonLoop?", answer: "Not at all. Sign up, add your students, set your schedule, and you're ready. Onboarding takes under 10 minutes." },
  { question: "Can parents book lessons directly?", answer: "Yes. Share your public booking page and parents can request trial lessons or regular slots based on your availability." },
  { question: "Does it handle invoicing and payments?", answer: "Yes — generate professional invoices in GBP, track payments, send reminders, and accept online payments via Stripe." },
  { question: "Can I switch from spreadsheets easily?", answer: "Yes. Import students and guardians via CSV. Most teachers are fully set up within 15 minutes." },
];

/* ─── Hero: Solo Teacher Day Mockup ─── */
const TODAY_SCHEDULE = [
  { time: "14:00", student: "Lily S.", instrument: "Piano", type: "Regular", status: "confirmed" as const },
  { time: "14:45", student: "Oscar B.", instrument: "Piano", type: "Regular", status: "confirmed" as const },
  { time: "15:30", student: "Mia T.", instrument: "Piano", type: "Trial", status: "new" as const },
  { time: "16:15", student: "Noah K.", instrument: "Piano", type: "Regular", status: "confirmed" as const },
  { time: "17:00", student: "Ava D.", instrument: "Piano", type: "Make-up", status: "rescheduled" as const },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: "bg-[hsl(var(--emerald)/0.1)]", text: "text-[hsl(var(--emerald))]", label: "Confirmed" },
  new: { bg: "bg-[hsl(var(--violet)/0.1)]", text: "text-[hsl(var(--violet))]", label: "Trial" },
  rescheduled: { bg: "bg-[hsl(var(--teal)/0.1)]", text: "text-[hsl(var(--teal))]", label: "Make-up" },
};

function HeroSoloDayView() {
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
            <h3 className="text-sm font-bold text-foreground">Today — Thursday</h3>
            <p className="text-xs text-muted-foreground">5 lessons · 3h 45m teaching</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--emerald)/0.1)] text-[hsl(var(--emerald))]"
          >
            All confirmed
          </motion.div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-px bg-border/20">
          {[
            { label: "This month", value: "£1,840" },
            { label: "Outstanding", value: "£120" },
            { label: "Students", value: "18" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              className="bg-card px-3 py-2.5 text-center"
            >
              <p className="text-xs font-bold text-foreground">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Lessons */}
        <div className="border-t border-border/40">
          {TODAY_SCHEDULE.map((lesson, i) => {
            const s = STATUS_STYLE[lesson.status];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.35 }}
                className="px-5 py-3 border-b border-border/15 last:border-0 flex items-center gap-3"
              >
                <span className="text-[11px] font-bold text-primary w-10 flex-shrink-0">{lesson.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground truncate">{lesson.student}</p>
                  <p className="text-[9px] text-muted-foreground">{lesson.instrument} · 45 min</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text} flex-shrink-0`}>
                  {s.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Quick action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="px-5 py-3 border-t border-border/40 flex items-center justify-between"
        >
          <span className="text-[10px] text-muted-foreground">1 invoice overdue</span>
          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
            <Send className="w-3 h-3" /> Send reminder
          </span>
        </motion.div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--coral))] text-white text-xs font-bold shadow-lg"
      >
        Zero admin
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute bottom-20 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Globe className="w-3 h-3" /> Booking page
      </motion.div>
    </motion.div>
  );
}

/* ─── Before / After ─── */
const BEFORE_ITEMS = [
  "Google Calendar for bookings",
  "Excel spreadsheet for invoices",
  "WhatsApp for parent messages",
  "Notebook for student notes",
  "Mental load for make-ups",
  "Sunday evenings doing admin",
];

const AFTER_ITEMS = [
  "One calendar with conflict detection",
  "One-click invoice generation",
  "Built-in messaging & portal",
  "Student profiles with full history",
  "Automated make-up tracking",
  "Admin done in minutes, not hours",
];

/* ─── Features ─── */
const FEATURES = [
  { icon: CalendarDays, title: "Simple, visual scheduling", description: "Drag-and-drop calendar with recurring lessons, availability, and automatic conflict detection.", to: "/features/scheduling", linkText: "Explore scheduling features", accent: "teal" },
  { icon: CreditCard, title: "One-click invoicing", description: "Generate monthly or termly invoices in GBP. Automatic reminders chase payments for you.", to: "/features/billing", linkText: "See invoicing and billing", accent: "coral" },
  { icon: MessageSquare, title: "Built-in messaging", description: "Message parents from LessonLoop instead of your personal phone. Templates save time.", to: "/features/messaging", linkText: "Explore messaging features", accent: "violet" },
  { icon: BookOpen, title: "Practice tracking", description: "Set assignments, track student practice logs, and share progress with parents.", to: "/features/practice-tracking", linkText: "See practice tracking", accent: "emerald" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask your AI assistant to draft emails, summarise student progress, or suggest schedule changes.", to: "/features/loopassist", linkText: "Meet LoopAssist AI", accent: "teal" },
  { icon: Globe, title: "Public booking page", description: "Share a branded booking link. New enquiries pick a time and you approve — no back-and-forth texts.", to: "/features/scheduling", linkText: "Learn about booking pages", accent: "violet" },
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
export default function ForSoloTeachers() {
  usePageMeta(
    "Software for Private Music Teachers | LessonLoop",
    "Schedule lessons, send invoices, and manage students — all from one app built for solo music teachers in the UK. Free to start.",
    {
      ogTitle: "Software for Private Music Teachers | LessonLoop",
      ogDescription: "LessonLoop helps private music teachers schedule, invoice, and communicate with families — without the admin overhead.",
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
        name="Solo Music Teacher Software"
        description="Scheduling, invoicing, and student management software designed for private music teachers."
        canonical={CANONICAL}
        breadcrumbName="Solo Teachers"
        faqs={FAQS}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -left-40 w-[500px] h-[500px] rounded-full opacity-10"
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--coral)/0.1)] border border-[hsl(var(--coral)/0.2)]">
                <User className="w-4 h-4 text-[hsl(var(--coral))]" />
                <span className="text-sm font-semibold text-[hsl(var(--coral))] tracking-wide">For Solo Teachers</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Teach more, admin less —{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--coral))] to-[hsl(var(--coral-dark))] bg-clip-text text-transparent">
                  your studio, simplified
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Professional scheduling, instant invoicing, and a parent portal that makes you look like an academy — even if it's just you.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
                >
                  Start free — no card needed <ArrowRight className="w-4 h-4" />
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
              <HeroSoloDayView />
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
              You went into teaching for the music,{" "}
              <span className="text-[hsl(var(--coral))]">not the spreadsheets</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              The solo teacher juggling act: scheduling, invoicing, messaging, chasing payments — every evening, every weekend.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Chasing payments", description: "Reminding parents to pay feels awkward. Late payments pile up and cash flow suffers." },
              { icon: Clock, title: "Evenings lost to admin", description: "Scheduling, rescheduling, texting confirmations, creating invoices — every single evening." },
              { icon: FileSpreadsheet, title: "Scattered systems", description: "Google Calendar for bookings, Excel for invoices, WhatsApp for messages. Nothing connects." },
              { icon: BanknoteIcon, title: "No financial overview", description: "You know you're busy, but can't see monthly income, outstanding fees, or trends at a glance." },
              { icon: Brain, title: "Mental load", description: "Remembering who cancelled, who needs a make-up, which parent hasn't been invoiced yet." },
              { icon: Smartphone, title: "Always on the phone", description: "Parents text at all hours. No boundaries between teaching and administration." },
            ].map((pain, i) => (
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

      {/* ═══ BEFORE / AFTER ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              From <span className="text-[hsl(var(--coral))]">juggling</span> to <span className="text-primary">flow</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-[hsl(var(--coral)/0.3)] bg-[hsl(var(--coral)/0.03)] p-6"
            >
              <p className="text-sm font-bold text-[hsl(var(--coral))] uppercase tracking-wider mb-4">Before LessonLoop</p>
              <ul className="space-y-3">
                {BEFORE_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-[hsl(var(--coral)/0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[hsl(var(--coral))] text-[10px] font-bold">✕</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* After */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-[hsl(var(--emerald)/0.3)] bg-[hsl(var(--emerald)/0.03)] p-6"
            >
              <p className="text-sm font-bold text-[hsl(var(--emerald))] uppercase tracking-wider mb-4">After LessonLoop</p>
              <ul className="space-y-3">
                {AFTER_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--emerald))] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Everything You Need</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Run a professional studio <span className="text-primary">without hiring anyone</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className={`p-6 rounded-2xl border-l-4 ${ACCENT_BORDER[feat.accent]} border border-border/30 bg-card hover:shadow-lg transition-shadow duration-300`}
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
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[hsl(var(--coral))] flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">"</span>
            </div>
            <blockquote className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
              I used to spend my Sundays doing invoices. Now LessonLoop does it in one click and parents pay through the portal. I've got my weekends back.
            </blockquote>
            <div>
              <p className="font-bold text-foreground">James T.</p>
              <p className="text-sm text-muted-foreground">Private Piano Teacher, Bristol</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARE STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Switching from something else?</h2>
            <p className="text-sm text-muted-foreground mt-2">See how LessonLoop compares</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
              { label: "vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
              { label: "vs Fons", to: "/compare/lessonloop-vs-fons" },
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--coral)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Focus on teaching, <span className="text-[hsl(var(--coral-light,var(--coral)))]">not paperwork.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Join thousands of UK music teachers using LessonLoop to run a professional studio — free to start, no credit card required.
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
