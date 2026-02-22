import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, Shield, Clock, CreditCard } from "lucide-react";

const guarantees = [
  { icon: Clock, text: "30-day free trial" },
  { icon: CreditCard, text: "No credit card required" },
  { icon: Shield, text: "Cancel anytime" },
];

export function CTASection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Animated Mesh */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(var(--teal) / 0.3) 0%, transparent 60%)",
          filter: "blur(100px)",
        }}
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          rotate: [90, 0, 90],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 right-0 w-[600px] h-[600px] opacity-20"
        style={{
          background: "radial-gradient(circle, hsl(var(--coral) / 0.4) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Side - Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Ready to get your
                <br />
                evenings back?
              </h2>
              <p className="text-xl text-white/70 mb-8">
                Join music educators across the UK who've swapped spreadsheets and chasing 
                payments for a platform that handles it all.
              </p>

              {/* Founder credential */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-light to-teal border-2 border-ink flex items-center justify-center text-sm font-bold text-ink">
                  LT
                </div>
                <div className="text-white/80">
                  Built by <span className="font-semibold text-white">Lauren Twilley</span>, a piano teacher who runs a school of 300 students
                </div>
              </div>

              {/* Guarantees */}
              <div className="flex flex-wrap gap-4">
                {guarantees.map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-2 text-white/70"
                  >
                    <div className="w-5 h-5 rounded-full bg-teal/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-teal-light" />
                    </div>
                    {item.text}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right Side - Form Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 lg:p-10">
                <h3 className="text-2xl font-bold text-white mb-2">
                  Start your 30-day trial
                </h3>
                <p className="text-white/60 mb-6">
                  Try free for 30 days. Cancel anytime.
                </p>

                <Link to="/signup" className="block">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      size="xl" 
                      className="w-full bg-gradient-to-r from-teal to-teal-dark text-white hover:from-teal-dark hover:to-teal font-bold shadow-xl h-14 text-lg"
                    >
                      Get Started Free
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </motion.div>
                </Link>

                <p className="text-center text-white/40 text-sm mt-4">
                  By signing up, you agree to our{" "}
                  <a href="/terms" className="underline hover:text-white/60">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy" className="underline hover:text-white/60">Privacy Policy</a>
                </p>
              </div>

              {/* Founder quote */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10"
              >
                <p className="text-white/70 text-sm italic mb-3">
                  "Most scheduling tools weren't built for the reality of music teaching. So I built one that was."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-xs">
                    LT
                  </div>
                  <div className="text-white/60 text-sm">
                    Lauren Twilley • Founder & Piano Teacher
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
