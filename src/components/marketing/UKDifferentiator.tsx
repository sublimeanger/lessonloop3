import { motion } from "framer-motion";
import { PoundSterling, Receipt, Calendar, CalendarOff, Shield, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const ukFeatures = [
  { icon: PoundSterling, title: "GBP & Pence", desc: "Everything in pounds and pence — no currency conversions or rounding surprises.", accent: "teal" as const },
  { icon: Receipt, title: "UK VAT Support", desc: "Auto-calculated on every invoice, HMRC-ready. Toggle on or off per organisation.", accent: "coral" as const },
  { icon: Calendar, title: "Term Dates", desc: "Your term structure built in — lessons auto-skip half-terms and holidays.", accent: "teal" as const },
  { icon: CalendarOff, title: "Bank Holidays", desc: "UK public holidays recognised from day one. No manual closure dates needed.", accent: "coral" as const },
  { icon: Shield, title: "GDPR by Design", desc: "UK data protection built into every layer — consent, retention, and export.", accent: "teal" as const },
  { icon: Clock, title: "Europe/London", desc: "BST & GMT handled automatically. No UTC confusion, ever.", accent: "coral" as const },
];

const accentClasses = {
  teal: {
    iconBg: "bg-[hsl(var(--teal)/0.15)]",
    iconColor: "text-[hsl(var(--teal-light))]",
    border: "group-hover:border-[hsl(var(--teal)/0.3)]",
    glow: "group-hover:shadow-[0_0_40px_-12px_hsl(var(--teal)/0.2)]",
  },
  coral: {
    iconBg: "bg-[hsl(var(--coral)/0.15)]",
    iconColor: "text-[hsl(var(--coral))]",
    border: "group-hover:border-[hsl(var(--coral)/0.3)]",
    glow: "group-hover:shadow-[0_0_40px_-12px_hsl(var(--coral)/0.2)]",
  },
};

export function UKDifferentiator() {
  return (
    <section className="py-24 lg:py-32 bg-[hsl(var(--ink))] relative overflow-hidden">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--teal-light)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Glow orbs */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] opacity-[0.06] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", filter: "blur(100px)" }} />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] opacity-[0.05] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)", filter: "blur(100px)" }} />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/80 text-sm font-semibold mb-6"
          >
            <span className="text-lg leading-none">🇬🇧</span>
            Built for UK Music Schools
          </motion.span>

          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Finally, software that
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--teal-light))] to-[hsl(var(--coral))] bg-clip-text text-transparent">
              speaks your language.
            </span>
          </h2>
          <p className="mt-5 text-lg text-white/50 max-w-xl mx-auto">
            No more converting dollars, fighting time zones, or explaining what a "half-term" is. LessonLoop was built in the UK, for the UK.
          </p>
        </motion.div>

        {/* Feature grid — 3 columns, asymmetric heights */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-5xl mx-auto">
          {ukFeatures.map((feat, i) => {
            const ac = accentClasses[feat.accent];
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 transition-all duration-300 ${ac.border} ${ac.glow}`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl ${ac.iconBg} flex items-center justify-center mb-4`}>
                  <feat.icon className={`w-5 h-5 ${ac.iconColor}`} />
                </div>
                <h3 className="font-bold text-white text-lg mb-1.5">{feat.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{feat.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Founder quote + CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="max-w-3xl mx-auto mt-14 flex flex-col lg:flex-row items-center gap-8"
        >
          {/* Quote */}
          <div className="flex-1 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-br from-[hsl(var(--teal))] to-[hsl(var(--coral))] shrink-0">
              <div className="w-full h-full rounded-full bg-[hsl(var(--ink))] flex items-center justify-center text-white font-bold text-sm">
                LT
              </div>
            </div>
            <div>
              <p className="text-white/60 italic leading-relaxed">
                "I spent years using American software that didn't understand terms, VAT, or bank holidays. So I built something that does."
              </p>
              <p className="text-white/30 text-sm mt-2">
                — Lauren Twilley, Founder &amp; Piano Teacher
              </p>
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/uk"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white font-semibold text-sm hover:bg-white/[0.1] transition-colors shrink-0"
          >
            Why we're built for the UK
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
