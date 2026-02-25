import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Sparkles, Brain, Clock, AlertTriangle, Search,
  MessageSquare, FileText, Zap, Shield, BarChart3,
  Calendar, Receipt, Users, ArrowRight, CheckCircle2,
  Bot, User, ChevronRight,
} from "lucide-react";

const faqs = [
  { question: "What can LoopAssist do?", answer: "LoopAssist can answer questions about your schedule, students, and invoices. It can draft emails, summarise attendance, propose invoice runs, and suggest reschedule slots — all from a chat interface." },
  { question: "Can LoopAssist take actions automatically?", answer: "No. LoopAssist proposes actions and shows you exactly what it wants to do. You review and confirm before anything happens. Every action is logged in the audit trail." },
  { question: "Is my data safe with AI?", answer: "Yes. LoopAssist only accesses data within your organisation. It never shares data across organisations, and all queries are processed securely." },
  { question: "Do I need to pay extra for LoopAssist?", answer: "LoopAssist is included in the Pro and Academy plans at no extra cost. It's not available on the Solo plan." },
  { question: "Can I use LoopAssist on mobile?", answer: "Yes. LoopAssist works in the chat panel on any device — desktop, tablet, or mobile." },
];

const CHAT_MESSAGES = [
  { role: "user" as const, text: "Who has lessons tomorrow?" },
  { role: "ai" as const, text: "You have 6 lessons tomorrow. 3 piano, 2 guitar, 1 violin. First lesson starts at 9:00 with Emma Watson (Grade 5 Piano)." },
  { role: "user" as const, text: "What's my outstanding revenue?" },
  { role: "ai" as const, text: "You have £2,340 outstanding across 12 invoices. 4 are overdue by 30+ days (£890). Want me to draft reminders?" },
];

const AI_PROPOSAL = {
  title: "Send payment reminders",
  description: "Draft and send reminders to 4 guardians with invoices overdue by 30+ days.",
  items: ["Sarah Chen — £245 (32 days)", "Mark Thompson — £180 (41 days)", "Lucy Evans — £290 (35 days)", "James Wilson — £175 (38 days)"],
};

function HeroChatMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3 }}
      className="relative w-full max-w-lg mx-auto"
    >
      {/* Glow behind */}
      <div className="absolute -inset-8 bg-gradient-to-br from-violet/20 via-teal/10 to-transparent rounded-3xl blur-2xl" />

      {/* Chat window */}
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50 bg-muted/40">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet to-teal flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">LoopAssist</p>
            <p className="text-xs text-muted-foreground">Online · reading your data</p>
          </div>
          <div className="ml-auto flex gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-3 max-h-[320px]">
          {CHAT_MESSAGES.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.4, duration: 0.4 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-violet" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-ink text-primary-foreground rounded-br-md"
                    : "bg-muted/70 text-foreground rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-teal" />
                </div>
              )}
            </motion.div>
          ))}

          {/* AI Proposal Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.4, duration: 0.5 }}
            className="ml-8"
          >
            <div className="rounded-xl border border-violet/20 bg-violet/5 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5 text-violet" />
                <span className="text-xs font-semibold text-violet">Proposed Action</span>
              </div>
              <p className="text-[12px] font-medium text-foreground mb-2">{AI_PROPOSAL.title}</p>
              <div className="space-y-1">
                {AI_PROPOSAL.items.slice(0, 2).map((item, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 text-violet/50" />
                    {item}
                  </p>
                ))}
                <p className="text-[11px] text-muted-foreground">+2 more</p>
              </div>
              <div className="flex gap-2 mt-3">
                <motion.button
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 2.9, type: "spring" }}
                  className="px-3 py-1.5 bg-violet text-primary-foreground text-[11px] font-semibold rounded-lg"
                >
                  Approve & Send
                </motion.button>
                <button className="px-3 py-1.5 border border-border text-[11px] text-muted-foreground rounded-lg">
                  Edit first
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
          <div className="flex items-center gap-2 rounded-xl bg-background border border-border/60 px-3.5 py-2.5">
            <span className="text-[13px] text-muted-foreground flex-1">Ask LoopAssist anything…</span>
            <div className="w-7 h-7 rounded-lg bg-violet flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.8, type: "spring", stiffness: 120 }}
        className="absolute -right-4 top-12 bg-card border border-border/60 shadow-lg rounded-xl px-3 py-2 flex items-center gap-2"
      >
        <Shield className="w-4 h-4 text-emerald" />
        <span className="text-[11px] font-semibold text-foreground">Confirm before action</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.1, type: "spring", stiffness: 120 }}
        className="absolute -left-4 bottom-20 bg-card border border-border/60 shadow-lg rounded-xl px-3 py-2 flex items-center gap-2"
      >
        <Brain className="w-4 h-4 text-violet" />
        <span className="text-[11px] font-semibold text-foreground">Knows your data</span>
      </motion.div>
    </motion.div>
  );
}

const CAPABILITIES = [
  { icon: Search, label: "Ask anything", desc: "\"Who has lessons tomorrow?\" \"What's outstanding?\" Type naturally and get instant answers from your real data.", accent: "violet" as const },
  { icon: FileText, label: "Draft messages", desc: "Payment reminders, cancellation notices, term updates — ask LoopAssist to write them. Edit and send in seconds.", accent: "teal" as const },
  { icon: Zap, label: "Propose actions", desc: "Invoice runs, reschedule slots, attendance follow-ups. LoopAssist suggests — you approve with one click.", accent: "coral" as const },
  { icon: Brain, label: "Contextual awareness", desc: "LoopAssist knows your schedule, students, terms, and billing. Every answer is specific to your school.", accent: "emerald" as const },
  { icon: Shield, label: "Confirm before executing", desc: "Nothing happens without your approval. Every proposed action requires confirmation. Every action is audit-logged.", accent: "violet" as const },
  { icon: BarChart3, label: "Quick insights", desc: "Revenue this term, lessons delivered, cancellation rates — instant summaries without opening a report.", accent: "teal" as const },
];

const accentMap = {
  violet: { border: "border-l-violet", bg: "bg-violet/5", icon: "text-violet" },
  teal: { border: "border-l-teal", bg: "bg-teal/5", icon: "text-teal" },
  coral: { border: "border-l-coral", bg: "bg-coral/5", icon: "text-coral" },
  emerald: { border: "border-l-emerald", bg: "bg-emerald/5", icon: "text-emerald" },
};

export default function FeatureLoopAssist() {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  usePageMeta(
    "LoopAssist AI — Smart Assistant for Music Teachers | LessonLoop",
    "Meet LoopAssist, the AI assistant built into LessonLoop. Ask questions, draft emails, get scheduling suggestions, and manage your music school with natural language. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/loopassist",
      ogTitle: "LoopAssist AI — Smart Assistant for Music Teachers | LessonLoop",
      ogDescription: "AI assistant built into LessonLoop. Ask questions about your schedule, draft emails, and manage your music school with natural language.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/loopassist",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="LoopAssist AI Assistant"
        description="AI assistant for music teachers — ask questions, draft emails, get scheduling suggestions, and manage your school with natural language."
        canonical="https://lessonloop.co.uk/features/loopassist"
        breadcrumbName="LoopAssist AI"
        faqs={faqs}
      />

      {/* ════════════════════════════════════════════════════
          HERO — Split: headline left, interactive chat right
         ════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-background pt-28 sm:pt-32 lg:pt-40 pb-20 lg:pb-28">
        {/* Background orb */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-violet/8 via-teal/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal/6 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet/10 border border-violet/20 mb-6">
                <Sparkles className="w-4 h-4 text-violet" />
                <span className="text-sm font-semibold text-violet tracking-wide">LoopAssist AI</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-foreground leading-[1.1] mb-6">
                Your AI assistant that{" "}
                <span className="bg-gradient-to-r from-violet to-teal bg-clip-text text-transparent">
                  knows your school
                </span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
                Ask questions in plain English. Get instant answers about your schedule, students, and invoices. 
                Draft emails, find gaps, and manage your school — all from a simple chat.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-violet text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Start free trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/features"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted/50 transition-colors"
                >
                  See all features
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-8 flex flex-wrap gap-4">
                {["No extra cost on Pro", "Reads your real data", "Never acts without approval"].map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald" />
                    {t}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — Chat Mockup */}
            <HeroChatMockup />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          PROBLEM — Dark cinematic section
         ════════════════════════════════════════════════════ */}
      <section ref={parallaxRef} className="relative bg-ink py-20 lg:py-28 overflow-hidden">
        <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-coral/5 rounded-full blur-3xl" />
        </motion.div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-widest text-coral uppercase mb-4">The problem</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight mb-5">
              You're drowning in admin questions
            </h2>
            <p className="text-lg text-primary-foreground/60 max-w-2xl mx-auto">
              How many lessons did I teach last month? Who hasn't paid? When's my next free slot? 
              Answering these shouldn't take 15 minutes each.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: Search, title: "Hunting for information", desc: "Clicking through screens to find a student's attendance, an overdue invoice, or your schedule for next week. It adds up fast." },
              { icon: Clock, title: "Repetitive admin tasks", desc: "Drafting the same reminder emails, summarising the week, calculating lesson counts — over and over again." },
              { icon: AlertTriangle, title: "Decision fatigue", desc: "When should I reschedule this lesson? Who needs a reminder? What's my revenue this term? You need answers, not more screens." },
            ].map((pain, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="group rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.03] p-6 lg:p-8 hover:border-coral/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-coral/10 flex items-center justify-center mb-5 group-hover:bg-coral/20 transition-colors">
                  <pain.icon className="w-5 h-5 text-coral" />
                </div>
                <h3 className="text-lg font-bold text-primary-foreground mb-3">{pain.title}</h3>
                <p className="text-sm text-primary-foreground/55 leading-relaxed">{pain.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          CAPABILITIES — Accent-bordered cards
         ════════════════════════════════════════════════════ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-widest text-violet uppercase mb-4">What LoopAssist can do</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-5">
              An AI assistant that works{" "}
              <span className="bg-gradient-to-r from-violet to-teal bg-clip-text text-transparent">with your data</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              LoopAssist reads your real schedule, student records, and invoice data — then gives you answers, drafts, and suggestions in seconds.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap, i) => {
              const colors = accentMap[cap.accent];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  className={`rounded-xl border border-border/60 ${colors.bg} border-l-4 ${colors.border} p-6 hover:shadow-md transition-shadow`}
                >
                  <cap.icon className={`w-5 h-5 ${colors.icon} mb-4`} />
                  <h3 className="text-base font-bold text-foreground mb-2">{cap.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          HOW IT WORKS — Large numbered steps
         ════════════════════════════════════════════════════ */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">AI that's simple to use</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { num: "01", title: "Open the chat", desc: "LoopAssist lives in a chat panel within LessonLoop. Click to open it anytime — desktop or mobile." },
              { num: "02", title: "Ask or request", desc: "Type a question or request in plain English. LoopAssist reads your data and responds instantly." },
              { num: "03", title: "Review and confirm", desc: "If LoopAssist proposes an action, you see exactly what it will do. Approve with one click, or edit first." },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative"
              >
                <span className="text-[5rem] lg:text-[6rem] font-black text-foreground/[0.04] leading-none block select-none">
                  {step.num}
                </span>
                <div className="mt-[-1.5rem] relative">
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          CONVERSATION EXAMPLES — Show real power
         ════════════════════════════════════════════════════ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold tracking-widest text-teal uppercase mb-4">Example conversations</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Just type what you need</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { q: "Who has lessons tomorrow?", a: "6 lessons: 3 piano, 2 guitar, 1 violin. First at 9:00 (Emma, Grade 5 Piano).", cat: "Schedule" },
              { q: "Draft a payment reminder for overdue invoices", a: "Here's a draft for 4 guardians with overdue invoices. Shall I send it?", cat: "Messaging" },
              { q: "What's my revenue this term?", a: "£14,280 collected, £2,340 outstanding. Up 12% vs last term.", cat: "Billing" },
              { q: "Find a free 30-min slot for a new student", a: "Tuesday 3:30pm, Wednesday 10:00am, or Thursday 4:00pm are all free.", cat: "Scheduling" },
              { q: "Show me cancellations this month", a: "7 cancellations: 3 illness, 2 holiday, 2 no-show. Cancellation rate: 4.2%.", cat: "Attendance" },
              { q: "How many lessons has James had this term?", a: "James Wilson: 18 lessons (16 attended, 1 cancelled, 1 no-show).", cat: "Students" },
            ].map((ex, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border/60 bg-card p-5 hover:shadow-md transition-shadow"
              >
                <span className="inline-block text-[10px] font-bold tracking-widest text-violet uppercase bg-violet/10 px-2 py-0.5 rounded mb-3">
                  {ex.cat}
                </span>
                <div className="flex items-start gap-2 mb-3">
                  <User className="w-4 h-4 text-teal mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">{ex.q}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 text-violet mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{ex.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          RELATED FEATURES
         ════════════════════════════════════════════════════ */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">LoopAssist works across</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: "Scheduling", desc: "Ask LoopAssist to find free slots, summarise your week, or check for conflicts.", to: "/features/scheduling", link: "Explore music lesson scheduling →" },
              { icon: Receipt, title: "Invoicing & Billing", desc: "Get instant answers on outstanding invoices, revenue summaries, and payment status.", to: "/features/billing", link: "Explore automated billing →" },
              { icon: Users, title: "Parent Portal", desc: "Draft parent communications, check who's been notified, and flag overdue families.", to: "/features/parent-portal", link: "Explore the parent portal →" },
            ].map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border/60 bg-card p-6 hover:shadow-md transition-shadow"
              >
                <r.icon className="w-6 h-6 text-teal mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">{r.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{r.desc}</p>
                <Link to={r.to} className="text-sm font-semibold text-violet hover:underline">{r.link}</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          CTA — Gradient finale
         ════════════════════════════════════════════════════ */}
      <section className="relative bg-ink py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-violet/10 via-teal/5 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground leading-tight mb-4">
              Meet your new admin assistant.{" "}
              <span className="bg-gradient-to-r from-violet-light to-teal-light bg-clip-text text-transparent">
                It already knows your school.
              </span>
            </h2>
            <p className="text-lg text-primary-foreground/60 max-w-xl mx-auto mb-8">
              LoopAssist is built into LessonLoop Pro and Academy plans. Ask questions, draft emails, and manage your school with AI — no extra cost.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet to-teal text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-primary-foreground/20 text-primary-foreground font-semibold hover:bg-primary-foreground/5 transition-colors"
              >
                View plans and pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
