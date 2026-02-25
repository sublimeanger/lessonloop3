import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  MessageSquare, Clock, AlertTriangle, Mail, Send,
  FileText, Bell, Users, Shield, Inbox,
  Calendar, Receipt, Sparkles, ArrowRight, ChevronRight,
  Check, CheckCheck, Paperclip,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "Can parents message teachers directly?", answer: "Yes. Parents send messages from the portal. Teachers receive them in their LessonLoop inbox. Everything stays in one professional thread." },
  { question: "Can I send bulk messages?", answer: "Yes. Use messaging templates to send announcements to all parents, a specific class, or selected guardians." },
  { question: "Are messages stored securely?", answer: "Yes. All messages are encrypted in transit and at rest. Messages are isolated per organisation with row-level security." },
  { question: "Can I use message templates?", answer: "Absolutely. Create reusable templates for common communications — term reminders, payment nudges, schedule changes, and more." },
  { question: "Do parents get email notifications for messages?", answer: "Yes. When a teacher sends a message, parents receive an email notification with a link to view it in the portal." },
];

/* ─── Hero: Chat Thread Mockup ─── */
const CHAT_MESSAGES = [
  { id: 1, role: "teacher" as const, name: "Ms Wilson", text: "Hi Sarah — just a quick update. Olivia did really well with her scales today. She's ready to start the Grade 5 pieces.", time: "14:32", status: "read" },
  { id: 2, role: "parent" as const, name: "Sarah Chen", text: "That's wonderful news! She's been practising a lot at home. Any particular pieces you'd recommend starting with?", time: "15:10", status: "read" },
  { id: 3, role: "teacher" as const, name: "Ms Wilson", text: "I'd suggest starting with the Bagatelle — it's a great fit for her style. I've attached the sheet music to her practice assignments.", time: "15:24", status: "delivered" },
];

const TEMPLATES = [
  { label: "Term reminder", preview: "A reminder that the new term begins on..." },
  { label: "Payment nudge", preview: "Your invoice #INV-2026-041 is now overdue..." },
  { label: "Schedule change", preview: "Please note that lessons on Friday 14th..." },
];

function HeroChatMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-md mx-auto"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-3 bg-gradient-to-r from-[hsl(var(--teal)/0.06)] to-transparent">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">SC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Sarah Chen</p>
            <p className="text-[10px] text-muted-foreground">Parent of Olivia Chen · Piano</p>
          </div>
          <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-[hsl(var(--emerald)/0.12)] text-[hsl(var(--emerald))]">Online</span>
        </div>

        {/* Messages */}
        <div className="px-4 py-4 space-y-3 min-h-[260px]">
          {CHAT_MESSAGES.map((msg, i) => {
            const isTeacher = msg.role === "teacher";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.3, duration: 0.4 }}
                className={`flex ${isTeacher ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] ${isTeacher ? "order-1" : ""}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isTeacher
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`flex items-center gap-1.5 mt-1 ${isTeacher ? "justify-end" : "justify-start"}`}>
                    <span className="text-[9px] text-muted-foreground">{msg.time}</span>
                    {isTeacher && (
                      msg.status === "read"
                        ? <CheckCheck className="w-3 h-3 text-primary" />
                        : <Check className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Composer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="px-4 py-3 border-t border-border/40 flex items-center gap-2"
        >
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 h-9 rounded-xl bg-secondary/60 border border-border/30 flex items-center px-3">
            <span className="text-xs text-muted-foreground/50">Type a message...</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Send className="w-4 h-4 text-primary-foreground" />
          </div>
        </motion.div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-[hsl(var(--emerald-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Shield className="w-3 h-3" /> Encrypted
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute bottom-16 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-[hsl(var(--violet-light))] text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Bell className="w-3 h-3" /> Email alerts
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: Inbox, title: "Unified inbox", description: "All parent messages in one place. No more switching between apps. Read, reply, and track from LessonLoop.", accent: "teal" },
  { icon: Send, title: "Direct messaging", description: "Send messages to individual parents or guardians. Threaded conversations keep context clear.", accent: "violet" },
  { icon: FileText, title: "Message templates", description: "Create reusable templates for term reminders, payment nudges, cancellation notices, and more.", accent: "coral" },
  { icon: Users, title: "Bulk messaging", description: "Send announcements to all parents, a specific teacher's families, or a hand-picked group.", accent: "teal" },
  { icon: Bell, title: "Email notifications", description: "Parents receive email alerts for new messages. They click through to the portal to read and reply.", accent: "emerald" },
  { icon: Shield, title: "Professional boundaries", description: "No personal phone numbers needed. Communication stays within the platform with clear work-life separation.", accent: "violet" },
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
  { num: "01", title: "Write or pick a template", description: "Compose from scratch or choose a saved template. Personalise with student or guardian names.", icon: FileText },
  { num: "02", title: "Send to parents", description: "Send to one parent, a group, or everyone. Parents get an email notification with a portal link.", icon: Send },
  { num: "03", title: "Track and reply", description: "See read status and replies in your inbox. Threaded conversations keep everything organised.", icon: Inbox },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: Calendar, title: "Scheduling", description: "Notify parents about schedule changes, cancellations, or new lesson times directly from the calendar.", to: "/features/scheduling", linkText: "Explore music lesson scheduling" },
  { icon: Receipt, title: "Invoicing & Billing", description: "Send payment reminders alongside invoices. Parents see both in the portal.", to: "/features/billing", linkText: "Explore automated billing" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist to draft a message, write a term update, or compose a payment reminder.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureMessaging() {
  usePageMeta(
    "Messaging for Music Schools — Teacher-Parent Communication | LessonLoop",
    "Professional messaging between teachers and parents. Templates, threaded conversations, and email notifications — all built into LessonLoop. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/messaging",
      ogTitle: "Messaging for Music Schools | LessonLoop",
      ogDescription: "Professional teacher-parent messaging with templates, threaded conversations, and email notifications.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/messaging",
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
        featureName="Messaging"
        description="Professional messaging for music schools — teacher-parent communication with templates, threads, and notifications."
        canonical="https://lessonloop.co.uk/features/messaging"
        breadcrumbName="Messaging"
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
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">Messaging</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Professional communication{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
                  without the chaos
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Keep all teacher-parent communication in one place. Threaded messages, reusable templates, and email notifications — no more scattered WhatsApp groups.
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

            {/* Right: chat mockup */}
            <div className="relative">
              <HeroChatMockup />
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
              Communication shouldn't mean <span className="text-[hsl(var(--coral))]">chaos</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              WhatsApp at 10pm, emails buried in spam, and text messages you forgot to reply to.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Messages everywhere", description: "WhatsApp, email, text, Facebook — parents message on whatever platform they prefer, and you lose track." },
              { icon: Clock, title: "Repetitive messages", description: "Typing the same term reminder, payment nudge, or schedule update for every parent individually." },
              { icon: Mail, title: "No professional boundary", description: "Personal phone number shared with parents. Messages at all hours. No work-life separation." },
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
              Messaging designed for <span className="text-primary">music schools</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              One inbox for all parent communication. Professional, threaded, and connected to your schedule and billing.
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

      {/* ═══ TEMPLATES SHOWCASE ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))]">Templates</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Write it once. <span className="text-[hsl(var(--violet))]">Reuse it forever.</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Create templates for your most common messages — term reminders, payment nudges, schedule changes. Personalise with student names and send in seconds.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/billing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  See automated billing features <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/parent-portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  Explore the parent portal <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Right: template cards */}
            <div className="space-y-3">
              {TEMPLATES.map((tmpl, i) => (
                <motion.div
                  key={tmpl.label}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  className="p-4 rounded-xl border border-border/50 bg-card hover:shadow-md transition-shadow group cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--violet)/0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[hsl(var(--violet))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{tmpl.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tmpl.preview}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-secondary text-muted-foreground flex-shrink-0">
                      Template
                    </span>
                  </div>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="text-center pt-2"
              >
                <span className="text-xs text-muted-foreground italic">Create unlimited custom templates</span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Messaging in <span className="text-primary">three steps</span></h2>
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
            Communicate professionally. <span className="text-[hsl(var(--teal-light))]">Reclaim your evenings.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            One inbox, message templates, and email notifications. Keep parent communication professional and in one place.
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
