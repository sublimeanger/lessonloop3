import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "./CountdownTimer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChevronRight, Shield, Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);

  const isDisposableDomain = (email: string) => {
    const blocked = ['mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com','sharklasers.com','guerrillamailblock.com','grr.la','dispostable.com','trashmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return !domain || blocked.includes(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (honeypot) { toast({ title: "You're in! We'll notify you when we launch." }); return; }
    if (isDisposableDomain(email)) { toast({ title: "Please use a real email address.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("kickstarter_signups" as any).insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "You're already on the list!" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "You're in! We'll notify you when we launch." });
        setEmail("");
      }
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[hsl(var(--ink))]" />

      {/* Animated glows */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] opacity-25"
        style={{ background: "radial-gradient(circle, hsl(var(--teal) / 0.3) 0%, transparent 60%)", filter: "blur(100px)" }}
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 right-0 w-[500px] h-[500px] opacity-15"
        style={{ background: "radial-gradient(circle, hsl(var(--coral) / 0.4) 0%, transparent 60%)", filter: "blur(80px)" }}
      />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
          >
            Be the first to know
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/50 mb-10"
          >
            Join the waiting list and we'll email you the moment the campaign goes live.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <CountdownTimer compact />
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="max-w-md mx-auto"
          >
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-5">
              <input type="text" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)} style={{ position: 'absolute', left: '-9999px' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Your email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[hsl(var(--coral))] to-[hsl(var(--coral-dark))] text-white hover:from-[hsl(var(--coral-dark))] hover:to-[hsl(var(--coral))] font-bold h-12 px-6 shrink-0"
                >
                  {loading ? "…" : "Notify Me"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.form>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-5 text-white/30 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>No spam, ever</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Join fellow educators</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Exclusive early access</span>
            </div>
          </motion.div>

          {/* Cross-links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-4 text-sm"
          >
            <Link to="/features/scheduling" className="text-white/40 hover:text-white/70 transition-colors">
              Music lesson scheduling →
            </Link>
            <Link to="/features/billing" className="text-white/40 hover:text-white/70 transition-colors">
              Automated billing →
            </Link>
            <Link to="/uk" className="text-white/40 hover:text-white/70 transition-colors">
              Built for UK music schools →
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
