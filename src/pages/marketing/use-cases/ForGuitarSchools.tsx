import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Guitar, CalendarDays, CreditCard, Users, BookOpen, BarChart3,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, Smartphone, UserX,
  ArrowRight, ChevronRight, Music, FileText, Mic, Play, Target,
  Flame, MapPin, FolderOpen,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/guitar-schools";

const FAQS = [
  { question: "Does LessonLoop support electric, acoustic, and bass guitar?", answer: "Yes. You can set up any instrument type and track students' progress on each individually." },
  { question: "Can I manage group guitar workshops?", answer: "Absolutely. Schedule group sessions, track individual attendance, and bill each student or family." },
  { question: "Does it work for a peripatetic guitar teacher?", answer: "Yes. Whether you teach at home, in schools, or across multiple venues, LessonLoop handles multi-location scheduling." },
  { question: "Can students share tabs and resources?", answer: "Teachers can upload tabs, sheet music, backing tracks, and videos to the resource library. Students access them through the portal." },
  { question: "Is there a free plan for solo guitar teachers?", answer: "Yes. LessonLoop offers a free tier and a 30-day trial of all premium features. Perfect for getting started." },
];

/* ─── Hero: Student Roster + Practice Mockup ─── */
const GUITAR_STUDENTS = [
  { name: "Jake M.", style: "Electric", level: "Intermediate", streak: 5, lastPractice: "Yesterday", song: "Back in Black — AC/DC" },
  { name: "Emily W.", style: "Acoustic", level: "Beginner", streak: 3, lastPractice: "Today", song: "Wonderwall — Oasis" },
  { name: "Ryan T.", style: "Bass", level: "Advanced", streak: 12, lastPractice: "Today", song: "Money — Pink Floyd" },
  { name: "Chloe P.", style: "Classical", level: "Grade 4", streak: 7, lastPractice: "Yesterday", song: "Recuerdos — Tárrega" },
];

const STYLE_COLORS: Record<string, { bg: string; text: string }> = {
  Electric: { bg: "bg-[hsl(var(--coral)/0.1)]", text: "text-[hsl(var(--coral))]" },
  Acoustic: { bg: "bg-[hsl(var(--teal)/0.1)]", text: "text-[hsl(var(--teal))]" },
  Bass: { bg: "bg-[hsl(var(--violet)/0.1)]", text: "text-[hsl(var(--violet))]" },
  Classical: { bg: "bg-[hsl(var(--emerald)/0.1)]", text: "text-[hsl(var(--emerald))]" },
};

function HeroGuitarRoster() {
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
            <h3 className="text-sm font-bold text-foreground">Guitar Students</h3>
            <p className="text-xs text-muted-foreground">4 active · 3 practised today</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]"
          >
            <Flame className="w-3 h-3" /> 6.75 avg streak
          </motion.div>
        </div>

        {/* Student rows */}
        {GUITAR_STUDENTS.map((s, i) => {
          const sc = STYLE_COLORS[s.style];
          return (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.35 }}
              className="px-5 py-3.5 border-b border-border/15 last:border-0"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate">{s.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>{s.style}</span>
                      <span className="text-[9px] text-muted-foreground">{s.level}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Flame className="w-3 h-3 text-[hsl(var(--coral))]" />
                  <span className="text-[10px] font-bold text-foreground">{s.streak}</span>
                </div>
              </div>
              <div className="ml-[42px] flex items-center gap-1.5">
                <Play className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[9px] text-muted-foreground truncate">{s.song}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--coral))] text-white text-xs font-bold shadow-lg"
      >
        All styles
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute bottom-16 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <FolderOpen className="w-3 h-3" /> Tabs & tracks
      </motion.div>
    </motion.div>
  );
}

/* ─── Resource library mockup ─── */
const RESOURCES = [
  { name: "Back in Black — TAB.pdf", type: "tab", instrument: "Electric", size: "340 KB" },
  { name: "Wonderwall — Chord Sheet.pdf", type: "tab", instrument: "Acoustic", size: "180 KB" },
  { name: "12-Bar Blues — Backing Track.mp3", type: "audio", instrument: "Electric", size: "5.2 MB" },
  { name: "Fingerpicking Pattern #3.pdf", type: "tab", instrument: "Classical", size: "220 KB" },
  { name: "Pentatonic Licks — Video.mp4", type: "video", instrument: "Electric", size: "28 MB" },
];

const RESOURCE_ICONS: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  tab: { icon: FileText, color: "text-[hsl(var(--coral))]", bg: "bg-[hsl(var(--coral)/0.1)]" },
  audio: { icon: Mic, color: "text-[hsl(var(--violet))]", bg: "bg-[hsl(var(--violet)/0.1)]" },
  video: { icon: Play, color: "text-[hsl(var(--teal))]", bg: "bg-[hsl(var(--teal)/0.1)]" },
};

function ResourceLibraryMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Resource Library</h3>
          <p className="text-[10px] text-muted-foreground">Tabs, backing tracks & videos</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary">+ Upload</span>
      </div>

      {RESOURCES.map((r, i) => {
        const rt = RESOURCE_ICONS[r.type];
        const Icon = rt.icon;
        return (
          <motion.div
            key={r.name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="px-5 py-2.5 border-b border-border/15 last:border-0 flex items-center gap-3"
          >
            <div className={`w-7 h-7 rounded-lg ${rt.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${rt.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-foreground truncate">{r.name}</p>
              <p className="text-[8px] text-muted-foreground">{r.instrument} · {r.size}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ─── Features ─── */
const FEATURES = [
  { icon: CalendarDays, title: "Flexible scheduling", description: "Weekly recurring lessons, one-off workshops, and group sessions. Drag-and-drop simplicity.", to: "/features/scheduling", linkText: "Explore scheduling features", accent: "teal" },
  { icon: CreditCard, title: "Automated invoicing", description: "Generate and send invoices in GBP. Automatic payment reminders and online payments.", to: "/features/billing", linkText: "See invoicing and billing", accent: "coral" },
  { icon: BookOpen, title: "Resource library", description: "Upload tabs, chord charts, backing tracks, and videos. Students access them through the portal.", to: "/features/resources", linkText: "Explore resources", accent: "violet" },
  { icon: Target, title: "Practice tracking", description: "Set weekly practice goals, track student logs, and share progress with parents.", to: "/features/practice-tracking", linkText: "See practice tracking", accent: "emerald" },
  { icon: Users, title: "Parent & student portal", description: "Families view schedules, download resources, pay invoices, and message you.", to: "/features/parent-portal", linkText: "View the family portal", accent: "teal" },
  { icon: BarChart3, title: "Reports & insights", description: "Revenue summaries, attendance trends, and student engagement — data-driven teaching.", to: "/features/reports", linkText: "Explore reports", accent: "violet" },
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
export default function ForGuitarSchools() {
  usePageMeta(
    "Guitar School Management Software | LessonLoop",
    "Manage guitar lessons, track student progress, automate invoicing, and communicate with families. Built for UK guitar teachers. Free trial.",
    {
      ogTitle: "Guitar School Management Software | LessonLoop",
      ogDescription: "Run your guitar school with LessonLoop — scheduling, billing, practice tracking, and a parent portal in one app.",
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
        name="Guitar School Management"
        description="Scheduling, billing, resource sharing, and parent communication software for guitar schools and teachers."
        canonical={CANONICAL}
        breadcrumbName="Guitar Schools"
        faqs={FAQS}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
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
                <Guitar className="w-4 h-4 text-[hsl(var(--coral))]" />
                <span className="text-sm font-semibold text-[hsl(var(--coral))] tracking-wide">For Guitar Schools</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Guitar school management{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--coral))] to-[hsl(var(--teal))] bg-clip-text text-transparent">
                  that rocks
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Scheduling, invoicing, resource sharing, and practice tracking — so you can focus on helping students shred, not shuffle paperwork.
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

            <div className="relative">
              <HeroGuitarRoster />
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
              You started teaching for the passion,{" "}
              <span className="text-[hsl(var(--coral))]">not the admin</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Guitar teaching admin shouldn't eat into your practice time. These headaches sound familiar?
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Scheduling nightmares", description: "Juggling lesson times across students, rooms, and your own gigging schedule." },
              { icon: Clock, title: "Invoicing by hand", description: "Creating invoices in Word, chasing payments by text, losing track of who's paid." },
              { icon: FileSpreadsheet, title: "Tabs everywhere", description: "Sharing resources via email, WhatsApp, and USB sticks — nothing is centralised." },
              { icon: Repeat, title: "Make-up lesson chaos", description: "Students cancel, you reschedule, then they cancel again. No system to track credits." },
              { icon: Smartphone, title: "Constant messages", description: "Parents texting at 10pm to reschedule. No boundaries, no central inbox." },
              { icon: UserX, title: "Student drop-off", description: "Without practice tracking, engagement dips and students quietly stop coming." },
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

      {/* ═══ FEATURES ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Purpose-Built</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Built for guitar teachers <span className="text-primary">and schools</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're a solo teacher or run a multi-teacher school, LessonLoop has you covered.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className={`p-6 rounded-2xl border-l-4 ${ACCENT_BORDER[feat.accent]} border border-border/30 hover:shadow-lg transition-shadow duration-300`}
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

      {/* ═══ RESOURCE LIBRARY ═══ */}
      <section className="bg-secondary/30 py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))]">Resources</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Tabs, backing tracks & videos —{" "}
                <span className="text-[hsl(var(--violet))]">all in one place</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Stop sending files over WhatsApp. Upload tabs, chord charts, backing tracks, and lesson recordings. Students access everything through the portal.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/resources" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  Explore resource sharing <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/parent-portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  See the parent portal <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <ResourceLibraryMockup />
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
              I teach 40 guitar students across two venues. LessonLoop handles my scheduling, billing, and even shares tabs with students. Game changer.
            </blockquote>
            <div>
              <p className="font-bold text-foreground">Dan R.</p>
              <p className="text-sm text-muted-foreground">Guitar Teacher, Manchester</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARE STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Switching from another tool?</h2>
            <p className="text-sm text-muted-foreground mt-2">See how LessonLoop compares for guitar teachers</p>
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
            Amplify your guitar school with{" "}
            <span className="text-[hsl(var(--coral-light,var(--coral)))]">LessonLoop.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Professional studio management for UK guitar teachers — scheduling, billing, and parent communication in one platform.
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
