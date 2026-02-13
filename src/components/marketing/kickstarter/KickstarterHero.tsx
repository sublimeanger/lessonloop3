import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "./CountdownTimer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Rocket, Shield, Target } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -90 },
  visible: {
    opacity: 1, y: 0, rotateX: 0,
    transition: { type: "spring" as const, damping: 12, stiffness: 100 },
  },
};

export function KickstarterHero() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("kickstarter_signups" as any).insert({ email, name: name || null });
      if (error) {
        if (error.code === "23505") {
          toast.info("You're already on the list! We'll be in touch.");
        } else {
          throw error;
        }
      } else {
        toast.success("You're in! We'll notify you when we launch.");
        setName("");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const headlineWords = ["Help", "Us", "Launch", "LessonLoop"];

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-ink" />
      <motion.div
        animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] opacity-40"
        style={{ background: "radial-gradient(circle, hsl(var(--teal) / 0.4) 0%, transparent 70%)", filter: "blur(80px)" }}
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--coral) / 0.4) 0%, transparent 70%)", filter: "blur(80px)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-coral/20 backdrop-blur-xl border border-coral/30 rounded-full px-5 py-2.5 mb-8"
          >
            <Rocket className="w-4 h-4 text-coral-light" />
            <span className="text-coral-light text-sm font-semibold">Coming to Kickstarter · Date TBC</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-white leading-[1.05] tracking-tight"
          >
            {headlineWords.map((word, i) => (
              <motion.span
                key={i}
                variants={wordVariants}
                className={`inline-block mr-4 ${word === "LessonLoop" ? "text-transparent bg-clip-text bg-gradient-to-r from-teal-light via-teal to-teal-dark" : ""}`}
                style={{ transformStyle: "preserve-3d" }}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-xl sm:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            The scheduling & invoicing platform built by a music teacher with 20 years' experience.
            Back us and get lifetime access at founding-member prices.
          </motion.p>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-12"
          >
            <p className="text-white/40 text-sm uppercase tracking-widest mb-4 font-medium">30-day campaign · launching soon</p>
            <CountdownTimer />
          </motion.div>

          {/* Email Signup */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-12 max-w-lg mx-auto"
          >
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-6">
              <p className="text-white font-semibold mb-4">Get notified on launch day</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
                <Input
                  type="email"
                  placeholder="Your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-gradient-to-r from-coral to-coral-dark text-white hover:from-coral-dark hover:to-coral font-bold h-12 text-base"
              >
                {loading ? "Signing up…" : "Notify Me"}
              </Button>
            </div>
          </motion.form>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white/40 text-sm"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>All-or-nothing</span>
            </div>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <span>£18,500 goal</span>
            <div className="w-px h-5 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Kickstarter protected</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
