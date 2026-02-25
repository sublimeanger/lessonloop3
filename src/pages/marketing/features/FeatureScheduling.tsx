import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import {
  Calendar, Clock, Repeat, AlertTriangle, Users, MapPin,
  CalendarDays, RefreshCw, Bell, Eye, Layers, GripVertical,
  Receipt, MessageSquare, Sparkles, ArrowRight, Check, Zap,
  Shield, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calendarReal } from "@/assets/marketing";

const faqs = [
  { question: "Can I set up recurring weekly lessons?", answer: "Yes. Create a lesson once and LessonLoop generates every occurrence across the term automatically, respecting closure dates and holidays." },
  { question: "Does LessonLoop detect scheduling conflicts?", answer: "Absolutely. Real-time conflict detection prevents double-booking teachers, rooms, or students before you save." },
  { question: "Can I manage multiple locations?", answer: "Yes. Each location has its own rooms, availability, and closure dates. Switch between them from one calendar view." },
  { question: "What happens when I reschedule a lesson?", answer: "Drag-and-drop or edit the lesson. LessonLoop updates the calendar, notifies parents, and syncs with Google Calendar if connected." },
  { question: "Does it work with UK term dates?", answer: "Yes. Define your own terms, half-terms, and bank holidays. Recurring lessons automatically skip closure dates." },
];

/* ─── Animated calendar hero ─── */
const LESSONS = [
  { day: 0, start: 0, dur: 1, label: "Piano — Ella M", colour: "bg-primary" },
  { day: 0, start: 3, dur: 1, label: "Violin — Jack R", colour: "bg-violet" },
  { day: 1, start: 1, dur: 2, label: "Group Guitar", colour: "bg-coral" },
  { day: 1, start: 5, dur: 1, label: "Drums — Liam", colour: "bg-emerald" },
  { day: 2, start: 0, dur: 1, label: "Piano — Maya K", colour: "bg-primary" },
  { day: 2, start: 2, dur: 1, label: "Flute — Ava S", colour: "bg-violet" },
  { day: 2, start: 4, dur: 2, label: "Theory Class", colour: "bg-coral" },
  { day: 3, start: 0, dur: 1, label: "Piano — Ella M", colour: "bg-primary" },
  { day: 3, start: 3, dur: 1, label: "Cello — Noah", colour: "bg-emerald" },
  { day: 4, start: 1, dur: 1, label: "Trumpet — Zoe", colour: "bg-violet" },
  { day: 4, start: 4, dur: 1, label: "Sax — Oscar", colour: "bg-coral" },
];

