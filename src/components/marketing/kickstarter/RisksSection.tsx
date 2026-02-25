import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Server, Brain, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const risks = [
  {
    icon: ShieldCheck,
    title: "Not Vaporware",
    body: "The core platform is already live and being used. This isn't a concept — it's a working product. Kickstarter funds go towards scaling, not building from scratch.",
    accent: "teal",
    mitigation: "Fully functional today",
  },
  {
    icon: AlertTriangle,
    title: "Third-Party APIs",
    body: "We rely on payment processors and email providers. If any change terms, we have fallback integrations planned. We'll never be locked into a single vendor.",
    accent: "amber",
    mitigation: "Multi-vendor fallbacks planned",
  },
  {
    icon: Server,
    title: "Infrastructure Scaling",
    body: "Growing from hundreds to thousands of users requires careful scaling. We've architected for this from day one with a multi-tenant, cloud-native approach.",
    accent: "blue",
    mitigation: "Cloud-native from day one",
  },
  {
    icon: Brain,
    title: "AI Accuracy",
    body: "LoopAssist uses a human-in-the-loop approach — every AI suggestion must be confirmed before it takes effect. You stay in control, always.",
    accent: "coral",
    mitigation: "Human-in-the-loop always",
  },
];

const ACCENT = {
  teal: { icon: "text-[hsl(var(--teal))]", badge: "bg-[hsl(var(--teal)/0.1)] text-[hsl(var(--teal))]", border: "border-l-[hsl(var(--teal))]" },
  amber: { icon: "text-warning", badge: "bg-warning/10 text-warning", border: "border-l-warning" },
  blue: { icon: "text-blue-500", badge: "bg-blue-500/10 text-blue-600", border: "border-l-blue-500" },
  coral: { icon: "text-[hsl(var(--coral))]", badge: "bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]", border: "border-l-[hsl(var(--coral))]" },
};

export function RisksSection() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Dark background */}
      <div className="absolute inset-0 bg-[hsl(var(--ink))]" />
      <motion.div
        className="absolute top-0 right-0 w-[500px] h-[500px] opacity-15"
        style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", filter: "blur(80px)" }}
      />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/70 text-sm font-semibold mb-6">
            <ShieldCheck className="w-4 h-4" />
            Transparency First
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Risks & Challenges
          </h2>
          <p className="text-lg text-white/50">
            We believe in transparency. Here's what could go wrong and how we've planned for it.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {risks.map((r, i) => {
            const a = ACCENT[r.accent as keyof typeof ACCENT];
            return (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <r.icon className={`w-5 h-5 ${a.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-2">{r.title}</h3>
                    <p className="text-white/50 leading-relaxed text-sm mb-3">{r.body}</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${a.badge}`}>
                      {r.mitigation}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Link to GDPR / privacy */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link
            to="/gdpr"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Read our GDPR compliance commitment <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
