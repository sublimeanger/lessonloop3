import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, Repeat, AlertTriangle, Users, MapPin,
  CalendarDays, RefreshCw, Bell, Eye, Layers, GripVertical,
  Receipt, MessageSquare, Sparkles, ArrowRight, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  { question: "Can I set up recurring weekly lessons?", answer: "Yes. Create a lesson once and LessonLoop generates every occurrence across the term automatically, respecting closure dates and holidays." },
  { question: "Does LessonLoop detect scheduling conflicts?", answer: "Absolutely. Real-time conflict detection prevents double-booking teachers, rooms, or students before you save." },
  { question: "Can I manage multiple locations?", answer: "Yes. Each location has its own rooms, availability, and closure dates. Switch between them from one calendar view." },
  { question: "What happens when I reschedule a lesson?", answer: "Drag-and-drop or edit the lesson. LessonLoop updates the calendar, notifies parents, and syncs with Google Calendar if connected." },
  { question: "Does it work with UK term dates?", answer: "Yes. Define your own terms, half-terms, and bank holidays. Recurring lessons automatically skip closure dates." },
];

/* ─── Mini calendar grid for the hero ─── */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = ["9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm"];

const calendarBlocks = [
  { col: 0, row: 0, span: 1, label: "Piano – Ella", color: "bg-primary/80" },
  { col: 0, row: 2, span: 1, label: "Violin – Jack", color: "bg-violet/70" },
  { col: 1, row: 1, span: 2, label: "Group Guitar", color: "bg-coral/70" },
  { col: 2, row: 0, span: 1, label: "Piano – Maya", color: "bg-primary/80" },
  { col: 2, row: 4, span: 1, label: "Drums – Liam", color: "bg-emerald/70" },
  { col: 3, row: 0, span: 1, label: "Piano – Ella", color: "bg-primary/80" },
  { col: 3, row: 3, span: 2, label: "Theory Class", color: "bg-violet/70" },
  { col: 4, row: 1, span: 1, label: "Flute – Ava", color: "bg-coral/70" },
  { col: 4, row: 5, span: 1, label: "Cello – Noah", color: "bg-emerald/70" },
];

