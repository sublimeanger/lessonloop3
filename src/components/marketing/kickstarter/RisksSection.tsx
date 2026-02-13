import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Server, Brain } from "lucide-react";

const risks = [
  {
    icon: ShieldCheck,
    title: "Not Vaporware",
    body: "The core platform is already live and being used. This isn't a concept — it's a working product. Kickstarter funds go towards scaling, not building from scratch.",
    color: "text-teal",
    bg: "from-teal/20 to-teal/5",
  },
  {
    icon: AlertTriangle,
    title: "Third-Party APIs",
    body: "We rely on payment processors and email providers. If any change terms, we have fallback integrations planned. We'll never be locked into a single vendor.",
    color: "text-warning",
    bg: "from-warning/20 to-warning/5",
  },
  {
    icon: Server,
    title: "Infrastructure Scaling",
    body: "Growing from hundreds to thousands of users requires careful scaling. We've architected for this from day one with a multi-tenant, cloud-native approach.",
    color: "text-info",
    bg: "from-info/20 to-info/5",
  },
  {
    icon: Brain,
    title: "AI Accuracy",
    body: "LoopAssist uses a human-in-the-loop approach — every AI suggestion must be confirmed before it takes effect. You stay in control, always.",
    color: "text-coral",
    bg: "from-coral/20 to-coral/5",
  },
];

export function RisksSection() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Risks & Challenges
          </h2>
          <p className="text-lg text-muted-foreground">
            We believe in transparency. Here's what could go wrong and how we've planned for it.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {risks.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.bg} flex items-center justify-center mb-4`}>
                <r.icon className={`w-6 h-6 ${r.color}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{r.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{r.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
