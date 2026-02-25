import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import UseCaseSchema from "@/components/marketing/use-case/UseCaseSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Music, CalendarDays, CreditCard, GraduationCap, Users, BookOpen,
  AlertTriangle, Clock, FileSpreadsheet, Repeat, UserX, MapPin,
  ArrowRight, ChevronRight, DoorOpen, Trophy, Star, Target,
  CheckCircle2, Piano,
} from "lucide-react";

const CANONICAL = "https://lessonloop.co.uk/for/piano-schools";

const FAQS = [
  { question: "Can I track ABRSM and Trinity grades?", answer: "Yes. LessonLoop supports all UK exam boards including ABRSM, Trinity, LCM, and RSL. Track current grade, target grade, and exam dates per student." },
  { question: "Does it handle group piano lessons?", answer: "Absolutely. Schedule group lessons with multiple students, track individual attendance, and bill each family separately." },
  { question: "Can parents see their child's practice?", answer: "Yes. Teachers set assignments and students log practice through the parent portal. Parents see progress charts and notes." },
  { question: "Is it suitable for a small piano school?", answer: "Perfect for it. Whether you have 2 pianos or 20, LessonLoop scales with your studio." },
  { question: "Can I set different rates for different lesson lengths?", answer: "Yes. Rate cards support per-duration pricing (30, 45, 60 min), sibling discounts, and scholarship rates. Billing runs apply the correct rate automatically." },
];

/* ─── Hero: Piano Studio Schedule Mockup ─── */
const ROOMS = ["Grand Piano", "Upright 1", "Upright 2"];
const TIME_SLOTS = ["09:00", "09:45", "10:30", "11:15", "12:00"];

const SCHEDULE_GRID: { student: string; grade: string; room: number; slot: number; span?: number; color: string }[] = [
  { student: "Lily S.", grade: "Gr. 5", room: 0, slot: 0, color: "hsl(var(--teal))" },
  { student: "Oscar B.", grade: "Gr. 3", room: 1, slot: 0, color: "hsl(var(--violet))" },
  { student: "Mia T.", grade: "Gr. 1", room: 2, slot: 0, color: "hsl(var(--coral))" },
  { student: "Noah K.", grade: "Gr. 7", room: 0, slot: 1, color: "hsl(var(--emerald))" },
  { student: "Group — Prep", grade: "Prep", room: 1, slot: 1, span: 2, color: "hsl(var(--violet))" },
  { student: "Ava D.", grade: "Gr. 4", room: 0, slot: 2, color: "hsl(var(--teal))" },
  { student: "Ethan P.", grade: "Gr. 6", room: 2, slot: 2, color: "hsl(var(--coral))" },
  { student: "Sophie M.", grade: "Gr. 2", room: 0, slot: 3, color: "hsl(var(--emerald))" },
  { student: "Exam Prep", grade: "Gr. 8", room: 2, slot: 3, color: "hsl(var(--coral))" },
];

