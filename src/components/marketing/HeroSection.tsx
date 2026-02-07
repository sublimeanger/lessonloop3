import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Play, Calendar, Clock, CheckCircle2, Bell } from "lucide-react";
import { dashboardHero } from "@/assets/marketing";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
// Word-by-word animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -90 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      type: "spring" as const,
      damping: 12,
      stiffness: 100,
    },
  },
};

// Floating notification data
const notifications = [
  {
    icon: CheckCircle2,
    title: "Payment received",
    subtitle: "Emma Watson paid £45.00",
    color: "from-emerald-500 to-emerald-600",
    position: "left-[5%] top-[25%]",
    delay: 1.2,
  },
  {
    icon: Calendar,
    title: "Lesson scheduled",
    subtitle: "Piano - Tomorrow 3pm",
    color: "from-teal to-teal-dark",
    position: "right-[5%] top-[30%]",
    delay: 1.5,
  },
  {
    icon: Bell,
    title: "Reminder sent",
    subtitle: "24hr lesson reminder",
    color: "from-coral to-coral-dark",
    position: "left-[8%] bottom-[25%]",
    delay: 1.8,
  },
  {
    icon: Clock,
    title: "3 lessons today",
    subtitle: "Next: Oliver at 2pm",
    color: "from-violet-500 to-violet-600",
    position: "right-[8%] bottom-[30%]",
    delay: 2.1,
  },
];

// Mockup schedule data
const scheduleItems = [
  { time: "09:00", student: "Emma W.", type: "Piano", color: "bg-teal" },
  { time: "10:00", student: "Oliver J.", type: "Guitar", color: "bg-coral" },
  { time: "11:30", student: "Sophie M.", type: "Violin", color: "bg-violet-500" },
  { time: "14:00", student: "James C.", type: "Piano", color: "bg-teal" },
  { time: "15:30", student: "Lily P.", type: "Voice", color: "bg-amber-500" },
];

export function HeroSection() {
  const isMobile = useIsMobile();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { stiffness: 100, damping: 30 };
  const x = useSpring(useTransform(mouseX, [0, 1], [-10, 10]), springConfig);
  const y = useSpring(useTransform(mouseY, [0, 1], [-10, 10]), springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return; // Skip on mobile
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const headlineWords = ["Music", "lessons,", "perfectly", "orchestrated."];

  return (
    <section 
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      onMouseMove={isMobile ? undefined : handleMouseMove}
    >
      {/* 3D Gradient Mesh Background */}
      <div className="absolute inset-0 bg-ink" />
      
      {/* Animated Mesh Gradients — static on mobile for performance */}
      {isMobile ? (
        <>
          <div
            className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] opacity-30"
            style={{
              background: "radial-gradient(circle, hsl(var(--teal) / 0.4) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute bottom-[-20%] right-[-10%] w-[350px] h-[350px] opacity-20"
            style={{
              background: "radial-gradient(circle, hsl(var(--coral) / 0.4) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
        </>
      ) : (
        <>
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] opacity-40"
            style={{
              background: "radial-gradient(circle, hsl(var(--teal) / 0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [360, 180, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] opacity-30"
            style={{
              background: "radial-gradient(circle, hsl(var(--coral) / 0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 100, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[40%] left-[30%] w-[500px] h-[500px] opacity-20"
            style={{
              background: "radial-gradient(circle, hsl(var(--teal-light) / 0.3) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
        </>
      )}

      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating Notifications (Desktop) */}
      <div className="absolute inset-0 hidden lg:block pointer-events-none">
        {notifications.map((notif, i) => (
          <motion.div
            key={notif.title}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: notif.delay, duration: 0.5, type: "spring" }}
            className={`absolute ${notif.position}`}
            style={{ x, y }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-3 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${notif.color} flex items-center justify-center shadow-lg`}>
                  <notif.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{notif.title}</div>
                  <div className="text-white/60 text-xs">{notif.subtitle}</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-24 pb-12">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2.5 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal"></span>
            </span>
            <span className="text-white/80 text-sm font-medium">
              Built by a music teacher, for music teachers
            </span>
          </motion.div>

          {/* Word-by-Word Headline */}
          <motion.h1
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-white leading-[1.05] tracking-tight perspective-1000"
          >
            {headlineWords.map((word, i) => (
              <motion.span
                key={i}
                variants={wordVariants}
                className={`inline-block mr-4 ${word === "perfectly" ? "text-transparent bg-clip-text bg-gradient-to-r from-teal-light via-teal to-teal-dark" : ""}`}
                style={{ transformStyle: "preserve-3d" }}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-xl sm:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            The all-in-one platform for scheduling, invoicing, and parent communication. 
            Created by a piano teacher who lived the problem.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/signup">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  size="xl" 
                  className="bg-gradient-to-r from-teal to-teal-dark text-white hover:from-teal-dark hover:to-teal font-bold shadow-2xl shadow-teal/20 px-10 h-14 text-lg"
                >
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </Link>
            <Link to="/contact?subject=demo">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 px-6 py-3.5 text-white/80 hover:text-white font-medium transition-colors group"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 group-hover:bg-white/10 group-hover:border-white/20 transition-all">
                  <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                </span>
                Book a Demo
              </motion.button>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-white/40"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🎹 Built by a music teacher</span>
            </div>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <span className="text-sm">30-day free trial</span>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <span className="text-sm">No credit card needed</span>
          </motion.div>
        </div>
      </div>

      {/* Product Mockup - Real Screenshot */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="relative w-full max-w-5xl mx-auto px-6 lg:px-8 mt-4 mb-12"
      >
        {/* Browser Frame */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40">
          {/* Browser Top Bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/80" />
              <div className="w-3 h-3 rounded-full bg-warning/80" />
              <div className="w-3 h-3 rounded-full bg-success/80" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-white/10 rounded-lg px-4 py-1 text-xs text-white/40 font-mono">
                app.lessonloop.net/calendar
              </div>
            </div>
          </div>

          {/* Real Screenshot */}
          <div className="relative">
            <img 
              src={dashboardHero} 
              alt="LessonLoop Dashboard - Music lesson scheduling software" 
              className="w-full h-auto"
            />
            {/* Subtle overlay for blend */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Floating Elements Around Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.2 }}
          className="absolute -left-4 top-1/2 -translate-y-1/2 hidden xl:block"
        >
          <motion.div
            animate={{ x: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="bg-card border border-border rounded-xl p-3 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">Payment received</div>
                <div className="text-xs text-muted-foreground">£45.00 from Emma W.</div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.4 }}
          className="absolute -right-4 top-1/3 hidden xl:block"
        >
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 3.5, repeat: Infinity }}
            className="bg-card border border-border rounded-xl p-3 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">Reminder sent</div>
                <div className="text-xs text-muted-foreground">Tomorrow's lessons</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1], y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-2 rounded-full bg-white/40"
          />
        </motion.div>
      </motion.div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
