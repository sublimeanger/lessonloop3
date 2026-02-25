import { motion } from "framer-motion";
import { PoundSterling, Receipt, Calendar, CalendarOff, Shield, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  { icon: PoundSterling, title: "GBP & Pence", desc: "Everything in pounds and pence — invoices, payment tracking, reports, parent portal. No currency conversions, no rounding errors, no confused parents." },
  { icon: Receipt, title: "UK VAT Auto-Calculation", desc: "VAT is calculated and itemised on every invoice automatically. Configurable VAT rate, HMRC-ready PDF invoices, and VAT breakdowns in your reports." },
  { icon: Calendar, title: "Termly Scheduling", desc: "Set your autumn, spring, and summer term dates. LessonLoop calculates lesson counts per term, auto-skips half-term breaks, and generates term invoices in bulk." },
  { icon: CalendarOff, title: "UK Bank Holidays", desc: "England, Wales, Scotland, and Northern Ireland bank holidays built in. Recurring lessons skip them automatically. No manual blocking required." },
  { icon: Shield, title: "GDPR by Design", desc: "Data export for Subject Access Requests, configurable retention policies, automatic anonymisation, comprehensive audit logging, soft delete, and role-based access. Not a checkbox — a design philosophy." },
  { icon: Clock, title: "British English & GMT/BST", desc: "British English throughout. DD/MM/YYYY dates. London timezone by default. No 'color', no 'center', no AM/PM confusion." },
];

export function UKSolution() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Built for UK music schools from the ground up
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Not adapted. Not translated. Not retrofitted. Every feature in LessonLoop was designed with UK music
            educators in mind.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-4xl mx-auto">
          {features.map((feat, i) => (
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
              <h3 className="font-semibold text-foreground">{feat.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8">
          <Link to="/features/billing" className="text-sm font-semibold text-primary hover:underline">
            See invoicing features →
          </Link>
          <Link to="/features/scheduling" className="text-sm font-semibold text-primary hover:underline">
            See scheduling features →
          </Link>
          <Link to="/features/parent-portal" className="text-sm font-semibold text-primary hover:underline">
            Explore the parent portal →
          </Link>
        </div>
      </div>
    </section>
  );
}