function HeroPianoSchedule() {
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
            <h3 className="text-sm font-bold text-foreground">Studio Schedule</h3>
            <p className="text-xs text-muted-foreground">Monday · 3 rooms · 9 lessons</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[hsl(var(--emerald)/0.1)] text-[hsl(var(--emerald))]"
          >
            No conflicts
          </motion.div>
        </div>

        {/* Grid header */}
        <div className="grid grid-cols-[50px_1fr_1fr_1fr] gap-px bg-border/20">
          <div className="bg-card p-2" />
          {ROOMS.map((room) => (
            <div key={room} className="bg-card px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <DoorOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{room}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        {TIME_SLOTS.map((time, slotIdx) => (
          <div key={time} className="grid grid-cols-[50px_1fr_1fr_1fr] gap-px bg-border/10">
            <div className="bg-card px-2 py-3 flex items-center">
              <span className="text-[10px] font-bold text-muted-foreground">{time}</span>
            </div>
            {ROOMS.map((_, roomIdx) => {
              const lesson = SCHEDULE_GRID.find((l) => l.room === roomIdx && l.slot === slotIdx);
              if (lesson) {
                return (
                  <motion.div
                    key={roomIdx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + slotIdx * 0.08 + roomIdx * 0.04 }}
                    className="bg-card px-2 py-2"
                    style={{ gridColumn: lesson.span ? `span ${lesson.span}` : undefined }}
                  >
                    <div
                      className="rounded-lg px-2 py-1.5 h-full"
                      style={{ backgroundColor: `color-mix(in srgb, ${lesson.color} 12%, transparent)`, borderLeft: `3px solid ${lesson.color}` }}
                    >
                      <p className="text-[10px] font-bold text-foreground truncate">{lesson.student}</p>
                      <p className="text-[8px] text-muted-foreground">{lesson.grade}</p>
                    </div>
                  </motion.div>
                );
              }
              // Check if this cell is covered by a span
              const spanning = SCHEDULE_GRID.find((l) => l.slot === slotIdx && l.room < roomIdx && l.span && l.room + l.span > roomIdx);
              if (spanning) return null;
              return <div key={roomIdx} className="bg-card px-2 py-2" />;
            })}
          </div>
        ))}
      </div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--teal))] text-white text-xs font-bold shadow-lg"
      >
        Room-aware
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
        className="absolute bottom-12 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <GraduationCap className="w-3 h-3" /> Grade tracking
      </motion.div>
    </motion.div>
  );
}

/* ─── Grade progression mockup ─── */
const STUDENT_GRADES = [
  { name: "Lily S.", current: "Grade 5", target: "Grade 6", board: "ABRSM", examDate: "Jun 2026", progress: 75 },
  { name: "Noah K.", current: "Grade 7", target: "Grade 8", board: "ABRSM", examDate: "Nov 2026", progress: 40 },
  { name: "Ethan P.", current: "Grade 6", target: "DipABRSM", board: "ABRSM", examDate: "Mar 2027", progress: 20 },
  { name: "Mia T.", current: "Grade 1", target: "Grade 2", board: "Trinity", examDate: "Mar 2026", progress: 90 },
];

function GradeTrackingMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/40">
        <h3 className="text-sm font-bold text-foreground">Grade Progression</h3>
        <p className="text-[10px] text-muted-foreground">4 students with upcoming exams</p>
      </div>

      {STUDENT_GRADES.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.1 }}
          className="px-5 py-3 border-b border-border/15 last:border-0"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <p className="text-[11px] font-bold text-foreground">{s.name}</p>
              <p className="text-[9px] text-muted-foreground">{s.current} → {s.target} · {s.board}</p>
            </div>
            <span className="text-[9px] font-medium text-muted-foreground">{s.examDate}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                s.progress >= 75 ? "bg-[hsl(var(--emerald))]" :
                s.progress >= 40 ? "bg-primary" :
                "bg-[hsl(var(--coral)/0.6)]"
              }`}
              style={{ width: `${s.progress}%` }}
            />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Features ─── */
const FEATURES = [
  { icon: CalendarDays, title: "Room-aware scheduling", description: "Assign pianos and rooms per lesson. Conflict detection prevents double-bookings automatically.", to: "/features/scheduling", linkText: "Explore scheduling features", accent: "teal" },
  { icon: GraduationCap, title: "Grade & exam tracking", description: "Track ABRSM, Trinity, and LCM grades per student. Log exam dates, results, and progression.", to: "/features/students", linkText: "See student management", accent: "violet" },
  { icon: CreditCard, title: "Flexible billing", description: "Termly, monthly, or per-lesson billing. Sibling discounts and scholarship rates built in.", to: "/features/billing", linkText: "See invoicing and billing", accent: "coral" },
  { icon: BookOpen, title: "Practice assignments", description: "Set weekly pieces and exercises. Students log practice, parents see progress.", to: "/features/practice-tracking", linkText: "Explore practice tracking", accent: "emerald" },
  { icon: Users, title: "Parent portal", description: "Families view schedules, pay invoices, and message teachers — reducing admin emails.", to: "/features/parent-portal", linkText: "View the family portal", accent: "teal" },
  { icon: Music, title: "Attendance & make-ups", description: "Mark attendance per lesson, track absences, and manage make-up credits automatically.", to: "/features/attendance", linkText: "See attendance tracking", accent: "violet" },
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
export default function ForPianoSchools() {
  usePageMeta(
    "Piano School Management Software | LessonLoop",
    "Schedule piano lessons, track grades, automate billing, and keep parents informed. Music school software built for UK piano teachers. Free trial.",
    {
      ogTitle: "Piano School Management Software | LessonLoop",
      ogDescription: "Run your piano school with LessonLoop — scheduling, grade tracking, invoicing, and parent portals in one platform.",
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
        name="Piano School Management"
        description="Scheduling, grade tracking, invoicing, and parent communication software for piano schools."
        canonical={CANONICAL}
        breadcrumbName="Piano Schools"
        faqs={FAQS}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-background pt-24 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <motion.div
          className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(var(--violet)) 0%, transparent 70%)" }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--violet)/0.1)] border border-[hsl(var(--violet)/0.2)]">
                <Music className="w-4 h-4 text-[hsl(var(--violet))]" />
                <span className="text-sm font-semibold text-[hsl(var(--violet))] tracking-wide">For Piano Schools</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Piano school management{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--violet))] to-[hsl(var(--teal))] bg-clip-text text-transparent">
                  in perfect harmony
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Grade tracking, room-aware scheduling, termly billing, and a parent portal — everything your piano school needs to run smoothly.
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
              <HeroPianoSchedule />
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
              Running a piano school has its own <span className="text-[hsl(var(--coral))]">challenges</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Room clashes, grade tracking on paper, complex termly billing — admin headaches that shouldn't stand between you and great teaching.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Room & piano clashes", description: "When multiple teachers share studios, double-bookings waste everyone's time." },
              { icon: Clock, title: "Grade tracking on paper", description: "ABRSM levels, exam dates, and targets scattered across notebooks and emails." },
              { icon: FileSpreadsheet, title: "Termly billing complexity", description: "Different rates for different durations, siblings, and scholarship students." },
              { icon: Repeat, title: "Make-up lesson chaos", description: "Tracking who's owed a make-up and finding a slot that works is a full-time job." },
              { icon: UserX, title: "No-shows without notice", description: "Students miss lessons without warning, and there's no system to track patterns." },
              { icon: MapPin, title: "Multi-room juggling", description: "Assigning the right piano to the right lesson at the right time across rooms." },
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
              Built for the way piano schools <span className="text-primary">work</span>
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

      {/* ═══ GRADE TRACKING ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--violet))]">Grade Tracking</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Every student's <span className="text-[hsl(var(--violet))]">musical journey</span>, tracked
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Log current grades, set targets, track exam dates and results. Know exactly where each student is on their path — from Prep to Diploma.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  Explore student management <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--violet))] hover:underline">
                  See reporting features <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <GradeTrackingMockup />
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
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[hsl(var(--violet))] flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold text-white">"</span>
            </div>
            <blockquote className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
              We run 6 piano studios across 3 rooms. LessonLoop means no more scheduling spreadsheets and parents love the portal. It's transformed our admin.
            </blockquote>
            <div>
              <p className="font-bold text-foreground">Helen K.</p>
              <p className="text-sm text-muted-foreground">Piano School Owner, Edinburgh</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARE STRIP ═══ */}
      <section className="border-y border-border/40 bg-secondary/20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Switching from another platform?</h2>
            <p className="text-sm text-muted-foreground mt-2">See how LessonLoop compares for piano schools</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "vs My Music Staff", to: "/compare/lessonloop-vs-my-music-staff" },
              { label: "vs Teachworks", to: "/compare/lessonloop-vs-teachworks" },
              { label: "vs Opus 1", to: "/compare/lessonloop-vs-opus1" },
              { label: "vs Fons", to: "/compare/lessonloop-vs-fons" },
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
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Give your piano school the software <span className="text-[hsl(var(--violet-light,var(--violet)))]">it deserves.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Join UK piano schools using LessonLoop to schedule, bill, and communicate — beautifully.
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
