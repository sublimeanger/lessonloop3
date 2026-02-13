import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "./CountdownTimer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("kickstarter_signups" as any).insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast.info("You're already on the list!");
        } else {
          throw error;
        }
      } else {
        toast.success("You're in! We'll notify you when we launch.");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-ink" />
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--teal) / 0.3) 0%, transparent 60%)", filter: "blur(100px)" }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
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
            className="text-lg text-white/60 mb-10"
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
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
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
              className="bg-gradient-to-r from-coral to-coral-dark text-white hover:from-coral-dark hover:to-coral font-bold h-12 px-6 shrink-0"
            >
              {loading ? "…" : "Notify Me"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
