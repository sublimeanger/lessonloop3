import { motion } from "framer-motion";
import { Server, Smartphone, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const pillars = [
  {
    icon: Server,
    title: "Infrastructure",
    body: "Scale our servers and database to handle thousands of teachers and their students reliably, with enterprise-grade uptime.",
    accent: "teal",
    stats: "99.9% uptime SLA",
    details: ["Multi-tenant architecture", "Automated backups", "Global CDN delivery"],
  },
  {
    icon: Smartphone,
    title: "Mobile App",
    body: "Build native iOS and Android apps so teachers can manage lessons on the go and parents can check schedules from anywhere.",
    accent: "coral",
    stats: "iOS + Android",
    details: ["Push notifications", "Offline-first sync", "Biometric login"],
  },
  {
    icon: Sparkles,
    title: "AI Enhancement",
    body: "Expand LoopAssist with smarter scheduling suggestions, automated invoice generation, and predictive analytics for your teaching business.",
    accent: "violet",
    stats: "10× faster admin",
    details: ["Smart rescheduling", "Revenue forecasting", "Auto-draft emails"],
  },
];

const ACCENT_MAP: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  teal: {
    border: "border-[hsl(var(--teal)/0.3)]",
    bg: "bg-[hsl(var(--teal)/0.1)]",
    text: "text-[hsl(var(--teal))]",
    glow: "hsl(var(--teal))",
  },
  coral: {
    border: "border-[hsl(var(--coral)/0.3)]",
    bg: "bg-[hsl(var(--coral)/0.1)]",
    text: "text-[hsl(var(--coral))]",
    glow: "hsl(var(--coral))",
  },
  violet: {
    border: "border-[hsl(var(--violet)/0.3)]",
    bg: "bg-[hsl(var(--violet)/0.1)]",
    text: "text-[hsl(var(--violet))]",
    glow: "hsl(var(--violet))",
  },
};

export function WhyKickstarter() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }} />

      <div className="container mx-auto px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
            Where Your Money Goes
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Why Kickstarter?
          </h2>
          <p className="text-lg text-muted-foreground">
            The core platform is <strong className="text-foreground">already built and functional</strong>.
            Your backing funds the next phase — scaling infrastructure, launching mobile apps, and supercharging our AI assistant.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pillars.map((p, i) => {
            const a = ACCENT_MAP[p.accent];
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border ${a.border} bg-card p-7 flex flex-col overflow-hidden group hover:shadow-xl transition-shadow`}
              >
                {/* Glow */}
                <div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-3xl"
                  style={{ background: `radial-gradient(circle, ${a.glow} 0%, transparent 70%)` }}
                />

                <div className={`w-12 h-12 rounded-xl ${a.bg} flex items-center justify-center mb-5`}>
                  <p.icon className={`w-6 h-6 ${a.text}`} />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm mb-5 flex-1">{p.body}</p>

                {/* Stats pill */}
                <div className={`inline-flex items-center self-start px-3 py-1 rounded-full ${a.bg} ${a.text} text-xs font-bold mb-4`}>
                  {p.stats}
                </div>

                {/* Details */}
                <ul className="space-y-2">
                  {p.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${a.text} flex-shrink-0`} />
                      {d}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Inline link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            to="/features"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Explore all features <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