function HeroCalendar() {
  return (
    <div className="relative">
      {/* Outer glow */}
      <div className="absolute -inset-8 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-ink/10 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/60 bg-muted/40">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald/50" />
          </div>
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">LessonLoop — Calendar</span>
        </div>

        <img
          src={calendarReal}
          alt="LessonLoop drag-and-drop music lesson calendar showing a full week of scheduled piano, guitar, and vocal lessons"
          className="w-full h-auto block"
          width={1920}
          height={1080}
          loading="eager"
        />
      </div>

      {/* Floating conflict badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.0, type: "spring", stiffness: 200 }}
        className="absolute -bottom-5 -left-3 sm:-left-6 z-10"
      >
        <div className="flex items-center gap-2.5 bg-card border border-emerald/30 rounded-xl px-4 py-2.5 shadow-xl shadow-emerald/5">
          <div className="w-7 h-7 rounded-full bg-emerald/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">No conflicts</p>
            <p className="text-[10px] text-muted-foreground">All clear this week</p>
          </div>
        </div>
      </motion.div>

      {/* Floating recurring badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
        className="absolute -top-4 -right-3 sm:-right-6 z-10"
      >
        <div className="flex items-center gap-2 bg-card border border-primary/30 rounded-xl px-3 py-2 shadow-xl shadow-primary/5">
          <Repeat className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">12 lessons generated</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Data ─── */
const painPoints = [
  { icon: AlertTriangle, title: "Double bookings & conflicts", description: "Generic calendars don't understand teacher availability, room capacity, or student overlap — so clashes happen constantly." },
  { icon: Clock, title: "Hours lost to admin", description: "Setting up recurring lessons, handling reschedules, chasing confirmations — it all adds up to hours you should be teaching." },
  { icon: Repeat, title: "Term dates are manual", description: "UK term dates, half-terms, bank holidays — most tools ignore them entirely, leaving you to manually skip or cancel." },
];

const capabilities = [
  {
    icon: GripVertical,
    title: "Drag-and-drop rescheduling",
    description: "Move lessons between slots, days, and rooms with a single drag. Changes notify parents and sync instantly.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: Repeat,
    title: "Smart recurring lessons",
    description: "Weekly, fortnightly, or custom patterns. Auto-generates the whole term and skips your closure dates.",
    accent: "from-violet/20 to-violet/5",
  },
  {
    icon: Eye,
    title: "Real-time conflict detection",
    description: "Clashes for teachers, rooms, and students are caught before you save. Never double-book again.",
    accent: "from-coral/20 to-coral/5",
  },
  {
    icon: CalendarDays,
    title: "UK term date engine",
    description: "Define your terms, half-terms, and bank holidays. Recurring lessons automatically skip blocked dates.",
    accent: "from-emerald/20 to-emerald/5",
  },
  {
    icon: MapPin,
    title: "Multi-location & rooms",
    description: "Manage multiple venues with individual rooms, availability windows, and closure dates from one view.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: RefreshCw,
    title: "Google Calendar sync",
    description: "Two-way sync keeps personal and teaching calendars aligned. Changes appear in Google instantly.",
    accent: "from-violet/20 to-violet/5",
  },
];

const metrics = [
  { value: "3hrs", label: "saved per week on average" },
  { value: "0", label: "double bookings after switching" },
  { value: "30s", label: "to create a recurring series" },
];

const steps = [
  { num: "01", title: "Set your availability", description: "Define when and where you teach. Set term dates, closure days, and room availability.", icon: Calendar },
  { num: "02", title: "Create your lessons", description: "Add one-off or recurring lessons. Assign students, teachers, and rooms. Conflicts caught instantly.", icon: Zap },
  { num: "03", title: "Teach with confidence", description: "Your calendar is always current. Reschedule with drag-and-drop. Parents notified automatically.", icon: Shield },
];

const relatedFeatures = [
  { icon: Receipt, title: "Invoicing & Billing", description: "Lessons flow straight into invoices. Bill by term, month, or lesson count.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: MessageSquare, title: "Parent Portal", description: "Parents see upcoming lessons, receive updates, and confirm changes — no email chains.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask your AI copilot to find gaps, suggest reschedule slots, or summarise your week.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

export default function FeatureScheduling() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  usePageMeta(
    "Music Lesson Scheduling Software — Drag & Drop Calendar | LessonLoop",
    "Schedule music lessons with drag-and-drop ease. Recurring lessons, conflict detection, UK term dates, multi-location support, and Google Calendar sync. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/scheduling",
      ogTitle: "Music Lesson Scheduling Software | LessonLoop",
      ogDescription: "Drag-and-drop calendar built for music teachers. Recurring lessons, conflict detection, term dates, and Google Calendar sync.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/scheduling",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Music Lesson Scheduling"
        description="Drag-and-drop calendar for music teachers with recurring lessons, conflict detection, UK term dates, and multi-location support."
        canonical="https://lessonloop.co.uk/features/scheduling"
        breadcrumbName="Scheduling"
        faqs={faqs}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO — Full-width immersive with calendar as centerpiece
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-36 overflow-hidden bg-background">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          {/* Text — centered, tight */}
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-semibold mb-6"
            >
              <Calendar className="w-4 h-4" />
              Scheduling
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.1] tracking-tight"
            >
              Your teaching week,{" "}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-primary to-teal-dark bg-clip-text text-transparent">
                  beautifully organised
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-teal-dark rounded-full origin-left"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              A drag-and-drop calendar built for the way music teachers really work — with recurring lessons, real-time conflict detection, and full UK term date support.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button size="lg" asChild className="text-base px-8">
                <Link to="/signup">
                  Start free trial <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base">
                <Link to="/pricing">View plans and pricing</Link>
              </Button>
            </motion.div>
          </div>

          {/* Calendar — the hero centerpiece */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="max-w-4xl mx-auto"
          >
            <HeroCalendar />
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SOCIAL PROOF — Metric strip
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-12 border-y border-border/50 bg-muted/20">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 lg:gap-24">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl lg:text-4xl font-bold text-foreground">{m.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{m.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PROBLEM — Dark immersive, left-aligned editorial
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={parallaxRef} className="py-24 lg:py-32 bg-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,hsl(var(--primary)/0.06),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,hsl(var(--coral)/0.04),transparent_50%)] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Left — editorial text */}
            <div>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-xs font-bold uppercase tracking-[0.25em] text-coral block mb-5"
              >
                The problem
              </motion.span>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl lg:text-[2.75rem] font-bold text-primary-foreground leading-[1.15] mb-5"
              >
                Scheduling shouldn't be your second job
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="text-lg text-primary-foreground/50 max-w-lg"
              >
                Most calendar tools weren't designed for music teaching. You end up working around them instead of with them.
              </motion.p>
            </div>

            {/* Right — pain point cards, stacked vertically */}
            <div className="space-y-4">
              {painPoints.map((point, i) => (
                <motion.div
                  key={point.title}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 items-start p-5 rounded-2xl bg-primary-foreground/[0.03] border border-primary-foreground/[0.06] hover:border-coral/20 transition-colors"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-coral/10 border border-coral/15 flex items-center justify-center">
                    <point.icon className="w-5 h-5 text-coral" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-primary-foreground mb-1">{point.title}</h3>
                    <p className="text-sm text-primary-foreground/40 leading-relaxed">{point.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CAPABILITIES — Large cards with gradient left border
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary block mb-4">The solution</span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight">
              A calendar designed for music teachers
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every feature was built from real teaching patterns — not generic project management.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4 lg:gap-5 max-w-5xl">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group relative rounded-2xl border border-border bg-card p-6 lg:p-8 overflow-hidden hover:shadow-lg hover:border-border/80 transition-all duration-300"
              >
                {/* Gradient left accent */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b", cap.accent)} />

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                    <cap.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-1.5">{cap.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HOW IT WORKS — Three large numbered cards
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 lg:py-32 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none -translate-y-1/2 translate-x-1/3" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary block mb-4">How it works</span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground">
              Up and running in minutes
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative group"
              >
                <div className="h-full rounded-2xl border border-border bg-card p-8 hover:shadow-lg transition-all duration-300">
                  {/* Large step number */}
                  <span className="text-6xl font-bold text-muted-foreground/10 absolute top-5 right-6 select-none group-hover:text-primary/10 transition-colors">
                    {step.num}
                  </span>

                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>

                {/* Arrow between cards — desktop */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-sm">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FAQ — Clean accordion style
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Frequently asked questions</h2>
              <p className="text-muted-foreground">
                Everything you need to know about LessonLoop's{" "}
                <Link to="/features/scheduling" className="text-primary hover:underline">music lesson scheduling</Link>{" "}
                features.
              </p>
            </motion.div>

            <div className="space-y-0 divide-y divide-border">
              {faqs.map((faq, i) => (
                <motion.details
                  key={faq.question}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group py-5"
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <span className="text-base font-semibold text-foreground pr-4">{faq.question}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed pr-8">{faq.answer}</p>
                </motion.details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RELATED FEATURES
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 lg:py-28 bg-muted/20 border-t border-border/50">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Works beautifully with</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {relatedFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={feature.to}
                  className="flex flex-col h-full p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{feature.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {feature.linkText} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CTA — Clean, dark, confident
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 lg:py-36 bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,hsl(var(--primary)/0.1),transparent_65%)] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold text-primary-foreground leading-tight"
          >
            Ready to take control of your schedule?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-lg text-primary-foreground/50"
          >
            Join hundreds of UK music teachers who've swapped spreadsheets for a calendar that understands music teaching.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button size="lg" className="bg-primary-foreground text-ink hover:bg-primary-foreground/90 text-base px-8" asChild>
              <Link to="/signup">
                Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base" asChild>
              <Link to="/pricing">View plans and pricing</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="mt-6 text-sm text-primary-foreground/30"
          >
            No credit card required · 30-day free trial · Cancel anytime
          </motion.p>
        </div>
      </section>
    </MarketingLayout>
  );
}
