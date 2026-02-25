import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import {
  Users, MessageSquare, AlertTriangle, Clock, Eye,
  CalendarDays, Receipt, Bell, Shield, BookOpen,
  Calendar, Sparkles, CreditCard, ArrowRight, Check,
  ChevronRight, Smartphone, Star, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  { question: "What can parents see in the portal?", answer: "Parents can view upcoming lessons, attendance history, invoices, payment status, practice assignments, and messages from teachers." },
  { question: "Can parents pay invoices through the portal?", answer: "Yes. Parents can view invoice details and make payments directly through the portal if Stripe is connected." },
  { question: "Is the parent portal secure?", answer: "Absolutely. Each parent has their own login. Row-level security ensures they only see data for their own children." },
  { question: "Can parents message teachers?", answer: "Yes. Built-in messaging keeps communication professional and in one place — no more scattered WhatsApp threads." },
  { question: "How do parents get access?", answer: "You invite parents by email. They receive a secure link, set a password, and are connected to their child's profile instantly." },
];

/* ─── Animated phone mockup ─── */
function HeroPhoneMockup() {
  const notifications = [
    { icon: CalendarDays, label: "Next lesson", value: "Piano — Tue 14 Jan, 3:30pm", colour: "text-primary", bg: "bg-primary/10" },
    { icon: Receipt, label: "Invoice ready", value: "Spring Term 2026 — £384.00", colour: "text-emerald", bg: "bg-emerald/10" },
    { icon: BookOpen, label: "Practice assigned", value: "Scales C major — 15 min/day", colour: "text-violet", bg: "bg-violet/10" },
    { icon: MessageSquare, label: "New message", value: "Great progress with arpeggios!", colour: "text-coral", bg: "bg-coral/10" },
  ];

  return (
    <div className="relative">
      {/* Outer glow */}
      <div className="absolute -inset-8 bg-gradient-to-b from-violet/15 via-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] sm:w-[320px] rounded-[2.5rem] border-[3px] border-border/80 bg-card shadow-2xl shadow-ink/15 overflow-hidden">
        {/* Notch */}
        <div className="flex justify-center pt-3 pb-2 bg-muted/40 border-b border-border/40">
          <div className="w-24 h-5 rounded-full bg-muted-foreground/10" />
        </div>

        {/* Screen content */}
        <div className="px-4 py-4 space-y-3 min-h-[380px] sm:min-h-[420px]">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-[10px] text-muted-foreground">Welcome back</p>
            <p className="text-sm font-bold text-foreground">Emma Morrison</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">2 children · Oakwood Music Academy</p>
          </motion.div>

          {/* Notification cards */}
          {notifications.map((n, i) => (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.15, duration: 0.35, ease: "easeOut" }}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/80 hover:border-border transition-colors"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", n.bg)}>
                <n.icon className={cn("w-4 h-4", n.colour)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{n.label}</p>
                <p className="text-xs font-medium text-foreground leading-snug">{n.value}</p>
              </div>
            </motion.div>
          ))}

          {/* Quick pay button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3 }}
            className="pt-1"
          >
            <div className="w-full rounded-xl bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground">
              Pay invoice →
            </div>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="flex justify-around py-3 border-t border-border/40 bg-muted/30">
          {[CalendarDays, Receipt, BookOpen, MessageSquare].map((Icon, i) => (
            <div key={i} className={cn("w-8 h-8 rounded-lg flex items-center justify-center", i === 0 ? "bg-primary/10" : "")}>
              <Icon className={cn("w-4 h-4", i === 0 ? "text-primary" : "text-muted-foreground/50")} />
            </div>
          ))}
        </div>
      </div>

      {/* Floating badge — secure */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
        className="absolute -bottom-4 -right-3 sm:-right-10 z-10"
      >
        <div className="flex items-center gap-2.5 bg-card border border-emerald/30 rounded-xl px-4 py-2.5 shadow-xl shadow-emerald/5">
          <div className="w-7 h-7 rounded-full bg-emerald/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Fully secure</p>
            <p className="text-[10px] text-muted-foreground">Row-level encryption</p>
          </div>
        </div>
      </motion.div>

      {/* Floating badge — no app needed */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.8, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -left-3 sm:-left-10 z-10"
      >
        <div className="flex items-center gap-2 bg-card border border-violet/30 rounded-xl px-3 py-2 shadow-xl shadow-violet/5">
          <Smartphone className="w-3.5 h-3.5 text-violet" />
          <span className="text-[10px] font-medium text-foreground">No app download needed</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Data ─── */
const painPoints = [
  { icon: MessageSquare, title: "Communication scattered everywhere", description: "Messages across WhatsApp, email, text, and verbal. Important updates get buried, and you lose track of who knows what." },
  { icon: AlertTriangle, title: "Parents can't find their invoices", description: "Re-sending the same PDF three times, explaining what's outstanding, answering 'have I paid?' — every single term." },
  { icon: Clock, title: "Endless back-and-forth", description: "Questions about lesson times, practice, and payments — all answered individually, over and over, week after week." },
];

const capabilities = [
  {
    icon: CalendarDays,
    title: "Lesson schedule at a glance",
    description: "Parents see all upcoming lessons, past attendance, and any schedule changes — always current, always accurate.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: Receipt,
    title: "Invoices & online payment",
    description: "View invoices, check payment status, and pay online with Stripe. No more chasing or re-sending PDFs.",
    accent: "from-emerald/20 to-emerald/5",
  },
  {
    icon: BookOpen,
    title: "Practice tracking",
    description: "Students and parents see practice assignments, log time, and track progress between lessons.",
    accent: "from-violet/20 to-violet/5",
  },
  {
    icon: Bell,
    title: "Smart notifications",
    description: "Automatic alerts for lesson changes, new invoices, and practice reminders. Parents stay informed without you lifting a finger.",
    accent: "from-coral/20 to-coral/5",
  },
  {
    icon: MessageSquare,
    title: "Built-in messaging",
    description: "Professional, threaded messaging between parents and teachers. Everything in one place, not scattered across apps.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: Shield,
    title: "Secure & private by design",
    description: "Each parent sees only their own children. Email-verified logins and row-level security keep every byte of data safe.",
    accent: "from-emerald/20 to-emerald/5",
  },
];

const metrics = [
  { value: "90%", label: "fewer parent emails" },
  { value: "0", label: "apps to download" },
  { value: "2min", label: "to invite a family" },
];

const steps = [
  { num: "01", title: "Invite parents by email", description: "Add a guardian to a student profile and hit invite. They receive a secure link to set up their account.", icon: Send },
  { num: "02", title: "Parents sign in from any device", description: "No app to install. Works in Safari, Chrome, any browser — desktop or mobile. One tap and they're in.", icon: Smartphone },
  { num: "03", title: "Everything they need, one place", description: "Lessons, invoices, practice, messages. Parents stop asking, and you stop repeating yourself.", icon: Star },
];

const relatedFeatures = [
  { icon: Calendar, title: "Scheduling", description: "Schedule changes update the parent portal in real time. No need to notify parents manually.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: CreditCard, title: "Invoicing & Billing", description: "Invoices appear in the parent portal automatically. Parents can view and pay without email.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Draft parent communications, summarise attendance, or flag overdue invoices with AI.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

export default function FeatureParentPortal() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  usePageMeta(
    "Parent Portal for Music Schools — Lessons, Invoices & Messaging | LessonLoop",
    "Give parents their own portal to view lessons, pay invoices, track practice, and message teachers. Secure, branded, and built for music schools. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/parent-portal",
      ogTitle: "Parent Portal for Music Schools | LessonLoop",
      ogDescription: "A secure portal where parents view lessons, pay invoices, track practice, and message teachers. Built for music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/parent-portal",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Parent Portal"
        description="Secure parent portal for music schools — view lessons, pay invoices, track practice, and message teachers."
        canonical="https://lessonloop.co.uk/features/parent-portal"
        breadcrumbName="Parent Portal"
        faqs={faqs}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO — Phone mockup as centrepiece
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-36 overflow-hidden bg-background">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-violet/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          {/* Two-column: text left, phone right */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet/20 bg-violet/5 text-violet text-sm font-semibold mb-6"
              >
                <Users className="w-4 h-4" />
                Parent Portal
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.1] tracking-tight"
              >
                Keep parents in the loop{" "}
                <span className="relative">
                  <span className="relative z-10 bg-gradient-to-r from-violet to-primary bg-clip-text text-transparent">
                    without the chaos
                  </span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-violet to-primary rounded-full origin-left"
                  />
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 text-lg lg:text-xl text-muted-foreground"
              >
                A secure portal where parents view lessons, pay invoices, track practice, and message teachers — all without a single WhatsApp group.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-col sm:flex-row gap-3"
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

            {/* Phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
              className="flex justify-center lg:justify-end"
            >
              <HeroPhoneMockup />
            </motion.div>
          </div>
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
          PROBLEM — Dark immersive, editorial
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={parallaxRef} className="py-24 lg:py-32 bg-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,hsl(var(--violet)/0.06),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,hsl(var(--coral)/0.04),transparent_50%)] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
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
                Communication chaos costs you hours every week
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="text-lg text-primary-foreground/50 max-w-lg"
              >
                WhatsApp messages at 10pm, lost emails, payment confusion — parents deserve better, and so do you.
              </motion.p>
            </div>

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
          CAPABILITIES — Cards with gradient left border
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
              One portal for everything parents need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Give parents a single, secure place to stay informed — and take the pressure off your inbox.
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
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-violet/5 rounded-full blur-[150px] pointer-events-none translate-y-1/2 translate-x-1/3" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary block mb-4">How it works</span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground">
              Parents up and running in minutes
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
                  <span className="text-6xl font-bold text-muted-foreground/10 absolute top-5 right-6 select-none group-hover:text-primary/10 transition-colors">
                    {step.num}
                  </span>

                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>

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
          FAQ
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
                Everything you need to know about the{" "}
                <Link to="/features/parent-portal" className="text-primary hover:underline">parent portal</Link>{" "}
                and family access.
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
          CTA — Dark, confident
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 lg:py-36 bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,hsl(var(--violet)/0.08),transparent_65%)] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold text-primary-foreground leading-tight"
          >
            Give parents the experience they deserve.{" "}
            <span className="bg-gradient-to-r from-violet to-primary bg-clip-text text-transparent">
              You'll love it too.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-lg text-primary-foreground/50"
          >
            A professional parent portal that saves you hours of messaging, chasing, and explaining. Built into every LessonLoop plan.
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