function CalendarMockup() {
  return (
    <div className="relative w-full">
      {/* Browser chrome */}
      <div className="bg-card border border-border rounded-t-2xl px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-coral/60" />
          <div className="w-3 h-3 rounded-full bg-emerald/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-muted rounded-lg px-3 py-1 text-xs text-muted-foreground text-center">
            lessonloop.co.uk/calendar
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-t-0 border-border rounded-b-2xl p-3 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 mb-1">
          <div />
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] lg:text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 relative">
          {HOURS.map((h, rowIdx) => (
            <div key={h} className="contents">
              <div className="text-[9px] lg:text-[10px] text-muted-foreground/60 py-2 pr-1 text-right">
                {h}
              </div>
              {DAYS.map((_, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className="bg-muted/30 rounded h-8 lg:h-9 border border-border/30"
                />
              ))}
            </div>
          ))}

          {/* Lesson blocks overlaid */}
          {calendarBlocks.map((block, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.08, duration: 0.3 }}
              className={cn(
                "absolute rounded-md px-1.5 py-0.5 text-[8px] lg:text-[10px] font-medium text-primary-foreground leading-tight shadow-sm",
                block.color
              )}
              style={{
                left: `calc(40px + ${block.col} * (100% - 40px) / 5 + 2px)`,
                top: `${block.row * (36) + 2}px`,
                width: `calc((100% - 40px) / 5 - 4px)`,
                height: `${block.span * 36 - 4}px`,
              }}
            >
              {block.label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Floating accent */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        className="absolute -bottom-4 -right-4 bg-card border border-border rounded-xl px-3 py-2 shadow-lg flex items-center gap-2"
      >
        <div className="w-6 h-6 rounded-full bg-emerald/20 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-emerald" />
        </div>
        <span className="text-[10px] lg:text-xs font-medium text-foreground">No conflicts found</span>
      </motion.div>
    </div>
  );
}

/* ─── Pain point numbering ─── */
const painPoints = [
  { icon: AlertTriangle, title: "Double bookings & conflicts", description: "Generic calendars don't understand teacher availability, room capacity, or student overlap — so clashes happen constantly." },
  { icon: Clock, title: "Hours lost to admin", description: "Setting up recurring lessons, handling reschedules, chasing confirmations — it all adds up to hours you should be teaching." },
  { icon: Repeat, title: "Term dates are manual", description: "UK term dates, half-terms, bank holidays — most tools ignore them entirely, leaving you to manually skip or cancel." },
];

const solutionFeatures = [
  { icon: GripVertical, title: "Drag-and-drop calendar", description: "Move lessons with a simple drag. Day, week, and month views with colour-coded lessons by teacher, instrument, or location.", hero: true },
  { icon: Repeat, title: "Recurring lessons", description: "Set up weekly or fortnightly patterns once. LessonLoop generates every occurrence across the whole term automatically." },
  { icon: Eye, title: "Real-time conflict detection", description: "Instantly see clashes for teachers, rooms, and students before you save. No more double-booking." },
  { icon: CalendarDays, title: "UK term date support", description: "Define terms, half-terms, and closure dates. Recurring lessons automatically skip holidays and bank holidays." },
  { icon: MapPin, title: "Multi-location & rooms", description: "Manage multiple teaching venues, each with their own rooms, availability windows, and closure dates." },
  { icon: RefreshCw, title: "Google Calendar sync", description: "Two-way sync keeps your personal and teaching calendars aligned. Changes in LessonLoop appear in Google instantly." },
];

const steps = [
  { num: "01", title: "Set your availability", description: "Define when and where you teach. Set term dates, closure days, and room availability." },
  { num: "02", title: "Add your lessons", description: "Create one-off or recurring lessons. Assign students, teachers, and rooms. Conflicts are caught instantly." },
  { num: "03", title: "Teach with confidence", description: "Your calendar is always up to date. Reschedule with drag-and-drop. Parents are notified automatically." },
];

const relatedFeatures = [
  { icon: Receipt, title: "Invoicing & Billing", description: "Lessons flow straight into invoices. Bill by term, month, or lesson count.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: MessageSquare, title: "Parent Portal", description: "Parents see upcoming lessons, receive updates, and confirm changes — all without email chains.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask your AI assistant to find gaps, suggest reschedule slots, or summarise your week.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

export default function FeatureScheduling() {
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

      {/* ━━━ HERO — Split layout with calendar mockup ━━━ */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-violet/5 pointer-events-none" />
        <div className="absolute top-20 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-40 w-96 h-96 bg-violet/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div className="max-w-xl">
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6"
              >
                <Calendar className="w-4 h-4" />
                Scheduling
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1]"
              >
                Music lesson scheduling that{" "}
                <span className="bg-gradient-to-r from-primary to-teal-dark bg-clip-text text-transparent">
                  actually works
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 text-lg text-muted-foreground"
              >
                A drag-and-drop calendar built for the way music teachers really work — with recurring lessons, conflict detection, UK term dates, and multi-location support.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 flex flex-col sm:flex-row gap-4"
              >
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Start free trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/pricing">View pricing</Link>
                </Button>
              </motion.div>
            </div>

            {/* Right — animated calendar */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative"
            >
              <CalendarMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━ PROBLEM — Dark cinematic section, staggered layout ━━━ */}
      <section className="py-20 lg:py-28 bg-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />
        <div className="container relative mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral mb-4 block">The problem</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary-foreground leading-tight max-w-2xl">
              Scheduling shouldn't be your second job
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/60 max-w-xl">
              Most calendar tools weren't designed for music teaching. You end up working around them instead of with them.
            </p>
          </motion.div>

          <div className="space-y-6 max-w-4xl">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="flex gap-5 lg:gap-8 items-start group"
                style={{ paddingLeft: `${i * 32}px` }}
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-coral/15 border border-coral/20 flex items-center justify-center group-hover:bg-coral/25 transition-colors">
                  <point.icon className="w-6 h-6 text-coral" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary-foreground mb-1">{point.title}</h3>
                  <p className="text-primary-foreground/50 text-sm max-w-md">{point.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ SOLUTION — Bento grid with hero card ━━━ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4 block">The solution</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
              A calendar designed for music teachers
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every scheduling feature in LessonLoop was built from real teaching patterns — not generic project management.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {solutionFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={cn(
                  "relative rounded-2xl border border-border p-6 lg:p-8 transition-all duration-300 group",
                  feature.hero
                    ? "lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-primary/5 via-card to-teal-light/10 hover:border-primary/40"
                    : "bg-card hover:border-primary/20 hover:shadow-md"
                )}
              >
                <div className={cn(
                  "rounded-xl flex items-center justify-center mb-4",
                  feature.hero ? "w-14 h-14 bg-primary/15" : "w-11 h-11 bg-primary/10"
                )}>
                  <feature.icon className={cn("text-primary", feature.hero ? "w-7 h-7" : "w-5 h-5")} />
                </div>
                <h3 className={cn(
                  "font-bold text-foreground mb-2",
                  feature.hero ? "text-xl lg:text-2xl" : "text-base"
                )}>
                  {feature.title}
                </h3>
                <p className={cn(
                  "text-muted-foreground leading-relaxed",
                  feature.hero ? "text-base max-w-lg" : "text-sm"
                )}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS — Horizontal timeline ━━━ */}
      <section className="py-20 lg:py-28 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4 block">How it works</span>
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
              Get your schedule running in minutes
            </h2>
          </motion.div>

          <div className="relative max-w-5xl mx-auto">
            {/* Connecting line — desktop */}
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

            <div className="grid md:grid-cols-3 gap-10 lg:gap-16">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="text-center relative"
                >
                  {/* Step number */}
                  <div className="relative z-10 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 text-sm font-bold shadow-lg shadow-primary/20">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ RELATED FEATURES — Gradient-accent cards ━━━ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Works hand-in-hand with</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {relatedFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={feature.to}
                  className="block h-full p-6 rounded-2xl border border-border bg-card relative overflow-hidden group hover:shadow-lg transition-all duration-300"
                >
                  {/* Top gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-teal-dark opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-1.5">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{feature.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                    {feature.linkText} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <section className="relative py-24 lg:py-32 bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)] pointer-events-none" />
        {/* Floating decorative calendar icons */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-16 left-[10%] text-primary/10"
        >
          <Calendar className="w-16 h-16" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-16 right-[12%] text-primary/10"
        >
          <CalendarDays className="w-20 h-20" />
        </motion.div>

        <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-foreground">
              Ready to take control of your schedule?{" "}
              <span className="bg-gradient-to-r from-primary to-teal-light bg-clip-text text-transparent">
                Start free today.
              </span>
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/60">
              Join UK music teachers who've ditched spreadsheets and sticky notes for a calendar that actually understands music teaching.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="bg-primary-foreground text-ink hover:bg-primary-foreground/90" asChild>
              <Link to="/signup">
                Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/pricing">View plans and pricing</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap justify-center gap-x-2 text-sm text-primary-foreground/40"
          >
            {["No credit card required", "30-day free trial", "Cancel anytime"].map((item, i) => (
              <span key={item} className="flex items-center">
                {i > 0 && <span className="mx-2">·</span>}
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
