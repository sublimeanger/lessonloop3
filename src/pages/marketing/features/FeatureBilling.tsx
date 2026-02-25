import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import {
  Receipt, PoundSterling, Clock, AlertTriangle, FileText, Zap,
  Calculator, Bell, CreditCard, Layers, RefreshCw,
  Calendar, MessageSquare, BarChart3, ArrowRight, Check,
  ChevronRight, Shield, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  { question: "Can I bill by term or by month?", answer: "Yes. LessonLoop supports termly billing runs, monthly invoicing, and per-lesson billing. Mix and match across different students." },
  { question: "Does LessonLoop handle VAT?", answer: "Yes. Set your VAT rate (or zero-rate for exempt teachers). VAT is calculated and shown on every invoice automatically." },
  { question: "Can I send payment reminders?", answer: "Absolutely. Automated reminders go out before and after due dates. You can also send manual nudges with one click." },
  { question: "What payment methods are supported?", answer: "LessonLoop generates invoices in GBP. Parents can pay via bank transfer, or you can connect Stripe for card payments." },
  { question: "Can I run bulk billing for the whole term?", answer: "Yes. Select a term, preview every invoice, and approve the batch. Hundreds of invoices generated in seconds." },
];

/* ─── Animated invoice hero ─── */
const INVOICE_ITEMS = [
  { student: "Ella M", desc: "Piano — 30 min", qty: 12, rate: 3200 },
  { student: "Jack R", desc: "Violin — 45 min", qty: 12, rate: 4000 },
  { student: "Maya K", desc: "Piano — 60 min", qty: 10, rate: 5000 },
  { student: "Liam T", desc: "Drums — 30 min", qty: 11, rate: 3200 },
];

