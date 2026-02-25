import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import FeaturePageSchema from "@/components/marketing/feature-page/FeaturePageSchema";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useRef } from "react";
import {
  FolderOpen, Clock, AlertTriangle, Upload, FileText,
  Music, Users, Tag, Download, Shield, Search,
  Calendar, MessageSquare, Sparkles, ArrowRight, ChevronRight,
  File, Image, Mic, BookOpen, Layers, Eye,
} from "lucide-react";

/* ─── FAQ data ─── */
const faqs = [
  { question: "What file types can I upload?", answer: "PDFs, images, audio files, and documents. Upload sheet music, practice recordings, worksheets, or any teaching material." },
  { question: "Can students access resources from the portal?", answer: "Yes. Resources shared with a student appear in their parent portal. Parents and students can download them anytime." },
  { question: "Can I organise resources by instrument or level?", answer: "Yes. Tag resources by instrument, grade level, or custom categories. Filter and search to find what you need." },
  { question: "Is there a storage limit?", answer: "Storage limits depend on your plan. Solo includes basic storage, Pro and Academy include expanded limits." },
  { question: "Can multiple teachers share resources?", answer: "Yes. Resources can be shared at the organisation level. Teachers can access and assign shared materials to their students." },
];

/* ─── Hero: File Library Mockup ─── */
const MOCK_FILES = [
  { name: "Prelude in C Major.pdf", type: "pdf" as const, instrument: "Piano", grade: "Grade 5", shared: 3, size: "1.2 MB" },
  { name: "Scales & Arpeggios.pdf", type: "pdf" as const, instrument: "Violin", grade: "Grade 3", shared: 7, size: "840 KB" },
  { name: "Lesson Recording — Week 12.mp3", type: "audio" as const, instrument: "Guitar", grade: "Grade 2", shared: 1, size: "4.8 MB" },
  { name: "Rhythm Worksheet.png", type: "image" as const, instrument: "Drums", grade: "Prep", shared: 12, size: "320 KB" },
  { name: "Sight-Reading Exercises.pdf", type: "pdf" as const, instrument: "Piano", grade: "Grade 4", shared: 5, size: "2.1 MB" },
];

const FILE_ICONS: Record<string, { icon: typeof File; color: string; bg: string }> = {
  pdf: { icon: FileText, color: "text-[hsl(var(--coral))]", bg: "bg-[hsl(var(--coral)/0.1)]" },
  audio: { icon: Mic, color: "text-[hsl(var(--violet))]", bg: "bg-[hsl(var(--violet)/0.1)]" },
  image: { icon: Image, color: "text-[hsl(var(--teal))]", bg: "bg-[hsl(var(--teal)/0.1)]" },
};

function HeroLibraryMockup() {
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
            <h3 className="text-sm font-bold text-foreground">Resource Library</h3>
            <p className="text-xs text-muted-foreground">142 files · 5 instruments</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 }}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-muted-foreground text-[10px]"
            >
              <Search className="w-3 h-3" /> Search…
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"
            >
              <Upload className="w-3 h-3" /> Upload
            </motion.div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-2.5 border-b border-border/20 flex gap-1.5 flex-wrap">
          {["All", "Piano", "Violin", "Guitar", "Drums"].map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                i === 0
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {tag}
            </motion.span>
          ))}
        </div>

        {/* File rows */}
        {MOCK_FILES.map((file, i) => {
          const ft = FILE_ICONS[file.type];
          const Icon = ft.icon;
          return (
            <motion.div
              key={file.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.12, duration: 0.35 }}
              className="px-5 py-3 border-b border-border/15 last:border-0 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg ${ft.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${ft.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">{file.instrument}</span>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="text-[9px] text-muted-foreground">{file.grade}</span>
                  <span className="text-[9px] text-muted-foreground/30">·</span>
                  <span className="text-[9px] text-muted-foreground">{file.size}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Users className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[9px] font-bold text-muted-foreground">{file.shared}</span>
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
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-[hsl(var(--emerald))] text-white text-xs font-bold shadow-lg"
      >
        Auto-organised
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200 }}
        className="absolute bottom-16 -left-4 px-3 py-1.5 rounded-full bg-[hsl(var(--violet))] text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
      >
        <Eye className="w-3 h-3" /> Portal access
      </motion.div>
    </motion.div>
  );
}

