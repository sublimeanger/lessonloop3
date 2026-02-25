import { motion } from "framer-motion";
import { PoundSterling, Receipt, Calendar, CalendarOff, Shield, Clock } from "lucide-react";

const ukFeatures = [
  { icon: PoundSterling, title: "GBP & Pence", desc: "Everything in pounds and pence — no currency conversions." },
  { icon: Receipt, title: "UK VAT", desc: "Auto-calculated on every invoice, HMRC-ready." },
  { icon: Calendar, title: "Term Dates", desc: "Your term structure, auto-skipping breaks." },
  { icon: CalendarOff, title: "Bank Holidays", desc: "UK public holidays built in from day one." },
  { icon: Shield, title: "GDPR Compliant", desc: "UK data protection by design." },
  { icon: Clock, title: "UK Time Zone", desc: "London time, always — no UTC confusion." },
];

export function UKDifferentiator() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            🇬🇧 Built for the UK
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Finally, software that
            <br />
            <span className="text-muted-foreground">understands UK music teaching.</span>
          </h2>
        </motion.div>

        {/* 2x3 Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-4xl mx-auto">
          {ukFeatures.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feat.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">{feat.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{feat.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Founder quote */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto mt-12 text-center"
        >
          <p className="text-lg italic text-muted-foreground leading-relaxed">
            "I spent years using American software that didn't understand terms, VAT, or bank holidays.
            So I built something that does."
          </p>
          <footer className="mt-4 text-sm text-muted-foreground">
            — Lauren Twilley, Founder
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