function HeroInvoice() {
  const subtotal = INVOICE_ITEMS.reduce((s, item) => s + item.qty * item.rate, 0);
  const vat = Math.round(subtotal * 0.2);
  const total = subtotal + vat;

  const formatGBP = (minor: number) => `£${(minor / 100).toFixed(2)}`;

  return (
    <div className="relative">
      {/* Outer glow */}
      <div className="absolute -inset-8 bg-gradient-to-b from-emerald/15 via-primary/5 to-transparent rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-ink/10 overflow-hidden">
        {/* Invoice header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald/50" />
            </div>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Invoice INV-2026-047</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">Spring Term 2026</span>
          </div>
        </div>

        {/* Invoice body */}
        <div className="p-4 sm:p-5">
          {/* Bill-to row */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Bill to</p>
              <p className="text-sm font-semibold text-foreground">The Morrison Family</p>
              <p className="text-xs text-muted-foreground">emma.morrison@email.co.uk</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Due date</p>
              <p className="text-sm font-semibold text-foreground">15 Jan 2026</p>
            </div>
          </div>

          {/* Line items table */}
          <div className="border border-border/50 rounded-xl overflow-hidden mb-4">
            <div className="grid grid-cols-[1fr_50px_70px_70px] sm:grid-cols-[1fr_60px_80px_80px] text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/60 px-3 py-2 font-medium">
              <span>Lesson</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
            </div>
            {INVOICE_ITEMS.map((item, i) => (
              <motion.div
                key={item.student}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
                className="grid grid-cols-[1fr_50px_70px_70px] sm:grid-cols-[1fr_60px_80px_80px] text-xs px-3 py-2.5 border-t border-border/30 items-center"
              >
                <div>
                  <span className="font-medium text-foreground block">{item.student}</span>
                  <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                </div>
                <span className="text-right text-muted-foreground tabular-nums">{item.qty}</span>
                <span className="text-right text-muted-foreground tabular-nums">{formatGBP(item.rate)}</span>
                <span className="text-right font-medium text-foreground tabular-nums">{formatGBP(item.qty * item.rate)}</span>
              </motion.div>
            ))}
          </div>

          {/* Totals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="flex justify-end"
          >
            <div className="w-48 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatGBP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>VAT (20%)</span>
                <span className="tabular-nums">{formatGBP(vat)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground text-sm pt-1.5 border-t border-border/50">
                <span>Total</span>
                <span className="tabular-nums">{formatGBP(total)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating "Paid" badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: -6 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
        className="absolute -bottom-5 -left-3 sm:-left-6 z-10"
      >
        <div className="flex items-center gap-2.5 bg-card border border-emerald/30 rounded-xl px-4 py-2.5 shadow-xl shadow-emerald/5">
          <div className="w-7 h-7 rounded-full bg-emerald/15 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Paid in full</p>
            <p className="text-[10px] text-muted-foreground">12 Jan 2026</p>
          </div>
        </div>
      </motion.div>

      {/* Floating batch badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute -top-4 -right-3 sm:-right-6 z-10"
      >
        <div className="flex items-center gap-2 bg-card border border-primary/30 rounded-xl px-3 py-2 shadow-xl shadow-primary/5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">34 invoices generated</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Data ─── */
const painPoints = [
  { icon: Clock, title: "Hours wasted on manual invoicing", description: "Counting lessons, calculating totals, formatting invoices — it eats into evenings and weekends that should be yours." },
  { icon: AlertTriangle, title: "Overdue payments pile up silently", description: "Without automated reminders, unpaid invoices quietly stack up. Chasing payments feels awkward and unprofessional." },
  { icon: PoundSterling, title: "GBP & VAT are afterthoughts", description: "Most tools default to USD with no VAT support. UK teachers need proper sterling invoicing with optional VAT — not hacks." },
];

const capabilities = [
  {
    icon: Zap,
    title: "Auto-generate from your schedule",
    description: "Invoices are built directly from attended lessons. No manual data entry — your calendar is your billing source.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: Layers,
    title: "Termly billing runs",
    description: "Select a term, preview the batch, and generate hundreds of invoices in seconds. Perfect for academies.",
    accent: "from-violet/20 to-violet/5",
  },
  {
    icon: PoundSterling,
    title: "GBP & UK VAT native",
    description: "All amounts in pounds sterling. Set your VAT rate or mark as exempt. VAT shown clearly on every invoice.",
    accent: "from-emerald/20 to-emerald/5",
  },
  {
    icon: Bell,
    title: "Automated payment reminders",
    description: "Reminders sent before and after due dates. Customise timing and message to match your style.",
    accent: "from-coral/20 to-coral/5",
  },
  {
    icon: Calculator,
    title: "Rate cards & flexible pricing",
    description: "Set per-lesson, per-term, or custom rates. Apply different rates by instrument, duration, or student.",
    accent: "from-primary/20 to-primary/5",
  },
  {
    icon: CreditCard,
    title: "Payment tracking & partial payments",
    description: "Mark payments received, track partial payments, and see outstanding balances at a glance.",
    accent: "from-violet/20 to-violet/5",
  },
];

const metrics = [
  { value: "£0", label: "lost to billing mistakes" },
  { value: "30s", label: "to run a full term billing batch" },
  { value: "85%", label: "faster than manual invoicing" },
];

const steps = [
  { num: "01", title: "Set your rate cards", description: "Create rates for different lesson types, durations, and instruments. Assign them to students once — done.", icon: Calculator },
  { num: "02", title: "Run a billing batch", description: "Select a term or date range. LessonLoop calculates everything from your schedule and attendance data.", icon: Zap },
  { num: "03", title: "Get paid automatically", description: "Invoices land in parent portals. Reminders go out on schedule. Payments are tracked in real time.", icon: Shield },
];

const relatedFeatures = [
  { icon: Calendar, title: "Scheduling", description: "Your schedule feeds directly into billing. Every lesson, cancellation, and make-up is accounted for.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: MessageSquare, title: "Parent Portal", description: "Parents view and pay invoices directly through their portal. No more email attachments.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: BarChart3, title: "Reports", description: "Revenue reports, outstanding ageing, and payment summaries — all built from your billing data.", to: "/features/reports", linkText: "Explore reporting features" },
];

export default function FeatureBilling() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  usePageMeta(
    "Music School Invoicing & Billing Software — GBP, VAT, Termly Runs | LessonLoop",
    "Automate music school invoicing with LessonLoop. GBP billing, UK VAT support, termly billing runs, payment tracking, and automated reminders. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/billing",
      ogTitle: "Music School Invoicing & Billing Software | LessonLoop",
      ogDescription: "GBP invoicing, UK VAT, termly billing runs, payment tracking, and automated reminders — built for UK music teachers.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/billing",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Music School Invoicing & Billing"
        description="Automated invoicing for music schools with GBP billing, UK VAT, termly billing runs, and payment tracking."
        canonical="https://lessonloop.co.uk/features/billing"
        breadcrumbName="Billing"
        faqs={faqs}
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO — Invoice mockup as centrepiece
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
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-14 lg:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald/20 bg-emerald/5 text-emerald text-sm font-semibold mb-6"
            >
              <Receipt className="w-4 h-4" />
              Invoicing & Billing
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-foreground leading-[1.1] tracking-tight"
            >
              Music school billing that{" "}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-emerald to-primary bg-clip-text text-transparent">
                  runs itself
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald to-primary rounded-full origin-left"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Generate invoices from your schedule automatically. GBP native, UK VAT ready, with termly billing runs and payment reminders — so you get paid without chasing.
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

          {/* Invoice — the hero centrepiece */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="max-w-2xl mx-auto"
          >
            <HeroInvoice />
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
          PROBLEM — Dark immersive, editorial layout
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={parallaxRef} className="py-24 lg:py-32 bg-ink relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,hsl(var(--emerald)/0.06),transparent_60%)] pointer-events-none" />
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
                Chasing payments shouldn't be your second job
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="text-lg text-primary-foreground/50 max-w-lg"
              >
                Spreadsheets, manual calculations, and awkward payment conversations — billing is the part of teaching nobody signed up for.
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
              Invoicing designed for music teachers
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              LessonLoop turns your schedule into invoices automatically — with every UK-specific detail handled for you.
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
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald/5 rounded-full blur-[150px] pointer-events-none -translate-y-1/2 -translate-x-1/3" />

        <div className="container relative mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary block mb-4">How it works</span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground">
              From lessons to paid invoices
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
                Everything you need to know about LessonLoop's{" "}
                <Link to="/features/billing" className="text-primary hover:underline">invoicing and billing</Link>{" "}
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
          CTA — Dark, confident
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 lg:py-36 bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,hsl(var(--emerald)/0.08),transparent_65%)] pointer-events-none" />

        <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold text-primary-foreground leading-tight"
          >
            Stop chasing payments.{" "}
            <span className="bg-gradient-to-r from-emerald to-primary bg-clip-text text-transparent">
              Start getting paid.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-lg text-primary-foreground/50"
          >
            LessonLoop automates your invoicing so you can focus on teaching. GBP, VAT, and termly billing — built for UK music educators.
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