/* ─── Capabilities ─── */
const CAPABILITIES = [
  { icon: Upload, title: "Drag-and-drop uploads", description: "Upload PDFs, images, audio, and documents in seconds. Drag files straight into your library.", accent: "teal" },
  { icon: Tag, title: "Instrument & level tags", description: "Tag resources by instrument, grade level, or custom categories. Filter and search across your entire library.", accent: "violet" },
  { icon: Users, title: "Share with students", description: "Assign resources to individual students or groups. Files appear instantly in the parent portal.", accent: "coral" },
  { icon: Download, title: "Parent portal downloads", description: "Students and parents download resources anytime from the portal. No more re-sending attachments.", accent: "emerald" },
  { icon: Music, title: "Built for music teachers", description: "Designed for the file types you actually use — sheet music PDFs, practice recordings, worksheets.", accent: "teal" },
  { icon: Shield, title: "Secure & scoped", description: "Files stored securely with access controls. Students only see resources shared with them.", accent: "violet" },
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

/* ─── Sharing flow mockup ─── */
function SharingFlowMockup() {
  const students = [
    { name: "Emma W.", instrument: "Piano", selected: true },
    { name: "Oliver P.", instrument: "Piano", selected: true },
    { name: "Sophia T.", instrument: "Violin", selected: false },
    { name: "James R.", instrument: "Guitar", selected: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/40">
        <h3 className="text-sm font-bold text-foreground">Share Resource</h3>
        <p className="text-[10px] text-muted-foreground">Prelude in C Major.pdf → Select students</p>
      </div>

      {/* File preview */}
      <div className="px-5 py-3 border-b border-border/20 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--coral)/0.1)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[hsl(var(--coral))]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Prelude in C Major.pdf</p>
          <p className="text-[9px] text-muted-foreground">Piano · Grade 5 · 1.2 MB</p>
        </div>
      </div>

      {/* Student list */}
      {students.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.08 }}
          className="px-5 py-2.5 border-b border-border/15 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {s.name.charAt(0)}
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground">{s.name}</p>
              <p className="text-[9px] text-muted-foreground">{s.instrument}</p>
            </div>
          </div>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
            s.selected
              ? "bg-primary text-primary-foreground"
              : "border border-border"
          }`}>
            {s.selected && <span className="text-[9px] font-bold">✓</span>}
          </div>
        </motion.div>
      ))}

      {/* Share button */}
      <div className="px-5 py-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold text-center"
        >
          Share with 3 students
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Steps ─── */
const STEPS = [
  { num: "01", title: "Upload files", description: "Drag and drop your teaching materials. Tag by instrument, level, or custom category.", icon: Upload },
  { num: "02", title: "Assign to students", description: "Share resources with individual students or groups. They appear in the parent portal immediately.", icon: Users },
  { num: "03", title: "Students access anytime", description: "Students and parents download materials from the portal. No more email attachments or lost files.", icon: Download },
];

/* ─── Related features ─── */
const RELATED = [
  { icon: BookOpen, title: "Practice Tracking", description: "Assign resources alongside practice tasks. Students see what to practise and have the materials to do it.", to: "/features/practice-tracking", linkText: "Explore practice tracking" },
  { icon: MessageSquare, title: "Parent Portal", description: "Resources appear in the parent portal. Parents and students can browse and download anytime.", to: "/features/parent-portal", linkText: "Explore the parent portal" },
  { icon: Sparkles, title: "LoopAssist AI", description: "Ask LoopAssist to find resources by instrument or level, or check which students have materials assigned.", to: "/features/loopassist", linkText: "Explore LoopAssist AI" },
];

/* ═══════════════════ PAGE ═══════════════════ */
export default function FeatureResources() {
  usePageMeta(
    "Teaching Resources & File Sharing for Music Schools | LessonLoop",
    "Upload, organise, and share teaching resources with students and parents. Sheet music, worksheets, and recordings — all in one place. Free 30-day trial.",
    {
      canonical: "https://lessonloop.co.uk/features/resources",
      ogTitle: "Teaching Resources & File Sharing | LessonLoop",
      ogDescription: "Upload and share sheet music, worksheets, and recordings with students through the parent portal.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features/resources",
      ogSiteName: "LessonLoop",
      ogLocale: "en_GB",
      twitterCard: "summary_large_image",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    }
  );

  return (
    <MarketingLayout>
      <FeaturePageSchema
        featureName="Teaching Resources"
        description="Upload, organise, and share teaching resources — sheet music, worksheets, and recordings — with students through the parent portal."
        canonical="https://lessonloop.co.uk/features/resources"
        breadcrumbName="Resources"
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary tracking-wide">Teaching Resources</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                Sheet music, worksheets, recordings —{" "}
                <span className="bg-gradient-to-r from-[hsl(var(--violet))] to-[hsl(var(--violet-dark,var(--violet)))] bg-clip-text text-transparent">
                  one library
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Upload once, tag by instrument and level, share with students instantly. Materials appear in the parent portal — no more email attachments.
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
              <HeroLibraryMockup />
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
              Teaching materials shouldn't live in <span className="text-[hsl(var(--coral))]">email attachments</span>
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Files scattered across email, Google Drive, WhatsApp, and USB sticks. Students lose them. You re-send them. Repeatedly.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: AlertTriangle, title: "Files everywhere", description: "Sheet music in email, recordings on WhatsApp, worksheets on a USB. Nothing is in one place." },
              { icon: Clock, title: "Re-sending constantly", description: "\"Can you send that piece again?\" — the most common parent message. You dig through old emails every time." },
              { icon: Search, title: "Can't find what you need", description: "Hundreds of files with no organisation. Finding the right piece for the right student takes too long." },
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
      <section className="relative bg-background py-20 lg:py-28 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">The Solution</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              A resource library built for <span className="text-primary">music teachers</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload once, organise by instrument and level, share with students instantly. Materials appear in the parent portal.
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
                className={`p-6 rounded-2xl border-l-4 ${ACCENT_BORDER[cap.accent]} border border-border/30 hover:shadow-lg transition-shadow duration-300`}
              >
                <cap.icon className={`w-6 h-6 mb-3 ${ACCENT_ICON[cap.accent]}`} />
                <h3 className="font-bold text-foreground mb-2">{cap.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SHARING FLOW ═══ */}
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
              <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--emerald))]">Sharing</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
                Share resources with students <span className="text-[hsl(var(--emerald))]">in two clicks</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Select a file, pick the students, and hit share. The resource appears instantly in their parent portal — tagged, organised, and downloadable.
              </p>
              <div className="pt-2 space-y-2">
                <Link to="/features/parent-portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  Explore the parent portal <ChevronRight className="w-4 h-4" />
                </Link>
                <br />
                <Link to="/features/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--emerald))] hover:underline">
                  Student management features <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <SharingFlowMockup />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Resources shared in <span className="text-primary">seconds</span></h2>
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
          style={{ background: "radial-gradient(ellipse, hsl(var(--violet)) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Stop re-sending files. <span className="text-[hsl(var(--violet-light,var(--violet)))]">Start sharing smarter.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
            Upload, organise, and share teaching materials with students — all from one platform, accessible through the parent portal.
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
